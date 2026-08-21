"use client";

import { useEffect } from "react";
import { submitSystemError } from "@/app/actions/feedback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const CIRCUIT_BREAKER_KEY = 'nexus_error_circuit_breaker';
    const MAX_ERRORS = 5;
    const TIME_WINDOW_MS = 60 * 1000;

    try {
      const now = Date.now();
      const stored = sessionStorage.getItem(CIRCUIT_BREAKER_KEY);
      let errorCount = 1;
      let timestamp = now;

      if (stored) {
        const parsed = JSON.parse(stored);
        if (now - parsed.timestamp < TIME_WINDOW_MS) {
          errorCount = parsed.count + 1;
          timestamp = parsed.timestamp;
        }
      }

      sessionStorage.setItem(CIRCUIT_BREAKER_KEY, JSON.stringify({ count: errorCount, timestamp }));

      if (errorCount > MAX_ERRORS) {
        console.warn('Circuit breaker triggered: Too many errors. Telemetry dropped.');
        return;
      }

      submitSystemError(error.message || 'Unknown React Rendering Error', {
        href: window.location.href,
        userAgent: navigator.userAgent,
        stack: error.stack,
        digest: error.digest,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      }).catch(err => console.error('Failed to report telemetry:', err));
    } catch (e) {
      console.error('Failed to execute error circuit breaker logic', e);
    }
    
    // Fallback console log for local debugging
    console.error("Caught by Error Boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[100dvh] w-screen flex flex-col items-center justify-center bg-dreamtea-light font-sans p-4">
      <div className="bg-white rounded-[32px] p-8 sm:p-10 max-w-md w-full shadow-[var(--shadow-panel)] flex flex-col items-center text-center">
        
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-50"></div>
          <img 
            src="/dreamtealogo.svg" 
            alt="Dream Tea Logo" 
            className="w-28 h-28 object-contain relative z-10 drop-shadow-sm"
          />
        </div>
        
        <h2 className="text-dreamtea-blue font-bold text-2xl mb-2">Oops! Something broke.</h2>
        
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-sm font-medium mt-4 mb-6 w-full break-words shadow-inner">
          {error.message || "An unexpected error occurred."}
        </div>
        
        <p className="text-gray-600 font-medium text-[15px] mb-8 leading-relaxed">
          Please let <span className="font-bold text-gray-800">Jako</span> know about this error by sending him a screenshot!
        </p>
        
        <button
          onClick={() => reset()}
          className="btn-nexus w-full h-[48px] flex items-center justify-center gap-2 mb-3"
        >
          <RefreshIcon />
          Try Again
        </button>
        
        <button
          onClick={() => window.location.href = '/'}
          className="w-full h-[48px] bg-white border-2 border-gray-200 text-gray-500 font-semibold rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors text-[14px] flex items-center justify-center focus:outline-none"
        >
          Return to Login
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// SVGs extracted as lightweight helper components
// --------------------------------------------------------------------------------

const RefreshIcon = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);
