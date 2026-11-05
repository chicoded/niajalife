import { Server } from "colyseus";
import { createServer, type IncomingMessage, type ServerResponse, type Server as HttpServer } from "node:http";
import { ROOM_NAME } from "@naijaverse/shared";
import { DistrictRoom } from "./rooms/DistrictRoom";
import { config } from "./config";

export interface GameServerHandle {
  /** The Colyseus instance (matchmaking + rooms). */
  server: Server;
  /** The underlying Node HTTP server. */
  httpServer: HttpServer;
  /** Starts listening and resolves with the bound port. */
  listen(port?: number): Promise<number>;
  /** Stops accepting new clients and waits for rooms to close. */
  shutdown(): Promise<void>;
}

/**
 * Creates the NaijaVerse game server without starting it, so tests can boot a
 * throwaway instance on their own port.
 */
export function createGameServer(): GameServerHandle {
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    // A tiny health probe: useful for hosting platforms and uptime checks.
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "naijaverse-game-server",
          protocol: 1,
          ts: Date.now(),
        }),
      );
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  const server = new Server({ server: httpServer });

  // One room type per district. Rooms carrying the same `districtId` in their
  // join options are matched together, so everyone in a district shares a room.
  server.define(ROOM_NAME, DistrictRoom).filterBy(["districtId"]);

  return {
    server,
    httpServer,
    async listen(port = config.port) {
      await server.listen(port);
      return port;
    },
    async shutdown() {
      try {
        await server.gracefullyShutdown(false);
      } finally {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    },
  };
}
