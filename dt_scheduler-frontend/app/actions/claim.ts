'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function getAvailableEmails() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Must be logged in
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Unauthorized' };

    const { data, error } = await adminSupabase
      .from('whitelisted_emails')
      .select('email')
      .is('claimed_by', null)
      .order('email');

    if (error) return { error: 'Failed to fetch emails' };
    return { emails: data.map(d => d.email) };
  } catch (error) {
    console.error(error);
    return { error: 'Unexpected error occurred' };
  }
}

export async function getCurrentUserRole() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { role: 'guest' }; // Not logged in -> they are a guest

    const { data, error } = await adminSupabase
      .from('users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (error || !data) {
      return { role: 'employee' }; // Default if they aren't in the table yet
    }
    return { role: data.role };
  } catch (err) {
    return { role: 'employee' };
  }
}

export async function requestClaim(email: string) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Check if user is logged in
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'You must be logged in to request an account claim.' };
    }

    // 2. Check if email exists in whitelisted_emails and is unclaimed
    const { data: whitelistData, error: whitelistError } = await adminSupabase
      .from('whitelisted_emails')
      .select('id, claimed_by')
      .eq('email', email.toLowerCase())
      .single();

    if (whitelistError || !whitelistData) {
      return { error: 'This email is not authorized for a staff account. Please contact an administrator.' };
    }

    if (whitelistData.claimed_by) {
      return { error: 'This email has already been claimed by an account.' };
    }

    // 2. Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Set expiration to 15 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // 4. Update the row with the OTP
    const { error: updateError } = await adminSupabase
      .from('whitelisted_emails')
      .update({
        claim_otp: otp,
        otp_expires_at: expiresAt.toISOString(),
      })
      .eq('id', whitelistData.id);

    if (updateError) {
      console.error('Failed to update OTP:', updateError);
      return { error: 'Failed to generate verification code. Please try again.' };
    }

    // 5. Send email using Resend
    const { error: emailError } = await resend.emails.send({
      from: 'Dream Tea Nexus <noreply@dt-nexus.com>', // User should update this to their verified domain
      to: [email],
      subject: 'Your Dream Tea Nexus Verification Code',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Dream Tea Nexus Account Verification</h2>
          <p>You requested to link your Dream Tea email to your Nexus account.</p>
          <p>Your verification code is:</p>
          <h1 style="font-size: 36px; letter-spacing: 5px; color: #3b82f6;">${otp}</h1>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    if (emailError) {
      console.error('Failed to send email:', emailError);
      return { error: 'Failed to send verification email. Please check your email configuration.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in requestClaim:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}

export async function verifyClaim(email: string, otp: string) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: 'You must be logged in to claim an account.' };
    }

    // 2. Query whitelisted_emails for matching email and OTP
    const { data: whitelistData, error: whitelistError } = await adminSupabase
      .from('whitelisted_emails')
      .select('id, otp_expires_at, claimed_by')
      .eq('email', email.toLowerCase())
      .eq('claim_otp', otp)
      .single();

    if (whitelistError || !whitelistData) {
      return { error: 'Invalid verification code.' };
    }

    if (whitelistData.claimed_by) {
      return { error: 'This email has already been claimed.' };
    }

    const expiresAt = new Date(whitelistData.otp_expires_at);
    if (new Date() > expiresAt) {
      return { error: 'Verification code has expired. Please request a new one.' };
    }

    // 3. Update whitelisted_emails to claim it
    const { error: claimError } = await adminSupabase
      .from('whitelisted_emails')
      .update({
        claimed_by: user.id,
        claim_otp: null,
        otp_expires_at: null,
      })
      .eq('id', whitelistData.id);

    if (claimError) {
      console.error('Failed to claim email:', claimError);
      return { error: 'Failed to claim account. Please try again.' };
    }

    // 4. Update user's role to 'staff' in the public.users table
    const { error: roleError } = await adminSupabase
      .from('users')
      .update({ role: 'staff' })
      .eq('auth_user_id', user.id);

    if (roleError) {
      console.error('Failed to update user role:', roleError);
      // We don't want to completely fail here if the claim succeeded, but it's bad.
      return { error: 'Account claimed, but failed to upgrade role. Please contact support.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in verifyClaim:', error);
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}
