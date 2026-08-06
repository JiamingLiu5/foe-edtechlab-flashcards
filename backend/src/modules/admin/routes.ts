import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { requireAdmin } from "../auth/plugin.js";
import { listDeckSummariesForOwner } from "../decks/routes.js";
import { getDailyQuotaUsage, getQuotaOverridesForUser, resetDailyQuota, setQuotaOverride } from "../../lib/quota.js";
import type { AdminUserDTO, AdminUserQuotaDTO, QuotaBucket, QuotaBucketDTO } from "@flashcards/shared";

const QUOTA_BUCKETS: { bucket: QuotaBucket; label: string; defaultLimit: number; scope: "daily" | "per_upload"; usageLabel: string }[] = [
  { bucket: "generation", label: "PDF / URL generation", defaultLimit: env.dailyGenerationQuota, scope: "daily", usageLabel: "today" },
  { bucket: "grading", label: "Self-check grading", defaultLimit: env.dailyGradingQuota, scope: "daily", usageLabel: "today" },
  { bucket: "deck_review", label: "AI deck review", defaultLimit: env.dailyDeckReviewQuota, scope: "daily", usageLabel: "today" },
  { bucket: "mcq_distractors", label: "Deceptive MCQ distractor generation", defaultLimit: env.dailyDistractorQuota, scope: "daily", usageLabel: "today" },
  { bucket: "pdf_page_limit", label: "Maximum PDF pages", defaultLimit: env.maxPdfPages, scope: "per_upload", usageLabel: "pages per PDF" },
  { bucket: "generated_card_limit", label: "Maximum AI-generated cards", defaultLimit: env.maxGeneratedCards, scope: "per_upload", usageLabel: "cards per import" },
];

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

  app.put<{ Params: { id: string }; Body: { role?: string } }>("/api/admin/users/:id/role", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;

    const role = req.body?.role;
    if (role !== "student" && role !== "teacher" && role !== "admin") {
      return reply.code(400).send({ error: "invalid_role", message: "Choose student, teacher, or admin." });
    }
    if (req.params.id === admin.userId) {
      return reply.code(400).send({ error: "cannot_self_change_role", message: "You can't change your own role." });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser) return reply.code(404).send({ error: "not_found", message: "User not found." });

    if (targetUser.role === "admin" && role !== "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return reply.code(400).send({
          error: "cannot_remove_last_admin",
          message: "At least one administrator account must remain.",
        });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
    });
    return reply.send({ user: toAdminUserDTO(user) });
  });

  app.delete<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;
    if (req.params.id === admin.userId) {
      return reply.code(400).send({ error: "cannot_self_remove", message: "You can't remove your own account." });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        role: true,
        jobsCreated: { select: { uploadPath: true } },
        decks: { select: { sources: { select: { storedPath: true } } } },
      },
    });
    if (!targetUser) return reply.code(404).send({ error: "not_found", message: "User not found." });

    if (targetUser.role === "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        return reply.code(400).send({
          error: "cannot_remove_last_admin",
          message: "At least one administrator account must remain.",
        });
      }
    }

    const { count: deletedCount } = await prisma.user.deleteMany({ where: { id: targetUser.id } });
    if (deletedCount === 0) return reply.code(404).send({ error: "not_found", message: "User not found." });

    // The database cascades the user's decks, cards, reviews, jobs, drafts, and sources.
    // Uploaded PDFs and retained source files live outside the database, so remove them separately.
    const filePaths = [
      ...targetUser.jobsCreated.map((j) => j.uploadPath),
      ...targetUser.decks.flatMap((d) => d.sources.map((s) => s.storedPath)),
    ].filter((p): p is string => !!p);
    await Promise.all(filePaths.map((p) => fs.unlink(p).catch(() => {})));

    return reply.send({ ok: true });
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

  app.get<{ Params: { id: string } }>("/api/admin/users/:id/quota", async (req, reply) => {
    const admin = requireAdmin(req, reply);
    if (!admin) return;

    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!targetUser) return reply.code(404).send({ error: "not_found", message: "User not found." });

    const overrides = await getQuotaOverridesForUser(targetUser.id);
    const buckets: QuotaBucketDTO[] = await Promise.all(
      QUOTA_BUCKETS.map(async ({ bucket, label, defaultLimit, scope, usageLabel }) => {
        const override = overrides.get(bucket);
        const used = scope === "daily" ? await getDailyQuotaUsage(targetUser.id, bucket) : 0;
        return { bucket, label, used, limit: override ?? defaultLimit, defaultLimit, overridden: override !== undefined, scope, usageLabel };
      })
    );

    const quota: AdminUserQuotaDTO = { buckets };
    return reply.send(quota);
  });

  app.post<{ Params: { id: string; bucket: string } }>(
    "/api/admin/users/:id/quota/:bucket/reset",
    async (req, reply) => {
      const admin = requireAdmin(req, reply);
      if (!admin) return;

      const config = QUOTA_BUCKETS.find((b) => b.bucket === req.params.bucket);
      if (!config) return reply.code(400).send({ error: "invalid_bucket", message: "Unknown quota bucket." });

      const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!targetUser) return reply.code(404).send({ error: "not_found", message: "User not found." });

      await resetDailyQuota(targetUser.id, config.bucket);
      return reply.send({ ok: true });
    }
  );

  app.put<{ Params: { id: string; bucket: string }; Body: { dailyLimit: number | null } }>(
    "/api/admin/users/:id/quota/:bucket",
    async (req, reply) => {
      const admin = requireAdmin(req, reply);
      if (!admin) return;

      const config = QUOTA_BUCKETS.find((b) => b.bucket === req.params.bucket);
      if (!config) return reply.code(400).send({ error: "invalid_bucket", message: "Unknown quota bucket." });

      const dailyLimit = req.body?.dailyLimit ?? null;
      if (dailyLimit !== null && (!Number.isInteger(dailyLimit) || dailyLimit < 0)) {
        return reply.code(400).send({ error: "invalid_limit", message: "dailyLimit must be a non-negative integer, or null to clear the override." });
      }

      const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!targetUser) return reply.code(404).send({ error: "not_found", message: "User not found." });

      await setQuotaOverride(targetUser.id, config.bucket, dailyLimit);
      return reply.send({ ok: true });
    }
  );
}
