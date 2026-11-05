import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Load the repo-root .env no matter which workspace directory we are launched from.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) loadEnv({ path: rootEnv });
loadEnv();

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export const config = {
  port: num(process.env.GAME_SERVER_PORT, 2567),
  /**
   * Allowed browser origins. The dev server also accepts the Vite preview port.
   * Entries are matched with a simple prefix check in `server.ts`.
   */
  origins: list(process.env.CLIENT_ORIGIN, [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]),
} as const;
