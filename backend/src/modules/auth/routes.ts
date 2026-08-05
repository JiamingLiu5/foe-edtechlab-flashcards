import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { hashPassword, verifyPassword } from "./password.js";
import { signSession, sessionCookie } from "./session.js";

const MIN_PASSWORD_LENGTH = 8;

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
  app.post<{ Body: { email: string; password: string; role?: "student" | "teacher" } }>("/api/auth/signup", async (req, reply) => {
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password ?? "";
    const role = req.body?.role ?? "student";

    if (!email || !isAllowedEmail(email)) {
      return reply.code(400).send({
        error: "invalid_email",
        message: `Sign-up is restricted to ${env.allowedEmailDomains.map((d) => "@" + d).join(" / ")} addresses.`,
      });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return reply.code(400).send({
        error: "weak_password",
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }
    if (role !== "student" && role !== "teacher") {
      return reply.code(400).send({ error: "invalid_role", message: "Choose either a student or teacher account." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "email_taken", message: "An account with this email already exists." });
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.create({ data: { email, passwordHash, role, status: "pending" } });

    return reply.send({
      pending: true,
      message: "Registration submitted. An admin needs to approve your account before you can sign in.",
    });
  });

  app.post<{ Body: { email: string; password: string } }>("/api/auth/login", async (req, reply) => {
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password ?? "";

    const invalidCredentials = () =>
      reply.code(401).send({ error: "invalid_credentials", message: "Incorrect email or password." });

    if (!email || !password) {
      return invalidCredentials();
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return invalidCredentials();
    }

    if (user.status === "pending") {
      return reply
        .code(403)
        .send({ error: "pending_approval", message: "Your account is awaiting admin approval." });
    }
    if (user.status === "rejected") {
      return reply
        .code(403)
        .send({ error: "account_rejected", message: "Your registration was not approved." });
    }
    if (user.status === "deactivated") {
      return reply
        .code(403)
        .send({ error: "account_deactivated", message: "This account has been deactivated." });
    }

    const session = signSession({ userId: user.id, email: user.email });
    reply.setCookie(sessionCookie.name, session, sessionCookie.options);

    return reply.send({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, status: user.status },
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
      create: { email: env.testLoginEmail, passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")), role: "student" },
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
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      return reply.code(401).send({ error: "unauthenticated", message: "Not signed in." });
    }
    return reply.send({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, status: user.status },
    });
  });
}
