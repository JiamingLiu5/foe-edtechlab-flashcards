import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sessionCookie, verifySession, type SessionPayload } from "./session.js";

declare module "fastify" {
  interface FastifyRequest {
    user: SessionPayload | null;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (req) => {
    const token = req.cookies?.[sessionCookie.name];
    req.user = token ? verifySession(token) : null;
  });
});

export function requireUser(req: FastifyRequest, reply: FastifyReply): SessionPayload | null {
  if (!req.user) {
    reply.code(401).send({ error: "unauthenticated", message: "Sign in required." });
    return null;
  }
  return req.user;
}
