import { Room, Client } from "colyseus";
import {
  CHAT,
  HAIRSTYLES,
  INTERACTION_RADIUS,
  MOVEMENT,
  MSG,
  OUTFITS,
  PLAYER_RADIUS,
  WORLD,
  distanceToBuilding,
  getDistrict,
  getDistrictLayout,
  resolveBuildingCollisions,
  sanitizeAppearance,
  type AppearanceUpdate,
  type Building,
  type BuildingEvent,
  type ChatReceivePayload,
  type ChatSendPayload,
  type DistrictId,
  type DistrictLayout,
  type JoinOptions,
  type MoveInput,
  type SpawnPoint,
} from "@naijaverse/shared";
import { DistrictState, PlayerState } from "../schema/DistrictState";

export interface DistrictRoomOptions {
  districtId?: DistrictId;
  /** Seconds a disconnected player may reclaim their character. 0 disables it. */
  reconnectSeconds?: number;
  maxClients?: number;
}

/**
 * The authoritative simulation for one Lagos district.
 *
 * The client never sends a position. It sends intent (`MoveInput`); the server
 * integrates that intent, clamps it, resolves collisions and replicates the
 * result. Editing the browser JS therefore cannot teleport a character or make
 * it faster — see `docs/MULTIPLAYER.md`.
 */
export class DistrictRoom extends Room<DistrictState> {
  private layout: DistrictLayout = getDistrictLayout("yaba");
  private reconnectSeconds = 15;
  private spawnCounter = 0;

  override onCreate(options: DistrictRoomOptions = {}) {
    this.setState(new DistrictState());

    const districtId = (options.districtId ?? "yaba") as DistrictId;
    this.state.districtId = getDistrict(districtId)?.id ?? "yaba";
    this.layout = getDistrictLayout(this.state.districtId as DistrictId);

    this.reconnectSeconds = clampNumber(options.reconnectSeconds, 0, 300, 15);
    this.maxClients = clampNumber(options.maxClients, 1, 40, 20);
    // Districts are persistent; a room is not thrown away when the last player leaves.
    this.autoDispose = false;
    this.setPatchRate(WORLD.tickMs);

    this.onMessage(MSG.MOVE, (client, payload) => this.handleMove(client, payload));
    this.onMessage(MSG.CHAT, (client, payload) => this.handleChat(client, payload));
    this.onMessage(MSG.BUILDING, (client, payload) => this.handleBuilding(client, payload));

    this.setSimulationInterval((dt) => this.simulate(dt), WORLD.tickMs);

    console.log(
      `[district] room ready — district="${this.state.districtId}" name="${this.roomName}" ` +
        `mode=${this.roomId}`,
    );
  }

  override onJoin(client: Client, options: JoinOptions) {
    const appearance = sanitizeAppearance(options?.appearance);

    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = appearance.name;
    player.gender = appearance.gender;
    player.skinTone = appearance.skinTone;
    player.hairstyle = appearance.hairstyle;
    player.outfit = appearance.outfit;
    player.trait = appearance.trait;
    player.joinedAt = Date.now();

    const spawn = this.nextSpawn();
    player.x = spawn.x;
    player.z = spawn.z;
    player.rotY = spawn.rotY;

    this.state.players.set(client.sessionId, player);

    this.broadcastSystem(`${player.name} entered ${this.districtName()}.`);
    client.send(
      MSG.CHAT_EVENT,
      systemMessage(
        `Welcome to ${this.districtName()}, ${player.name}. ` +
          `WASD to move, Shift to sprint, Enter to chat, E to interact.`,
      ),
    );
    console.log(`[district] ${player.name} (${client.sessionId}) joined — ${this.state.players.size} online`);
  }

