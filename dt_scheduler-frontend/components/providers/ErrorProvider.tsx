'use client';

import { useEffect, ReactNode } from 'react';
import { submitSystemError } from '@/app/actions/feedback';

export default function ErrorProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const CIRCUIT_BREAKER_KEY = 'nexus_error_circuit_breaker';
    const MAX_ERRORS = 5;
    const TIME_WINDOW_MS = 60 * 1000; // 1 minute

    const checkCircuitBreaker = () => {
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

        return errorCount <= MAX_ERRORS;
      } catch (e) {
        return true; // fail open if storage throws
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (!checkCircuitBreaker()) {
        console.warn('Circuit breaker triggered for window error.');
        return;
      }
      
      submitSystemError(event.message || 'Unhandled Window Error', {
        href: window.location.href,
        userAgent: navigator.userAgent,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }).catch(err => console.error('Failed to log window error', err));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!checkCircuitBreaker()) {
        console.warn('Circuit breaker triggered for unhandled promise rejection.');
        return;
      }
      
      const reason = event.reason;
      let message = 'Unhandled Promise Rejection';
      let stack = null;
      
      if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack;
      } else if (typeof reason === 'string') {
        message = reason;
      } else if (reason) {
        message = JSON.stringify(reason);
      }

      submitSystemError(message, {
        href: window.location.href,
        userAgent: navigator.userAgent,
        stack: stack,
        type: 'PromiseRejection'
      }).catch(err => console.error('Failed to log promise rejection', err));
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
}
