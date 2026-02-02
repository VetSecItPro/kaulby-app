import { PageHeaderSkeleton, ResultsListSkeleton } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <ResultsListSkeleton count={5} />
    </div>
  );
}
