"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bug, HelpCircle, Shield, Send, Loader2, CheckCircle, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { submitSupportTicket } from "@/app/(dashboard)/dashboard/help/actions";

function ReportBugDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState({
    category: "Bug Report",
    subject: "",
    message: "",
  });
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const resetForm = () => {
    setFormState({ category: "Bug Report", subject: "", message: "" });
    setSubmitStatus({ type: null, message: "" });
  };

  const handleSubmit = () => {
    setSubmitStatus({ type: null, message: "" });
    startTransition(async () => {
      const result = await submitSupportTicket(formState);
      if (result.success) {
        setSubmitStatus({
          type: "success",
          message: "Your report has been sent! We'll get back to you within 24 hours.",
        });
      } else {
        setSubmitStatus({
          type: "error",
          message: result.error || "Something went wrong. Please try again.",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Bug className="h-3.5 w-3.5" />
          Report a Bug
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Report a Bug
          </DialogTitle>
          <DialogDescription>
            Describe the issue and we&apos;ll get back to you.
          </DialogDescription>
        </DialogHeader>

        {submitStatus.type === "success" ? (
          <div className="py-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Report Sent!</h3>
            <p className="text-sm text-muted-foreground mb-4">Your report has been sent. We&apos;ll get back to you.</p>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bug-category">Category</Label>
              <Select
                value={formState.category}
                onValueChange={(value) => setFormState({ ...formState, category: value })}
              >
                <SelectTrigger id="bug-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bug Report">Bug Report</SelectItem>
                  <SelectItem value="Technical Issue">Technical Issue</SelectItem>
                  <SelectItem value="Feature Request">Feature Request</SelectItem>
                  <SelectItem value="Billing Question">Billing Question</SelectItem>
                  <SelectItem value="General Question">General Question</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bug-subject">Subject</Label>
              <Input
                id="bug-subject"
                placeholder="Brief description of the issue"
                value={formState.subject}
                onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bug-message">Details</Label>
              <Textarea
                id="bug-message"
                placeholder="Steps to reproduce, error messages, or any relevant context..."
                className="min-h-[120px]"
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

            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={isPending || !formState.subject || !formState.message}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Report
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DashboardFooter() {
  return (
    <footer className="border-t bg-muted/30 py-6 px-6 mt-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md overflow-hidden bg-black flex items-center justify-center">
              <Image
                src="/logo.jpg"
                alt="Kaulby"
                width={24}
                height={24}
                className="object-cover w-full h-full"
              />
            </div>
            <span className="text-sm font-semibold gradient-text">Kaulby</span>
          </Link>
          <span className="text-xs text-muted-foreground/50">|</span>
          <p className="text-xs text-muted-foreground/70">
            &copy; {new Date().getFullYear()} All rights reserved.
          </p>
        </div>

        {/* Links */}
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link
            href="/dashboard/help"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Help Center
          </Link>
          <ReportBugDialog />
          <Link
            href="/docs/api"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            API Docs
          </Link>
          <Link
            href="/privacy"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-foreground transition-colors"
          >
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
