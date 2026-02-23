"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const AdminCharts = dynamic(
  () => import("./admin-charts").then(mod => ({ default: mod.AdminCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    ),
  }
);

export { AdminCharts };
