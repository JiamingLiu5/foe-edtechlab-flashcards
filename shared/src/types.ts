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
  tags: string[];
  source: string | null;
  includeInQuiz: boolean;
  /** Set via the Study page's "All done" action — excluded from future Study sessions until un-retired. */
  retired: boolean;
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
  cardLimit: number;
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
  dueAt: string;
}

export interface DueCardDTO {
  card: CardDTO | null;
  isNew: boolean;
  nextDueAt: string | null;
  /** Minutes until the card would come back for each outcome — the student's configured Study intervals. */
  intervalPreviews: Record<ReviewOutcome, number>;
}

/** Student-configurable minutes until a card comes back after each Study outcome (applies across all their decks). */
export interface StudySettingsDTO {
  againMinutes: number;
  hardMinutes: number;
  goodMinutes: number;
  easyMinutes: number;
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

export type QuotaBucket = "generation" | "grading" | "deck_review" | "pdf_page_limit" | "generated_card_limit";

export interface QuotaBucketDTO {
  bucket: QuotaBucket;
  label: string;
  used: number;
  limit: number;
  defaultLimit: number;
  overridden: boolean;
  scope: "daily" | "per_upload";
  usageLabel: string;
}

export interface AdminUserQuotaDTO {
  buckets: QuotaBucketDTO[];
}
