import jwt from "jsonwebtoken";
import { env } from "../../env.js";

export interface SessionPayload {
  userId: string;
  email: string;
}

const COOKIE_NAME = "flashcards_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.sessionSecret, { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, env.sessionSecret) as SessionPayload;
  } catch {
    return null;
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    signed: false,
  },
};
