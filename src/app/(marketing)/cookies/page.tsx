import { Metadata } from "next";

// Static generation - revalidate every day
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Cookie Policy | Kaulby",
  description: "How Kaulby uses cookies and similar technologies to provide, improve, and protect our service.",
};

export default function CookiePolicyPage() {
  return (
    <div className="container max-w-4xl py-16">
      <h1 className="text-4xl font-bold mb-8">Cookie Policy</h1>
      <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. What Are Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cookies are small text files stored on your device when you visit a website. They help
            websites remember your preferences, keep you signed in, and understand how you use the
            service. Kaulby uses cookies and similar technologies (such as localStorage) to provide
            a secure, functional experience.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Essential Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            These cookies are strictly necessary for the service to function. They cannot be
            disabled without breaking core functionality.
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li>
              <strong>Clerk authentication session cookies:</strong> Maintain your signed-in state
              and secure your account. These are set by Clerk, our authentication provider, and
              are required for accessing your dashboard.
            </li>
            <li>
              <strong>CSRF protection tokens:</strong> Prevent cross-site request forgery attacks
              on form submissions.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Analytics Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use analytics cookies to understand how visitors interact with Kaulby so we can
            improve the product.
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li>
              <strong>PostHog:</strong> Tracks anonymized usage data such as pages visited,
              features used, and session duration. This helps us identify usability issues and
              prioritize improvements. PostHog data is used solely for product improvement and is
              not shared with third parties for advertising purposes.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Preference Storage</h2>
          <p className="text-muted-foreground leading-relaxed">
            Kaulby uses browser localStorage (not cookies) to remember certain preferences on
            your device. This data never leaves your browser and is not sent to our servers.
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li><strong>Theme preference:</strong> Your selected color theme (dark mode).</li>
            <li><strong>Timezone setting:</strong> Your preferred timezone for scheduling and display.</li>
            <li><strong>Onboarding state:</strong> Whether you have completed the onboarding wizard or dismissed the quick-start guide.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Third-Party Services That Set Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            The following third-party services may set cookies or similar identifiers when you use Kaulby:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li>
              <strong>Clerk:</strong> Authentication and user management. Sets session cookies to
              keep you signed in securely. See{" "}
              <a
                href="https://clerk.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Clerk&apos;s Privacy Policy
              </a>.
            </li>
            <li>
              <strong>PostHog:</strong> Product analytics. Sets cookies to track anonymized usage
              patterns. See{" "}
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                PostHog&apos;s Privacy Policy
              </a>.
            </li>
            <li>
              <strong>Polar.sh:</strong> Payment processing. May set cookies during the checkout
              and subscription management flow. See{" "}
              <a
                href="https://polar.sh/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Polar&apos;s Privacy Policy
              </a>.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. How to Manage Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            You can control and manage cookies through your browser settings. Most browsers allow
            you to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li>View what cookies are stored and delete them individually</li>
            <li>Block third-party cookies</li>
            <li>Block cookies from specific sites</li>
            <li>Block all cookies</li>
            <li>Delete all cookies when you close your browser</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Please note that blocking essential cookies will prevent you from signing in and using
            Kaulby. If you block analytics cookies, we will not be able to track your usage, but
            the service will continue to function normally.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            To clear localStorage data, use your browser&apos;s developer tools (usually accessible
            via F12) and navigate to the Application or Storage tab.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Changes to This Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Cookie Policy from time to time to reflect changes in our practices
            or for other operational, legal, or regulatory reasons. We encourage you to review this
            page periodically for the latest information on our cookie practices.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have questions about our use of cookies or this Cookie Policy, please contact us at:
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Email: privacy@kaulbyapp.com
          </p>
        </section>
      </div>
    </div>
  );
}
