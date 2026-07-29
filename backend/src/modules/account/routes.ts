import type { FastifyInstance } from "fastify";
import { prisma } from "../../db.js";
import { requireUser } from "../auth/plugin.js";
import type { StudySettingsDTO } from "@flashcards/shared";

const MIN_MINUTES = 0;
const MAX_MINUTES = 60 * 24 * 30; // 30 days — generous sanity ceiling, not a real limit

function toDTO(user: {
  studyAgainMinutes: number;
  studyHardMinutes: number;
  studyGoodMinutes: number;
  studyEasyMinutes: number;
}): StudySettingsDTO {
  return {
    againMinutes: user.studyAgainMinutes,
    hardMinutes: user.studyHardMinutes,
    goodMinutes: user.studyGoodMinutes,
    easyMinutes: user.studyEasyMinutes,
  };
}

function isValidMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_MINUTES && value <= MAX_MINUTES;
}

export async function accountRoutes(app: FastifyInstance) {
  app.get("/api/account/study-settings", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { studyAgainMinutes: true, studyHardMinutes: true, studyGoodMinutes: true, studyEasyMinutes: true },
    });
    return reply.send(toDTO(dbUser));
  });

  app.put<{ Body: Partial<StudySettingsDTO> }>("/api/account/study-settings", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const { againMinutes, hardMinutes, goodMinutes, easyMinutes } = req.body ?? {};
    if (
      !isValidMinutes(againMinutes) ||
      !isValidMinutes(hardMinutes) ||
      !isValidMinutes(goodMinutes) ||
      !isValidMinutes(easyMinutes)
    ) {
      return reply.code(400).send({
        error: "invalid_minutes",
        message: `Each interval must be a whole number of minutes between ${MIN_MINUTES} and ${MAX_MINUTES}.`,
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: {
        studyAgainMinutes: againMinutes,
        studyHardMinutes: hardMinutes,
        studyGoodMinutes: goodMinutes,
        studyEasyMinutes: easyMinutes,
      },
    });
    return reply.send(toDTO(updated));
  });
}
