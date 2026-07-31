import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // Extract the user's email address from the session
      const email = data.session.user.email;

      if (email) {
        // Query the custom whitelist database table
        const { data: whitelistData, error: whitelistError } = await supabase
          .from('whitelisted_emails')
          .select('email')
          .eq('email', email)
          .maybeSingle();

        if (whitelistError || !whitelistData) {
          // Revoke unauthorized session
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/?error=not-whitelisted`);
        }
        
        // Allowed: proceed to the dashboard
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        // No email associated with the account
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/?error=not-whitelisted`);
      }
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/?error=auth-failed`);
}
