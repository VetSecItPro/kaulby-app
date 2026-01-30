import { Langfuse } from "langfuse";

// Lazy-initialized Langfuse client to avoid build-time errors
let _langfuse: Langfuse | null = null;

function getLangfuse(): Langfuse {
  if (!_langfuse) {
    _langfuse = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
    });
  }
  return _langfuse;
}

// Export getter as langfuse for backwards compatibility
export const langfuse = {
  get trace() {
    return getLangfuse().trace.bind(getLangfuse());
  },
  get shutdownAsync() {
    return getLangfuse().shutdownAsync.bind(getLangfuse());
  },
  get flushAsync() {
    return getLangfuse().flushAsync.bind(getLangfuse());
  },
};

// Create a trace for a user action
export function createTrace(params: {
  name: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}): { id: string } {
  // Return mock trace if Langfuse isn't configured
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return { id: `mock-trace-${Date.now()}` };
  }
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
    // Only shutdown if Langfuse is configured
    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      await langfuse.shutdownAsync();
    }
  });
}
