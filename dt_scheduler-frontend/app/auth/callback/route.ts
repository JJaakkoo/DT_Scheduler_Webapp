import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Handles the OAuth or Email callback from Supabase.
 * Exchanges the auth code for a session and verifies if the user's email is whitelisted.
 *
 * @param {Request} request - The incoming HTTP request.
 * @returns {Promise<NextResponse>} A redirect response to the target page or an error page.
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    
    // Security: Validate the 'next' parameter to prevent open redirect vulnerabilities
    let next = searchParams.get('next') ?? '/dashboard';
    if (!next.startsWith('/') || next.startsWith('//')) {
      next = '/dashboard';
    }

    if (!code) {
      return NextResponse.redirect(`${origin}/?error=auth-failed`);
    }

    const supabase = await createClient();
    
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error('Session exchange error:', error);
      return NextResponse.redirect(`${origin}/?error=auth-failed`);
    }

    const email = data.session.user.email;

    if (!email) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/?error=not-whitelisted`);
    }

    // Verify if the email exists in the whitelist
    const { data: whitelistData, error: whitelistError } = await supabase
      .from('whitelisted_emails')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (whitelistError || !whitelistData) {
      console.warn(`Unauthorized login attempt by: ${email}`);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/?error=not-whitelisted`);
    }
    
    // Authorization successful: proceed to the requested route
    return NextResponse.redirect(`${origin}${next}`);
  } catch (error) {
    console.error('Auth callback unexpected error:', error);
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/?error=auth-failed`);
  }
}
