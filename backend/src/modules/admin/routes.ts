import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { requireAdmin } from "../auth/plugin.js";
import { listDeckSummariesForOwner } from "../decks/routes.js";
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

  app.get<{ Params: { id: string } }>("/api/admin/users/:id/decks", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;

    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser) return reply.code(404).send({ error: "not_found", message: "User not found." });

    const decks = await listDeckSummariesForOwner(targetUser.id);
    return reply.send({ user: toAdminUserDTO(targetUser), decks });
  });

  app.get<{ Params: { deckId: string } }>("/api/admin/decks/:deckId/cards", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;

    const deck = await prisma.deck.findUnique({ where: { id: req.params.deckId } });
    if (!deck) return reply.code(404).send({ error: "not_found", message: "Deck not found." });

    const cards = await prisma.card.findMany({
      where: { deckId: deck.id },
      orderBy: { createdAt: "asc" },
    });
    return reply.send({
      deck: { id: deck.id, name: deck.name, ownerId: deck.ownerId, createdAt: deck.createdAt.toISOString() },
      cards,
    });
  });
}
