import { Globe, Brain, Shield, Target, TrendingUp, Zap } from "lucide-react";

export type ArticleCategory =
  | "Platform Monitoring"
  | "AI Analysis"
  | "Brand Tracking"
  | "Competitive Intelligence"
  | "Growth & Leads"
  | "Product Updates";

export const categoryConfig: Record<
  ArticleCategory,
  { icon: typeof Globe; colorClass: string; badgeClass: string }
> = {
  "Platform Monitoring": {
    icon: Globe,
    colorClass: "text-teal-400",
    badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  },
  "AI Analysis": {
    icon: Brain,
    colorClass: "text-purple-400",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  "Brand Tracking": {
    icon: Shield,
    colorClass: "text-blue-400",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  "Competitive Intelligence": {
    icon: Target,
    colorClass: "text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  "Growth & Leads": {
    icon: TrendingUp,
    colorClass: "text-green-400",
    badgeClass: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  "Product Updates": {
    icon: Zap,
    colorClass: "text-indigo-400",
    badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
};

export const allCategories: ArticleCategory[] = [
  "Platform Monitoring",
  "AI Analysis",
  "Brand Tracking",
  "Competitive Intelligence",
  "Growth & Leads",
  "Product Updates",
];
