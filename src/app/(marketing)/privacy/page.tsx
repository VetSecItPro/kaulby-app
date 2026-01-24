import { Metadata } from "next";

// Static generation - revalidate every day
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Privacy Policy | Kaulby",
  description: "How Kaulby collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="container max-w-4xl py-16">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p className="text-muted-foreground leading-relaxed">
            Kaulby (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy
            Policy explains how we collect, use, disclose, and safeguard your information when you use
            our community monitoring service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>

          <h3 className="text-xl font-medium mb-3 mt-6">2.1 Information You Provide</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Account information (email, name, profile details)</li>
            <li>Payment information (processed securely via Polar)</li>
            <li>Monitor configurations (keywords, sources, preferences)</li>
            <li>Communications with our support team</li>
          </ul>

          <h3 className="text-xl font-medium mb-3 mt-6">2.2 Information Collected Automatically</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Usage data (features used, pages visited)</li>
            <li>Device information (browser type, operating system)</li>
            <li>IP address and general location</li>
            <li>Cookies and similar tracking technologies</li>
          </ul>

          <h3 className="text-xl font-medium mb-3 mt-6">2.3 Third-Party Data</h3>
          <p className="text-muted-foreground leading-relaxed">
            We collect publicly available content from platforms like Reddit, Hacker News, and Product Hunt
            based on your monitor configurations. This data is used solely to provide the monitoring service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Provide and maintain the Service</li>
            <li>Process your subscription and payments</li>
            <li>Send alerts and notifications based on your preferences</li>
            <li>Analyze and improve our Service</li>
            <li>Communicate with you about updates and features</li>
            <li>Detect and prevent fraud or abuse</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. AI Processing</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use artificial intelligence to analyze monitored content for sentiment, categorization,
            and summarization. This processing is performed to enhance your experience and provide
            actionable insights. Your monitor configurations and results are not used to train AI models.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Information Sharing</h2>
          <p className="text-muted-foreground leading-relaxed">We may share your information with:</p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li><strong>Service Providers:</strong> Third parties that help us operate the Service (e.g., payment processing, analytics, email delivery)</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            We do not sell your personal information to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
          <p className="text-muted-foreground leading-relaxed">
            We retain your information for as long as your account is active or as needed to provide
            the Service. Monitored results are retained according to your subscription plan:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li>Free plan: 7 days</li>
            <li>Pro plan: 30 days</li>
            <li>Enterprise plan: 365 days</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            You may request deletion of your account and data at any time.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Data Security</h2>
          <p className="text-muted-foreground leading-relaxed">
            We implement appropriate technical and organizational measures to protect your information,
            including encryption, access controls, and secure infrastructure. However, no method of
            transmission over the Internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Your Rights</h2>
          <p className="text-muted-foreground leading-relaxed">Depending on your location, you may have the right to:</p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li>Access your personal information</li>
            <li>Correct inaccurate data</li>
            <li>Delete your data</li>
            <li>Object to or restrict processing</li>
            <li>Data portability</li>
            <li>Withdraw consent</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            To exercise these rights, contact us at privacy@kaulbyapp.com.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use cookies and similar technologies to maintain your session, remember preferences,
            and analyze usage. You can control cookies through your browser settings, but disabling
            them may affect Service functionality.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">10. Third-Party Services</h2>
          <p className="text-muted-foreground leading-relaxed">We use the following third-party services:</p>
          <ul className="list-disc list-inside text-muted-foreground mt-4 space-y-2">
            <li><strong>Clerk:</strong> Authentication and user management</li>
            <li><strong>Polar:</strong> Payment processing (Merchant of Record)</li>
            <li><strong>PostHog:</strong> Product analytics</li>
            <li><strong>Loops:</strong> Email communications</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Each service has its own privacy policy governing data handling.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Children&apos;s Privacy</h2>
          <p className="text-muted-foreground leading-relaxed">
            The Service is not intended for users under 18 years of age. We do not knowingly collect
            information from children. If you believe we have collected information from a child,
            please contact us immediately.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">12. International Transfers</h2>
          <p className="text-muted-foreground leading-relaxed">
            Your information may be transferred to and processed in countries other than your own.
            We ensure appropriate safeguards are in place for such transfers in accordance with
            applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">13. Changes to This Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of significant
            changes via email or through the Service. Your continued use after changes constitutes
            acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">14. Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have questions about this Privacy Policy or our data practices, please contact us at:
          </p>
          <p className="text-muted-foreground leading-relaxed mt-4">
            Email: privacy@kaulbyapp.com
          </p>
        </section>
      </div>
    </div>
  );
}
