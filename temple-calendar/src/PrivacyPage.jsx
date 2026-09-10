/**
 * PrivacyPage - dedicated /privacy page. Template content, "CalendarFly" +
 * generic details per the site owner's choice — flagged in LegalPageLayout
 * as needing legal review before publishing.
 */
import React from 'react';
import LegalPageLayout, { LegalSection } from './components/LegalPageLayout';

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" effectiveDate="[Insert date before publishing]" hideDisclaimer>
      <LegalSection title="1. Overview">
        <p>
          This Privacy Policy explains how CalendarFly ("we", "us", "our") collects, uses, and protects information
          when you use our event management platform for small organizations, nonprofits, and cultural centers,
          including our website, admin dashboard, and public calendar pages (together, the "Service").
        </p>
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <p>We collect information in a few ways:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account information</strong> — name, email address, organization name, and role when you sign up or are added as a user.</li>
          <li><strong>Organization content</strong> — events, custom calendar imports, flyers, announcements, and other content your organization adds to the Service.</li>
          <li><strong>RSVP information</strong> — name and contact details submitted by community members through public RSVP pages.</li>
          <li><strong>Usage data</strong> — basic technical information like login timestamps, browser type, and pages visited, used for security and reliability.</li>
          <li><strong>Contact form submissions</strong> — anything you send us through our Contact page.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How We Use Information">
        <ul className="list-disc pl-5 space-y-1">
          <li>To operate and maintain the Service, including your organization's calendar and admin dashboard.</li>
          <li>To communicate with you about your account, subscription, and support requests.</li>
          <li>To improve the Service's features and reliability.</li>
          <li>To send optional broadcasts and notifications your organization chooses to send to its own community.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. How We Share Information">
        <p>
          We do not sell personal information. We may share information with service providers who help us run the
          Service (for example, cloud hosting and email delivery), and when required by law.
        </p>
      </LegalSection>

      <LegalSection title="5. Data Retention">
        <p>
          We retain account and organization data for as long as your account is active, or as needed to provide
          the Service. You can request deletion of your organization's data by contacting us.
        </p>
      </LegalSection>

      <LegalSection title="6. Your Choices">
        <p>
          You can update your account details from your Profile page at any time. To request a copy of your data
          or ask us to delete it, use the Contact page.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact Us">
        <p>
          Questions about this policy? Reach us through the <a href="/contact" className="text-black underline">Contact page</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