  override async onLeave(client: Client, consented?: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.connected = false;

    // A deliberate exit (room.leave()) removes the character immediately.
    if (consented) {
      this.state.players.delete(client.sessionId);
      this.broadcastSystem(`${player.name} left the city.`);
      return;
    }

    // An abrupt drop (refresh, lost signal) holds the slot for a while.
    try {
      await this.allowReconnection(client, this.reconnectSeconds);
      player.connected = true;
      player.lastSeq = -1;
      player.inputX = 0;
      player.inputZ = 0;
      this.broadcastSystem(`${player.name} reconnected.`);
    } catch {
      this.state.players.delete(client.sessionId);
      this.broadcastSystem(`${player.name} dropped out of the city.`);
    }
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  private simulate(dtMs: number) {
    // Guard against a stalled event loop producing a huge step.
    const dt = Math.min(dtMs, 120) / 1000;

    this.state.serverTime = Date.now();
    this.state.tickCount++;

    this.state.players.forEach((player) => {
      if (!player.connected) return;
      if (player.inputX === 0 && player.inputZ === 0) return;

      let ix = player.inputX;
      let iz = player.inputZ;
      const len = Math.hypot(ix, iz);
      if (len > MOVEMENT.maxInput) {
        ix = (ix / len) * MOVEMENT.maxInput;
        iz = (iz / len) * MOVEMENT.maxInput;
      }

      const speed = MOVEMENT.speed * (player.sprint ? MOVEMENT.sprintMultiplier : 1);
      const nx = clamp(player.x + ix * speed * dt, -WORLD.bounds, WORLD.bounds);
      const nz = clamp(player.z + iz * speed * dt, -WORLD.bounds, WORLD.bounds);

      const resolved = this.resolveCollisions(nx, nz);
      player.x = resolved.x;
      player.z = resolved.z;
    });
  }

  /** Pushes a position out of any building footprint it has entered. */
  private resolveCollisions(x: number, z: number): { x: number; z: number } {
    return resolveBuildingCollisions(this.layout.buildings, x, z, PLAYER_RADIUS);
  }

  private nextSpawn(): SpawnPoint {
    const base = this.layout.spawn;
    const n = this.spawnCounter++;
    // Golden-angle spiral keeps arrivals from stacking on one another.
    const angle = n * 2.399963;
    const radius = n === 0 ? 0 : 2 + (n % 4) * 1.5;
    return {
      x: clamp(base.x + Math.cos(angle) * radius, -WORLD.bounds, WORLD.bounds),
      z: clamp(base.z + Math.sin(angle) * radius, -WORLD.bounds, WORLD.bounds),
      rotY: base.rotY,
    };
  }

  // -------------------------------------------------------------------------
  // Client messages
  // -------------------------------------------------------------------------

  private handleMove(client: Client, payload: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.connected) return;

    const data = payload as Partial<MoveInput> | null;
    if (!data || typeof data !== "object") return;

    const seq = Number(data.seq);
    if (!Number.isFinite(seq)) return;
    // Drop replayed or out-of-order packets, and implausible sequence jumps.
    if (seq <= player.lastSeq) return;
    if (seq - player.lastSeq > 2000) return;
    player.lastSeq = seq;

    // Clamp to a unit vector. This is what defeats "just send mx: 999".
    player.inputX = clampNumber(data.mx, -1, 1, 0);
    player.inputZ = clampNumber(data.mz, -1, 1, 0);
    player.sprint = data.sprint === true;

    const ry = Number(data.ry);
    if (Number.isFinite(ry)) player.rotY = ry;
  }

  private handleChat(client: Client, payload: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.connected) return;

    const data = payload as Partial<ChatSendPayload> | null;
    const raw = typeof data?.text === "string" ? data.text : "";
    const text = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, CHAT.maxLength);
    if (!text) return;

    const now = Date.now();
    if (now - player.lastChatAt < CHAT.rateLimitMs) return;
    player.lastChatAt = now;

    const message: ChatReceivePayload = {
      id: player.id,
      name: player.name,
      text,
      ts: now,
    };
    this.broadcast(MSG.CHAT_EVENT, message);
  }

  private handleBuilding(client: Client, payload: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.connected) return;

    const data = payload as { buildingId?: unknown; action?: unknown; value?: unknown } | null;
    const buildingId = typeof data?.buildingId === "string" ? data.buildingId : "";
    const building = this.layout.buildings.find((b) => b.id === buildingId);
    if (!building) return;

    // Server-authoritative proximity: interacting from across the map is rejected.
    if (distanceToBuilding(building, player.x, player.z) > INTERACTION_RADIUS) {
      this.sendBuildingEvent(client, {
        buildingId: building.id,
        name: building.name,
        action: "error",
        message: `You are too far from ${building.name}. Walk closer.`,
      });
      return;
    }

    const action = typeof data?.action === "string" ? data.action : "";
    const value = typeof data?.value === "string" ? data.value : "";

    const styling = this.applyStyling(building, action, value);
    if (styling) {
      if ("hairstyle" in styling) player.hairstyle = styling.hairstyle!;
      if ("outfit" in styling) player.outfit = styling.outfit!;
      const message =
        "hairstyle" in styling
          ? `Fresh cut! You are now rocking: ${labelOf(HAIRSTYLES, player.hairstyle)}.`
          : `New fit! You are now wearing: ${labelOf(OUTFITS, player.outfit)}.`;
      this.sendBuildingEvent(client, {
        buildingId: building.id,
        name: building.name,
        action,
        message,
        appearance: styling,
      });
      this.broadcastSystem(`${player.name} changed their look at ${building.name}.`);
      return;
    }

    // Default interaction: a real, informative description of the venue.
    this.sendBuildingEvent(client, {
      buildingId: building.id,
      name: building.name,
      action: "info",
      message: building.blurb,
    });
  }

  private applyStyling(b: Building, action: string, value: string): AppearanceUpdate | null {
    if (b.interaction === "salon" && action === "hairstyle" && HAIRSTYLES.some((h) => h.id === value)) {
      return { hairstyle: value };
    }
    if (b.interaction === "boutique" && action === "outfit" && OUTFITS.some((o) => o.id === value)) {
      return { outfit: value };
    }
    return null;
  }

  private sendBuildingEvent(client: Client, event: BuildingEvent) {
    client.send(MSG.BUILDING_EVENT, event);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private districtName(): string {
    return getDistrict(this.state.districtId)?.name ?? "Lagos";
  }

  private broadcastSystem(text: string) {
    this.broadcast(MSG.CHAT_EVENT, systemMessage(text));
  }
}

function systemMessage(text: string): ChatReceivePayload {
  return { id: "system", name: "City", text, ts: Date.now(), system: true };
}

function labelOf(list: { id: string; label: string }[], id: string): string {
  return list.find((item) => item.id === id)?.label ?? id;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}
