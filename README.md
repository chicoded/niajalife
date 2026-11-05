# NaijaVerse

A persistent, browser-first, multiplayer Nigerian life-simulation game.

This repository currently contains **Milestone 01 — The Multiplayer Vertical Slice**.
Its only job is to prove that the shared world actually works: real players, real
networking, real server authority. Jobs, money, businesses, elections and vehicles
are deliberately **not** here yet.

---

## What works today

- **Landing screen** with register / sign in (accounts are stored on the device for
  this milestone).
- **Character creation** — name, gender, skin tone, hairstyle, outfit and trait, with a
  live rotating 3D preview. The look you choose is what other players see.
- **A real 3D Yaba** rendered with Babylon.js: 16 named buildings, roads with kerbs and
  markings, danfo buses, market stalls, trees and streetlights.
- **Third-person movement** with a follow camera. `WASD` / arrow keys on desktop, a
  thumbstick on touch devices, `Shift` to sprint.
- **Server-authoritative multiplayer** over Colyseus WebSockets. The browser sends
  *intent*; the server integrates, clamps, resolves collisions and replicates the result.
- **Other real players** visible with floating name tags, interpolated between server
  updates.
- **Text chat**, **building interactions** (barber changes hair, boutique changes outfit,
  every other venue returns a real description), **quality settings**, and
  **reconnection** (a dropped client holds its character for 15 seconds).

## What is deliberately not built yet

Honest list, so nothing is mistaken for a placeholder that works:

- No jobs, money, banking, businesses, elections or vehicles.
- Ikeja, Surulere, Mushin, Lekki and Victoria Island are listed but not playable.
- **No database yet.** The Colyseus server holds everything in memory; the Supabase
  schema and RLS policies arrive in the persistence phase.
- No voice chat, crews or relationships.

---

## Requirements

- **Node.js 20 or newer**
- npm 10+ (npm workspaces are used)

## Getting started

```bash
npm install
cp .env.example .env     # optional — the defaults work as-is
npm run dev
```

Then open **http://localhost:5173**.

`npm run dev` starts both processes:

| Process     | URL                          | Purpose                          |
| ----------- | ---------------------------- | -------------------------------- |
| Game server | `ws://localhost:2567`        | Authoritative simulation         |
| Web client  | `http://localhost:5173`      | The game itself (Vite dev server)|

The server also exposes a health probe at **http://localhost:2567/health**.

### Playing with two players

Open a second browser tab (or a different browser), register a second account and sign
in. Both characters appear in the same district, move together and can chat. Your local
character is drawn immediately (client-side prediction) and corrected if the server
disagrees.

---

## Scripts

| Command             | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Run the game server and the web client together.                    |
| `npm run dev:server`| Run only the Colyseus server (`tsx watch`).                         |
| `npm run dev:web`   | Run only the Vite dev server.                                       |
| `npm run typecheck` | Type-check every workspace.                                         |
| `npm run build`     | Production build of the server and the web client.                  |
| `npm test`          | Run the two-client multiplayer acceptance test.                     |
| `npm start`         | Start the built game server.                                        |

The acceptance test boots a real Colyseus server on port `2757`, connects two real
clients over a real WebSocket, and asserts on what each client actually observes —
including that a hacked movement payload cannot teleport or speed up a character.

---

## Environment variables

Copy `.env.example` to `.env`. Every value has a working default, so the game runs
with no `.env` at all.

| Variable                    | Scope       | Default                     | Notes                                                    |
| --------------------------- | ----------- | --------------------------- | -------------------------------------------------------- |
| `GAME_SERVER_PORT`          | server      | `2567`                      | Port the Colyseus server listens on.                     |
| `CLIENT_ORIGIN`             | server      | `http://localhost:5173,…`   | Comma-separated allowed browser origins.                 |
| `VITE_GAME_SERVER_URL`      | browser     | `ws://localhost:2567`       | Where the client connects.                               |
| `API_PORT`                  | server      | `4000`                      | Reserved for the API service (later milestone).          |
| `SUPABASE_URL`              | server      | —                           | Supabase project URL.                                    |
| `SUPABASE_ANON_KEY`         | server      | —                           | Public key.                                              |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | —                       | **Never** expose this to the browser.                    |
| `VITE_SUPABASE_URL`         | browser     | —                           | Safe to expose.                                          |
| `VITE_SUPABASE_ANON_KEY`    | browser     | —                           | Safe to expose.                                          |

> **Security:** the service-role key bypasses Row Level Security. It must stay on the
> server. Only `VITE_*` variables are ever bundled into the browser build.

Supabase is **optional for Milestone 01**. Without it, accounts and characters are kept
in the browser's `localStorage` (passwords are hashed with WebCrypto, never stored in
plain text). This is a convenience for the vertical slice, not a final auth system —
Supabase Auth with Row Level Security replaces it, and the local `Account` shape already
mirrors the columns those tables will have.

---

## Repository layout

```
naijaverse/
├── apps/
│   ├── web/            # Babylon.js + React client (the game)
│   └── game-server/    # Colyseus authoritative server
├── packages/
│   └── shared/         # Types, world data and the network protocol
├── database/           # SQL migrations (added in the persistence phase)
├── docs/               # Architecture and protocol notes
└── .env.example
```

### Why a shared package

`packages/shared` is the single source of truth for the character options, the Yaba
world layout, the collision helper and the message names. Both the client and the server
import it, so they **cannot drift apart** — a building added once exists in both, and a
message renamed once is renamed on both sides.

### Why server authority matters

The client never sends a position. It sends `{ seq, mx, mz, ry, sprint }` and the server:

1. discards replayed or out-of-order packets (the `seq` guard),
2. clamps the input to a unit vector,
3. integrates it with the real speed on the real tick,
4. pushes the result out of any building it entered,
5. replicates the confirmed position.

Editing the browser JavaScript therefore cannot teleport a character, make it faster, or
let it walk through walls. The same two rules guard chat (length + rate limit) and
building interactions (the server re-checks your distance before acting).

---

## Tech stack

Babylon.js · React · TypeScript · Vite · Node.js · Colyseus · (Supabase + PostgreSQL
arriving in the persistence phase).
