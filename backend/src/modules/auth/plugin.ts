import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../db.js";
import { sessionCookie, verifySession } from "./session.js";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: "user" | "admin";
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (req) => {
    const token = req.cookies?.[sessionCookie.name];
    const payload = token ? verifySession(token) : null;
    if (!payload) {
      req.user = null;
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, status: true },
    });
    req.user =
      dbUser && dbUser.status === "approved"
        ? { userId: dbUser.id, email: dbUser.email, role: dbUser.role }
        : null;
  });
});

export function requireUser(req: FastifyRequest, reply: FastifyReply): AuthenticatedUser | null {
  if (!req.user) {
    reply.code(401).send({ error: "unauthenticated", message: "Sign in required." });
    return null;
  }
  return req.user;
}

export function requireAdmin(req: FastifyRequest, reply: FastifyReply): AuthenticatedUser | null {
  const user = requireUser(req, reply);
  if (!user) return null;
  if (user.role !== "admin") {
    reply.code(403).send({ error: "forbidden", message: "Admin access required." });
    return null;
  }
  return user;
}
