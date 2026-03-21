/**
 * Health check endpoint — pings all critical external services.
 * Used for monitoring uptime and diagnosing service degradation.
 *
 * GET /api/health
 * Returns: { status: "healthy" | "degraded" | "unhealthy", services: {...}, timestamp }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ServiceStatus {
  status: "up" | "down" | "degraded";
  latencyMs: number;
  error?: string;
}

async function checkService(
  name: string,
  checkFn: () => Promise<void>
): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await checkFn();
    return { status: "up", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      ...(process.env.NODE_ENV === "development" ? { error: error instanceof Error ? error.message : String(error) } : {}),
    };
  }
}

export async function GET() {
  const services: Record<string, ServiceStatus> = {};

  // Check all services in parallel with individual timeouts
  const checks = await Promise.allSettled([
    checkService("database", async () => {
      await db.execute(sql`SELECT 1`);
    }),
    checkService("redis", async () => {
      if (!process.env.UPSTASH_REDIS_REST_URL) {
        throw new Error("Not configured");
      }
      const res = await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/ping`,
        {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),
    checkService("resend", async () => {
      if (!process.env.RESEND_API_KEY) throw new Error("Not configured");
      const res = await fetch("https://api.resend.com/domains", {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok && res.status !== 401) throw new Error(`HTTP ${res.status}`);
    }),
    checkService("serper", async () => {
      if (!process.env.SERPER_API_KEY) throw new Error("Not configured");
      // Just verify the key is valid with a minimal query
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: "test", num: 1 }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),
    checkService("inngest", async () => {
      if (!process.env.INNGEST_SIGNING_KEY)
        throw new Error("Not configured");
      // Inngest doesn't have a simple ping, just verify env vars exist
      if (!process.env.INNGEST_EVENT_KEY)
        throw new Error("INNGEST_EVENT_KEY missing");
    }),
  ]);

  const serviceNames = ["database", "redis", "resend", "serper", "inngest"];
  checks.forEach((result, i) => {
    if (result.status === "fulfilled") {
      services[serviceNames[i]] = result.value;
    } else {
      services[serviceNames[i]] = {
        status: "down",
        latencyMs: 0,
        ...(process.env.NODE_ENV === "development" ? { error: result.reason?.message || "Unknown error" } : {}),
      };
    }
  });

  // Overall status
  const downCount = Object.values(services).filter(
    (s) => s.status === "down"
  ).length;
  const overallStatus =
    downCount === 0 ? "healthy" : downCount <= 2 ? "degraded" : "unhealthy";
  const httpStatus =
    overallStatus === "healthy"
      ? 200
      : overallStatus === "degraded"
        ? 200
        : 503;

  return NextResponse.json(
    {
      status: overallStatus,
      services,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
    },
    { status: httpStatus }
  );
}
