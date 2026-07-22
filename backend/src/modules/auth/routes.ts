import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { sendMagicLinkEmail } from "./mailer.js";
import { signSession, sessionCookie } from "./session.js";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

function isAllowedEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && env.allowedEmailDomains.includes(domain);
}

function matchesSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { email: string } }>("/api/auth/magic-link", async (req, reply) => {
    const email = req.body?.email?.trim().toLowerCase();
    if (!email || !isAllowedEmail(email)) {
      return reply.code(400).send({
        error: "invalid_email",
        message: `Sign-in is restricted to ${env.allowedEmailDomains.map((d) => "@" + d).join(" / ")} addresses.`,
      });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.magicLink.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
      },
    });

    const link = `${env.appOrigin}/#/auth/verify?token=${token}`;
    await sendMagicLinkEmail(email, link);

    return reply.send({ ok: true });
  });

  app.get<{ Querystring: { token: string } }>("/api/auth/verify", async (req, reply) => {
    const { token } = req.query;
    if (!token) {
      return reply.code(400).send({ error: "missing_token", message: "Missing token." });
    }

    const magicLink = await prisma.magicLink.findUnique({ where: { token }, include: { user: true } });
    if (!magicLink || magicLink.usedAt || magicLink.expiresAt < new Date()) {
      return reply.code(400).send({ error: "invalid_token", message: "This link is invalid or has expired." });
    }

    await prisma.magicLink.update({ where: { id: magicLink.id }, data: { usedAt: new Date() } });

    const session = signSession({ userId: magicLink.user.id, email: magicLink.user.email });
    reply.setCookie(sessionCookie.name, session, sessionCookie.options);

    return reply.send({
      user: { id: magicLink.user.id, email: magicLink.user.email, displayName: magicLink.user.displayName },
    });
  });

  app.get<{ Querystring: { secret?: string } }>("/api/auth/dev-login", async (req, reply) => {
    if (!env.testLoginSecret || !env.testLoginEmail) {
      return reply.code(404).send();
    }

    const provided = req.query.secret ?? "";
    if (!matchesSecret(provided, env.testLoginSecret)) {
      return reply.code(404).send();
    }

    const user = await prisma.user.upsert({
      where: { email: env.testLoginEmail },
      update: {},
      create: { email: env.testLoginEmail },
    });

    const session = signSession({ userId: user.id, email: user.email });
    reply.setCookie(sessionCookie.name, session, sessionCookie.options);

    return reply.redirect(`${env.appOrigin}/`);
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie(sessionCookie.name, { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: "unauthenticated", message: "Not signed in." });
    }
    return reply.send({ user: { id: req.user.userId, email: req.user.email, displayName: null } });
  });
}
