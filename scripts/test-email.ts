import { Resend } from "resend";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendTestEmail() {
  console.log("Sending test email to support@kaulbyapp.com...\n");

  const timestamp = new Date().toISOString();

  const { data, error } = await resend.emails.send({
    from: "Test <support@steelmotionllc.com>",
    to: "support@kaulbyapp.com",
    subject: "Test Email Forwarding",
    text: `This is a test email to verify the forwarding from support@kaulbyapp.com to support@steelmotionllc.com.

Sent at: ${timestamp}

If you receive this at support@steelmotionllc.com, the webhook is working correctly!`,
  });

  if (error) {
    console.error("Failed to send email:", error);
  } else {
    console.log("Email sent successfully!");
    console.log("Email ID:", data?.id);
  }
}

sendTestEmail();
