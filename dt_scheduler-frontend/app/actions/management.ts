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
  statusText: string;
  statusColor: string;
  isClickable: boolean;
  availabilityScore: number;
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
}

export interface StaffUpdateData {
  name?: string;
  temp_email?: string;
  s_name?: string;
  role?: string;
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
 * Retrieves formatted staff data with calculated availability statuses.
 * @returns {Promise<StaffTableDataResponse>} List of formatted staff or error message.
 */
export async function getStaffTableData(): Promise<StaffTableDataResponse> {
  try {
    const adminSupabase = createAdminClient();
    const supabase = await createClient();
    
    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };
    
    const { data: userStaffData } = await adminSupabase.from('staff').select('role').eq('staff_id', user.id).single();
    if (!userStaffData || userStaffData.role !== 'admin') return { error: 'Unauthorized' };
    
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
    let targetPeriod = releasedPeriod === 1 ? 2 : 1;
    if (targetPeriod === 1) {
      targetMonth += 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
    }
    
    const { data: staff, error } = await adminSupabase
      .from('staff')
      .select('id, staff_id, name, temp_email, email, role, s_name, created_at')
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
            name: s.name,
            temp_email: s.temp_email,
            email: s.email,
            created_at: s.created_at,
            s_name: s.s_name,
            role: s.role,
            statusText,
            statusColor,
            isClickable,
            availabilityScore: statusScore
        };
    });
    
    return { staff: formattedStaff };
  } catch (error) {
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
  try {
    const adminSupabase = createAdminClient();
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };
    
    const { data: userStaffData } = await adminSupabase.from('staff').select('role').eq('staff_id', user.id).single();
    if (!userStaffData || userStaffData.role !== 'admin') return { error: 'Unauthorized' };
    
    const { error } = await adminSupabase.from('staff').insert(data);
    if (error) return { error: error.message };
    
    if (data.temp_email) {
      const { error: whitelistError } = await adminSupabase.from('whitelisted_emails').insert({ email: data.temp_email });
      if (whitelistError) {
        console.error("Whitelist insert error (may already exist):", whitelistError);
      }
    }
    
    return { success: true };
  } catch (error) {
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
  try {
    const adminSupabase = createAdminClient();
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };
    
    const { data: userStaffData } = await adminSupabase.from('staff').select('role').eq('staff_id', user.id).single();
    if (!userStaffData || userStaffData.role !== 'admin') return { error: 'Unauthorized' };
    
    const { error } = await adminSupabase.from('staff').update(updates).eq('id', id);
    if (error) return { error: error.message };
    
    return { success: true };
  } catch (error) {
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
  try {
    const adminSupabase = createAdminClient();
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };
    
    const { data: userStaffData } = await adminSupabase.from('staff').select('role').eq('staff_id', user.id).single();
    if (!userStaffData || userStaffData.role !== 'admin') return { error: 'Unauthorized' };
    
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
  } catch (error) {
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
  try {
    const adminSupabase = createAdminClient();
    const supabase = await createClient();
    
    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };
    
    const { data: userStaffData } = await adminSupabase.from('staff').select('role').eq('staff_id', user.id).single();
    if (!userStaffData || userStaffData.role !== 'admin') return { error: 'Unauthorized' };
    
    const { error } = await adminSupabase.from('staff').delete().eq('id', id);
    if (error) return { error: error.message };
    
    return { success: true };
  } catch (error) {
    console.error('deleteStaffRecord error:', error);
    return { error: 'Unexpected error occurred' };
  }
}
