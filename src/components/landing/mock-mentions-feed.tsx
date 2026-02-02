import { MockResultCard } from "./mock-result-card";
import { MOCK_RESULTS } from "./mock-data";

export function MockMentionsFeed() {
  return (
    <div>
      {/* Filter bar */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2 overflow-x-auto">
        <span className="shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-primary text-primary-foreground">
          All (42)
        </span>
        <span className="shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-muted/60 text-muted-foreground">
          Unread (10)
        </span>
        <span className="shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-muted/60 text-muted-foreground">
          Saved (3)
        </span>
        <div className="w-px h-5 bg-border/40 shrink-0 mx-1" />
        <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-blue-900/20 text-blue-400">
          Solutions
        </span>
        <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-green-900/20 text-green-400">
          Budget
        </span>
        <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-red-900/20 text-red-400">
          Pain Points
        </span>
        <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-purple-900/20 text-purple-400">
          Advice
        </span>
        <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-amber-900/20 text-amber-400">
          Trending
        </span>
      </div>

      {/* Results */}
      <div className="p-4 space-y-3">
        {MOCK_RESULTS.map((result) => (
          <MockResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
}
