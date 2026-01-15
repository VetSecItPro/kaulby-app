"use client";

import { Component, type ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

// Error boundary that wraps ClerkProvider - catches initialization errors
class ClerkErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.warn("[Clerk] Error caught by boundary:", error.message);
  }

  render() {
    if (this.state.hasError) {
      // Render children without Clerk if it fails
      return <>{this.props.fallback}</>;
    }
    return this.props.children;
  }
}

interface ResilientClerkProviderProps {
  children: ReactNode;
}

export function ResilientClerkProvider({ children }: ResilientClerkProviderProps) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // If no key, render without Clerk
  if (!key) {
    if (typeof window !== "undefined") {
      console.warn("[Clerk] No publishable key found - auth disabled");
    }
    return <>{children}</>;
  }

  return (
    <ClerkErrorBoundary fallback={children}>
      <ClerkProvider
        publishableKey={key}
        appearance={{
          baseTheme: dark,
          variables: {
            colorPrimary: "#14b8a6",
            colorBackground: "#0a0a0a",
            colorInputBackground: "#171717",
            colorInputText: "#fafafa",
          },
        }}
        afterSignOutUrl="/"
      >
        {children}
      </ClerkProvider>
    </ClerkErrorBoundary>
  );
}
