"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { StaffRow } from "@/components/management/StaffRow";
import { AddStaffModal } from "@/components/management/AddStaffModal";
import { AvailabilityTab } from "@/components/management/AvailabilityTab";

export default function ManagementPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
    };
    
    checkAuth();
  }, [router, supabase.auth]);

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

  const [staffData, setStaffData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'staff' | 'scheduling'>('staff');
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Calendar State
  const [targetPeriod, setTargetPeriod] = useState<{ year: number, month: number, period: number } | null>(null);
  const [maxTargetPeriod, setMaxTargetPeriod] = useState<{ year: number, month: number, period: number } | null>(null);
  const [validDates, setValidDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [periodAvailability, setPeriodAvailability] = useState<any[]>([]);
  const [isFetchingAvail, setIsFetchingAvail] = useState(false);

  // Add Staff Modal State
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAddStaffSuccess = (message: string) => {
    setIsAddStaffModalOpen(false);
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
    fetchData();
  };

  const handleViewAvailability = (name: string) => {
    setSearchQuery(name);
    setActiveTab('scheduling');
    localStorage.setItem("nexus_management_iv", "true");
  };

  useEffect(() => {
    const cachedLoc = localStorage.getItem("nexus_management_loc");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cachedLoc) setSelectedLocation(cachedLoc);

    const cachedTab = localStorage.getItem("nexus_management_tab");
     
    if (cachedTab) setActiveTab(cachedTab as 'staff' | 'scheduling');

    const cachedSearch = localStorage.getItem("nexus_management_search");
     
    if (cachedSearch) setSearchQuery(cachedSearch);

    const cachedDate = localStorage.getItem("nexus_management_date");
     
    if (cachedDate) setSelectedDate(new Date(cachedDate));
  }, []);

  useEffect(() => {
    localStorage.setItem("nexus_management_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem("nexus_management_search", searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedDate) {
      localStorage.setItem("nexus_management_date", selectedDate.toISOString());
    } else {
      localStorage.removeItem("nexus_management_date");
    }
  }, [selectedDate]);

  const handleLocationChange = (loc: string) => {
    setSelectedLocation(loc);
    localStorage.setItem("nexus_management_loc", loc);
  };

  useEffect(() => {
    const fetchAvail = async () => {
      if (!targetPeriod) return;
      setIsFetchingAvail(true);
      const { getAvailabilityForPeriod } = await import('@/app/actions/management');
      const { availability, error } = await getAvailabilityForPeriod(targetPeriod.year, targetPeriod.month, targetPeriod.period);
      if (availability) {
        setPeriodAvailability(availability);
      } else {
        console.error(error);
      }
      setIsFetchingAvail(false);
    };
    fetchAvail();
  }, [targetPeriod]);

  const calculateValidDates = (y: number, m: number, p: number) => {
    const dates: Date[] = [];
    if (p === 1) {
      for (let i = 1; i <= 15; i++) dates.push(new Date(y, m - 1, i));
    } else {
      const lastDay = new Date(y, m, 0).getDate();
      for (let i = 16; i <= lastDay; i++) dates.push(new Date(y, m - 1, i));
    }
    setValidDates(dates);
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
    setSelectedDate(null);
  };

  const handleNextPeriod = () => {
    if (!targetPeriod) return;
    if (maxTargetPeriod && targetPeriod.year === maxTargetPeriod.year && targetPeriod.month === maxTargetPeriod.month && targetPeriod.period === maxTargetPeriod.period) return;
    
    let { year, month, period } = targetPeriod;
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
    setSelectedDate(null);
  };

  const fetchData = async () => {
    setIsLoading(true);
    const { getStaffTableData } = await import('@/app/actions/management');
    const { staff, error } = await getStaffTableData();
    if (staff) {
      setStaffData(staff);
    } else {
      console.error(error);
    }
    
    // Fetch schedule boundary data
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
       
       targetPeriodNum = targetPeriodNum === 1 ? 2 : 1;
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
    
    setIsLoading(false);
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchData();
    }
  }, [role]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setVisibleCount(10);
  };

  const sortedStaffData = [...staffData].sort((a, b) => {
    if (!sortField) return 0;
    
    if (sortField === 'statusText') {
       const scoreA = a.availabilityScore || 0;
       const scoreB = b.availabilityScore || 0;
       if (scoreA < scoreB) return sortDirection === 'asc' ? -1 : 1;
       if (scoreA > scoreB) return sortDirection === 'asc' ? 1 : -1;
       return 0;
    }
    
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  }).filter(staff => {
    if (!staffSearchQuery) return true;
    const q = staffSearchQuery.toLowerCase();
    return (
      (staff.name && staff.name.toLowerCase().includes(q)) ||
      (staff.email && staff.email.toLowerCase().includes(q)) ||
      (staff.temp_email && staff.temp_email.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    if (visibleCount < sortedStaffData.length) {
      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + 10);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visibleCount, sortedStaffData.length]);

  const visibleStaffData = sortedStaffData.slice(0, visibleCount);

  if (!role) return null;

  return (
    <main className="min-h-[100dvh] w-screen flex flex-col bg-[#c2e2f5] font-sans overflow-x-hidden overflow-y-auto relative">
      {/* TOAST */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-[#8ab4f8] text-white px-6 py-3 rounded-xl shadow-xl font-bold animate-in slide-in-from-top-4 fade-in duration-300 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          {toastMessage}
        </div>
      )}
      {role !== 'admin' && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">You need administrator privileges to view this page.</p>
            <div className="flex flex-col gap-3">
              <Link href="/dashboard" className="w-full bg-[#8ab4f8] text-white hover:opacity-90 py-3 rounded-xl font-bold transition-all shadow-sm">
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
                 <Link href="/dashboard" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                    Dashboard
                 </Link>
                 <Link href="/availability" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>
                    My Availability
                 </Link>
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
                 {role === 'admin' && (
                   <div className="font-medium text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1 sm:gap-2 bg-sky-50 text-sky-700 border border-sky-100/50">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 sm:w-4 sm:h-4 text-sky-600">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                     </svg>
                     Admin
                   </div>
                 )}
               </div>
             ) : null}
             <div className="text-gray-600 font-medium text-sm bg-gray-100/80 px-3 py-1.5 rounded-full hidden sm:flex items-center gap-2">
               Management
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col items-center py-6 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 flex flex-col relative overflow-hidden transition-all duration-300">
          <div className="flex border-b border-gray-100 mb-6 space-x-6">
            <button 
              onClick={() => setActiveTab('staff')}
              className={`pb-3 text-[15px] font-semibold transition-colors relative ${activeTab === 'staff' ? 'text-sky-500' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Staff
              {activeTab === 'staff' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-sky-500 rounded-t-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('scheduling')}
              className={`pb-3 text-[15px] font-semibold transition-colors relative ${activeTab === 'scheduling' ? 'text-sky-500' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Availability
              {activeTab === 'scheduling' && <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-sky-500 rounded-t-full" />}
            </button>
          </div>
          
          {activeTab === 'staff' && (
            <div className="overflow-x-auto w-full pb-4">
            <div className="flex justify-between items-center mb-4 min-w-[700px] gap-4">
              <div className="relative max-w-sm w-full">
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
                  value={staffSearchQuery}
                  onChange={e => { setStaffSearchQuery(e.target.value); setVisibleCount(10); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
              <button onClick={() => setIsAddStaffModalOpen(true)} className="bg-[#8ab4f8] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:opacity-90 hover:shadow transition-all flex items-center gap-2 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add New Staff
              </button>
            </div>
            <table className="w-full text-left text-[13px] text-gray-600 border-collapse whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-700 text-xs uppercase border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 font-medium cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-3 py-3 font-medium cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('temp_email')}>
                    <div className="flex items-center gap-1">Temp Email {sortField === 'temp_email' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-3 py-3 font-medium cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('email')}>
                    <div className="flex items-center gap-1">Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-3 py-3 font-medium cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('s_name')}>
                    <div className="flex items-center gap-1">S Name {sortField === 's_name' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-3 py-3 font-medium cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('role')}>
                    <div className="flex items-center gap-1">Role {sortField === 'role' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-3 py-3 font-medium cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('created_at')}>
                    <div className="flex items-center gap-1">Created At {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-3 py-3 font-medium cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('statusText')}>
                    <div className="flex items-center gap-1">Availability {sortField === 'statusText' && (sortDirection === 'asc' ? '↑' : '↓')}</div>
                  </th>
                  <th className="px-3 py-3 font-medium text-right w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleStaffData.map(staff => (
                  <StaffRow key={staff.id} staff={staff} onSave={fetchData} onViewAvailability={handleViewAvailability} />
                ))}
                {sortedStaffData.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      {staffSearchQuery ? "No matching staff found." : "No staff records found."}
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Loading staff data...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
          
          {activeTab === 'scheduling' && (
             <AvailabilityTab 
               searchQuery={searchQuery}
               setSearchQuery={setSearchQuery}
               selectedLocation={selectedLocation}
               handleLocationChange={handleLocationChange}
               isFetchingAvail={isFetchingAvail}
               selectedDate={selectedDate}
               setSelectedDate={setSelectedDate}
               validDates={validDates}
               periodAvailability={periodAvailability}
               targetPeriod={targetPeriod}
               maxTargetPeriod={maxTargetPeriod}
               handlePrevPeriod={handlePrevPeriod}
               handleNextPeriod={handleNextPeriod}
             />
          )}
        </div>
      </div>

      <AddStaffModal 
        isOpen={isAddStaffModalOpen} 
        onClose={() => setIsAddStaffModalOpen(false)} 
        onSuccess={handleAddStaffSuccess} 
      />
    </main>
  );
}
