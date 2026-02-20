"use client";

import { useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  HelpCircle,
  Zap,
  Radio,
  Globe,
  Brain,
  Bell,
  Key,
  CreditCard,
  Users,
  Settings,
  Shield,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SectionItem {
  id: string;
  title: string;
  icon: LucideIcon;
  badge?: string;
}

// Section navigation data — colocated here because icons are React components
// that can't be serialized across the server→client boundary
const sections: SectionItem[] = [
  { id: "faq", title: "Quick Answers", icon: HelpCircle },
  { id: "getting-started", title: "Getting Started", icon: Zap },
  { id: "monitors", title: "Monitors", icon: Radio },
  { id: "platforms", title: "Platforms", icon: Globe },
  { id: "results", title: "Results & Analysis", icon: Brain },
  { id: "alerts", title: "Alerts & Notifications", icon: Bell },
  { id: "api", title: "API Access", icon: Key, badge: "Team" },
  { id: "billing", title: "Billing & Plans", icon: CreditCard },
  { id: "team", title: "Team Management", icon: Users, badge: "Team" },
  { id: "account", title: "Account & Settings", icon: Settings },
  { id: "troubleshooting", title: "Troubleshooting", icon: Shield },
  { id: "contact", title: "Contact Support", icon: Mail },
];

export function HelpNav() {
  // Handle smooth scroll to section
  // Note: Layout renders both mobile and desktop versions to DOM.
  // We must find the VISIBLE element (non-zero height) to get correct position.
  const scrollToSection = useCallback((e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();

    // Find all elements with this ID and get the visible one
    const allElements = document.querySelectorAll(`#${sectionId}`);
    let element: HTMLElement | null = null;

    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i] as HTMLElement;
      if (el.getBoundingClientRect().height > 0) {
        element = el;
        break;
      }
    }

    if (!element) return;

    // Scroll to the visible element with offset for header
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const targetPosition = scrollTop + rect.top - 80;

    window.scrollTo({
      top: Math.max(0, targetPosition),
      behavior: 'smooth'
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Documentation
        </CardTitle>
        <CardDescription>
          Click any section to jump directly to it
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={(e) => scrollToSection(e, section.id)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors group"
              >
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm group-hover:text-primary transition-colors">{section.title}</span>
                {section.badge && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {section.badge}
                  </Badge>
                )}
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
