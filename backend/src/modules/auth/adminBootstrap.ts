import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { hashPassword } from "./password.js";

export async function bootstrapAdmin(): Promise<void> {
  if (!env.adminEmail || !env.adminPassword) return;

  const email = env.adminEmail.trim().toLowerCase();
  const passwordHash = await hashPassword(env.adminPassword);
  const displayName = env.adminName || null;

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, displayName, role: "admin", status: "approved" },
    create: { email, passwordHash, displayName, role: "admin", status: "approved" },
  });
}
