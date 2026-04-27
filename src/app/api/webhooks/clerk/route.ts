import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";

// PERF: Webhook processing may take longer than default 10s - FIX-016
export const maxDuration = 60;
import { eq, sql } from "drizzle-orm";
import { upsertContact, sendWelcomeEmail } from "@/lib/email";
import { identifyUser } from "@/lib/posthog";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add CLERK_WEBHOOK_SECRET to your .env.local file");
  }

  const headersList = await headers();
  const svix_id = headersList.get("svix-id");
  const svix_timestamp = headersList.get("svix-timestamp");
  const svix_signature = headersList.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  const payload = await request.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let event: WebhookEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (error) {
    logger.error("Error verifying webhook:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // SECURITY (SEC-INTEG-008): Idempotency guard - prevent duplicate event processing
  const eventId = svix_id;
  try {
    await db.insert(webhookEvents).values({
      eventId,
      eventType: event.type,
      provider: "clerk",
    });
  } catch (dupError: unknown) {
    if (dupError instanceof Error && dupError.message?.includes("unique")) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw dupError;
  }

  try {
    switch (event.type) {
      case "user.created": {
        const { id, email_addresses, first_name, last_name } = event.data;
        const primaryEmail = email_addresses.find(
          (email) => email.id === event.data.primary_email_address_id
        );

        const email = primaryEmail?.email_address || "";
        const name = [first_name, last_name].filter(Boolean).join(" ") || null;

        // Check for existing user with same email (handles re-signup after account deletion)
        const existingUser = email
          ? await db.query.users.findFirst({
              where: eq(users.email, email),
            })
          : null;

        let isNewUser = true;

        if (existingUser) {
          // User with this email already exists - update their Clerk ID
          // This handles cases where:
          // 1. User deleted their Clerk account but DB record remained
          // 2. User signed up again with the same email
          // Security note: We don't expose "email already exists" externally
          logger.warn(`[clerk-webhook] Linking existing user ${existingUser.id} to new Clerk ID ${id}`);

          // Can't just UPDATE the PK because child tables have FK constraints
          // without ON UPDATE CASCADE. Must: create new row → migrate FKs → delete old row.
          const oldId = existingUser.id;

          // 1. Temporarily clear email on old row to avoid unique constraint conflict
          await db.update(users).set({ email: `migrating-${oldId}@placeholder` }).where(eq(users.id, oldId));

          // 2. Insert new user row with the new Clerk ID and all existing data
          await db.execute(
            sql`INSERT INTO users (id, email, name, subscription_status, subscription_id, created_at, updated_at,
              current_period_start, current_period_end, is_admin, timezone, workspace_id, workspace_role,
              is_founding_member, founding_member_number, founding_member_price_id, onboarding_completed,
              day_pass_expires_at, day_pass_purchase_count, last_day_pass_purchased_at,
              is_banned, banned_at, ban_reason, polar_customer_id, polar_subscription_id,
              deletion_requested_at, integrations, last_active_at, reengagement_email_sent_at,
              report_schedule, report_day, report_last_sent_at, digest_paused, trial_winback_sent_at,
              report_branding, tos_accepted_at)
            SELECT ${id}, ${email}, COALESCE(${name}, name), subscription_status, subscription_id, created_at, NOW(),
              current_period_start, current_period_end, is_admin, timezone, workspace_id, workspace_role,
              is_founding_member, founding_member_number, founding_member_price_id, onboarding_completed,
              day_pass_expires_at, day_pass_purchase_count, last_day_pass_purchased_at,
              is_banned, banned_at, ban_reason, polar_customer_id, polar_subscription_id,
              deletion_requested_at, integrations, last_active_at, reengagement_email_sent_at,
              report_schedule, report_day, report_last_sent_at, digest_paused, trial_winback_sent_at,
              report_branding, tos_accepted_at
            FROM users WHERE id = ${oldId}`
          );

          // 3. Migrate all FK references from old ID to new ID
          const childTables = [
            "activity_logs", "ai_logs", "ai_visibility_checks", "api_keys",
            "audiences", "bookmark_collections", "bookmarks", "chat_conversations",
            "email_delivery_failures", "email_events", "feedback", "monitors",
            "notifications", "saved_searches", "shared_reports", "usage",
            "user_detection_keywords", "webhooks",
          ];
          for (const table of childTables) {
            await db.execute(
              sql`UPDATE ${sql.identifier(table)} SET user_id = ${id} WHERE user_id = ${oldId}`
            );
          }
          // Also update workspace_members if it exists
          try {
            await db.execute(
              sql`UPDATE ${sql.identifier("workspace_members")} SET user_id = ${id} WHERE user_id = ${oldId}`
            );
          } catch { /* table may not exist */ }

          // 4. Delete old user row
          await db.delete(users).where(eq(users.id, oldId));

          logger.warn(`[clerk-webhook] Successfully migrated user ${oldId} → ${id}`);
          isNewUser = false;
        } else {
          // Create new user in database
          await db.insert(users).values({
            id, // Use Clerk ID as primary key
            email,
            name,
          });
        }

        // Send welcome email (only for truly new users)
        if (isNewUser) {
          try {
            await upsertContact({
              email,
              firstName: first_name || undefined,
              lastName: last_name || undefined,
              userId: id,
              subscriptionStatus: "free",
            });

            await sendWelcomeEmail({
              email,
              name: first_name || undefined,
            });
          } catch (emailError) {
            logger.error("Email error:", { error: emailError instanceof Error ? emailError.message : String(emailError) });
          }
        }

        // Identify in PostHog
        identifyUser({
          distinctId: id,
          properties: {
            email,
            name,
            createdAt: new Date().toISOString(),
            isReturningUser: !isNewUser,
          },
        });

        break;
      }

      case "user.updated": {
        const { id, email_addresses, first_name, last_name } = event.data;
        const primaryEmail = email_addresses.find(
          (email) => email.id === event.data.primary_email_address_id
        );

        const email = primaryEmail?.email_address || "";
        const name = [first_name, last_name].filter(Boolean).join(" ") || null;

        await db
          .update(users)
          .set({
            email,
            name,
            updatedAt: new Date(),
          })
          .where(eq(users.id, id));

        // Update contact info
        try {
          await upsertContact({
            email,
            firstName: first_name || undefined,
            lastName: last_name || undefined,
            userId: id,
          });
        } catch (emailError) {
          logger.error("Email error:", { error: emailError instanceof Error ? emailError.message : String(emailError) });
        }

        break;
      }

      case "user.deleted": {
        const { id } = event.data;
        if (id) {
          await db.delete(users).where(eq(users.id, id));
        }
        break;
      }

      default:
        // Unhandled Clerk event type - no action needed
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Webhook handler error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
