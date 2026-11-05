import { createGameServer } from "./server";
import { config } from "./config";

const handle = createGameServer();

handle
  .listen(config.port)
  .then((port) => {
    console.log(`NaijaVerse game server listening on ws://localhost:${port}`);
    console.log(`Allowed client origins: ${config.origins.join(", ")}`);
    console.log(`Health check: http://localhost:${port}/health`);
  })
  .catch((error) => {
    console.error("Failed to start game server:", error);
    process.exit(1);
  });

async function stop(signal: string) {
  console.log(`\nReceived ${signal}, shutting down...`);
  await handle.shutdown();
  process.exit(0);
}

process.on("SIGINT", () => void stop("SIGINT"));
process.on("SIGTERM", () => void stop("SIGTERM"));
