"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type DeviceType = "mobile" | "tablet" | "desktop";

interface DeviceContextType {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: DeviceType;
}

const DeviceContext = createContext<DeviceContextType>({
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  deviceType: "desktop",
});

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setDeviceType("mobile");
      } else if (width < 1024) {
        setDeviceType("tablet");
      } else {
        setDeviceType("desktop");
      }
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  const value: DeviceContextType = {
    isMobile: deviceType === "mobile",
    isTablet: deviceType === "tablet",
    isDesktop: deviceType === "desktop",
    deviceType,
  };

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
