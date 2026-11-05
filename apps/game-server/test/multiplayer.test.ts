/**
 * Milestone 01 acceptance test: two real clients, one authoritative server.
 *
 * This is the proof the architecture doc asks for — it does NOT mock the
 * network. Two `colyseus.js` clients connect over a real WebSocket to a real
 * Colyseus room and we assert on what each client actually sees.
 *
 * Run with:  npm --workspace @naijaverse/game-server run test
 */
import { Client, type Room } from "colyseus.js";
import { DEFAULT_APPEARANCE, MOVEMENT, ROOM_NAME } from "@naijaverse/shared";
import { createGameServer } from "../src/server";

const PORT = 2757;
const URL = `ws://127.0.0.1:${PORT}`;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `  ::  ${detail}` : ""}`);
  }
}

interface PlayerView {
  id: string;
  name: string;
  x: number;
  z: number;
  rotY: number;
  hairstyle: string;
  outfit: string;
  connected: boolean;
}

function players(room: Room): Map<string, PlayerView> {
  return (room.state as unknown as { players: Map<string, PlayerView> }).players;
}

function view(room: Room, id: string): PlayerView | undefined {
  return players(room).get(id);
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000, intervalMs = 25): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(intervalMs);
  }
  return predicate();
}

// A single monotonic sequence counter shared by every simulated packet, because
// the server rejects out-of-order or replayed sequence numbers.
let seq = 0;

function holdInput(room: Room, mx: number, mz: number, sprint = false) {
  const timer = setInterval(() => {
    room.send("move", { seq: seq++, mx, mz, ry: 0, sprint });
  }, 50);
  return {
    async release() {
      clearInterval(timer);
      room.send("move", { seq: seq++, mx: 0, mz: 0, ry: 0, sprint: false });
      await sleep(150);
    },
  };
}

async function main() {
  const handle = createGameServer();
  await handle.listen(PORT);

  console.log(`\nNaijaVerse — multiplayer acceptance test`);
  console.log(`server: ${URL}\n`);

  const clientA = new Client(URL);
  const clientB = new Client(URL);

  const roomA = await clientA.joinOrCreate<PlayerView>(ROOM_NAME, {
    districtId: "yaba",
    reconnectSeconds: 1,
    maxClients: 20,
    appearance: { ...DEFAULT_APPEARANCE, name: "Ada", hairstyle: "braids", outfit: "ankara" },
  });

  const roomB = await clientB.joinOrCreate<PlayerView>(ROOM_NAME, {
    districtId: "yaba",
    appearance: { ...DEFAULT_APPEARANCE, name: "Bode", hairstyle: "fade", outfit: "streetwear" },
  });

  // 1. Both players can enter the same room and see each other.
  const bothJoined = await waitFor(() => players(roomA).size === 2 && players(roomB).size === 2);
  check(
    "two clients join the same district room and see each other",
    bothJoined,
    `A sees ${players(roomA).size}, B sees ${players(roomB).size}`,
  );

  check(
    "player names are replicated",
    view(roomB, roomA.sessionId)?.name === "Ada" && view(roomA, roomB.sessionId)?.name === "Bode",
    `A sees "${view(roomA, roomB.sessionId)?.name}", B sees "${view(roomB, roomA.sessionId)?.name}"`,
  );

  check(
    "character appearance is replicated",
    view(roomB, roomA.sessionId)?.hairstyle === "braids",
    `B sees A's hairstyle as "${view(roomB, roomA.sessionId)?.hairstyle}"`,
  );

  // 2. Movement is synchronised.
  const startX = view(roomB, roomA.sessionId)?.x ?? 0;
  const walking = holdInput(roomA, 1, 0);
  await sleep(900);
  await walking.release();
  await sleep(250);
  const movedX = (view(roomB, roomA.sessionId)?.x ?? 0) - startX;
  check("Player A's movement is visible to Player B", movedX > 2, `B observed dx = ${movedX.toFixed(2)}m`);

  // 3. Chat reaches the other player.
  const inbox: string[] = [];
  roomB.onMessage("chat", (msg: { text: string }) => inbox.push(msg.text));
  roomA.send("chat", { text: "How far, Bode?" });
  const gotChat = await waitFor(() => inbox.includes("How far, Bode?"), 1500);
  check("chat messages reach the other player", gotChat, `B received ${JSON.stringify(inbox)}`);

  // 4. A far-away building interaction is rejected (server-side proximity check).
  const buildingEvents: { action: string }[] = [];
  roomB.onMessage("building_event", (event: { action: string }) => buildingEvents.push(event));
  roomB.send("building", { buildingId: "national-theatre" });
  const rejected = await waitFor(() => buildingEvents.some((e) => e.action === "error"), 1500);
  check("interacting with a distant building is rejected by the server", rejected);

  // 5. Absurd input cannot produce a speedhack or a teleport.
  const beforeHack = view(roomB, roomA.sessionId)?.x ?? 0;
  const hacked = holdInput(roomA, 999, 0);
  await sleep(1000);
  await hacked.release();
  await sleep(250);
  const hackedDistance = (view(roomB, roomA.sessionId)?.x ?? 0) - beforeHack;
  const ceiling = MOVEMENT.speed * MOVEMENT.sprintMultiplier * 1.3 + 1;
  check(
    "server clamps hacked movement input (no teleport / speedhack)",
    hackedDistance > 1 && hackedDistance <= ceiling,
    `moved ${hackedDistance.toFixed(2)}m, ceiling ${ceiling.toFixed(2)}m`,
  );

  // 6. A deliberate leave removes the character from the shared world.
  roomA.leave();
  const shrunk = await waitFor(() => players(roomB).size === 1, 2500);
  check("leaving removes the character from the shared world", shrunk, `B sees ${players(roomB).size}`);

  await roomB.leave();
  await handle.shutdown();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nTest crashed:", error);
  process.exit(1);
});
