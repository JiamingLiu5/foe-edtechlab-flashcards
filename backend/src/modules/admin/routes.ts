import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { requireAdmin } from "../auth/plugin.js";
import type { AdminUserDTO } from "@flashcards/shared";

function toAdminUserDTO(user: {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  createdAt: Date;
}): AdminUserDTO {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role as AdminUserDTO["role"],
    status: user.status as AdminUserDTO["status"],
    createdAt: user.createdAt.toISOString(),
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/api/admin/users", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;

    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    return reply.send({ users: users.map(toAdminUserDTO) });
  });

  app.post<{ Params: { id: string } }>("/api/admin/users/:id/approve", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "approved" },
    });
    return reply.send({ user: toAdminUserDTO(user) });
  });

  app.post<{ Params: { id: string } }>("/api/admin/users/:id/reject", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "rejected" },
    });
    return reply.send({ user: toAdminUserDTO(user) });
  });

  app.post<{ Params: { id: string } }>("/api/admin/users/:id/deactivate", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    if (req.params.id === admin.userId) {
      return reply.code(400).send({ error: "cannot_self_deactivate", message: "You can't deactivate your own account." });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "deactivated" },
    });
    return reply.send({ user: toAdminUserDTO(user) });
  });

  app.post<{ Params: { id: string } }>("/api/admin/users/:id/reactivate", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "approved" },
    });
    return reply.send({ user: toAdminUserDTO(user) });
  });

  app.post<{ Params: { id: string } }>("/api/admin/users/:id/promote", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: "admin" },
    });
    return reply.send({ user: toAdminUserDTO(user) });
  });

  app.post<{ Params: { id: string } }>("/api/admin/users/:id/demote", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    if (req.params.id === admin.userId) {
      return reply.code(400).send({ error: "cannot_self_demote", message: "You can't demote your own account." });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: "user" },
    });
    return reply.send({ user: toAdminUserDTO(user) });
  });
}
