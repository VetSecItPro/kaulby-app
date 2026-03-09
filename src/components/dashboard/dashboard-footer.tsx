"use client";

import Link from "next/link";
import { Bug, HelpCircle, FileText, Shield, ExternalLink } from "lucide-react";

export function DashboardFooter() {
  return (
    <footer className="border-t bg-muted/30 py-6 px-4 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link
              href="/dashboard/help"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Help Center
            </Link>
            <Link
              href="/dashboard/help#support"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Bug className="h-3.5 w-3.5" />
              Report a Bug
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              API Docs
            </Link>
            <Link
              href="/privacy"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Shield className="h-3.5 w-3.5" />
              Privacy
            </Link>
            <Link
              href="/terms"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Terms
            </Link>
            <a
              href="https://kaulbyapp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              kaulbyapp.com
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-xs text-muted-foreground/70">
            &copy; {new Date().getFullYear()} Kaulby. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
