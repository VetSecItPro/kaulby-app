"use client";

export default function ManageError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">{error.message || "Failed to load admin dashboard"}</p>
      <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
        Try again
      </button>
    </div>
  );
}
