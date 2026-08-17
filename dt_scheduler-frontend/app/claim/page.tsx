'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestClaim, verifyClaim } from '@/app/actions/claim';

export default function ClaimAccountPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    if (!email) {
      setError('Please enter your official Dream Tea email.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestClaim(email);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMsg('Verification code sent! Please check your email.');
        setStep(2);
      }
    } catch (err) {
      setError('Failed to request verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyClaim(email, otp);
      if (result.error) {
        setError(result.error);
      } else {
        // Upgrade role in local state since DB is updated
        localStorage.setItem('nexus_role', 'staff');
        document.cookie = "nexus_role=staff; path=/; max-age=86400";
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Failed to verify code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-screen flex items-center justify-center p-8 overflow-y-auto">
      <div className="w-full max-w-5xl min-h-[650px] rounded-3xl flex overflow-hidden shadow-xl relative bg-white">
        
        <img
          src="/Background Image.png"
          alt="The inside of Dream Tea"
          className="absolute top-0 right-0 bottom-0 w-[calc(100%-300px)] h-full object-cover z-0 hidden md:block"
        />

        <div className="w-full md:max-w-[448px] min-h-[650px] bg-white md:rounded-3xl shadow-[var(--shadow-panel)] flex flex-col items-center justify-center p-6 sm:p-8 shrink-0 relative z-10 transition-all duration-500">
          
          <div className="flex flex-row items-center w-full justify-center mb-6">
            <img src="/dreamtealogo.svg" alt="Dream Tea Logo" className="object-contain w-8 h-8 mr-2" />
            <h1 className="font-bold text-lg text-text-primary">Dream Tea Nexus</h1>
          </div>

          <div className="w-full flex flex-col items-center">
            <h1 className="font-bold text-[36px] text-text-primary text-center leading-tight mb-2">
              {step === 1 ? 'Link Account' : 'Verify Email'}
            </h1>
            <h2 className="font-bold text-[14px] text-text-secondary text-center mb-8 px-4">
              {step === 1 
                ? "Enter your official Dream Tea email to upgrade your access." 
                : `Enter the 6-digit code sent to ${email}`}
            </h2>

            <form onSubmit={step === 1 ? handleRequest : handleVerify} className="w-full flex flex-col items-center gap-4">
              
              {step === 1 ? (
                <input
                  type="email"
                  placeholder="name@dreamteayeg.ca"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-nexus w-full max-w-[280px]"
                />
              ) : (
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="input-nexus w-full max-w-[280px] text-center tracking-[0.5em] font-bold text-xl"
                />
              )}

              {error && (
                <div className="text-red-500 text-xs font-medium w-full max-w-[280px] text-center mt-2 animate-fade-in">
                  {error}
                </div>
              )}

              {successMsg && !error && step === 2 && (
                <div className="text-green-500 text-xs font-medium w-full max-w-[280px] text-center mt-2 animate-fade-in">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-nexus w-full max-w-[280px] mt-4 flex items-center justify-center gap-2"
              >
                {isLoading && (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {step === 1 ? 'Send Code' : 'Verify & Link'}
              </button>

              {step === 2 && (
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); setError(''); setSuccessMsg(''); }}
                  className="text-xs text-text-secondary hover:text-text-primary mt-4 font-medium transition-colors"
                >
                  Use a different email
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
