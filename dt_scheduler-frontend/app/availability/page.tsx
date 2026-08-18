"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../utils/supabase/client";

const STAFF_ROLES = ['staff', 'admin', 'manager', 'supervisor', 'assistant supervisor'];

const LOCATIONS = ["Whyte", "Downtown", "Heritage"];

const getLocationTheme = (location: string) => {
  const loc = (location || "").toLowerCase();
  if (loc.includes("whyte")) return { text: "text-[#CAB1E3]", border: "border-[#CAB1E3]", bg: "bg-[#CAB1E3]/10", fill: "bg-[#CAB1E3]" };
  if (loc.includes("heritage")) return { text: "text-[#ED9BB4]", border: "border-[#ED9BB4]", bg: "bg-[#ED9BB4]/10", fill: "bg-[#ED9BB4]" };
  if (loc.includes("downtown") || loc.includes("dt")) return { text: "text-[#A0B99B]", border: "border-[#A0B99B]", bg: "bg-[#A0B99B]/10", fill: "bg-[#A0B99B]" };
  return { text: "text-sky-500", border: "border-sky-200", bg: "bg-sky-50", fill: "bg-[#8ab4f8]" };
};

const HOURS = Array.from({length: 13}, (_, i) => (i + 10).toString());
const MINUTES = ["00", "15", "30", "45"];

const TimeWheel = ({ value, onChange, options, isHour = false }: { value: string, onChange: (v: string) => void, options: string[], isHour?: boolean }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticScroll = React.useRef(false);
  
  React.useEffect(() => {
     if (!containerRef.current) return;
     const el = containerRef.current.querySelector(`[data-val="${value}"]`) as HTMLElement;
     if (el) {
        isProgrammaticScroll.current = true;
        const top = el.offsetTop - containerRef.current.offsetTop - 50;
        containerRef.current.scrollTo({ top, behavior: 'smooth' });
        setTimeout(() => { isProgrammaticScroll.current = false; }, 300);
     }
  }, [value]);

  const handleScroll = () => {
     if (isProgrammaticScroll.current) return;
     if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
     scrollTimeoutRef.current = setTimeout(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const center = container.scrollTop + (container.clientHeight / 2);
        let closestVal = value;
        let minDiff = Infinity;
        const children = Array.from(container.querySelectorAll('button'));
        children.forEach(child => {
           const childCenter = child.offsetTop + (child.offsetHeight / 2) - container.offsetTop;
           const diff = Math.abs(childCenter - center);
           if (diff < minDiff) {
              minDiff = diff;
              closestVal = child.dataset.val || value;
           }
        });
        if (closestVal !== value) onChange(closestVal);
     }, 150);
  };

  return (
    <div ref={containerRef} onScroll={handleScroll} className="time-wheel h-[150px] overflow-y-auto overflow-x-hidden w-[70px] sm:w-[90px] flex flex-col items-center snap-y snap-mandatory pt-[50px] pb-[50px]">
       {options.map(o => {
         const display = isHour ? (parseInt(o) > 12 ? parseInt(o) - 12 : parseInt(o)).toString() : o;
         return (
           <button 
             key={o} 
             data-val={o}
             onClick={() => onChange(o)}
             className={`w-full h-[50px] shrink-0 snap-center text-2xl sm:text-3xl font-bold transition-all ${value === o ? 'text-[#8ab4f8] scale-110' : 'text-gray-300 hover:text-gray-400'}`}
           >
             {display}
           </button>
         );
       })}
    </div>
  );
};

