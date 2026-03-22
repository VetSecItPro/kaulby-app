import { useUser as useClerkUser } from "@clerk/nextjs";

/**
 * Safe wrapper around Clerk's useUser that returns null instead of throwing
 * when called outside ClerkProvider (e.g., when ClerkErrorBoundary catches
 * an initialization error and renders children without the provider).
 */
export function useSafeUser() {
  try {
    return useClerkUser();
  } catch {
    return { user: null, isLoaded: false, isSignedIn: false as const };
  }
}
