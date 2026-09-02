import { gameApp } from "./apps/game";
import { logger } from "./lib/logger";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("Invalid game service port.");
}

const server = gameApp.listen(port, "0.0.0.0", () => {
  logger.info("game-service", "Game service is ready");
});

function shutdown(signal: string): void {
  logger.info("game-service", "Game service shutdown requested", { signal });
  server.close((error) => {
    if (error) {
      logger.error("game-service", "Game service shutdown failed", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
