/**
 * TermsPage - dedicated /terms page. Template content, "CalendarFly" +
 * generic details per the site owner's choice — flagged in LegalPageLayout
 * as needing legal review before publishing.
 */
import React from 'react';
import LegalPageLayout, { LegalSection } from './components/LegalPageLayout';

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" effectiveDate="[Insert date before publishing]" hideDisclaimer>
      <LegalSection title="1. Agreement to Terms">
        <p>
          These Terms of Service ("Terms") govern your access to and use of CalendarFly's event management
          platform for small organizations, nonprofits, and cultural centers (the "Service"). By creating an
          account or using the Service, you agree to these Terms.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts and Organizations">
        <ul className="list-disc pl-5 space-y-1">
          <li>You must provide accurate information when creating an account or organization.</li>
          <li>You're responsible for activity that happens under your account, including content added by users you invite.</li>
          <li>Organization admins are responsible for the accuracy of event, calendar import, and RSVP content they publish.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Subscriptions and Plans">
        <p>
          The Service is offered on Free, Starter, Pro, and Enterprise plans with different feature limits, as
          described on our <a href="/pricing" className="text-black underline">Pricing page</a>. Paid plans
          include a 7-day free trial. You can change or cancel your plan at any time from your account's
          Subscription page.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable Use">
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Post unlawful, harassing, or fraudulent content.</li>
          <li>Attempt to access another organization's data without authorization.</li>
          <li>Interfere with or disrupt the Service's infrastructure.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Your Content">
        <p>
          You retain ownership of the events, flyers, and other content your organization creates. You grant us a
          license to host and display that content as needed to operate the Service, including on your
          organization's public calendar.
        </p>
      </LegalSection>

      <LegalSection title="6. Termination">
        <p>
          You may stop using the Service and close your account at any time. We may suspend or terminate accounts
          that violate these Terms.
        </p>
      </LegalSection>

      <LegalSection title="7. Disclaimers and Limitation of Liability">
        <p>
          The Service is provided "as is" without warranties of any kind. To the extent permitted by law,
          CalendarFly is not liable for indirect or consequential damages arising from use of the Service.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to These Terms">
        <p>
          We may update these Terms from time to time. Continued use of the Service after changes take effect
          means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact Us">
        <p>
          Questions about these Terms? Reach us through the <a href="/contact" className="text-black underline">Contact page</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
