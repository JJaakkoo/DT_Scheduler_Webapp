import React from 'react';
import Link from 'next/link';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-dreamtea-light py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden p-8 sm:p-12">
        <div className="mb-8">
          <Link href="/" className="text-dreamtea-blue hover:underline text-sm font-medium flex items-center gap-1">
            <BackIcon />
            Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-text-primary mb-6">Terms of Service</h1>
        <p className="text-sm text-text-secondary mb-8">Last Updated: 8/16/2026</p>

        <div className="prose prose-sm sm:prose-base text-text-primary space-y-6">
          <p>
            Please read these Terms of Service ("Terms") carefully before using the Dream Tea Nexus Portal ("Service").
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">2. Access and Use</h2>
          <p>
            This portal is strictly intended for authorized Dream Tea staff scheduling and management. Access to the portal is contingent upon your active employment. Account access, along with all associated permissions, will be immediately revoked upon termination or resignation. You are responsible for maintaining the confidentiality of your account and password, and you agree to accept responsibility for all activities that occur under your account.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">3. Prohibited Uses</h2>
          <p>You may use the Service only for lawful workplace purposes. You agree not to use the Service:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>To attempt to bypass whitelist restrictions, alter row-level security policies, or access another employee's account.</li>
            <li>To engage in unauthorized tampering with shift data, schedule assignments, or backend automation triggers.</li>
            <li>To share internal portal access, screenshots, or proprietary company data with unauthorized third parties or the general public.</li>
            <li>In any way that infringes upon the rights of others, or is illegal, fraudulent, or harmful to the operations of Dream Tea.</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-4">4. Limitation of Liability</h2>
          <p>
            In no event shall Dream Tea Nexus, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">5. Intellectual Property</h2>
          <p>
            The Service and its original content, features, frontend components, and backend functionality are and will remain the exclusive property of Dream Tea Nexus and its licensors.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">6. Changes to Terms</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">7. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at <strong>jakozeng@gmail.com</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// SVGs extracted as lightweight helper components
// --------------------------------------------------------------------------------

const BackIcon = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
  </svg>
);
