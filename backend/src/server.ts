import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./env.js";
import { authPlugin } from "./modules/auth/plugin.js";
import { authRoutes } from "./modules/auth/routes.js";
import { deckRoutes } from "./modules/decks/routes.js";
import { cardRoutes } from "./modules/cards/routes.js";
import { generationRoutes } from "./modules/generation/routes.js";
import { studyRoutes } from "./modules/study/routes.js";
import { selfCheckRoutes } from "./modules/selfCheck/routes.js";
import { exportRoutes } from "./modules/export/routes.js";

const app = Fastify({
  logger: env.nodeEnv === "development" ? { transport: { target: "pino-pretty" } } : true,
});

await app.register(cors, { origin: env.appOrigin, credentials: true });
await app.register(cookie);
await app.register(multipart, { limits: { fileSize: env.maxUploadBytes } });
await app.register(authPlugin);

app.get("/api/health", async () => ({ ok: true }));

await app.register(authRoutes);
await app.register(deckRoutes);
await app.register(cardRoutes);
await app.register(generationRoutes);
await app.register(studyRoutes);
await app.register(selfCheckRoutes);
await app.register(exportRoutes);

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
