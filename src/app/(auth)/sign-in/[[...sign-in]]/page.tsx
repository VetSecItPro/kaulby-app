import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
      {/* Logo */}
      <div className="mb-8 animate-fade-in">
        <Image
          src="/logo.jpg"
          alt="Kaulby"
          width={120}
          height={120}
          className="rounded-2xl"
          priority
        />
      </div>

      {/* Sign In Form */}
      <div className="animate-fade-up">
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-zinc-900/80 border border-zinc-800 shadow-2xl backdrop-blur-sm",
              headerTitle: "text-white",
              headerSubtitle: "text-zinc-400",
              socialButtonsBlockButton: "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white",
              socialButtonsBlockButtonText: "text-white",
              dividerLine: "bg-zinc-700",
              dividerText: "text-zinc-500",
              formFieldLabel: "text-zinc-300",
              formFieldInput: "bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500",
              formButtonPrimary: "bg-teal-500 hover:bg-teal-600 text-black font-semibold",
              footerActionLink: "text-teal-400 hover:text-teal-300",
              identityPreviewText: "text-white",
              identityPreviewEditButton: "text-teal-400",
            }
          }}
          fallback={
            <div className="text-center p-8">
              <p className="text-zinc-400">Loading sign in...</p>
            </div>
          }
        />
      </div>
    </div>
  );
}
