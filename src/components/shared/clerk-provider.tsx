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

// Check for key at module level (consistent between server and client)
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function ResilientClerkProvider({ children }: ResilientClerkProviderProps) {
  // If no key, render without Clerk (consistent on server and client)
  if (!CLERK_KEY) {
    return <>{children}</>;
  }

  // Always render ClerkProvider if key exists - let Clerk handle any issues
  return (
    <ClerkErrorBoundary fallback={children}>
      <ClerkProvider
        publishableKey={CLERK_KEY}
        appearance={{
          baseTheme: dark,
          variables: {
            colorPrimary: "hsl(172, 66%, 50%)",
            colorBackground: "hsl(0, 0%, 3.9%)",
            colorInputBackground: "hsl(0, 0%, 10%)",
            colorInputText: "hsl(0, 0%, 98%)",
          },
        }}
        afterSignOutUrl="/"
      >
        {children}
      </ClerkProvider>
    </ClerkErrorBoundary>
  );
}
