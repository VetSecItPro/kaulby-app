export function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border/30">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-4 py-1 rounded-md bg-background/50 text-xs text-muted-foreground font-mono">
            app.kaulby.com/dashboard
          </div>
        </div>
        <div className="w-[54px]" /> {/* Spacer to center URL bar */}
      </div>
      {/* Content */}
      <div className="bg-background/50">{children}</div>
    </div>
  );
}
