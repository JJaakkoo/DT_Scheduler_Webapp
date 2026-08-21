'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitUserFeedback } from '@/app/actions/feedback';
import { getCurrentUserRole } from '@/app/actions/claim';

export default function FeedbackPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [category, setCategory] = useState('Bug Report');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user is authenticated and not a guest
    const checkAuth = async () => {
      const currentRole = localStorage.getItem("nexus_role");
      if (!currentRole || currentRole === 'guest') {
        router.push('/');
        return;
      }
      
      const result = await getCurrentUserRole();
      if (result.role === 'guest' || result.role === 'unclaimed') {
        router.push('/');
        return;
      }
      setRole(result.role);
    };
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please provide some feedback before submitting.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const res = await submitUserFeedback(category, message);
    if (res.success) {
      setSuccess(true);
      setMessage('');
    } else {
      setError(res.error || 'Failed to submit feedback.');
    }
    
    setIsSubmitting(false);
  };

  if (!role) {
    return <div className="min-h-screen bg-[#c2e2f5] flex items-center justify-center"><SpinnerIcon /></div>;
  }

  return (
    <main className="min-h-[100dvh] w-screen flex flex-col bg-[#c2e2f5] font-sans p-4 sm:p-8">
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 mt-8 sm:mt-12">
        
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="bg-white/80 hover:bg-white text-gray-700 font-medium px-4 py-2 rounded-full shadow-sm transition-colors text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="bg-white/80 px-4 py-1.5 rounded-full text-xs font-bold text-gray-600 shadow-sm uppercase tracking-wider flex items-center gap-2">
             Nexus Portal Feedback
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-[32px] p-6 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.1)] flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 opacity-60"></div>
          
          <div className="flex items-center gap-4 mb-8">
             <img src="/dreamtealogo.svg" alt="Dream Tea Logo" className="w-12 h-12 object-contain" />
             <div>
               <h1 className="text-2xl font-bold text-gray-800">Submit Feedback</h1>
               <p className="text-sm text-gray-500 font-medium">Found a bug or have a suggestion? Let us know!</p>
             </div>
          </div>

          {success ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center flex flex-col items-center animate-in fade-in zoom-in duration-300 shadow-sm">
               <div className="w-16 h-16 bg-white border-2 border-gray-100 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                 </svg>
               </div>
               <h2 className="text-xl font-bold text-gray-800 mb-2">Thank you!</h2>
               <p className="text-gray-600 text-sm mb-6">Your feedback has been submitted successfully.</p>
               <button 
                 onClick={() => { setSuccess(false); setCategory('Bug Report'); }}
                 className="bg-white border-2 border-gray-200 text-gray-600 font-bold px-6 py-2 rounded-full hover:bg-gray-50 transition-colors text-sm"
               >
                 Submit Another
               </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Category</label>
                <div className="relative">
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-[52px] appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 text-gray-700 font-medium outline-none focus:border-[#8ab4f8] focus:ring-2 focus:ring-[#8ab4f8]/20 transition-all cursor-pointer"
                  >
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Suggestion">Feature Suggestion</option>
                    <option value="UI/UX Improvement">UI/UX Improvement</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Message</label>
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe the issue or suggestion in detail..."
                  className="w-full min-h-[160px] bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 text-[15px] outline-none focus:border-[#8ab4f8] focus:ring-2 focus:ring-[#8ab4f8]/20 transition-all resize-y placeholder:text-gray-400"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm font-bold px-4 py-3 rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full h-[56px] mt-2 bg-[#8ab4f8] hover:bg-blue-400 text-white font-bold text-[16px] rounded-full shadow-[0_4px_14px_rgba(139,185,217,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <SpinnerIcon />
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    Send Feedback
                  </>
                )}
              </button>

            </form>
          )}

        </div>
      </div>
    </main>
  );
}

const SpinnerIcon = ({ className = "animate-spin h-5 w-5 text-current" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);
