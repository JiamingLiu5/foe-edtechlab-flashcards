function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  sessionSecret: required("SESSION_SECRET"),
  allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS ?? "ic.ac.uk,imperial.ac.uk")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:5173",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModelGeneration: process.env.ANTHROPIC_MODEL_GENERATION ?? "claude-sonnet-4-5",
  anthropicModelGrading: process.env.ANTHROPIC_MODEL_GRADING ?? "claude-haiku-4-5",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModelOcr: process.env.GEMINI_MODEL_OCR ?? "gemini-3.5-flash-lite",
  geminiModelGeneration: process.env.GEMINI_MODEL_GENERATION ?? "gemini-3.5-flash",
  geminiModelGrading: process.env.GEMINI_MODEL_GRADING ?? "gemini-3.5-flash-lite",
  uploadDir: process.env.UPLOAD_DIR ?? "/data/uploads",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024,
  maxPdfPages: Number(process.env.MAX_PDF_PAGES ?? 30),
  maxGeneratedCards: Number(process.env.MAX_GENERATED_CARDS ?? 25),
  dailyGenerationQuota: Number(process.env.MAX_GENERATION_JOBS_PER_DAY ?? process.env.DAILY_GENERATION_QUOTA ?? 5),
  dailyGradingQuota: Number(process.env.MAX_GRADING_JOBS_PER_DAY ?? process.env.DAILY_GRADING_QUOTA ?? 50),
  dailyDeckReviewQuota: Number(process.env.DAILY_DECK_REVIEW_QUOTA ?? 5),
  maxUrlFetchBytes: Number(process.env.MAX_URL_FETCH_MB ?? 5) * 1024 * 1024,
  testLoginSecret: process.env.TEST_LOGIN_SECRET ?? "",
  testLoginEmail: process.env.TEST_LOGIN_EMAIL ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  adminName: process.env.ADMIN_NAME ?? "",
};
