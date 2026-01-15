import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-card border border-border shadow-lg",
          }
        }}
        fallback={
          <div className="text-center p-8">
            <p className="text-muted-foreground">Loading sign up...</p>
          </div>
        }
      />
    </div>
  );
}
