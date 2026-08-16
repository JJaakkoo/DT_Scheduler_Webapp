import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-dreamtea-light py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden p-8 sm:p-12">
        <div className="mb-8">
          <Link href="/" className="text-dreamtea-blue hover:underline text-sm font-medium flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
            Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-text-primary mb-6">Privacy Policy</h1>
        <p className="text-sm text-text-secondary mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-sm sm:prose-base text-text-primary space-y-6">
          <p>
            Welcome to the Dream Tea Nexus Portal ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and share your information when you use our internal scheduling and automation web application.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">1. Information We Collect</h2>
          <p>We collect personal information that you voluntarily provide to us when you register on the portal, including:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Personal Info:</strong> Your email address.</li>
            <li><strong>Credentials:</strong> Passwords, password hints, and similar security information used for authentication and account access.</li>
            <li><strong>Usage Data:</strong> Scheduling information, shifts, availability, and activity logs within the portal.</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-4">2. How We Use Your Information</h2>
          <p>We use the personal information collected via our portal for a variety of business purposes described below:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>To facilitate account creation and logon process.</li>
            <li>To manage user accounts and provide access to the internal scheduling system.</li>
            <li>To send administrative information to you, such as changes to our terms, conditions, and policies.</li>
            <li>To manage shifts, scheduling, and portal automation tasks.</li>
          </ul>

          <h2 className="text-xl font-bold mt-8 mb-4">3. Will Your Information Be Shared?</h2>
          <p>
            We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations. We use third-party service providers (like Supabase for authentication and database hosting, and Vercel for web hosting) who have their own strict privacy policies and data protection standards.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">4. How Long Do We Keep Your Information?</h2>
          <p>
            We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy policy, unless a longer retention period is required or permitted by law.
          </p>

          <h2 className="text-xl font-bold mt-8 mb-4">5. Contact Us</h2>
          <p>
            If you have questions or comments about this policy, you may email us at <strong>jakozeng@gmail.com</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
