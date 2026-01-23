"use client";

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";

type DeviceType = "mobile" | "tablet" | "desktop";

interface DeviceContextType {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: DeviceType;
  isHydrated: boolean;
}

const DeviceContext = createContext<DeviceContextType>({
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  deviceType: "desktop",
  isHydrated: false,
});

// Debounce helper to prevent excessive state updates during resize
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T;
}

// Get initial device type from window (only call on client)
function getDeviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  // Start with "desktop" for SSR consistency, then update after hydration
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated and set correct device type
    setDeviceType(getDeviceType());
    setIsHydrated(true);

    // Debounced resize handler
    const debouncedCheck = debounce(() => {
      setDeviceType(getDeviceType());
    }, 300);

    window.addEventListener("resize", debouncedCheck);
    return () => window.removeEventListener("resize", debouncedCheck);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<DeviceContextType>(() => ({
    isMobile: deviceType === "mobile",
    isTablet: deviceType === "tablet",
    isDesktop: deviceType === "desktop",
    deviceType,
    isHydrated,
  }), [deviceType, isHydrated]);

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  return useContext(DeviceContext);
}

// Component to conditionally render based on device
export function MobileOnly({ children }: { children: ReactNode }) {
  const { isMobile } = useDevice();
  if (!isMobile) return null;
  return <>{children}</>;
}

export function TabletOnly({ children }: { children: ReactNode }) {
  const { isTablet } = useDevice();
  if (!isTablet) return null;
  return <>{children}</>;
}

export function DesktopOnly({ children }: { children: ReactNode }) {
  const { isDesktop } = useDevice();
  if (!isDesktop) return null;
  return <>{children}</>;
}

export function MobileAndTablet({ children }: { children: ReactNode }) {
  const { isMobile, isTablet } = useDevice();
  if (!isMobile && !isTablet) return null;
  return <>{children}</>;
}

export function NotMobile({ children }: { children: ReactNode }) {
  const { isMobile } = useDevice();
  if (isMobile) return null;
  return <>{children}</>;
}
