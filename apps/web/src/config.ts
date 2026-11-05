/** Runtime configuration, injected by Vite at build time. */

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/** WebSocket endpoint of the Colyseus game server. */
export const GAME_SERVER_URL = str(import.meta.env.VITE_GAME_SERVER_URL, "ws://localhost:2567");
