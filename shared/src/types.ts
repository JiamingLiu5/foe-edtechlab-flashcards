// API contract types shared between backend and frontend.
// Hand-maintained DTOs, not Prisma entities directly — keeps the wire shape
// stable even if internal storage columns change.

export interface UserDTO {
  id: string;
  email: string;
  displayName: string | null;
}

export interface DeckSummaryDTO {
  id: string;
  name: string;
  cardCount: number;
  dueCount: number;
  forgottenCount: number;
  createdAt: string;
}

export interface CardDTO {
  id: string;
  deckId: string;
  front: string;
  back: string;
  source: string | null;
  createdAt: string;
}

export type GenerationJobStatus =
  | "queued"
  | "extracting"
  | "generating"
  | "ready"
  | "failed";

export interface GenerationJobDTO {
  id: string;
  deckId: string;
  status: GenerationJobStatus;
  sourceFilename: string;
  error: string | null;
  createdAt: string;
  drafts: AiDraftDTO[];
}

export type AiDraftStatus = "pending" | "accepted" | "discarded";

export interface AiDraftDTO {
  id: string;
  jobId: string;
  generatedFront: string;
  generatedBack: string;
  editedFront: string | null;
  editedBack: string | null;
  sourceCitation: string | null;
  status: AiDraftStatus;
}

export type ReviewOutcome = "again" | "hard" | "good" | "easy";

export interface ReviewResultDTO {
  cardId: string;
  outcome: ReviewOutcome;
  easeFactor: number;
  intervalDays: number;
  dueAt: string;
}

export interface DueCardDTO {
  card: CardDTO;
  isNew: boolean;
}

export interface SelfCheckGradeDTO {
  score: number; // 0-100
  feedback: string;
  missing: string[];
}

export interface MagicLinkRequestDTO {
  email: string;
}

export interface ApiErrorDTO {
  error: string;
  message: string;
}
