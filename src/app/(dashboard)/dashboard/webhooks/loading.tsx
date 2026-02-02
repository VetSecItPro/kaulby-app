import { PageHeaderSkeleton, TableSkeleton } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={4} columns={5} />
    </div>
  );
}
