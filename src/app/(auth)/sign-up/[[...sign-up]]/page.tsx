"use client";

import { useSignUp } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FoundingMembersBanner } from "@/components/founding-members-banner";

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
        <div className="mb-8 animate-fade-in">
          <Image src="/logo.jpg" alt="Kaulby" width={120} height={120} className="rounded-2xl" priority />
        </div>
        <div className="text-center p-8">
          <p className="text-zinc-400">Loading sign up...</p>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError("");
    setSubmitting(true);

    try {
      await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerifying(true);
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr.errors?.[0]?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError("");
    setSubmitting(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.push("/pricing");
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr.errors?.[0]?.message || "Invalid verification code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (!signUp) return;
    setError("");
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch {
      setError("Failed to resend code. Please try again.");
    }
  }

  // Email verification step
  if (verifying) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
        <div className="mb-8 animate-fade-in">
          <Image src="/logo.jpg" alt="Kaulby" width={120} height={120} className="rounded-2xl" priority />
        </div>
        <div className="animate-fade-up w-full max-w-[400px]">
          <div className="bg-zinc-900/80 border border-zinc-800 shadow-2xl backdrop-blur-sm rounded-xl p-8">
            <h1 className="text-xl font-semibold text-white text-center mb-1">Verify your email</h1>
            <p className="text-zinc-400 text-sm text-center mb-6">
              We sent a code to <span className="text-white">{email}</span>
            </p>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Verification code
                </label>
                <input
                  id="code"
                  name="one-time-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter code"
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !code}
                className="w-full rounded-lg bg-teal-500 hover:bg-teal-600 text-black font-semibold py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Verifying..." : "Verify"}
              </button>
            </form>

            <button
              onClick={handleResendCode}
              className="w-full mt-3 text-sm text-teal-400 hover:text-teal-300 transition-colors"
            >
              Resend code
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Sign-up form
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
      <div className="mb-8 animate-fade-in">
        <Image src="/logo.jpg" alt="Kaulby" width={120} height={120} className="rounded-2xl" priority />
      </div>

      <div className="animate-fade-up w-full max-w-[400px]">
        <div className="bg-zinc-900/80 border border-zinc-800 shadow-2xl backdrop-blur-sm rounded-xl p-8">
          <h1 className="text-xl font-semibold text-white text-center mb-1">Create your account</h1>
          <p className="text-zinc-400 text-sm text-center mb-4">Welcome! Please fill in the details to get started.</p>

          <div className="mb-5">
            <FoundingMembersBanner variant="compact" />
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            {/* Hidden decoy to absorb any residual autofill */}
            <input type="text" name="fake-user" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden="true" />
            <input type="password" name="fake-pass" autoComplete="current-password" className="hidden" tabIndex={-1} aria-hidden="true" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  First name
                </label>
                <input
                  id="firstName"
                  name="given-name-new"
                  type="text"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Last name
                </label>
                <input
                  id="lastName"
                  name="family-name-new"
                  type="text"
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                name="new-email-signup"
                type="email"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="new-password-signup"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            {/* Clerk CAPTCHA widget - required for bot protection with custom flows */}
            <div id="clerk-captcha" className="mb-2" />

            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="w-full rounded-lg bg-teal-500 hover:bg-teal-600 text-black font-semibold py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              {submitting ? "Creating account..." : (
                <>Continue <span aria-hidden="true">&#9654;</span></>
              )}
            </button>
          </form>

          <p className="text-sm text-zinc-500 text-center mt-4">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-teal-400 hover:text-teal-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
