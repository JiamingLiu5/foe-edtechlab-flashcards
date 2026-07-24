// API contract types shared between backend and frontend.
// Hand-maintained DTOs, not Prisma entities directly — keeps the wire shape
// stable even if internal storage columns change.

export type UserRole = "user" | "admin";
export type UserStatus = "pending" | "approved" | "rejected" | "deactivated";

export interface UserDTO {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface AdminUserDTO {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
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

/** "import" drafts cards from a fresh PDF/URL source; "review" checks existing deck cards for issues. */
export type GenerationJobKind = "import" | "review";
export type GenerationSourceType = "pdf" | "url";

export interface GenerationJobDTO {
  id: string;
  deckId: string;
  status: GenerationJobStatus;
  kind: GenerationJobKind;
  sourceType: GenerationSourceType;
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
  /** Set for "review" jobs: what's wrong with the original card. */
  issue: string | null;
  /** Set for "review" jobs: the existing card this draft would overwrite. */
  originalCardId: string | null;
  originalFront: string | null;
  originalBack: string | null;
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

export interface SignupRequestDTO {
  email: string;
  password: string;
}

export interface SignupResponseDTO {
  pending: true;
  message: string;
}

export interface LoginRequestDTO {
  email: string;
  password: string;
}

export interface ApiErrorDTO {
  error: string;
  message: string;
}
