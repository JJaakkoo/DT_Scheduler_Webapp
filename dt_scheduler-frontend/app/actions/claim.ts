'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function getAvailableStaff() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Must be logged in
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Unauthorized' };

    const { data, error } = await adminSupabase
      .from('staff')
      .select('id:staff_id, name')
      .is('claimed_by', null)
      .order('name');

    if (error) return { error: 'Failed to fetch staff list' };
    return { staff: data };
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
    if (!user) return { role: 'guest' };

    // Check if they claimed a staff identity
    const { data: staffData } = await adminSupabase
      .from('staff')
      .select('role')
      .eq('claimed_by', user.id)
      .single();

    if (staffData) {
      return { role: staffData.role };
    }

    return { role: 'employee' };
  } catch (err) {
    return { role: 'employee' };
  }
}


export async function requestClaim(staffId: string) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Check if user is logged in
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'You must be logged in to request an account claim.' };
    }

    // 2. Check if staff exists and is unclaimed
    const { data: staffData, error: staffError } = await adminSupabase
      .from('staff')
      .select('id:staff_id, claimed_by, temp_email, name')
      .eq('staff_id', staffId)
      .single();

    if (staffError || !staffData) {
      return { error: 'Staff member not found.' };
    }

    if (staffData.claimed_by) {
      return { error: 'This staff identity has already been claimed.' };
    }

    // 3. Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Valid for 15 minutes

    // 4. Save OTP to database
    const { error: updateError } = await adminSupabase
      .from('staff')
      .update({
        claim_otp: otp,
        otp_expires_at: expiresAt.toISOString(),
      })
      .eq('staff_id', staffData.id);

    if (updateError) {
      console.error('Failed to update OTP:', updateError);
      return { error: 'Failed to generate verification code.' };
    }

    // 5. Send Email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'Dream Tea Nexus <no-reply@dreamteanexus.ca>',
      to: [staffData.temp_email],
      subject: 'Verify your Dream Tea Nexus Account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${staffData.name},</h2>
          <p>You requested to link your account to the Dream Tea Nexus portal.</p>
          <p>Your verification code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 5px; color: #628ebf;">${otp}</h1>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    if (emailError) {
      console.error('Failed to send email:', emailError);
      return { error: 'Failed to send verification email. Please contact support.' };
    }

    return { success: true };
  } catch (error) {
    console.error('requestClaim error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function verifyClaim(staffId: string, otp: string) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: 'You must be logged in to claim an account.' };
    }

    // 2. Query staff for matching ID and OTP
    const { data: staffData, error: staffError } = await adminSupabase
      .from('staff')
      .select('id:staff_id, otp_expires_at, claimed_by, s_name, email')
      .eq('staff_id', staffId)
      .eq('claim_otp', otp)
      .single();

    if (staffError || !staffData) {
      return { error: 'Invalid verification code.' };
    }

    if (staffData.claimed_by) {
      return { error: 'This identity has already been claimed.' };
    }

    const expiresAt = new Date(staffData.otp_expires_at);
    if (new Date() > expiresAt) {
      return { error: 'Verification code has expired. Please request a new one.' };
    }

    // 3. Update staff to claim it
    const { error: claimError } = await adminSupabase
      .from('staff')
      .update({
        claimed_by: user.id,
        email: user.email, // Optionally set their real email here
        claim_otp: null,
        otp_expires_at: null,
        role: 'staff', // Set their role to staff since they claimed the identity
      })
      .eq('staff_id', staffData.id);

    if (claimError) {
      console.error('Failed to claim identity:', claimError);
      return { error: 'Failed to claim account. Please try again.' };
    }

    return { success: true };
  } catch (error) {
    console.error('verifyClaim error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}
