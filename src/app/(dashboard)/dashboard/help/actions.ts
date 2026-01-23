"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SupportTicketData {
  category: string;
  subject: string;
  message: string;
}

export async function submitSupportTicket(data: SupportTicketData) {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId) {
    return { success: false, error: "You must be logged in to submit a support ticket" };
  }

  const userEmail = user?.emailAddresses[0]?.emailAddress || "unknown";
  const userName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : user?.username || "Unknown User";

  // Validate inputs
  if (!data.category || !data.subject || !data.message) {
    return { success: false, error: "Please fill in all fields" };
  }

  if (data.subject.length > 200) {
    return { success: false, error: "Subject is too long (max 200 characters)" };
  }

  if (data.message.length > 5000) {
    return { success: false, error: "Message is too long (max 5000 characters)" };
  }

  try {
    // Send email to support
    await resend.emails.send({
      from: "Kaulby Support <support@kaulbyapp.com>",
      to: "support@kaulbyapp.com",
      replyTo: userEmail,
      subject: `[${data.category}] ${data.subject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0a0a0a; padding: 24px; border-radius: 12px;">
            <h2 style="color: #fafafa; margin: 0 0 24px 0; font-size: 20px;">New Support Ticket</h2>

            <div style="background: #141414; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="color: #a1a1aa; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Category</p>
              <p style="color: #fafafa; margin: 0; font-size: 14px;">${escapeHtml(data.category)}</p>
            </div>

            <div style="background: #141414; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="color: #a1a1aa; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Subject</p>
              <p style="color: #fafafa; margin: 0; font-size: 14px;">${escapeHtml(data.subject)}</p>
            </div>

            <div style="background: #141414; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="color: #a1a1aa; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Message</p>
              <p style="color: #fafafa; margin: 0; font-size: 14px; white-space: pre-wrap;">${escapeHtml(data.message)}</p>
            </div>

            <div style="border-top: 1px solid #262626; padding-top: 16px; margin-top: 16px;">
              <p style="color: #a1a1aa; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">User Details</p>
              <p style="color: #fafafa; margin: 0 0 4px 0; font-size: 14px;"><strong>Name:</strong> ${escapeHtml(userName)}</p>
              <p style="color: #fafafa; margin: 0 0 4px 0; font-size: 14px;"><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
              <p style="color: #fafafa; margin: 0; font-size: 14px;"><strong>User ID:</strong> ${escapeHtml(userId)}</p>
            </div>
          </div>

          <p style="color: #71717a; font-size: 12px; margin-top: 16px; text-align: center;">
            Reply directly to this email to respond to the user.
          </p>
        </div>
      `,
      text: `
New Support Ticket

Category: ${data.category}
Subject: ${data.subject}

Message:
${data.message}

---
User Details:
Name: ${userName}
Email: ${userEmail}
User ID: ${userId}

Reply directly to this email to respond to the user.
      `.trim(),
    });

    // Send confirmation to user
    await resend.emails.send({
      from: "Kaulby Support <support@kaulbyapp.com>",
      to: userEmail,
      subject: `We received your support request: ${data.subject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0a0a0a; padding: 24px; border-radius: 12px;">
            <h2 style="color: #fafafa; margin: 0 0 16px 0; font-size: 20px;">Thanks for reaching out!</h2>

            <p style="color: #a1a1aa; margin: 0 0 24px 0; font-size: 14px; line-height: 1.6;">
              We've received your support request and will get back to you as soon as possible.
              Our typical response time is within 24 hours.
            </p>

            <div style="background: #141414; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="color: #a1a1aa; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Your Request</p>
              <p style="color: #fafafa; margin: 0 0 8px 0; font-size: 14px;"><strong>${escapeHtml(data.subject)}</strong></p>
              <p style="color: #a1a1aa; margin: 0; font-size: 13px; white-space: pre-wrap;">${escapeHtml(data.message.substring(0, 500))}${data.message.length > 500 ? "..." : ""}</p>
            </div>

            <p style="color: #a1a1aa; margin: 0; font-size: 14px; line-height: 1.6;">
              You can reply directly to this email if you need to add more information.
            </p>
          </div>

          <p style="color: #71717a; font-size: 12px; margin-top: 16px; text-align: center;">
            Kaulby - Community Monitoring Made Simple
          </p>
        </div>
      `,
      text: `
Thanks for reaching out!

We've received your support request and will get back to you as soon as possible.
Our typical response time is within 24 hours.

Your Request:
${data.subject}

${data.message.substring(0, 500)}${data.message.length > 500 ? "..." : ""}

You can reply directly to this email if you need to add more information.

---
Kaulby - Community Monitoring Made Simple
      `.trim(),
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send support ticket:", error);
    return { success: false, error: "Failed to send your message. Please try again or email us directly." };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
