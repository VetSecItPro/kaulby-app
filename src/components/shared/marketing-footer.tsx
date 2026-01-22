import Link from "next/link";
import Image from "next/image";

export function MarketingFooter() {
  return (
    <footer className="border-t py-6 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Brand */}
          <div className="flex flex-col gap-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden bg-black flex items-center justify-center">
                <Image
                  src="/logo.jpg"
                  alt="Kaulby"
                  width={28}
                  height={28}
                  className="object-cover w-full h-full"
                />
              </div>
              <span className="text-lg font-bold gradient-text">Kaulby</span>
            </Link>
            <p className="text-xs text-muted-foreground">
              AI-powered social listening for startups.
            </p>
          </div>

          {/* Links - single row */}
          <nav className="flex flex-wrap items-center gap-4 md:gap-6">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/tools" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Tools
            </Link>
            <Link href="/alternatives" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Alternatives
            </Link>
            <Link href="/articles" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Articles
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </nav>
        </div>

        {/* Bottom line */}
        <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Kaulby. All rights reserved.</span>
          <span>Veteran-owned business</span>
        </div>
      </div>
    </footer>
  );
}
