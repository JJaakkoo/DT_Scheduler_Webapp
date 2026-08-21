'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

/**
 * Ensures the user has admin privileges.
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
 * Fetches the draft schedule for a specific year, month, and period.
 */
export async function getDraftSchedule(year: number, month: number, period: number) {
  try {
    const { adminSupabase } = await requireAdminAuth();
    
    const { data, error } = await adminSupabase
      .from('draft_schedules')
      .select('schedule_data')
      .eq('year', year)
      .eq('month', month)
      .eq('period', period)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      console.error("Error fetching draft:", error);
      return { schedule_data: null, error: error.message };
    }
    
    return { schedule_data: data?.schedule_data || {}, error: null };
  } catch (err: any) {
    return { schedule_data: null, error: err.message };
  }
}

/**
 * Saves or updates the draft schedule for a specific year, month, and period.
 */
export async function saveDraftSchedule(year: number, month: number, period: number, scheduleData: any) {
  try {
    const { adminSupabase } = await requireAdminAuth();
    
    // Check if a draft already exists
    const { data: existingDraft } = await adminSupabase
      .from('draft_schedules')
      .select('id')
      .eq('year', year)
      .eq('month', month)
      .eq('period', period)
      .single();

    if (existingDraft) {
      // Update existing
      const { error } = await adminSupabase
        .from('draft_schedules')
        .update({ schedule_data: scheduleData, last_updated: new Date().toISOString() })
        .eq('id', existingDraft.id);
        
      if (error) throw error;
    } else {
      // Insert new
      const { error } = await adminSupabase
        .from('draft_schedules')
        .insert({
          year,
          month,
          period,
          schedule_data: scheduleData,
        });
        
      if (error) throw error;
    }
    
    return { success: true };
  } catch (err: any) {
    console.error("Failed to save draft:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Publishes the draft schedule to the official schedules table.
 */
export async function publishSchedule(year: number, month: number, period: number, scheduleData: any) {
  try {
    const { adminSupabase } = await requireAdminAuth();
    
    // 1. Check if an official schedule already exists for this period
    const { data: existingSchedule } = await adminSupabase
      .from('schedules')
      .select('id')
      .eq('year', year)
      .eq('month', month)
      .eq('period', period)
      .single();

    if (existingSchedule) {
      // Update existing official schedule
      const { error } = await adminSupabase
        .from('schedules')
        .update({ schedule_data: scheduleData }) // Assuming schedules table has this column, or adjust as needed
        .eq('id', existingSchedule.id);
      if (error) throw error;
    } else {
      // Insert new official schedule
      const { error } = await adminSupabase
        .from('schedules')
        .insert({
          year,
          month,
          period,
          schedule_data: scheduleData
        });
      if (error) throw error;
    }

    // Optional: Clear the draft after publishing to keep things tidy
    await adminSupabase
      .from('draft_schedules')
      .delete()
      .eq('year', year)
      .eq('month', month)
      .eq('period', period);
    
    return { success: true };
  } catch (err: any) {
    console.error("Failed to publish schedule:", err);
    return { success: false, error: err.message };
  }
}
