"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../utils/supabase/client";

const LOCATIONS = ["Whyte", "Downtown", "Heritage"];

const getLocationTheme = (location: string) => {
  const loc = (location || "").toLowerCase();
  if (loc.includes("whyte")) return { text: "text-[#CAB1E3]", border: "border-[#CAB1E3]", bg: "bg-[#CAB1E3]/10", fill: "bg-[#CAB1E3]" };
  if (loc.includes("heritage")) return { text: "text-[#ED9BB4]", border: "border-[#ED9BB4]", bg: "bg-[#ED9BB4]/10", fill: "bg-[#ED9BB4]" };
  if (loc.includes("downtown") || loc.includes("dt")) return { text: "text-[#A0B99B]", border: "border-[#A0B99B]", bg: "bg-[#A0B99B]/10", fill: "bg-[#A0B99B]" };
  return { text: "text-sky-500", border: "border-sky-200", bg: "bg-sky-50", fill: "bg-[#8ab4f8]" };
};

const HOURS = Array.from({length: 11}, (_, i) => (i + 12).toString());
const MINUTES = ["00", "15", "30", "45"];

const TimeWheel = ({ value, onChange, options, isHour = false }: { value: string, onChange: (v: string) => void, options: string[], isHour?: boolean }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
     if (!containerRef.current) return;
     const el = containerRef.current.querySelector(`[data-val="${value}"]`) as HTMLElement;
     if (el) {
        // center the element
        const top = el.offsetTop - containerRef.current.offsetTop - 50;
        containerRef.current.scrollTo({ top, behavior: 'smooth' });
     }
  }, [value]);

  return (
    <div ref={containerRef} className="time-wheel h-[150px] overflow-y-auto w-[50px] flex flex-col items-center snap-y snap-mandatory pt-[50px] pb-[50px]">
       {options.map(o => {
         const display = isHour ? (parseInt(o) > 12 ? parseInt(o) - 12 : parseInt(o)).toString() : o;
         return (
           <button 
             key={o} 
             data-val={o}
             onClick={() => onChange(o)}
             className={`h-[50px] shrink-0 snap-center text-3xl font-bold transition-all ${value === o ? 'text-[#8ab4f8] scale-110' : 'text-gray-300 hover:text-gray-400'}`}
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
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isFullDay, setIsFullDay] = useState(false);
  
  // Bounds
  const [startTime, setStartTime] = useState<string>("12:00");
  const [endTime, setEndTime] = useState<string>("22:00");
  
  // Submission State
  const [missingDates, setMissingDates] = useState<Date[]>([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allSaved, setAllSaved] = useState(false);

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

      // Load saved locations
      const savedLocs = localStorage.getItem("nexus_avail_locations");
      if (savedLocs) setSelectedLocations(JSON.parse(savedLocs));
      
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
       targetYear = now.getFullYear();
       targetMonth = now.getMonth() + 1;
       targetPeriodNum = now.getDate() <= 15 ? 1 : 2;
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
    
    // 2. Fetch custom user ID
    const { data: userData } = await supabase.from('users').select('id').eq('auth_user_id', authUserId).single();
    if (!userData) return;
    
    // 3. Fetch availability for target period
    const { data: availData } = await supabase.from('availability')
      .select('schedule_data, updated_at')
      .eq('user_id', userData.id)
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
    } else if (localDraft?.data) {
       finalCache = localDraft.data;
    }
    
    setAvailabilityCache(finalCache);
  };

  const transformDBToCache = (schedule_data: any) => {
     const cache: any = {};
     for (const [dayStr, dayData] of Object.entries(schedule_data)) {
        const anyDayData: any = dayData;
        const locs = Object.keys(anyDayData.locations || {});
        
        if (locs.length === 0) {
           cache[dayStr] = { isUnavailable: true, isFullDay: false, startTime: "12:00", endTime: "22:00", locations: [] };
           continue;
        }
        
        let startTime = "12:00";
        let endTime = "22:00";
        let isFullDay = true;
        
        const firstLocShifts = anyDayData.locations[locs[0]];
        if (firstLocShifts && firstLocShifts.length > 0) {
           const startD = new Date(firstLocShifts[0].start.dateTime);
           const endD = new Date(firstLocShifts[0].end.dateTime);
           startTime = `${startD.getHours().toString().padStart(2, '0')}:${startD.getMinutes().toString().padStart(2, '0')}`;
           endTime = `${endD.getHours().toString().padStart(2, '0')}:${endD.getMinutes().toString().padStart(2, '0')}`;
           if (startTime !== "12:00" || endTime !== "22:00") isFullDay = false;
        }
        
        cache[dayStr] = {
           isUnavailable: false,
           isFullDay,
           startTime,
           endTime,
           locations: locs.map(l => l.charAt(0).toUpperCase() + l.slice(1)) // capitalize back
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
    let newLocs = [...selectedLocations];
    if (newLocs.includes(loc)) {
      newLocs = newLocs.filter(l => l !== loc);
    } else {
      newLocs.push(loc);
    }
    setSelectedLocations(newLocs);
    localStorage.setItem("nexus_avail_locations", JSON.stringify(newLocs));
  };

  useEffect(() => {
    if (selectedDate) {
      const dayStr = selectedDate.toISOString().split('T')[0];
      const cached = availabilityCache[dayStr];
      if (cached) {
        setIsUnavailable(cached.isUnavailable);
        setIsFullDay(cached.isFullDay);
        setStartTime(cached.startTime || "12:00");
        setEndTime(cached.endTime || "22:00");
        if (cached.locations) setSelectedLocations(cached.locations);
      } else {
        // Reset defaults
        setIsUnavailable(false);
        setIsFullDay(false);
        setStartTime("12:00");
        setEndTime("22:00");
        setSelectedLocations([]);
      }
    }
  }, [selectedDate, availabilityCache]);

  const saveCurrentDay = () => {
    if (!selectedDate) return availabilityCache;
    const dayStr = selectedDate.toISOString().split('T')[0];
    
    let newCache;
    if (!isUnavailable && selectedLocations.length === 0) {
      newCache = { ...availabilityCache };
      delete newCache[dayStr];
    } else {
      newCache = {
        ...availabilityCache,
        [dayStr]: {
          isUnavailable,
          isFullDay,
          startTime,
          endTime,
          locations: selectedLocations
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
    setIsFullDay(false);
    setStartTime("12:00");
    setEndTime("22:00");
    setSelectedLocations([]);
    
    if (!selectedDate) return;
    const dayStr = selectedDate.toISOString().split('T')[0];
    const newCache = { ...availabilityCache };
    delete newCache[dayStr];
    
    setAvailabilityCache(newCache);
    localStorage.setItem("nexus_avail_draft", JSON.stringify({
      updated_at: new Date().toISOString(),
      data: newCache
    }));
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
        
        if (!cache.isUnavailable) {
           const startStr = cache.isFullDay ? "12:00" : cache.startTime;
           const endStr = cache.isFullDay ? "22:00" : cache.endTime;
           
           cache.locations.forEach((loc: string) => {
              const startDateTime = `${dayStr}T${startStr}:00`;
              const endDateTime = `${dayStr}T${endStr}:00`;
              
              schedule_data[dayStr].locations[loc.toLowerCase()] = [{
                 start: { dateTime: startDateTime, timeZone: "America/Edmonton" },
                 end: { dateTime: endDateTime, timeZone: "America/Edmonton" }
              }];
           });
        }
      });
      
      // 2. We need the custom `user_id` from the `users` table
      const { data: userData, error: userError } = await supabase.from('users').select('id').eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id).single();
      
      if (userError || !userData) {
         alert("Could not find your staff record. Please contact the manager to get your account linked.");
         setIsSubmitting(false);
         return;
      }
      
      // 3. Upsert into `availability` table
      const { error: upsertError } = await supabase.from('availability').upsert({
         user_id: userData.id,
         year: targetPeriod.year,
         month: targetPeriod.month,
         period: targetPeriod.period,
         schedule_data: schedule_data,
         updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, year, month, period' });
      
      if (upsertError) {
         console.error(upsertError);
         alert("Failed to submit availability. " + upsertError.message);
      } else {
         alert("Availability successfully submitted!");
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!role) return null;

  return (
    <main className="min-h-[100dvh] w-screen flex flex-col bg-[#c2e2f5] font-sans overflow-x-hidden overflow-y-auto">
      
      {/* HEADER */}
      <div className="w-full bg-white/90 backdrop-blur-md shadow-sm z-50 px-4 py-3 sm:px-8 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="relative">
            <button onClick={() => setIsNavOpen(!isNavOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-gray-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            {isNavOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                 {email && <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 mb-1 truncate block sm:hidden">{email}</div>}
                 <Link href="/dashboard" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                    Dashboard
                 </Link>
                 <button onClick={handleLogOut} disabled={isLoggingOut} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
                    {isLoggingOut ? "Logging out..." : "Log Out"}
                 </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
             <div className="text-gray-700 font-medium text-sm hidden sm:block">
               {email}
             </div>
             <div className="text-gray-600 font-medium text-sm bg-gray-100/80 px-3 py-1.5 rounded-full flex items-center gap-2">
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
                            const isSelected = selectedLocations.includes(loc);
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
                      <div className="flex flex-col sm:flex-row gap-6 mb-8">
                         <style dangerouslySetInnerHTML={{__html: `
                           .time-wheel::-webkit-scrollbar { display: none; }
                           .time-wheel { -ms-overflow-style: none; scrollbar-width: none; }
                         `}} />
                         
                         <div className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-center items-center relative overflow-hidden">
                           <h3 className="absolute top-4 left-4 text-xs font-bold text-gray-400 uppercase tracking-widest z-10">Start Time</h3>
                           <div className="flex w-full mt-6 h-[150px] justify-center gap-2 relative">
                              <TimeWheel value={startTime.split(':')[0]} onChange={(h) => {
                                 const newT = `${h}:${startTime.split(':')[1]}`;
                                 setStartTime(newT);
                                 if (newT > endTime) setEndTime(newT);
                              }} options={HOURS} isHour />
                              <div className="flex items-center text-3xl font-bold text-gray-400 mt-[-10px]">:</div>
                              <TimeWheel value={startTime.split(':')[1]} onChange={(m) => {
                                 const newT = `${startTime.split(':')[0]}:${m}`;
                                 setStartTime(newT);
                                 if (newT > endTime) setEndTime(newT);
                              }} options={MINUTES} />
                              <div className="flex items-center text-xl font-bold text-gray-400 ml-2 mt-[-5px]">
                                 {parseInt(startTime.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                              </div>
                           </div>
                         </div>
                         
                         <div className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-center items-center relative overflow-hidden">
                           <h3 className="absolute top-4 left-4 text-xs font-bold text-gray-400 uppercase tracking-widest z-10">End Time</h3>
                           <div className="flex w-full mt-6 h-[150px] justify-center gap-2 relative">
                              <TimeWheel value={endTime.split(':')[0]} onChange={(h) => {
                                 const newT = `${h}:${endTime.split(':')[1]}`;
                                 setEndTime(newT);
                                 if (newT < startTime) setStartTime(newT);
                              }} options={HOURS} isHour />
                              <div className="flex items-center text-3xl font-bold text-gray-400 mt-[-10px]">:</div>
                              <TimeWheel value={endTime.split(':')[1]} onChange={(m) => {
                                 const newT = `${endTime.split(':')[0]}:${m}`;
                                 setEndTime(newT);
                                 if (newT < startTime) setStartTime(newT);
                              }} options={MINUTES} />
                              <div className="flex items-center text-xl font-bold text-gray-400 ml-2 mt-[-5px]">
                                 {parseInt(endTime.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                              </div>
                           </div>
                         </div>
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
                     <div className="flex items-center gap-2">
                       <button onClick={handleClearDay} className="bg-red-50 hover:bg-red-100 text-red-500 font-bold px-4 py-3 rounded-xl transition-all border border-red-100">
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
                    onClick={() => { setSelectedDate(day); setAllSaved(false); }}
                    className={`
                      aspect-square p-1 sm:p-2 flex flex-col items-center justify-start relative transition-all bg-white
                    `}
                  >
                    <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-2 rounded-lg border-gray-800 font-bold' : ''}`}>
                       <span className={`text-sm ${isSelected ? 'text-gray-800' : 'text-gray-700'}`}>{day.getDate()}</span>
                    </div>
                    {isCompleted && !cacheData.isUnavailable && (
                       <div className="flex flex-col w-full mt-1 items-center gap-0.5">
                         {cacheData.locations.map((loc: string) => {
                           const startH = parseInt(cacheData.startTime.split(':')[0]);
                           const startM = cacheData.startTime.split(':')[1];
                           const endH = parseInt(cacheData.endTime.split(':')[0]);
                           const endM = cacheData.endTime.split(':')[1];
                           const fmtStart = `${startH > 12 ? startH - 12 : startH}:${startM}`;
                           const fmtEnd = `${endH > 12 ? endH - 12 : endH}:${endM}`;
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
              const latestCache = saveCurrentDay() || availabilityCache;
              const missing = validDates.filter(d => !latestCache[d.toISOString().split('T')[0]]);
              if (missing.length > 0) {
                 setMissingDates(missing);
                 setShowMissingModal(true);
              } else {
                 handleFinalSubmit();
              }
            }} 
            className="w-full max-w-xs bg-white hover:bg-gray-50 text-gray-800 shadow-md shadow-gray-200 font-bold py-3 rounded-xl transition-all border border-gray-100 text-base mb-12 disabled:opacity-50">
            {isSubmitting ? "Submitting..." : "Submit Availability"}
          </button>

        </div>
      </div>

      {showMissingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
              <button onClick={() => setShowMissingModal(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex items-center gap-4 mb-4 text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <h3 className="text-xl font-bold text-gray-800">Missing Days</h3>
              </div>
              <p className="text-gray-600 mb-4">There was no availability given for these days:</p>
              <div className="max-h-[200px] overflow-y-auto bg-amber-50 rounded-xl p-4 mb-6 border border-amber-100">
                 <ul className="list-disc list-inside text-amber-800 font-medium space-y-1">
                   {missingDates.map(d => (
                     <li key={d.toISOString()}>{d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</li>
                   ))}
                 </ul>
              </div>
              <button onClick={() => setShowMissingModal(false)} className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-xl transition-all">
                Go Back and Complete
              </button>
           </div>
        </div>
      )}
    </main>
  );
}