export default function AvailabilityPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Calendar State
  const [targetPeriod, setTargetPeriod] = useState<{ year: number, month: number, period: number } | null>(null);
  const [maxTargetPeriod, setMaxTargetPeriod] = useState<{ year: number, month: number, period: number } | null>(null);
  const [validDates, setValidDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availabilityCache, setAvailabilityCache] = useState<Record<string, any>>({});
  
  // Form State
  const [locationTimes, setLocationTimes] = useState<Record<string, { startTime: string, endTime: string }>>({});
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  
  // Submission State
  const [missingDates, setMissingDates] = useState<Date[]>([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allSaved, setAllSaved] = useState(false);
  const [actionIndicator, setActionIndicator] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Auth Check
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        router.push("/");
        return;
      }
      setEmail(data.session.user.email || null);
      
      const currentRole = localStorage.getItem("nexus_role");
      if (!currentRole) {
        router.push("/");
        return;
      }
      setRole(currentRole);

      // Removed saved locations logic since times are now per-location
      
      fetchInitialData(data.session.user.id);
    };
    
    checkAuth();
  }, []);

  const fetchInitialData = async (authUserId: string) => {
    // 1. Find the target period
    const { data: schedData, error: schedError } = await supabase
      .from('schedules')
      .select('year, month, period')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('period', { ascending: false })
      .limit(1);

    let targetYear, targetMonth, targetPeriodNum;
    if (schedError || !schedData || schedData.length === 0) {
       const now = new Date();
       let currentYear = now.getFullYear();
       let currentMonth = now.getMonth() + 1;
       let currentPeriod = now.getDate() <= 15 ? 1 : 2;
       
       targetYear = currentYear;
       targetMonth = currentMonth;
       targetPeriodNum = currentPeriod === 1 ? 2 : 1;
       
       if (targetPeriodNum === 1) {
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
       targetPeriodNum = latest.period === 1 ? 2 : 1;
       
       if (targetPeriodNum === 1) {
         targetMonth += 1;
         if (targetMonth > 12) {
           targetMonth = 1;
           targetYear += 1;
         }
       }
    }

    setTargetPeriod({ year: targetYear, month: targetMonth, period: targetPeriodNum });
    setMaxTargetPeriod({ year: targetYear, month: targetMonth, period: targetPeriodNum });
    calculateValidDates(targetYear, targetMonth, targetPeriodNum);
    
    // 2. Fetch custom staff_id from staff table instead of auth.users
    const { data: userData } = await supabase.from('staff').select('id').eq('staff_id', authUserId).single();
    if (!userData) return;
    
    // 3. Fetch availability for target period
    const { data: availData } = await supabase.from('availability')
      .select('schedule_data, updated_at')
      .eq('staff_id', userData.id)
      .eq('year', targetYear)
      .eq('month', targetMonth)
      .eq('period', targetPeriodNum)
      .single();
      
    // 4. Compare with localStorage cache
    let finalCache: any = {};
    const localDraftStr = localStorage.getItem("nexus_avail_draft");
    let localDraft = null;
    
    if (localDraftStr) {
      try {
        localDraft = JSON.parse(localDraftStr);
      } catch (e) {}
    }
    
    const dbTime = availData?.updated_at ? new Date(availData.updated_at).getTime() : 0;
    const localTime = localDraft?.updated_at ? new Date(localDraft.updated_at).getTime() : 0;
    
    if (dbTime > localTime && availData?.schedule_data) {
       // Convert JSON back to cache format
       finalCache = transformDBToCache(availData.schedule_data);
    } else if (localDraft?.data && Object.keys(localDraft.data).length > 0) {
       finalCache = localDraft.data;
    } else {
       // No data for this period and no local draft. Fetch most recent as a template!
       const { data: latestAvail } = await supabase.from('availability')
         .select('schedule_data')
         .eq('staff_id', userData.id)
         .order('year', { ascending: false })
         .order('month', { ascending: false })
         .order('period', { ascending: false })
         .limit(1)
         .single();
         
       if (latestAvail?.schedule_data) {
          const oldCache = transformDBToCache(latestAvail.schedule_data);
          const dowMap: Record<number, any> = {};
          // Map each day of the week to its latest occurrence in the previous schedule
          Object.keys(oldCache).sort().forEach(dateStr => {
             const parts = dateStr.split('-');
             const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
             dowMap[d.getDay()] = oldCache[dateStr];
          });
          
          const targetDates: Date[] = [];
          if (targetPeriodNum === 1) {
            for (let i = 1; i <= 15; i++) targetDates.push(new Date(targetYear, targetMonth - 1, i));
          } else {
            const lastDay = new Date(targetYear, targetMonth, 0).getDate();
            for (let i = 16; i <= lastDay; i++) targetDates.push(new Date(targetYear, targetMonth - 1, i));
          }
          
          targetDates.forEach(d => {
             const dayStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
             const pattern = dowMap[d.getDay()];
             if (pattern) {
                finalCache[dayStr] = JSON.parse(JSON.stringify(pattern));
             }
          });
       }
    }
    
    setAvailabilityCache(finalCache);
  };

  const transformDBToCache = (schedule_data: any) => {
     const cache: any = {};
     for (const [dayStr, dayData] of Object.entries(schedule_data)) {
        const anyDayData: any = dayData;
        const locs = Object.keys(anyDayData.locations || {});
        
        if (locs.length === 0) {
           cache[dayStr] = { isUnavailable: true, locationTimes: {} };
           continue;
        }
        
        const dayLocationTimes: Record<string, { startTime: string, endTime: string }> = {};
        
        for (const loc of locs) {
           const shifts = anyDayData.locations[loc];
           if (shifts && shifts.length > 0) {
               const startD = new Date(shifts[0].start.dateTime);
               const endD = new Date(shifts[0].end.dateTime);
               const startTime = `${startD.getHours().toString().padStart(2, '0')}:${startD.getMinutes().toString().padStart(2, '0')}`;
               const endTime = `${endD.getHours().toString().padStart(2, '0')}:${endD.getMinutes().toString().padStart(2, '0')}`;
               const formattedLoc = loc.charAt(0).toUpperCase() + loc.slice(1);
               dayLocationTimes[formattedLoc] = { startTime, endTime };
           }
        }
        
        cache[dayStr] = {
           isUnavailable: false,
           locationTimes: dayLocationTimes
        };
     }
     return cache;
  };

  const calculateValidDates = (y: number, m: number, p: number) => {
    const dates: Date[] = [];
    if (p === 1) {
      for (let i = 1; i <= 15; i++) {
        dates.push(new Date(y, m - 1, i));
      }
    } else {
      const lastDay = new Date(y, m, 0).getDate();
      for (let i = 16; i <= lastDay; i++) {
        dates.push(new Date(y, m - 1, i));
      }
    }
    setValidDates(dates);
  };

  const handleLogOut = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    localStorage.removeItem("nexus_role");
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("nexus_login_time");
    document.cookie = "nexus_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/");
    router.refresh();
  };

  const toggleLocation = (loc: string) => {
    const newTimes = { ...locationTimes };
    
    if (newTimes[loc]) {
      if (activeLocation === loc) {
        // Just turn it off and pick another active location if available
        delete newTimes[loc];
        const remaining = Object.keys(newTimes);
        setActiveLocation(remaining.length > 0 ? remaining[0] : null);
      } else {
        // Turn it off
        delete newTimes[loc];
      }
    } else {
      // Turn it on
      let st = "12:00";
      let et = "22:00";
      if (activeLocation && newTimes[activeLocation]) {
         st = newTimes[activeLocation].startTime;
         et = newTimes[activeLocation].endTime;
      }
      newTimes[loc] = { startTime: st, endTime: et };
      setActiveLocation(loc);
    }
    
    setLocationTimes(newTimes);
  };

  // useEffect removed to allow linear nav to preserve form state

  const saveCurrentDay = () => {
    if (!selectedDate) return availabilityCache;
    const dayStr = selectedDate.toISOString().split('T')[0];
    
    let newCache;
    if (!isUnavailable && Object.keys(locationTimes).length === 0) {
      newCache = { ...availabilityCache };
      delete newCache[dayStr];
    } else {
      newCache = {
        ...availabilityCache,
        [dayStr]: {
          isUnavailable,
          locationTimes
        }
      };
    }
    
    setAvailabilityCache(newCache);
    localStorage.setItem("nexus_avail_draft", JSON.stringify({
      updated_at: new Date().toISOString(),
      data: newCache
    }));
    
    return newCache;
  };

  const handleClearDay = () => {
    setIsUnavailable(false);
    const resetTimes: Record<string, { startTime: string, endTime: string }> = {};
    for (const loc of Object.keys(locationTimes)) {
       resetTimes[loc] = { startTime: "12:00", endTime: "22:00" };
    }
    setLocationTimes(resetTimes);
    
    if (!selectedDate) return;
    const dayStr = selectedDate.toISOString().split('T')[0];
    const newCache = { ...availabilityCache };
    delete newCache[dayStr];
    
    setAvailabilityCache(newCache);
    localStorage.setItem("nexus_avail_draft", JSON.stringify({
      updated_at: new Date().toISOString(),
      data: newCache
    }));
    
    setActionIndicator("Cleared");
    setTimeout(() => setActionIndicator(null), 1500);
  };

  const handleSaveDay = () => {
    saveCurrentDay();
    if (!selectedDate) return;
    const currentIndex = validDates.findIndex(d => d.toDateString() === selectedDate.toDateString());
    if (currentIndex >= 0 && currentIndex < validDates.length - 1) {
      setSelectedDate(validDates[currentIndex + 1]);
    } else if (currentIndex === validDates.length - 1) {
      setAllSaved(true);
      setSelectedDate(null);
    }
    
    setActionIndicator("Saved");
    setTimeout(() => setActionIndicator(null), 1500);
  };

  const handleNextDay = handleSaveDay;

  const handlePrevDay = () => {
    saveCurrentDay();
    if (!selectedDate) return;
    const currentIndex = validDates.findIndex(d => d.toDateString() === selectedDate.toDateString());
    if (currentIndex > 0) {
      setSelectedDate(validDates[currentIndex - 1]);
    }
  };

  const handleUnavailableToggle = () => {
    setIsUnavailable(true);
    if (!selectedDate) return;
    const dayStr = selectedDate.toISOString().split('T')[0];
    
    const newCache = {
      ...availabilityCache,
      [dayStr]: {
        isUnavailable: true,
        isFullDay: false,
        startTime: "12:00",
        endTime: "22:00",
        locations: []
      }
    };
    
    setAvailabilityCache(newCache);
    localStorage.setItem("nexus_avail_draft", JSON.stringify({
      updated_at: new Date().toISOString(),
      data: newCache
    }));
    
    // Auto advance
    const currentIndex = validDates.findIndex(d => d.toDateString() === selectedDate.toDateString());
    if (currentIndex >= 0 && currentIndex < validDates.length - 1) {
      setSelectedDate(validDates[currentIndex + 1]);
    } else if (currentIndex === validDates.length - 1) {
      setAllSaved(true);
      setSelectedDate(null);
    }
    
    setIsUnavailable(false);
  };

  const handlePrevPeriod = () => {
    if (!targetPeriod) return;
    let { year, month, period } = targetPeriod;
    if (period === 2) {
      period = 1;
    } else {
      period = 2;
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
    }
    setTargetPeriod({ year, month, period });
    calculateValidDates(year, month, period);
    // Ideally we fetch data for this period from Supabase, but for now we rely on the localStorage cache spanning multiple periods.
  };

  const handleNextPeriod = () => {
    if (!targetPeriod || !maxTargetPeriod) return;
    let { year, month, period } = targetPeriod;
    if (year === maxTargetPeriod.year && month === maxTargetPeriod.month && period === maxTargetPeriod.period) {
       return; // Cannot go past the allowed period
    }
    if (period === 1) {
      period = 2;
    } else {
      period = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    setTargetPeriod({ year, month, period });
    calculateValidDates(year, month, period);
  };

  const handleFinalSubmit = async () => {
    if (!targetPeriod || !email) return;
    setIsSubmitting(true);
    
    try {
      // 1. Compile the JSON data
      const schedule_data: Record<string, any> = {};
      
      validDates.forEach(day => {
        const dayStr = day.toISOString().split('T')[0];
        const cache = availabilityCache[dayStr];
        if (!cache) return; // Should be caught by validation
        
        schedule_data[dayStr] = {
           timeZone: "America/Edmonton",
           locations: {}
        };
        
        if (!cache.isUnavailable && cache.locationTimes) {
           Object.entries(cache.locationTimes).forEach(([loc, times]: [string, any]) => {
              const startDateTime = `${dayStr}T${times.startTime}:00`;
              const endDateTime = `${dayStr}T${times.endTime}:00`;
              
              schedule_data[dayStr].locations[loc.toLowerCase()] = [{
                 start: { dateTime: startDateTime, timeZone: "America/Edmonton" },
                 end: { dateTime: endDateTime, timeZone: "America/Edmonton" }
              }];
           });
        }
      });
      
      // 2. We need the custom `staff_id` from the `staff` table
      const { data: userData, error: userError } = await supabase.from('staff').select('id').eq('staff_id', (await supabase.auth.getUser()).data.user?.id).single();
      
      if (userError || !userData) {
         alert("Could not find your staff record. Please contact the manager to get your account linked.");
         setIsSubmitting(false);
         return;
      }
      
      // 3. Upsert into `availability` table
      const { data: upsertData, error: upsertError } = await supabase.from('availability').upsert({
         staff_id: userData.id,
         year: targetPeriod.year,
         month: targetPeriod.month,
         period: targetPeriod.period,
         schedule_data: schedule_data,
         updated_at: new Date().toISOString()
      }, { onConflict: 'staff_id, year, month, period' }).select('id').single();
      
      if (upsertError || !upsertData) {
         console.error(upsertError);
         setToastMessage({ text: "Failed to submit availability. " + (upsertError?.message || ""), type: 'error' });
         setTimeout(() => setToastMessage(null), 3000);
      } else {
         // (Redundant availability_ids update removed - Dashboard now fetches directly via staff_id)
         setToastMessage({ text: "Availability successfully submitted!", type: 'success' });
         setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage({ text: "An unexpected error occurred.", type: 'error' });
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!role) return null;

  return (
    <main className="min-h-[100dvh] w-screen flex flex-col bg-[#c2e2f5] font-sans overflow-x-hidden overflow-y-auto relative">
      {/* TOAST */}
      {toastMessage && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] ${toastMessage.type === 'success' ? 'bg-[#8ab4f8]' : 'bg-rose-400'} text-white px-6 py-3 rounded-xl shadow-xl font-bold animate-in slide-in-from-top-4 fade-in duration-300 flex items-center gap-2`}>
          {toastMessage.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          )}
          {toastMessage.text}
        </div>
      )}
      {!STAFF_ROLES.includes(role || '') && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">Please link your account first.</p>
            <div className="flex flex-col gap-3">
              <Link href="/claim" className="w-full bg-[#8ab4f8] text-white hover:opacity-90 py-3 rounded-xl font-bold transition-all shadow-sm">
                Link Account
              </Link>
              <Link href="/dashboard" className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200 py-3 rounded-xl font-bold transition-colors">
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
      
      {/* HEADER */}
      <div className="w-full bg-white/90 backdrop-blur-md shadow-sm z-50 px-4 py-3 sm:px-8 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between flex-row-reverse sm:flex-row sm:justify-start">
          <img src="/dreamtealogo.svg" alt="Dream Tea" className="hidden sm:block h-8 w-auto mr-2 opacity-90" />
          <div className="relative">
            <button onClick={() => setIsNavOpen(!isNavOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-gray-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            {isNavOpen && (
              <div className="absolute top-full right-0 sm:right-auto sm:left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                 {/* Email moved to top left on mobile */}
                 <Link href="/dashboard" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                    Dashboard
                 </Link>
                 {role === 'admin' && (
                   <Link href="/management" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.99l1.005.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                      Management
                   </Link>
                 )}
                 <Link href="/privacy-policy" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                    Privacy Policy
                 </Link>
                 <Link href="/terms-of-service" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                    Terms of Service
                 </Link>
                 <button onClick={handleLogOut} disabled={isLoggingOut} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
                    {isLoggingOut ? "Logging out..." : "Log Out"}
                 </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
             {role === 'guest' ? (
               <div className="text-gray-700 font-medium text-sm flex items-center gap-2 sm:gap-3">
                 <span className="truncate max-w-[180px] sm:max-w-[250px] lg:max-w-none">Guest Log In</span>
               </div>
             ) : email ? (
               <div className="text-gray-700 font-medium text-sm flex items-center gap-2 sm:gap-3">
                 <span className="truncate max-w-[180px] sm:max-w-[250px] lg:max-w-none">{email}</span>
                 {STAFF_ROLES.includes(role || '') && (
                   <div className={`font-medium text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1 sm:gap-2 ${role === 'admin' ? 'bg-sky-50 text-sky-700 border border-sky-100/50' : 'bg-gray-100/80 text-gray-600'}`}>
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 sm:w-4 sm:h-4 ${role === 'admin' ? 'text-sky-600' : 'text-gray-500'}`}>
                       {role === 'admin' ? (
                         <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                       ) : (
                         <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                       )}
                     </svg>
                     {role === 'admin' ? 'Admin' : 'Linked'}
                   </div>
                 )}
               </div>
             ) : null}
             <div className="text-gray-600 font-medium text-sm bg-gray-100/80 px-3 py-1.5 rounded-full hidden sm:flex items-center gap-2">
               Availability
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col items-center py-6 px-4 sm:px-8">
        <div className="w-full max-w-[850px] flex flex-col items-center gap-8 relative z-10 my-auto">
          
          {/* AVAILABILITY FORM CARD */}
          <div className="w-full bg-white rounded-3xl shadow-xl p-6 sm:p-8 min-h-[300px] flex flex-col relative overflow-hidden transition-all duration-300">
             {allSaved ? (
               <div className="flex-1 flex flex-col items-center justify-center text-green-500">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                 <p className="text-2xl font-bold text-gray-800 text-center">All availability saved.</p>
                 <p className="text-gray-500 mt-2 font-medium text-center">You're good to submit.</p>
               </div>
             ) : !selectedDate ? (
               <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>
                 <p className="text-lg font-medium text-center">Please choose a day from the calendar below</p>
               </div>
             ) : (
               <div className="flex flex-col w-full h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">
                        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">Select your availability for this date</p>
                    </div>
                    
                    <button 
                      onClick={handleUnavailableToggle}
                      className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 ${isUnavailable ? 'bg-red-500 text-white shadow-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                      Unavailable
                    </button>
                  </div>

                  <div className="relative flex-1 flex flex-col">
                    <div className={`flex-1 flex flex-col transition-opacity duration-300 ${isUnavailable ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                      
                      {/* LOCATIONS */}
                      <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Locations</h3>
                        <div className="flex flex-wrap gap-2">
                          {LOCATIONS.map(loc => {
                            const theme = getLocationTheme(loc);
                            const isSelected = !!locationTimes[loc];
                            const isActive = activeLocation === loc;
                            return (
                              <button
                                key={loc}
                                onClick={() => toggleLocation(loc)}
                                className={`px-4 py-2 rounded-full border-2 text-sm font-bold transition-all ${isSelected ? theme.bg + ' ' + theme.border + ' ' + theme.text : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                              >
                                {loc}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* TIMES */}
                      <div className="flex flex-row gap-2 sm:gap-6 mb-8 w-full">
                         {!activeLocation ? (
                            <div className="flex-1 bg-gray-50 rounded-2xl p-8 border border-gray-100 flex items-center justify-center text-gray-400 font-bold text-center">
                               Select a location above to set its hours
                            </div>
                         ) : (
                            <>
                               <style dangerouslySetInnerHTML={{__html: `
                                 .time-wheel::-webkit-scrollbar { display: none; }
                                 .time-wheel { -ms-overflow-style: none; scrollbar-width: none; }
                                 @keyframes fadeOutUp {
                                   0% { opacity: 0; transform: translate(-50%, 10px); }
                                   20% { opacity: 1; transform: translate(-50%, 0); }
                                   80% { opacity: 1; transform: translate(-50%, 0); }
                                   100% { opacity: 0; transform: translate(-50%, -10px); }
                                 }
                                 .animate-fade-out-up { animation: fadeOutUp 1.5s ease-out forwards; }
                                 @keyframes popIn {
                                   0% { opacity: 0; transform: scale(0.9); }
                                   100% { opacity: 1; transform: scale(1); }
                                 }
                                 .animate-pop-in { animation: popIn 0.2s ease-out forwards; }
                               `}} />
                               
                               <div className="flex-1 bg-gray-50 rounded-2xl p-2 sm:p-4 border border-gray-100 flex flex-col justify-center items-center relative overflow-hidden">
                                 <h3 className="absolute top-2 left-2 sm:top-4 sm:left-4 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest z-10">Start Time</h3>
                                 <div className="flex w-full mt-6 h-[150px] justify-center gap-1 sm:gap-2 relative pr-[20px] sm:pr-0">
                                    <TimeWheel value={locationTimes[activeLocation].startTime.split(':')[0]} onChange={(h) => {
                                       const newT = `${h}:${locationTimes[activeLocation].startTime.split(':')[1]}`;
                                       const newTimes = { ...locationTimes };
                                       Object.keys(newTimes).forEach(l => {
                                          newTimes[l] = { ...newTimes[l], startTime: newT };
                                          if (newT > newTimes[l].endTime) newTimes[l].endTime = newT;
                                       });
                                       setLocationTimes(newTimes);
                                    }} options={HOURS} isHour />
                                    <div className="flex items-center text-2xl sm:text-3xl font-bold text-gray-400 mt-[-10px]">:</div>
                                    <TimeWheel value={locationTimes[activeLocation].startTime.split(':')[1]} onChange={(m) => {
                                       const newT = `${locationTimes[activeLocation].startTime.split(':')[0]}:${m}`;
                                       const newTimes = { ...locationTimes };
                                       Object.keys(newTimes).forEach(l => {
                                          newTimes[l] = { ...newTimes[l], startTime: newT };
                                          if (newT > newTimes[l].endTime) newTimes[l].endTime = newT;
                                       });
                                       setLocationTimes(newTimes);
                                    }} options={MINUTES} />
                                    <div className="flex items-center text-xl sm:text-2xl font-bold text-gray-400 ml-2 mt-[-5px]">
                                       <span key={parseInt(locationTimes[activeLocation].startTime.split(':')[0]) >= 12 ? 'PM' : 'AM'} className="animate-pop-in inline-block">
                                         {parseInt(locationTimes[activeLocation].startTime.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                                       </span>
                                    </div>
                                 </div>
                               </div>
                               
                               <div className="flex-1 bg-gray-50 rounded-2xl p-2 sm:p-4 border border-gray-100 flex flex-col justify-center items-center relative overflow-hidden">
                                 <h3 className="absolute top-2 left-2 sm:top-4 sm:left-4 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest z-10">End Time</h3>
                                 <div className="flex w-full mt-6 h-[150px] justify-center gap-1 sm:gap-2 relative pr-[20px] sm:pr-0">
                                    <TimeWheel value={locationTimes[activeLocation].endTime.split(':')[0]} onChange={(h) => {
                                       const newT = `${h}:${locationTimes[activeLocation].endTime.split(':')[1]}`;
                                       const newTimes = { ...locationTimes };
                                       Object.keys(newTimes).forEach(l => {
                                          newTimes[l] = { ...newTimes[l], endTime: newT };
                                          if (newT < newTimes[l].startTime) newTimes[l].startTime = newT;
                                       });
                                       setLocationTimes(newTimes);
                                    }} options={HOURS} isHour />
                                    <div className="flex items-center text-2xl sm:text-3xl font-bold text-gray-400 mt-[-10px]">:</div>
                                    <TimeWheel value={locationTimes[activeLocation].endTime.split(':')[1]} onChange={(m) => {
                                       const newT = `${locationTimes[activeLocation].endTime.split(':')[0]}:${m}`;
                                       const newTimes = { ...locationTimes };
                                       Object.keys(newTimes).forEach(l => {
                                          newTimes[l] = { ...newTimes[l], endTime: newT };
                                          if (newT < newTimes[l].startTime) newTimes[l].startTime = newT;
                                       });
                                       setLocationTimes(newTimes);
                                    }} options={MINUTES} />
                                    <div className="flex items-center text-xl sm:text-2xl font-bold text-gray-400 ml-2 mt-[-5px]">
                                       <span key={parseInt(locationTimes[activeLocation].endTime.split(':')[0]) >= 12 ? 'PM' : 'AM'} className="animate-pop-in inline-block">
                                         {parseInt(locationTimes[activeLocation].endTime.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                                       </span>
                                    </div>
                                 </div>
                               </div>
                            </>
                         )}
                      </div>
                    </div>
                    {isUnavailable && (
                       <div 
                         className="absolute inset-0 z-20 cursor-pointer rounded-xl" 
                         onClick={() => setIsUnavailable(false)}
                         title="Click to mark as available"
                       />
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-auto pt-8">
                     <button onClick={handlePrevDay} className="text-gray-400 hover:text-gray-700 font-bold px-4 py-2 flex items-center gap-2">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                       <span className="hidden sm:inline">Previous Day</span>
                     </button>
                     <div className="flex items-center gap-2 relative">
                       {actionIndicator && (
                         <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-sm font-bold text-gray-400 animate-fade-out-up whitespace-nowrap">
                           {actionIndicator}
                         </div>
                       )}
                       <button onClick={handleClearDay} className="bg-white hover:bg-gray-50 text-black shadow-md shadow-gray-200 font-bold px-4 py-3 rounded-xl transition-all border border-gray-100">
                         Clear
                       </button>
                       <button onClick={handleSaveDay} className="bg-white hover:bg-gray-50 text-black shadow-md shadow-gray-200 font-bold px-4 sm:px-8 py-3 rounded-xl transition-all border border-gray-100">
                         Save Availability
                       </button>
                     </div>
                     <button onClick={handleNextDay} className="text-gray-400 hover:text-gray-700 font-bold px-4 py-2 flex items-center gap-2">
                       <span className="hidden sm:inline">Next Day</span>
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                     </button>
                  </div>
               </div>
             )}
          </div>

          {/* STRICT CALENDAR */}
          <div className="w-full bg-white rounded-3xl shadow-xl p-6 sm:p-8 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <button onClick={handlePrevPeriod} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
                {targetPeriod && (
                  <h3 className="text-lg font-bold text-gray-800 text-center">
                    {targetPeriod.year} {new Date(targetPeriod.year, targetPeriod.month - 1).toLocaleString('en-US', { month: 'long' })} {targetPeriod.period === 1 ? '1-15' : '16-31'} (Period {targetPeriod.period})
                  </h3>
                )}
                {(() => {
                  const isAtMaxPeriod = targetPeriod && maxTargetPeriod && targetPeriod.year === maxTargetPeriod.year && targetPeriod.month === maxTargetPeriod.month && targetPeriod.period === maxTargetPeriod.period;
                  return (
                    <button onClick={handleNextPeriod} disabled={!!isAtMaxPeriod} className={`p-2 rounded-lg transition-colors ${isAtMaxPeriod ? 'text-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                    </button>
                  )
                })()}
             </div>
             
             <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-bold text-gray-400 py-2">
                  {day}
                </div>
              ))}
              
              {validDates.length > 0 && Array.from({ length: validDates[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="p-2"></div>
              ))}

              {validDates.map(day => {
                const isSelected = selectedDate?.toDateString() === day.toDateString();
                const dayStr = day.toISOString().split('T')[0];
                const cacheData = availabilityCache[dayStr];
                const isCompleted = !!cacheData;
                
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => { 
                       setSelectedDate(day); 
                       setAllSaved(false); 
                       const dStr = day.toISOString().split('T')[0];
                       const cached = availabilityCache[dStr];
                       if (cached) {
                         setIsUnavailable(cached.isUnavailable);
                         setLocationTimes(cached.locationTimes || {});
                         const locs = Object.keys(cached.locationTimes || {});
                         setActiveLocation(locs.length > 0 ? locs[0] : null);
                       } else {
                         setIsUnavailable(false);
                       }
                    }}
                    className={`
                      aspect-square p-1 sm:p-2 flex flex-col items-center justify-start relative transition-all bg-white
                    `}
                  >
                    <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-2 rounded-lg border-gray-800 font-bold' : ''}`}>
                       <span className={`text-sm ${isSelected ? 'text-gray-800' : 'text-gray-700'}`}>{day.getDate()}</span>
                    </div>
                    {isCompleted && !cacheData.isUnavailable && (
                       <div className="flex flex-col w-full mt-1 items-center gap-0.5">
                         {cacheData.locationTimes && Object.entries(cacheData.locationTimes).map(([loc, times]: [string, any]) => {
                           const startH = parseInt(times.startTime.split(':')[0]);
                           const startM = times.startTime.split(':')[1];
                           const endH = parseInt(times.endTime.split(':')[0]);
                           const endM = times.endTime.split(':')[1];
                           const fmtStart = `${startH.toString().padStart(2, '0')}:${startM}`;
                           const fmtEnd = `${endH.toString().padStart(2, '0')}:${endM}`;
                           return (
                             <span key={loc} className={`text-[10px] font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-1 ${getLocationTheme(loc).text}`}>
                               {loc.charAt(0)}: {fmtStart}-{fmtEnd}
                             </span>
                           );
                         })}
                       </div>
                    )}
                    {isCompleted && cacheData.isUnavailable && (
                       <div className="flex flex-col w-full mt-1 items-center justify-center">
                         <span className="text-[10px] font-bold text-red-400 mt-1 whitespace-nowrap px-1">
                           Unavailable
                         </span>
                       </div>
                    )}
                  </button>
                )
              })}
             </div>
          </div>

          {/* SUBMISSION */}
          <button disabled={isSubmitting} onClick={() => {
              const missing = validDates.filter(d => !availabilityCache[d.toISOString().split('T')[0]]);
              setMissingDates(missing);
              setShowMissingModal(true);
            }} 
            className="w-full max-w-xs bg-white hover:bg-gray-50 text-gray-800 shadow-md shadow-gray-200 font-bold py-3 rounded-xl transition-all border border-gray-100 text-base mb-12 disabled:opacity-50">
            {isSubmitting ? "Submitting..." : "Submit Availability"}
          </button>

        </div>
      </div>

      {showMissingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative">
              <button onClick={() => setShowMissingModal(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
              <div className={`flex items-center gap-4 mb-4 ${missingDates.length > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                {missingDates.length > 0 ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                )}
                <h3 className="text-xl font-bold text-gray-800">{missingDates.length > 0 ? 'Missing Days' : 'Confirm Availability'}</h3>
              </div>
              <p className="text-gray-600 mb-4">{missingDates.length > 0 ? 'There was no availability given for these days:' : 'All availability has been filled! Please review your submission:'}</p>
              <div className={`max-h-[200px] overflow-y-auto rounded-xl p-4 mb-6 border ${missingDates.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                 <ul className="list-disc list-inside font-medium space-y-1 text-sm sm:text-base">
                   {validDates.map(d => {
                     const isMissing = missingDates.some(md => md.toISOString() === d.toISOString());
                     let suffix = "";
                     if (!isMissing) {
                        const dayStr = d.toISOString().split('T')[0];
                        const cache = availabilityCache[dayStr];
                        if (cache.isUnavailable) {
                           suffix = ": Unavailable";
                        } else {
                           const locs = Object.values(cache.locationTimes || {}) as any[];
                           if (locs.length > 0) {
                              const startH = parseInt(locs[0].startTime.split(':')[0]);
                              const startM = locs[0].startTime.split(':')[1];
                              const endH = parseInt(locs[0].endTime.split(':')[0]);
                              const endM = locs[0].endTime.split(':')[1];
                              const fmtStart = `${startH.toString().padStart(2, '0')}:${startM}`;
                              const fmtEnd = `${endH.toString().padStart(2, '0')}:${endM}`;
                              suffix = `: ${fmtStart}-${fmtEnd}`;
                           } else {
                              suffix = ": Available";
                           }
                        }
                     }
                     return (
                       <li key={d.toISOString()} className={missingDates.length > 0 ? (isMissing ? "text-amber-800" : "text-amber-800/50") : "text-gray-700"}>
                         {d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}{suffix}
                       </li>
                     );
                   })}
                 </ul>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                 <button onClick={() => setShowMissingModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-xl transition-all">
                   Go Back
                 </button>
                 <button onClick={() => {
                    setShowMissingModal(false);
                    handleFinalSubmit();
                 }} className="flex-1 bg-white hover:bg-gray-50 text-gray-800 shadow-md shadow-gray-200 font-bold py-3 rounded-xl transition-all border border-gray-100">
                   Confirm
                 </button>
              </div>
           </div>
        </div>
      )}
    </main>
  );
}
