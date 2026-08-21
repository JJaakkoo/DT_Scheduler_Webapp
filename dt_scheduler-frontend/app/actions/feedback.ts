'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';

// Very basic in-memory store for server-side rate limiting
// In a highly scaled production app, you would use Redis/Upstash instead
const rateLimitCache = new Map<string, { count: number; timestamp: number }>();

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitCache.get(identifier);

  if (!record) {
    rateLimitCache.set(identifier, { count: 1, timestamp: now });
    return false;
  }

  if (now - record.timestamp > RATE_LIMIT_WINDOW_MS) {
    // Reset window
    rateLimitCache.set(identifier, { count: 1, timestamp: now });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true;
  }

  record.count++;
  return false;
}

/**
 * Sanitizes a URL by stripping out all query parameters.
 */
function sanitizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return urlString; // Fallback if it's not a valid URL
  }
}

/**
 * Sanitizes metadata to prevent leaking sensitive tokens or query parameters.
 */
function sanitizeMetadata(metadata: any): any {
  if (!metadata) return null;
  const sanitized = { ...metadata };
  if (sanitized.href) {
    sanitized.href = sanitizeUrl(sanitized.href);
  }
  return sanitized;
}

export async function submitUserFeedback(category: string, message: string) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    // Server-side rate limiting by IP (or fallback)
    const ip = headers().get('x-forwarded-for') || 'unknown';
    if (isRateLimited(`feedback_${ip}`)) {
      return { success: false, error: 'Rate limit exceeded. Please try again later.' };
    }

    if (!message || message.trim() === '') {
      return { success: false, error: 'Message is required.' };
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await adminSupabase
      .from('user_feedback')
      .insert({
        user_id: user?.id || null,
        email: user?.email || null,
        category: category || 'General',
        message: message.trim()
      });

    if (error) {
      console.error('Failed to submit user feedback:', error);
      return { success: false, error: 'Failed to submit feedback.' };
    }

    return { success: true };
  } catch (error) {
    console.error('submitUserFeedback unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function submitSystemError(message: string, metadata: any) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    // Server-side rate limiting by IP (or fallback)
    const ip = headers().get('x-forwarded-for') || 'unknown';
    if (isRateLimited(`error_${ip}`)) {
      return { success: false, error: 'Rate limit exceeded.' };
    }

    if (!message) return { success: false, error: 'Message is required.' };

    const { data: { user } } = await supabase.auth.getUser();
    const sanitizedMetadata = sanitizeMetadata(metadata);

    const { error } = await adminSupabase
      .from('system_errors')
      .insert({
        user_id: user?.id || null,
        email: user?.email || null,
        message: message.trim(),
        metadata: sanitizedMetadata
      });

    if (error) {
      console.error('Failed to log system error:', error);
      return { success: false, error: 'Failed to log error.' };
    }

    return { success: true };
  } catch (error) {
    console.error('submitSystemError unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
