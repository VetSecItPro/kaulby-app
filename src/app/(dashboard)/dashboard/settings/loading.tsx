import { PageHeaderSkeleton, SettingsSkeleton } from "@/components/dashboard/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <SettingsSkeleton />
    </div>
  );
}
