import { Langfuse } from "langfuse";

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
});

// Create a trace for a user action
export function createTrace(params: {
  name: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}) {
  return langfuse.trace({
    name: params.name,
    userId: params.userId,
    metadata: params.metadata,
    tags: params.tags,
  });
}

// Shutdown on process exit
if (typeof process !== "undefined") {
  process.on("beforeExit", async () => {
    await langfuse.shutdownAsync();
  });
}
