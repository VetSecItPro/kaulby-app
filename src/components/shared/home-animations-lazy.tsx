"use client";

import dynamic from "next/dynamic";
import { ReactNode, Suspense } from "react";

// Static fallback that renders content immediately without animation
function StaticWrapper({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function StaticSection({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={className}>{children}</section>;
}

// Dynamically import home animations - loads framer-motion only when needed
const DynamicHomeAnimations = dynamic(
  () => import("./home-animations").then((mod) => mod.HomeAnimations),
  {
    ssr: true, // Enable SSR to avoid flash of no content
  }
);

const DynamicAnimatedSection = dynamic(
  () => import("./home-animations").then((mod) => mod.AnimatedSection),
  { ssr: true }
);

const DynamicStaggerContainer = dynamic(
  () => import("./home-animations").then((mod) => mod.StaggerContainer),
  { ssr: true }
);

const DynamicStaggerItem = dynamic(
  () => import("./home-animations").then((mod) => mod.StaggerItem),
  { ssr: true }
);

const DynamicAnimatedBadge = dynamic(
  () => import("./home-animations").then((mod) => mod.AnimatedBadge),
  { ssr: true }
);

const DynamicAnimatedStepCard = dynamic(
  () => import("./home-animations").then((mod) => mod.AnimatedStepCard),
  { ssr: true }
);

const DynamicTextReveal = dynamic(
  () => import("./home-animations").then((mod) => mod.TextReveal),
  { ssr: true }
);

// Export wrapper components that show content immediately, add animations when loaded
export function HomeAnimations({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <DynamicHomeAnimations>{children}</DynamicHomeAnimations>
    </Suspense>
  );
}

export function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Suspense fallback={<StaticSection className={className}>{children}</StaticSection>}>
      <DynamicAnimatedSection className={className} delay={delay}>
        {children}
      </DynamicAnimatedSection>
    </Suspense>
  );
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <Suspense fallback={<StaticWrapper className={className}>{children}</StaticWrapper>}>
      <DynamicStaggerContainer className={className} staggerDelay={staggerDelay}>
        {children}
      </DynamicStaggerContainer>
    </Suspense>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Suspense fallback={<StaticWrapper className={className}>{children}</StaticWrapper>}>
      <DynamicStaggerItem className={className}>{children}</DynamicStaggerItem>
    </Suspense>
  );
}

export function AnimatedBadge({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Suspense fallback={<StaticWrapper className={className}>{children}</StaticWrapper>}>
      <DynamicAnimatedBadge className={className} delay={delay}>
        {children}
      </DynamicAnimatedBadge>
    </Suspense>
  );
}

export function AnimatedStepCard({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Suspense fallback={<StaticWrapper className={className}>{children}</StaticWrapper>}>
      <DynamicAnimatedStepCard className={className} delay={delay}>
        {children}
      </DynamicAnimatedStepCard>
    </Suspense>
  );
}

export function TextReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Suspense fallback={<StaticWrapper className={className}>{children}</StaticWrapper>}>
      <DynamicTextReveal className={className} delay={delay}>
        {children}
      </DynamicTextReveal>
    </Suspense>
  );
}
