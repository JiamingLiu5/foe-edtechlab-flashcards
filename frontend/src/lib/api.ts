import type {
  AdminUserDTO,
  AdminUserQuotaDTO,
  AiDraftDTO,
  CardDTO,
  CardDifficulty,
  DeckSourceDTO,
  DeckSummaryDTO,
  DueCardDTO,
  GenerationJobDTO,
  QuotaBucket,
  ReviewOutcome,
  ReviewResultDTO,
  SelfCheckGradeDTO,
  SignupResponseDTO,
  StudySettingsDTO,
  UserDTO,
} from "@flashcards/shared";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export { ApiError };

export const api = {
  signup: (email: string, password: string) =>
    request<SignupResponseDTO>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<{ user: UserDTO }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: UserDTO }>("/auth/me"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  adminListUsers: () => request<{ users: AdminUserDTO[] }>("/admin/users"),
  adminApprove: (id: string) => request<{ user: AdminUserDTO }>(`/admin/users/${id}/approve`, { method: "POST" }),
  adminReject: (id: string) => request<{ user: AdminUserDTO }>(`/admin/users/${id}/reject`, { method: "POST" }),
  adminDeactivate: (id: string) => request<{ user: AdminUserDTO }>(`/admin/users/${id}/deactivate`, { method: "POST" }),
  adminReactivate: (id: string) => request<{ user: AdminUserDTO }>(`/admin/users/${id}/reactivate`, { method: "POST" }),
  adminPromote: (id: string) => request<{ user: AdminUserDTO }>(`/admin/users/${id}/promote`, { method: "POST" }),
  adminDemote: (id: string) => request<{ user: AdminUserDTO }>(`/admin/users/${id}/demote`, { method: "POST" }),
  adminRemoveUser: (id: string) => request<{ ok: true }>(`/admin/users/${id}`, { method: "DELETE" }),
  adminListUserDecks: (id: string) => request<{ user: AdminUserDTO; decks: DeckSummaryDTO[] }>(`/admin/users/${id}/decks`),
  adminListDeckCards: (deckId: string) =>
    request<{ deck: { id: string; name: string; ownerId: string; createdAt: string }; cards: CardDTO[] }>(
      `/admin/decks/${deckId}/cards`
    ),
  adminGetUserQuota: (id: string) => request<AdminUserQuotaDTO>(`/admin/users/${id}/quota`),
  adminResetQuota: (id: string, bucket: QuotaBucket) =>
    request<{ ok: true }>(`/admin/users/${id}/quota/${bucket}/reset`, { method: "POST" }),
  adminSetQuotaOverride: (id: string, bucket: QuotaBucket, dailyLimit: number | null) =>
    request<{ ok: true }>(`/admin/users/${id}/quota/${bucket}`, {
      method: "PUT",
      body: JSON.stringify({ dailyLimit }),
    }),

  listDecks: () => request<{ decks: DeckSummaryDTO[] }>("/decks"),
  createDeck: (name: string) => request<{ deck: DeckSummaryDTO }>("/decks", { method: "POST", body: JSON.stringify({ name }) }),
  deleteDeck: (id: string) => request<{ ok: true }>(`/decks/${id}`, { method: "DELETE" }),

  listSources: (deckId: string) => request<{ sources: DeckSourceDTO[] }>(`/decks/${deckId}/sources`),
  deleteSource: (deckId: string, sourceId: string) =>
    request<{ ok: true }>(`/decks/${deckId}/sources/${sourceId}`, { method: "DELETE" }),

  listCards: (deckId: string) => request<{ cards: CardDTO[] }>(`/decks/${deckId}/cards`),
  createCard: (deckId: string, front: string, back: string, tags: string[] = []) =>
    request<{ cards: CardDTO[] }>(`/decks/${deckId}/cards`, { method: "POST", body: JSON.stringify({ front, back, tags }) }),
  createCardsBulk: (deckId: string, cards: { front: string; back: string; tags?: string[] }[]) =>
    request<{ cards: CardDTO[] }>(`/decks/${deckId}/cards`, { method: "POST", body: JSON.stringify({ cards }) }),
  updateCard: (
    deckId: string,
    cardId: string,
    card: { front?: string; back?: string; tags?: string[]; includeInQuiz?: boolean; retired?: boolean; difficulty?: CardDifficulty }
  ) => request<{ card: CardDTO }>(`/decks/${deckId}/cards/${cardId}`, { method: "PATCH", body: JSON.stringify(card) }),
  deleteCard: (deckId: string, cardId: string) => request<{ ok: true }>(`/decks/${deckId}/cards/${cardId}`, { method: "DELETE" }),

  uploadPdf: (deckId: string, file: File, cardLimit: number) => {
    const form = new FormData();
    form.append("cardLimit", String(cardLimit));
    form.append("file", file);
    return request<{ job: GenerationJobDTO }>(`/decks/${deckId}/generate`, { method: "POST", body: form });
  },
  importUrl: (deckId: string, url: string, cardLimit: number) =>
    request<{ job: GenerationJobDTO }>(`/decks/${deckId}/generate-url`, { method: "POST", body: JSON.stringify({ url, cardLimit }) }),
  generateFromText: (deckId: string, text: string, cardLimit: number) =>
    request<{ job: GenerationJobDTO }>(`/decks/${deckId}/generate-text`, { method: "POST", body: JSON.stringify({ text, cardLimit }) }),
  startDeckReview: (deckId: string) =>
    request<{ job: GenerationJobDTO }>(`/decks/${deckId}/review`, { method: "POST", body: JSON.stringify({}) }),
  getJob: (jobId: string) => request<{ job: GenerationJobDTO }>(`/generation-jobs/${jobId}`),
  acceptDraft: (jobId: string, draftId: string, edited?: { front: string; back: string }) =>
    request<{ card: CardDTO }>(`/generation-jobs/${jobId}/drafts/${draftId}/accept`, {
      method: "POST",
      body: JSON.stringify(edited ? { front: edited.front, back: edited.back } : {}),
    }),
  discardDraft: (jobId: string, draftId: string) =>
    request<{ ok: true }>(`/generation-jobs/${jobId}/drafts/${draftId}/discard`, { method: "POST" }),

  nextDueCard: (deckId: string) => request<DueCardDTO>(`/decks/${deckId}/study/next`),
  submitReview: (cardId: string, outcome: ReviewOutcome) =>
    request<ReviewResultDTO>("/reviews", { method: "POST", body: JSON.stringify({ cardId, outcome }) }),
  getStudySettings: () => request<StudySettingsDTO>("/account/study-settings"),
  updateStudySettings: (settings: StudySettingsDTO) =>
    request<StudySettingsDTO>("/account/study-settings", { method: "PUT", body: JSON.stringify(settings) }),
  getQuiz: (deckId: string) =>
    request<{ questions: { cardId: string; front: string; options: string[]; answer: string; difficulty: CardDifficulty }[] }>(`/decks/${deckId}/quiz`),
  getFillQuiz: (deckId: string) =>
    request<{ questions: { cardId: string; front: string; back: string; difficulty: CardDifficulty }[] }>(`/decks/${deckId}/quiz?mode=fill`),

  gradeSelfCheck: async (cardId: string, answer: string) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      return await request<SelfCheckGradeDTO>("/self-check/grade", {
        method: "POST",
        body: JSON.stringify({ cardId, answer }),
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  },

  exportAnkiUrl: (deckId: string) => `/api/decks/${deckId}/export/anki`,
};

export type { AdminUserDTO, AiDraftDTO, CardDTO, DeckSourceDTO, DeckSummaryDTO, GenerationJobDTO, UserDTO };
