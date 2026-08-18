import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-dreamtea-light py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden p-8 sm:p-12">
        <div className="mb-8">
          <Link href="/" className="text-dreamtea-blue hover:underline text-sm font-medium flex items-center gap-1">
            <BackIcon />
            Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-text-primary mb-6">Privacy Policy</h1>
        <p className="text-sm text-text-secondary mb-8">Last Updated: 8/16/2026</p>

        <div className="prose prose-sm sm:prose-base text-text-primary space-y-6">
          <p>
            Welcome to the Dream Tea Nexus Portal ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and secure your information when you use our internal scheduling and automation web application.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">1. Information We Collect</h2>
          <p>We collect personal information necessary for employment administration and scheduling when you are registered on the portal, including:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Personal Info:</strong> Your email address.</li>
            <li><strong>Credentials:</strong> Passwords and similar security information used for authentication and secure account access.</li>
            <li><strong>Usage Data:</strong> Scheduling information, shifts, availability, and activity logs within the portal.</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-4">2. Cookies and Session Management</h2>
          <p>
            To keep you securely logged into the portal during your session, we utilize standard authentication mechanics, including local storage and functional cookies. These are strictly used to maintain your login state and ensure secure access to your account.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">3. How We Use Your Information</h2>
          <p>We use the personal information collected via our portal strictly for internal business purposes, including:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>To facilitate the account creation and secure logon process.</li>
            <li>To manage user accounts and provide access to the internal scheduling system.</li>
            <li>To send administrative information to you, such as changes to our terms, conditions, and policies.</li>
            <li>To manage shifts, coordinate scheduling, and execute portal automation tasks.</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-4">4. Data Security</h2>
          <p>
            We take the security of your employment data seriously. User information is protected through strict database-level security protocols, including row-level security and explicit whitelist rules. These measures ensure that staff members can only access their own personal data and authorized scheduling information.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">5. Will Your Information Be Shared?</h2>
          <p>
            We only share information with your consent, to comply with laws, to manage your employment services, or to fulfill business obligations. We use trusted third-party infrastructure providers (such as Supabase for secure authentication and database hosting, and Vercel for web hosting) who operate under their own strict privacy policies and modern data protection standards.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">6. How Long Do We Keep Your Information?</h2>
          <p>
            We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy policy and your duration of employment, unless a longer retention period is required or permitted by law.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">7. Contact Us</h2>
          <p>
            If you have questions or comments about this policy, you may email us at <strong>jakozeng@gmail.com</strong>.
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
