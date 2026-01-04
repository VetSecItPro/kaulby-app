import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { upsertContact, sendWelcomeEmail } from "@/lib/loops";
import { identifyUser } from "@/lib/posthog";

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
    console.error("Error verifying webhook:", error);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
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

        // Create user in database
        await db.insert(users).values({
          id, // Use Clerk ID as primary key
          email,
          name,
        });

        // Add to Loops
        try {
          await upsertContact({
            email,
            firstName: first_name || undefined,
            lastName: last_name || undefined,
            userId: id,
            subscriptionStatus: "free",
          });

          // Send welcome email
          await sendWelcomeEmail({
            email,
            name: first_name || undefined,
          });
        } catch (loopsError) {
          console.error("Loops error:", loopsError);
        }

        // Identify in PostHog
        identifyUser({
          distinctId: id,
          properties: {
            email,
            name,
            createdAt: new Date().toISOString(),
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

        // Update in Loops
        try {
          await upsertContact({
            email,
            firstName: first_name || undefined,
            lastName: last_name || undefined,
            userId: id,
          });
        } catch (loopsError) {
          console.error("Loops error:", loopsError);
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
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
