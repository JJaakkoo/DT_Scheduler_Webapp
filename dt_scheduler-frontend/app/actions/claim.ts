'use server';

import crypto from 'node:crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export interface StaffBasic {
  id: string;
  name: string;
}

export interface AvailableStaffResponse {
  staff?: StaffBasic[];
  error?: string;
}

export interface CurrentUserRoleResponse {
  role: string;
}

export interface ActionResponse {
  success?: boolean;
  error?: string;
}

/**
 * Retrieves a list of staff members who haven't claimed their accounts.
 * @returns {Promise<AvailableStaffResponse>} List of available staff or error.
 */
export async function getAvailableStaff(): Promise<AvailableStaffResponse> {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Unauthorized' };

    const { data, error } = await adminSupabase
      .from('staff')
      .select('id, name')
      .is('staff_id', null)
      .order('name');

    if (error) return { error: 'Failed to fetch staff list' };
    return { staff: data as StaffBasic[] };
  } catch (error) {
    console.error('getAvailableStaff error:', error);
    return { error: 'Unexpected error occurred' };
  }
}

/**
 * Gets the role of the currently logged-in user based on their claimed staff identity.
 * @returns {Promise<CurrentUserRoleResponse>} The user's role.
 */
export async function getCurrentUserRole(): Promise<CurrentUserRoleResponse> {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { role: 'guest' };

    const { data: staffData } = await adminSupabase
      .from('staff')
      .select('role')
      .eq('staff_id', user.id)
      .single();

    return { role: staffData?.role || 'unclaimed' };
  } catch (err) {
    console.error('getCurrentUserRole error:', err);
    return { role: 'unclaimed' };
  }
}

/**
 * Requests an account claim for a specific staff member by sending an OTP.
 * @param {string} staffId - The ID of the staff member to claim.
 * @returns {Promise<ActionResponse>} Success status or error message.
 */
export async function requestClaim(staffId: string): Promise<ActionResponse> {
  // Strict Validation
  if (!staffId || typeof staffId !== 'string') {
    return { error: 'Invalid staff identity provided.' };
  }

  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: 'You must be logged in to request an account claim.' };
    }

    const { data: staffData, error: staffError } = await adminSupabase
      .from('staff')
      .select('id, staff_id, temp_email, name')
      .eq('id', staffId)
      .single();

    if (staffError || !staffData) {
      return { error: 'Staff member not found.' };
    }

    if (staffData.staff_id) {
      return { error: 'This staff identity has already been claimed.' };
    }

    // Security: Use native crypto module for OTP generation instead of Math.random()
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Valid for 15 minutes

    const { error: updateError } = await adminSupabase
      .from('staff')
      .update({
        claim_otp: otp,
        otp_expires_at: expiresAt.toISOString(),
      })
      .eq('id', staffData.id);

    if (updateError) {
      console.error('Failed to update OTP:', updateError);
      return { error: 'Failed to generate verification code.' };
    }

    const { sendVerificationEmail } = await import('@/utils/email');
    const { error: emailError } = await sendVerificationEmail(staffData.temp_email, staffData.name, otp);

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

/**
 * Verifies a claim request using the provided OTP and links the user's account.
 * @param {string} staffId - The ID of the staff member.
 * @param {string} otp - The 6-digit one-time password.
 * @returns {Promise<ActionResponse>} Success status or error message.
 */
export async function verifyClaim(staffId: string, otp: string): Promise<ActionResponse> {
  // Strict Validation
  if (!staffId || typeof staffId !== 'string' || !otp || typeof otp !== 'string' || otp.length !== 6) {
    return { error: 'Invalid verification details provided.' };
  }

  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: 'You must be logged in to claim an account.' };
    }

    const { data: staffData, error: staffError } = await adminSupabase
      .from('staff')
      .select('id, otp_expires_at, staff_id, s_name, email, role')
      .eq('id', staffId)
      .eq('claim_otp', otp)
      .single();

    if (staffError || !staffData) {
      return { error: 'Invalid verification code.' };
    }

    if (staffData.staff_id) {
      return { error: 'This identity has already been claimed.' };
    }

    const expiresAt = new Date(staffData.otp_expires_at);
    if (new Date() > expiresAt) {
      return { error: 'Verification code has expired. Please request a new one.' };
    }

    const validRoles = ['admin', 'manager', 'supervisor', 'assistant supervisor'];
    const newRole = validRoles.includes(staffData.role) ? staffData.role : 'staff';

    const { error: claimError } = await adminSupabase
      .from('staff')
      .update({
        staff_id: user.id,
        email: user.email, // Optionally set their real email here
        claim_otp: null,
        otp_expires_at: null,
        role: newRole,
      })
      .eq('id', staffData.id);

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

/**
 * Automatically links a user to an unclaimed staff identity if their email matches
 * a whitelisted temp_email. This runs silently in the background during login.
 * 
 * @param {string} userId - The authenticated user's ID from Supabase Auth.
 * @param {string} email - The authenticated user's email.
 * @returns {Promise<void>}
 */
export async function autoLinkUser(userId: string, email: string): Promise<void> {
  if (!userId || !email) return;

  try {
    // Admin client is required to bypass RLS since the user is not yet linked
    const adminSupabase = createAdminClient();

    // Look for an unlinked staff row matching this email
    const { data: staffData, error: findError } = await adminSupabase
      .from('staff')
      .select('id, role, staff_id')
      .eq('temp_email', email)
      .maybeSingle();

    if (findError) {
      console.error('autoLinkUser: Error querying staff table:', findError);
      return;
    }

    if (!staffData) {
      // No matching row found. This is normal for non-staff.
      return;
    }

    if (staffData.staff_id === userId) {
      // Already correctly linked to this user.
      return;
    }

    const validRoles = ['admin', 'manager', 'supervisor', 'assistant supervisor'];
    const newRole = validRoles.includes(staffData.role) ? staffData.role : 'staff';

    // Link the identity
    const { error: linkError } = await adminSupabase
      .from('staff')
      .update({
        staff_id: userId,
        email: email,
        claim_otp: null,
        otp_expires_at: null,
        role: newRole,
      })
      .eq('id', staffData.id);

    if (linkError) {
      console.error('autoLinkUser: Failed to automatically link identity:', linkError);
    } else {
      console.log(`autoLinkUser: Successfully auto-linked user ${email} to staff record ${staffData.id}`);
    }
  } catch (err) {
    console.error('autoLinkUser: Unexpected error:', err);
  }
}
