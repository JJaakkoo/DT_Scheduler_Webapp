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
       let currentYear = now.getFullYear();
       let currentMonth = now.getMonth() + 1;
       let currentPeriod = now.getDate() <= 15 ? 1 : 2;
       
       targetYear = currentYear;
       targetMonth = currentMonth;
       targetPeriod = currentPeriod === 1 ? 2 : 1;
       
       if (targetPeriod === 1) {
         targetMonth += 1;
         if (targetMonth > 12) {
           targetMonth = 1;
           targetYear += 1;
         }
       }
    } else {
       const latest = schedData[0];
       targetYear = latest.year;
       targetMonth = latest.month;
       targetPeriod = latest.period === 1 ? 2 : 1;
       
       if (targetPeriod === 1) {
         targetMonth += 1;
         if (targetMonth > 12) {
           targetMonth = 1;
           targetYear += 1;
         }
       }
    }
    
    const { data: staff, error } = await adminSupabase
      .from('staff')
      .select('id, staff_id, name, temp_email, email, role, s_name, created_at, availability_ids')
      .order('name');
    if (error) return { error: 'Failed to fetch staff' };
    
    // Collect all availability ids
    const availIds = staff.flatMap(s => s.availability_ids || []);
    
    let validAvailabilityIds = new Set<string>();
    if (availIds.length > 0) {
       const { data: availData } = await adminSupabase
          .from('availability')
          .select('id, year, month, period')
          .in('id', availIds);
          
       if (availData) {
          for (const a of availData) {
             if (a.year === targetYear && a.month === targetMonth && a.period === targetPeriod) {
                validAvailabilityIds.add(a.id);
             }
          }
       }
    }
    
    const formattedStaff = staff.map(s => {
        let hasCurrentAvailability = false;
        if (s.availability_ids && Array.isArray(s.availability_ids)) {
            hasCurrentAvailability = s.availability_ids.some((id: string) => validAvailabilityIds.has(id));
        }
        
        return {
            id: s.id,
            name: s.name,
            temp_email: s.temp_email,
            email: s.email,
            created_at: s.created_at,
            s_name: s.s_name,
            role: s.role,
            availabilityRaw: s.availability_ids,
            hasCurrentAvailability
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
