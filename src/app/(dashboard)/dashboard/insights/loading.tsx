import { PageHeaderSkeleton, StatsGridSkeleton, ResultsListSkeleton } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatsGridSkeleton />
      <ResultsListSkeleton count={3} />
    </div>
  );
}
