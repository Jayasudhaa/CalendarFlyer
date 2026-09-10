/**
 * SecurityPage - dedicated /security page. Grounded in what's actually
 * implemented in the codebase (bcrypt hashing, JWT auth, org-partitioned
 * data, role-based access) rather than claiming certifications/audits that
 * don't exist yet. Template content per the site owner's choice — flagged
 * in LegalPageLayout as needing review before publishing.
 */
import React from 'react';
import LegalPageLayout, { LegalSection } from './components/LegalPageLayout';

export default function SecurityPage() {
  return (
    <LegalPageLayout title="Security" effectiveDate="[Insert date before publishing]" hideDisclaimer>
      <LegalSection title="Our Approach">
        <p>
          CalendarFly is built as a multi-tenant platform, meaning every organization's data — events, calendar
          imports, RSVPs, and settings — is kept separate and scoped to that organization. Here's a plain-language
          look at how we handle security today.
        </p>
      </LegalSection>

      <LegalSection title="Account Security">
        <ul className="list-disc pl-5 space-y-1">
          <li>Passwords are never stored in plain text — they're hashed with bcrypt before being saved.</li>
          <li>Login sessions use signed JWT tokens with an expiration window.</li>
          <li>Accounts have role-based access (owner, admin, viewer) so not every user can perform every action.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Data Isolation">
        <ul className="list-disc pl-5 space-y-1">
          <li>Every organization's data is scoped by a unique organization ID, so one organization cannot see or modify another's events, users, or settings.</li>
          <li>Admin-level platform tools are separated from regular organization accounts and require separate authentication.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Infrastructure">
        <p>
          The Service runs on cloud infrastructure (Amazon Web Services) for data storage and hosting. In
          production, session cookies are marked secure and HTTP-only, and cross-origin requests are restricted to
          approved domains.
        </p>
      </LegalSection>

      <LegalSection title="What We're Not Claiming">
        <p>
          We're an early-stage product. We have not yet completed a formal third-party security audit, penetration
          test, or compliance certification (e.g. SOC 2). If your organization requires that level of assurance,
          please reach out via the Contact page before relying on the Service for sensitive data.
        </p>
      </LegalSection>

      <LegalSection title="Reporting a Security Issue">
        <p>
          If you believe you've found a security vulnerability, please contact us directly rather than filing a
          public report, so we can investigate and respond before any details are made public.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
