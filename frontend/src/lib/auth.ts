import { writable } from "svelte/store";
import type { UserDTO } from "@flashcards/shared";
import { api } from "./api";

export const currentUser = writable<UserDTO | null | undefined>(undefined); // undefined = not checked yet

export async function refreshSession(): Promise<void> {
  try {
    const { user } = await api.me();
    currentUser.set(user);
  } catch {
    currentUser.set(null);
  }
}
