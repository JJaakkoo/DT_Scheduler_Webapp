'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export interface ActionResponse {
  success?: boolean;
  error?: string;
}

export interface FormattedStaff {
  id: string;
  name: string;
  temp_email: string;
  email: string | null;
  created_at: string;
  s_name: string;
  role: string;
  is_active: boolean;
  is_new: boolean;
  main_location: string | null;
  statusText: string;
  statusColor: string;
  isClickable: boolean;
  availabilityScore: number;
  sort_order: number;
}

export interface StaffTableDataResponse {
  staff?: FormattedStaff[];
  error?: string;
}

export interface StaffInputData {
  name: string;
  temp_email: string;
  s_name: string;
  role: string;
  main_location: string | null;
}

export interface StaffUpdateData {
  name?: string;
  temp_email?: string;
  s_name?: string;
  role?: string;
  is_active?: boolean;
  is_new?: boolean;
  main_location?: string | null;
  sort_order?: number;
}

export interface AvailabilityStaffInfo {
  name: string;
  s_name: string;
}

export interface AvailabilityRecord {
  id: string;
  staff_id: string;
  year: number;
  month: number;
  period: number;
  schedule_data?: Record<string, { locations?: Record<string, unknown> }>;
  staff?: AvailabilityStaffInfo;
}

export interface AvailabilityResponse {
  availability?: AvailabilityRecord[];
  error?: string;
}

/**
 * Helper function to calculate a sortable score for a year, month, and period.
 */
const getScore = (y: number, m: number, p: number): number => y * 24 + (m - 1) * 2 + (p - 1);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Centralized authorization check for admin access.
 * Enforces security and type safety.
 * @throws {Error} If user is unauthorized or not an admin.
 */
