import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* A11Y: Screen reader text — FIX-313 */}
      <span className="sr-only">Loading...</span>

      {/* Header skeleton */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-16 hidden sm:block" />
            <Skeleton className="h-4 w-16 hidden sm:block" />
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>
      </header>

      {/* Hero skeleton */}
      <main className="flex-1">
        <section className="py-16 md:py-24 lg:py-32 px-4">
          <div className="container mx-auto text-center max-w-5xl">
            <Skeleton className="h-6 w-64 mx-auto mb-6 rounded-full" />
            <Skeleton className="h-12 md:h-16 w-full max-w-3xl mx-auto mb-4" />
            <Skeleton className="h-12 md:h-16 w-full max-w-2xl mx-auto mb-6" />
            <Skeleton className="h-6 w-full max-w-xl mx-auto mb-4" />
            <Skeleton className="h-6 w-full max-w-lg mx-auto mb-10" />
            <div className="flex gap-4 justify-center">
              <Skeleton className="h-12 w-36 rounded-full" />
              <Skeleton className="h-12 w-32 rounded-full" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
