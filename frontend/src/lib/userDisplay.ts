import type { UserRole } from "@flashcards/shared";

export function formatUserLabel(
  role: UserRole,
  email: string | null | undefined,
  displayName?: string | null,
): string {
  const name = displayName?.trim() || email?.split("@", 1)[0]?.trim() || "Unknown user";
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  return `${roleLabel}: ${name}`;
}