async function requireAdminAuth() {
  const adminSupabase = createAdminClient();
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Unauthorized');
  
  const { data: userStaffData, error: staffError } = await adminSupabase
    .from('staff')
    .select('role')
    .eq('staff_id', user.id)
    .single();

  if (staffError || !userStaffData || userStaffData.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  return { adminSupabase, user };
}

/**
 * Retrieves formatted staff data with calculated availability statuses.
 * @returns {Promise<StaffTableDataResponse>} List of formatted staff or error message.
 */
export async function getStaffTableData(): Promise<StaffTableDataResponse> {
  try {
    const { adminSupabase } = await requireAdminAuth();
    
    // 1. Find the target period
    const { data: schedData, error: schedError } = await adminSupabase
      .from('schedules')
      .select('year, month, period')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('period', { ascending: false })
      .limit(1);

    let releasedYear: number;
    let releasedMonth: number;
    let releasedPeriod: number;
    const now = new Date();

    if (schedError || !schedData || schedData.length === 0) {
       releasedYear = now.getFullYear();
       releasedMonth = now.getMonth() + 1;
       releasedPeriod = now.getDate() <= 15 ? 1 : 2;
    } else {
       const latest = schedData[0];
       releasedYear = latest.year;
       releasedMonth = latest.month;
       releasedPeriod = latest.period;
    }
    
    let targetYear = releasedYear;
    let targetMonth = releasedMonth;
    const targetPeriod = releasedPeriod === 1 ? 2 : 1;
    if (targetPeriod === 1) {
      targetMonth += 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
    }
    
    const { data: staff, error } = await adminSupabase
      .from('staff')
      .select('id, staff_id, name, temp_email, email, role, s_name, created_at, is_new, main_location, is_active, sort_order')
      .order('name');
      
    if (error) return { error: 'Failed to fetch staff' };
    
    // Collect all staff ids
    const staffIds = staff.map(s => s.id);
    
    const availRecordsByStaff: Record<string, AvailabilityRecord[]> = {};
    if (staffIds.length > 0) {
       const { data: availData } = await adminSupabase
          .from('availability')
          .select('id, staff_id, year, month, period, schedule_data')
          .in('staff_id', staffIds);
          
       if (availData) {
          for (const a of availData as AvailabilityRecord[]) {
             if (!availRecordsByStaff[a.staff_id]) availRecordsByStaff[a.staff_id] = [];
             availRecordsByStaff[a.staff_id].push(a);
          }
       }
    }
    
    const releasedScore = getScore(releasedYear, releasedMonth, releasedPeriod);
    const targetScore = getScore(targetYear, targetMonth, targetPeriod);
    
    const formattedStaff: FormattedStaff[] = staff.map(s => {
        let statusText = "No Availability Found";
        let statusColor = "text-rose-400";
        let isClickable = false;
        
        const staffAvails = (availRecordsByStaff[s.id] || [])
            .sort((a, b) => getScore(b.year, b.month, b.period) - getScore(a.year, a.month, a.period));
            
        let statusScore = 0;
        
        if (staffAvails.length > 0) {
            const latest = staffAvails[0];
            const availScore = getScore(latest.year, latest.month, latest.period);
            statusScore = availScore;
            
            let hasAvailableShift = false;
            if (latest.schedule_data) {
               for (const day of Object.values(latest.schedule_data)) {
                  if (day.locations && Object.keys(day.locations).length > 0) {
                     hasAvailableShift = true;
                     break;
                  }
               }
            }
            
            statusText = `${MONTHS[latest.month - 1]} - Period ${latest.period}${!hasAvailableShift ? ' (Unavailable)' : ''}`;
            
            if (availScore === targetScore) {
                statusColor = "text-teal-400";
                isClickable = true;
            } else if (availScore === releasedScore) {
                statusColor = "text-amber-400";
                isClickable = true;
            } else {
                statusColor = "text-gray-500";
            }
        }
        
        return {
            id: s.id,
            staff_id: s.staff_id,
            name: s.name,
            temp_email: s.temp_email,
            email: s.email,
            created_at: s.created_at,
            s_name: s.s_name,
            role: s.role,
            is_active: s.is_active,
            is_new: s.is_new,
            main_location: s.main_location,
            statusText,
            statusColor,
            isClickable,
            availabilityScore: statusScore,
            sort_order: s.sort_order || 0
        };
    });
    
    return { staff: formattedStaff };
  } catch (error: any) {
    if (error.message === 'Unauthorized') return { error: 'Unauthorized' };
    console.error('getStaffTableData error:', error);
    return { error: 'Unexpected error occurred' };
  }
}

/**
 * Adds a new staff record to the database and optionally whitelists their email.
 * @param {StaffInputData} data - The staff details to add.
 * @returns {Promise<ActionResponse>} Success status or error message.
 */
export async function addStaffRecord(data: StaffInputData): Promise<ActionResponse> {
  // Strict Input Validation
  if (!data || typeof data !== 'object') return { error: 'Invalid input data.' };
  if (!data.name || !data.s_name || !data.role || !data.temp_email) {
    return { error: 'Missing required staff fields.' };
  }
  
  if (data.main_location !== undefined && data.main_location !== null && data.main_location !== '' && !['Strathcona', 'Downtown', 'Heritage'].includes(data.main_location)) {
    return { error: 'Invalid main location.' };
  }

  try {
    const { adminSupabase } = await requireAdminAuth();
    
    // Explicitly destructure to avoid unintended properties being inserted
    const insertData = {
      name: data.name,
      temp_email: data.temp_email,
      s_name: data.s_name,
      role: data.role,
      is_active: true, // Always true for new staff
      is_new: true, // Always true for new staff
      main_location: data.main_location || null
    };

    const { error } = await adminSupabase.from('staff').insert(insertData);
    if (error) return { error: error.message };
    
    if (insertData.temp_email) {
      const { error: whitelistError } = await adminSupabase
        .from('whitelisted_emails')
        .insert({ email: insertData.temp_email });
        
      if (whitelistError) {
        console.error("Whitelist insert error (may already exist):", whitelistError);
      }
    }
    
    return { success: true };
  } catch (error: any) {
    if (error.message === 'Unauthorized') return { error: 'Unauthorized' };
    console.error('addStaffRecord error:', error);
    return { error: 'Unexpected error occurred' };
  }
}

/**
 * Updates an existing staff record.
 * @param {string} id - The ID of the staff to update.
 * @param {StaffUpdateData} updates - The partial updates to apply.
 * @returns {Promise<ActionResponse>} Success status or error message.
 */
export async function updateStaffRecord(id: string, updates: StaffUpdateData): Promise<ActionResponse> {
  // Validation
  if (!id || typeof id !== 'string') return { error: 'Invalid staff ID.' };
  if (!updates || typeof updates !== 'object') return { error: 'Invalid update data.' };
  if (updates.is_active !== undefined && typeof updates.is_active !== 'boolean') {
    return { error: 'is_active must be a boolean.' };
  }
  if (updates.is_new !== undefined && typeof updates.is_new !== 'boolean') {
    return { error: 'is_new must be a boolean.' };
  }
  if (updates.main_location !== undefined && updates.main_location !== null && updates.main_location !== '' && !['Strathcona', 'Downtown', 'Heritage'].includes(updates.main_location)) {
    return { error: 'Invalid main location.' };
  }

  try {
    const { adminSupabase } = await requireAdminAuth();
    
    // Strip unknown fields
    const safeUpdates: Partial<StaffUpdateData> = {};
    if (updates.name !== undefined) safeUpdates.name = updates.name;
    if (updates.temp_email !== undefined) safeUpdates.temp_email = updates.temp_email;
    if (updates.s_name !== undefined) safeUpdates.s_name = updates.s_name;
    if (updates.role !== undefined) safeUpdates.role = updates.role;
    if (updates.is_active !== undefined) safeUpdates.is_active = updates.is_active;
    if (updates.is_new !== undefined) safeUpdates.is_new = updates.is_new;
    if (updates.main_location !== undefined) safeUpdates.main_location = updates.main_location;
    
    if (Object.keys(safeUpdates).length === 0) {
      return { error: 'No valid fields to update.' };
    }

    const { error } = await adminSupabase.from('staff').update(safeUpdates).eq('id', id);
    if (error) return { error: error.message };
    
    return { success: true };
  } catch (error: any) {
    if (error.message === 'Unauthorized') return { error: 'Unauthorized' };
    console.error('updateStaffRecord error:', error);
    return { error: 'Unexpected error occurred' };
  }
}

/**
 * Retrieves availability records for a specific period, including staff basic info.
 * @param {number} year - Target year.
 * @param {number} month - Target month.
 * @param {number} period - Target period (1 or 2).
 * @returns {Promise<AvailabilityResponse>} Availability records or error message.
 */
export async function getAvailabilityForPeriod(year: number, month: number, period: number): Promise<AvailabilityResponse> {
  // Input Validation
  if (typeof year !== 'number' || typeof month !== 'number' || typeof period !== 'number') {
    return { error: 'Invalid period parameters.' };
  }

  try {
    const { adminSupabase } = await requireAdminAuth();
    
    const { data: availData, error: availError } = await adminSupabase
      .from('availability')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .eq('period', period);
      
    if (availError) return { error: availError.message };
    
    const { data: allStaff, error: staffError } = await adminSupabase
      .from('staff')
      .select('id, name, s_name');
      
    if (staffError) return { error: staffError.message };
    
    const staffMap: Record<string, AvailabilityStaffInfo> = {};
    for (const s of allStaff) {
       staffMap[s.id] = { name: s.name, s_name: s.s_name };
    }
    
    const formatted: AvailabilityRecord[] = (availData as AvailabilityRecord[]).map(a => ({
       ...a,
       staff: staffMap[a.staff_id] || { name: 'Unknown', s_name: 'Unknown' }
    }));
    
    return { availability: formatted };
  } catch (error: any) {
    if (error.message === 'Unauthorized') return { error: 'Unauthorized' };
    console.error('getAvailabilityForPeriod error:', error);
    return { error: 'Unexpected error occurred' };
  }
}

/**
 * Deletes a staff record by ID.
 * @param {string} id - The ID of the staff to delete.
 * @returns {Promise<ActionResponse>} Success status or error message.
 */
export async function deleteStaffRecord(id: string): Promise<ActionResponse> {
  // Input Validation
  if (!id || typeof id !== 'string') return { error: 'Invalid staff ID.' };

  try {
    const { adminSupabase } = await requireAdminAuth();
    
    const { error } = await adminSupabase.from('staff').delete().eq('id', id);
    if (error) return { error: error.message };
    
    return { success: true };
  } catch (error: any) {
    if (error.message === 'Unauthorized') return { error: 'Unauthorized' };
    console.error('deleteStaffRecord error:', error);
    return { error: 'Unexpected error occurred' };
  }
}

export async function unlinkStaffAccount(id: string): Promise<ActionResponse> {
  if (!id || typeof id !== 'string') return { error: 'Invalid staff ID.' };

  try {
    const { adminSupabase } = await requireAdminAuth();

    const { error } = await adminSupabase
      .from('staff')
      .update({
        staff_id: null,
        email: null,
        role: 'unclaimed',
        claim_otp: null,
        otp_expires_at: null
      })
      .eq('id', id);

    if (error) return { error: error.message };

    return { success: true };
  } catch (error: any) {
    if (error.message === 'Unauthorized') return { error: 'Unauthorized' };
    console.error('unlinkStaffAccount error:', error);
    return { error: 'Unexpected error occurred' };
  }
}

/**
 * Updates the sort_order of staff based on a newly provided ordered array of IDs.
 * @param {string[]} orderedIds - The array of staff IDs in their new order.
 */
export async function updateStaffSortOrder(orderedIds: string[]): Promise<ActionResponse> {
  if (!Array.isArray(orderedIds)) return { error: 'Invalid order data.' };
  try {
    const { adminSupabase } = await requireAdminAuth();
    // Using a loop to update each staff record. In a high scale app, consider an RPC or bulk upsert.
    // Given the small size, parallel updates work fine.
    const promises = orderedIds.map((id, index) => 
      adminSupabase.from('staff').update({ sort_order: index + 1 }).eq('id', id)
    );
    await Promise.all(promises);
    return { success: true };
  } catch (error: any) {
    if (error.message === 'Unauthorized') return { error: 'Unauthorized' };
    console.error('updateStaffSortOrder error:', error);
    return { error: 'Unexpected error occurred' };
  }
}

/**
 * Resets the sort_order of all staff to 0 (default).
 */
export async function resetStaffSortOrder(): Promise<ActionResponse> {
  try {
    const { adminSupabase } = await requireAdminAuth();
    // Supabase update without an eq() filter updates all rows if no condition, 
    // but the JS client requires a filter. We can use .neq('id', 'uuid-0...') or .gt('created_at', '0') 
    // or just fetch all and update.
    const { data: staffIds } = await adminSupabase.from('staff').select('id');
    if (staffIds) {
      const promises = staffIds.map(s => adminSupabase.from('staff').update({ sort_order: 0 }).eq('id', s.id));
      await Promise.all(promises);
    }
    return { success: true };
  } catch (error) {
    console.error('resetStaffSortOrder error:', error);
    return { error: 'An unexpected error occurred while resetting sorting order.' };
  }
}

export async function updateStaffActiveStatus(staffId: string, isActive: boolean): Promise<ActionResponse> {
  if (!staffId || typeof staffId !== 'string') return { error: 'Invalid staff ID.' };
  if (typeof isActive !== 'boolean') return { error: 'Invalid active status.' };
  
  try {
    const { adminSupabase } = await requireAdminAuth();
    const { error } = await adminSupabase.from('staff').update({ is_active: isActive }).eq('id', staffId);
    
    if (error) {
      console.error('updateStaffActiveStatus error:', error);
      return { error: 'Failed to update active status. Please try again.' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('updateStaffActiveStatus error:', error);
    return { error: 'An unexpected error occurred while updating active status.' };
  }
}
