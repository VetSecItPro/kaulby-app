"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Users } from "lucide-react";

interface InviteDetails {
  email: string;
  workspaceName: string;
  inviterName: string;
  expiresAt: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn, isLoaded, user } = useUser();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);

  const token = params.token as string;

  // Fetch invite details
  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`/api/invite/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to load invite");
          return;
        }

        setInvite(data.invite);
      } catch {
        setError("Failed to load invite details");
      } finally {
        setLoading(false);
      }
    }

    fetchInvite();
  }, [token]);

  // Accept invite
  async function handleAccept() {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invite");
        setAccepting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch {
      setError("Failed to accept invite");
      setAccepting(false);
    }
  }

  // Loading state
  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading invite...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button variant="outline">Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>Welcome to the team!</CardTitle>
            <CardDescription>
              You&apos;ve joined {invite?.workspaceName}. Redirecting to dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not signed in
  if (!isSignedIn) {
    const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(`/invite/${token}`)}`;
    const signUpUrl = `/sign-up?redirect_url=${encodeURIComponent(`/invite/${token}`)}`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Link href="/" className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-black flex items-center justify-center">
                <Image
                  src="/logo.jpg"
                  alt="Kaulby"
                  width={32}
                  height={32}
                  className="object-cover w-full h-full"
                />
              </div>
              <span className="text-xl font-bold gradient-text">Kaulby</span>
            </Link>
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>You&apos;re Invited!</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">{invite?.inviterName}</span> invited you to join{" "}
              <span className="font-medium text-foreground">{invite?.workspaceName}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Sign in or create an account with <span className="font-medium">{invite?.email}</span> to accept this invite.
            </p>
            <div className="flex flex-col gap-2">
              <Link href={signInUrl} className="w-full">
                <Button className="w-full">Sign In</Button>
              </Link>
              <Link href={signUpUrl} className="w-full">
                <Button variant="outline" className="w-full">Create Account</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Signed in - show accept button
  const emailMismatch = user?.primaryEmailAddress?.emailAddress?.toLowerCase() !== invite?.email.toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-black flex items-center justify-center">
              <Image
                src="/logo.jpg"
                alt="Kaulby"
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            </div>
            <span className="text-xl font-bold gradient-text">Kaulby</span>
          </Link>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join {invite?.workspaceName}</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{invite?.inviterName}</span> invited you to join their team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailMismatch && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-400">
              This invite was sent to <span className="font-medium">{invite?.email}</span>.
              You&apos;re signed in as <span className="font-medium">{user?.primaryEmailAddress?.emailAddress}</span>.
              Please sign in with the correct email.
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button
            className="w-full"
            onClick={handleAccept}
            disabled={accepting || emailMismatch}
          >
            {accepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Accept Invitation"
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            As a team member, you&apos;ll have access to all monitors and results.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
