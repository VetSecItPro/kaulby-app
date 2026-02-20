"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Loader2, CheckCircle } from "lucide-react";
import { submitSupportTicket } from "@/app/(dashboard)/dashboard/help/actions";

export function SupportForm() {
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<{
    category: string;
    subject: string;
    message: string;
  }>({
    category: "",
    subject: "",
    message: "",
  });
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleSubmitTicket = () => {
    setSubmitStatus({ type: null, message: "" });

    startTransition(async () => {
      const result = await submitSupportTicket(formState);

      if (result.success) {
        setSubmitStatus({
          type: "success",
          message: "Your message has been sent! We'll get back to you within 24 hours.",
        });
        setFormState({ category: "", subject: "", message: "" });
      } else {
        setSubmitStatus({
          type: "error",
          message: result.error || "Something went wrong. Please try again.",
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Send className="h-5 w-5" />
          Submit a Support Ticket
        </CardTitle>
        <CardDescription>
          Describe your issue and we&apos;ll get back to you within 24 hours. Team customers receive priority support.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {submitStatus.type === "success" ? (
          <div className="p-6 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Message Sent!</h3>
            <p className="text-sm text-green-700 dark:text-green-300 mb-4">
              {submitStatus.message}
            </p>
            <Button
              variant="outline"
              onClick={() => setSubmitStatus({ type: null, message: "" })}
            >
              Submit Another Request
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formState.category}
                onValueChange={(value) => setFormState({ ...formState, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="What can we help with?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technical Issue">Technical Issue</SelectItem>
                  <SelectItem value="Billing Question">Billing Question</SelectItem>
                  <SelectItem value="Feature Request">Feature Request</SelectItem>
                  <SelectItem value="Account Help">Account Help</SelectItem>
                  <SelectItem value="Platform/Integration">Platform / Integration</SelectItem>
                  <SelectItem value="General Question">General Question</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Brief description of your issue"
                value={formState.subject}
                onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, or relevant context that might help us assist you faster."
                className="min-h-[150px]"
                value={formState.message}
                onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formState.message.length}/5000
              </p>
            </div>

            {submitStatus.type === "error" && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">{submitStatus.message}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Or email us directly at{" "}
                <a href="mailto:support@kaulbyapp.com" className="text-primary hover:underline">
                  support@kaulbyapp.com
                </a>
              </p>
              <Button
                onClick={handleSubmitTicket}
                disabled={isPending || !formState.category || !formState.subject || !formState.message}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
