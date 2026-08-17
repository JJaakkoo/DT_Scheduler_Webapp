'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requestClaim, verifyClaim, getAvailableStaff } from '@/app/actions/claim';

export default function ClaimAccountPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [staffId, setStaffId] = useState('');
  const [availableStaff, setAvailableStaff] = useState<{id: string, name: string}[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function fetchStaff() {
      const result = await getAvailableStaff();
      if (result.staff) {
        setAvailableStaff(result.staff);
      } else {
        setError(result.error || 'Failed to load available staff.');
      }
      setIsLoadingStaff(false);
    }
    fetchStaff();
  }, []);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    if (!staffId) {
      setError('Please select your name from the list.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestClaim(staffId);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMsg('Verification code sent! Please check the email you recieve your schedule from.');
        setStep(2);
      }
    } catch (err) {
      setError('Failed to request verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e?: React.FormEvent, code?: string) => {
    if (e) e.preventDefault();
    setError('');
    
    const currentOtp = code || otp;
    if (!currentOtp || currentOtp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyClaim(staffId, currentOtp);
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
                ? "Select your name from the list to link your account." 
                : `Enter the 6-digit code sent to your email`}
            </h2>

            <form onSubmit={step === 1 ? handleRequest : handleVerify} className="w-full flex flex-col items-center gap-4">
              
              {step === 1 ? (
                isLoadingStaff ? (
                  <div className="w-full max-w-[280px] h-11 bg-gray-100 animate-pulse rounded-xl" />
                ) : (
                  <select
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="input-nexus w-full max-w-[280px] appearance-none cursor-pointer"
                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7em top 50%', backgroundSize: '.65em auto' }}
                  >
                    <option value="" disabled>Select your name</option>
                    {availableStaff.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )
              ) : (
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setOtp(val);
                    if (val.length === 6) {
                      handleVerify(undefined, val);
                    }
                  }}
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
                  Select a different name
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
