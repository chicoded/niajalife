# Multiplayer & Authority

How NaijaVerse keeps a shared world honest. This describes what is built in
Milestone 01.

## The one rule

> The client sends **intent**. The server decides **truth**.

The browser never sends a position, a speed, a chat rate or an interaction result.
It asks, and the server answers. Anything else can be edited in devtools.

## Transport

Colyseus over WebSocket. Two kinds of data travel over it:

- **Continuous state** — player positions, rotation, name and appearance. These are
  `@colyseus/schema` fields, patched to every client on a fixed `50 ms` patch rate
  (`WORLD.tickMs`).
- **Discrete events** — chat messages and building responses. These are plain messages
  (`room.send` / `room.onMessage`) named by the constants in `packages/shared/src/protocol.ts`.

The server runs the simulation on its own `50 ms` interval (`setSimulationInterval`),
independent of how fast any client renders.

## Movement

1. The client samples its keyboard or thumbstick into a camera-relative direction and
   clamps it to `MOVEMENT.maxInput` (1).
2. It sends `{ seq, mx, mz, ry, sprint }` roughly 20 times per second — **including zeros**.
   Stopping the sender would leave the server applying the last non-zero intent.
3. The server:
   - rejects any packet whose `seq` is not greater than the last one it accepted
     (replays and reordered packets die here),
   - rejects implausible sequence jumps,
   - clamps `mx` and `mz` to `[-1, 1]`,
   - integrates `direction × speed × dt`, where `speed` is `MOVEMENT.speed`
     (and `× sprintMultiplier` when sprinting),
   - clamps the result inside the world bounds,
   - pushes the result out of any building footprint via the shared
     `resolveBuildingCollisions` helper,
   - replicates the confirmed position.

Because the speed and the clamps live on the server, a modified client that sends
`mx: 999` moves exactly as fast as everyone else. The acceptance test asserts this.

### Client-side prediction

Waiting a full round trip before your own character moves feels awful on a slow
connection, so the client predicts: it runs the *same* intent through the *same*
shared collision helper and draws the result immediately. When the server's confirmed
position arrives, the client compares it with its prediction and snaps only if the two
have drifted apart by more than **3 metres**. Prediction order-of-operations and
collision logic are shared code (`packages/shared/src/world.ts`), so the two cannot
silently disagree about where a wall is.

## Chat

The server strips control characters, trims, caps the text at `CHAT.maxLength` (200)
and ignores messages sent within `CHAT.rateLimitMs` (700 ms) of a player's last one.
The client's `maxLength` attribute is a convenience, not the enforcement.

## Building interactions

A client cannot interact with a building from across the map. The server recomputes
`distanceToBuilding` for the player's authoritative position and rejects the request
when it exceeds `INTERACTION_RADIUS` (6 m), replying with an `error` event. Only the
barber (salon) and boutique, matching a valid option in the shared `HAIRSTYLES` /
`OUTFITS` lists, change a player's appearance — and the server applies that change,
then broadcasts it.

## Reconnection

`autoDispose` is `false`, so a district room outlives its players. When a client drops
without leaving, the server calls `allowReconnection(client, 15)`: the character stays
in the world, frozen and marked `connected = false`, for a 15-second window. If the
client returns in time it reclaims its exact character (its movement sequence is reset
so the guard does not reject the first packet); if not, the character is removed and
everyone is told.

## What the browser is allowed to know

The client imports types, world data and the protocol from `packages/shared` — never
server code. It reads replicated state through small local interfaces in `GameClient.ts`
so it does not depend on the server's schema classes. The Supabase service-role key is
never sent to the browser; only `VITE_*` variables are ever bundled.
