import type {
  AiDraftDTO,
  CardDTO,
  DeckSummaryDTO,
  DueCardDTO,
  GenerationJobDTO,
  ReviewOutcome,
  ReviewResultDTO,
  SelfCheckGradeDTO,
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
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
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
  requestMagicLink: (email: string) => request<{ ok: true }>("/auth/magic-link", { method: "POST", body: JSON.stringify({ email }) }),
  verifyMagicLink: (token: string) => request<{ user: UserDTO }>(`/auth/verify?token=${encodeURIComponent(token)}`),
  me: () => request<{ user: UserDTO }>("/auth/me"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  listDecks: () => request<{ decks: DeckSummaryDTO[] }>("/decks"),
  createDeck: (name: string) => request<{ deck: DeckSummaryDTO }>("/decks", { method: "POST", body: JSON.stringify({ name }) }),
  deleteDeck: (id: string) => request<{ ok: true }>(`/decks/${id}`, { method: "DELETE" }),

  listCards: (deckId: string) => request<{ cards: CardDTO[] }>(`/decks/${deckId}/cards`),
  createCard: (deckId: string, front: string, back: string) =>
    request<{ cards: CardDTO[] }>(`/decks/${deckId}/cards`, { method: "POST", body: JSON.stringify({ front, back }) }),
  createCardsBulk: (deckId: string, cards: { front: string; back: string }[]) =>
    request<{ cards: CardDTO[] }>(`/decks/${deckId}/cards`, { method: "POST", body: JSON.stringify({ cards }) }),
  deleteCard: (deckId: string, cardId: string) => request<{ ok: true }>(`/decks/${deckId}/cards/${cardId}`, { method: "DELETE" }),

  uploadPdf: (deckId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ job: GenerationJobDTO }>(`/decks/${deckId}/generate`, { method: "POST", body: form });
  },
  getJob: (jobId: string) => request<{ job: GenerationJobDTO }>(`/generation-jobs/${jobId}`),
  acceptDraft: (jobId: string, draftId: string, edited?: { front: string; back: string }) =>
    request<{ card: CardDTO }>(`/generation-jobs/${jobId}/drafts/${draftId}/accept`, {
      method: "POST",
      body: JSON.stringify(edited ? { front: edited.front, back: edited.back } : {}),
    }),
  discardDraft: (jobId: string, draftId: string) =>
    request<{ ok: true }>(`/generation-jobs/${jobId}/drafts/${draftId}/discard`, { method: "POST" }),

  nextDueCard: (deckId: string) => request<DueCardDTO & { card: CardDTO | null }>(`/decks/${deckId}/study/next`),
  submitReview: (cardId: string, outcome: ReviewOutcome) =>
    request<ReviewResultDTO>("/reviews", { method: "POST", body: JSON.stringify({ cardId, outcome }) }),
  getQuiz: (deckId: string) =>
    request<{ questions: { cardId: string; front: string; options: string[]; answer: string }[] }>(`/decks/${deckId}/quiz`),

  gradeSelfCheck: (cardId: string, answer: string) =>
    request<SelfCheckGradeDTO>("/self-check/grade", { method: "POST", body: JSON.stringify({ cardId, answer }) }),

  exportAnkiUrl: (deckId: string) => `/api/decks/${deckId}/export/anki`,
};

export type { AiDraftDTO, CardDTO, DeckSummaryDTO, GenerationJobDTO, UserDTO };
