import Link from "next/link";
import Image from "next/image";
import { AuthButtons } from "@/components/shared/auth-buttons";
import { MarketingNavLinks } from "@/components/shared/marketing-nav-links";

export function MarketingHeader() {
  // TODO (FIX-309): Add mobile hamburger menu for better navigation on small screens
  return (
    <header className="sticky top-0 z-50 glass border-b safe-area-top">
      <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" prefetch={false}>
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-black flex items-center justify-center">
            <Image
              src="/logo.jpg"
              alt="Kaulby"
              width={32}
              height={32}
              className="object-cover w-full h-full"
              priority
            />
          </div>
          <span className="text-xl md:text-2xl font-bold gradient-text">Kaulby</span>
        </Link>
        <nav className="flex items-center gap-3 md:gap-6">
          {/* A11Y: Client component for active state indication — FIX-019 */}
          <MarketingNavLinks />
          <AuthButtons />
        </nav>
      </div>
    </header>
  );
}
