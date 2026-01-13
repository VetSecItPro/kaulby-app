"use client";

import { ChevronLeft, Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface MobileHeaderProps {
  title?: string;
  showBackButton?: boolean;
}

export function MobileHeader({ title, showBackButton = false }: MobileHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          {showBackButton ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-full hover:bg-accent"
            >
              <ChevronLeft className="h-5 w-5" />
            </motion.button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">K</span>
              </div>
              <span className="font-semibold text-lg">Kaulby</span>
            </div>
          )}
          {title && showBackButton && (
            <h1 className="font-semibold text-lg">{title}</h1>
          )}
        </div>
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </header>
  );
}
