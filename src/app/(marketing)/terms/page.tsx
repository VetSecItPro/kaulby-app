import { Metadata } from "next";

// Static generation - revalidate every day
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Terms of Service | Kaulby",
  description: "Terms and conditions for using Kaulby's community monitoring service.",
};

export default function TermsPage() {
  return (
    <div className="container max-w-4xl py-16">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            By accessing or using Kaulby (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
            If you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
          <p className="text-muted-foreground leading-relaxed">
            Kaulby is a community monitoring platform that helps you track mentions, keywords, and conversations
            across various online platforms including Reddit, Hacker News, Product Hunt, and more. The Service
            includes AI-powered analysis features for sentiment detection and categorization.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>
          <p className="text-muted-foreground leading-relaxed">
            To use the Service, you must create an account. You agree to provide accurate information and
            maintain the security of your account credentials. You are responsible for all activities that
            occur under your account.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Subscription and Billing</h2>
          <p className="text-muted-foreground leading-relaxed">
            Kaulby offers free and paid subscription plans. Paid subscriptions are billed in advance on a
            monthly basis. You may cancel your subscription at any time, and cancellation will take effect
            at the end of the current billing period.
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li>Free plan: Limited monitors and results</li>
            <li>Pro plan: Extended limits and AI features</li>
            <li>Enterprise plan: Unlimited usage with priority support</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Acceptable Use</h2>
          <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to any part of the Service</li>
            <li>Interfere with or disrupt the Service or servers</li>
            <li>Use the Service to harass, stalk, or harm others</li>
            <li>Violate the terms of service of monitored platforms</li>
            <li>Resell or redistribute the Service without authorization</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
          <p className="text-muted-foreground leading-relaxed">
            The Service and its original content, features, and functionality are owned by Kaulby and are
            protected by international copyright, trademark, and other intellectual property laws.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Data and Privacy</h2>
          <p className="text-muted-foreground leading-relaxed">
            Your use of the Service is also governed by our Privacy Policy. By using the Service, you
            consent to the collection and use of information as described in the Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Third-Party Services</h2>
          <p className="text-muted-foreground leading-relaxed">
            The Service may integrate with or link to third-party services (e.g., Reddit, Hacker News).
            We are not responsible for the content, policies, or practices of any third-party services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
          <p className="text-muted-foreground leading-relaxed">
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either
            express or implied. We do not guarantee that the Service will be uninterrupted, secure, or
            error-free.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            To the maximum extent permitted by law, Kaulby shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages resulting from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            We reserve the right to modify these Terms at any time. We will notify users of significant
            changes via email or through the Service. Continued use after changes constitutes acceptance
            of the modified Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">12. Termination</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may terminate or suspend your account and access to the Service immediately, without prior
            notice, for conduct that we believe violates these Terms or is harmful to other users, us,
            or third parties.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have any questions about these Terms, please contact us at legal@kaulbyapp.com.
          </p>
        </section>
      </div>
    </div>
  );
}
