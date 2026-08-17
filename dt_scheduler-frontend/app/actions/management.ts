'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export async function getStaffTableData() {
  try {
    const adminSupabase = createAdminClient();
    const supabase = await createClient();
    
    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };
    
    const { data: staffData } = await adminSupabase.from('staff').select('role').eq('staff_id', user.id).single();
    if (!staffData || staffData.role !== 'admin') return { error: 'Unauthorized' };
    
    // 1. Find the target period
    const { data: schedData, error: schedError } = await adminSupabase
      .from('schedules')
      .select('year, month, period')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('period', { ascending: false })
      .limit(1);

    let targetYear, targetMonth, targetPeriod;
    if (schedError || !schedData || schedData.length === 0) {
       const now = new Date();
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
      .select('id, staff_id, name, temp_email, email, role, s_name, created_at, availability_ids')
      .order('name');
    if (error) return { error: 'Failed to fetch staff' };
    
    // Collect all availability ids
    const availIds = staff.flatMap(s => s.availability_ids || []);
    
    let availRecords: Record<string, any> = {};
    if (availIds.length > 0) {
       const { data: availData } = await adminSupabase
          .from('availability')
          .select('id, year, month, period, schedule_data')
          .in('id', availIds);
          
       if (availData) {
          for (const a of availData) {
             availRecords[a.id] = a;
          }
       }
    }
    
    const getScore = (y: number, m: number, p: number) => y * 24 + (m - 1) * 2 + (p - 1);
    const releasedScore = getScore(releasedYear, releasedMonth, releasedPeriod);
    const targetScore = getScore(targetYear, targetMonth, targetPeriod);
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const formattedStaff = staff.map(s => {
        let statusText = "No Availability Found";
        let statusColor = "text-red-500";
        let isClickable = false;
        
        let staffAvails = (s.availability_ids || [])
            .map((id: string) => availRecords[id])
            .filter(Boolean)
            .sort((a: any, b: any) => getScore(b.year, b.month, b.period) - getScore(a.year, a.month, a.period));
            
        if (staffAvails.length > 0) {
            const latest = staffAvails[0];
            const availScore = getScore(latest.year, latest.month, latest.period);
            
            let hasAvailableShift = false;
            if (latest.schedule_data) {
               for (const day of Object.values(latest.schedule_data) as any[]) {
                  if (day.locations && Object.keys(day.locations).length > 0) {
                     hasAvailableShift = true;
                     break;
                  }
               }
            }
            
            statusText = `${MONTHS[latest.month - 1]} - Period ${latest.period}${!hasAvailableShift ? ' (Unavailable)' : ''}`;
            
            if (availScore === targetScore) {
                statusColor = "text-emerald-500";
                isClickable = true;
            } else if (availScore === releasedScore) {
                statusColor = "text-amber-500";
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
            isClickable
        };
    });
    
    return { staff: formattedStaff };
  } catch (error) {
    console.error(error);
    return { error: 'Unexpected error occurred' };
  }
}

export async function updateStaffRecord(id: string, updates: { name?: string, temp_email?: string, s_name?: string, role?: string }) {
  try {
    const adminSupabase = createAdminClient();
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };
    
    const { data: staffData } = await adminSupabase.from('staff').select('role').eq('staff_id', user.id).single();
    if (!staffData || staffData.role !== 'admin') return { error: 'Unauthorized' };
    
    const { error } = await adminSupabase.from('staff').update(updates).eq('id', id);
    if (error) return { error: error.message };
    
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Unexpected error occurred' };
  }
}
