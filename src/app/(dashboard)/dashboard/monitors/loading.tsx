import { PageHeaderSkeleton, MonitorsListSkeleton } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <MonitorsListSkeleton count={3} />
    </div>
  );
}
