"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../utils/supabase/client";

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
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Calendar State
  const [targetPeriod, setTargetPeriod] = useState<{ year: number, month: number, period: number } | null>(null);
  const [maxTargetPeriod, setMaxTargetPeriod] = useState<{ year: number, month: number, period: number } | null>(null);
  const [validDates, setValidDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [periodAvailability, setPeriodAvailability] = useState<any[]>([]);
  const [isFetchingAvail, setIsFetchingAvail] = useState(false);

  // Add Staff Modal State
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addSName, setAddSName] = useState('');
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  const handleAddStaff = async () => {
    if (!addName || !addEmail || !addSName) return alert("Please fill out all fields.");
    setIsAddingStaff(true);
    
    const { addStaffRecord } = await import('../actions/management');
    const { success, error } = await addStaffRecord({
      name: addName,
      temp_email: addEmail,
      s_name: addSName,
      role: 'employee'
    });
    
    if (error) {
      console.error(error);
      alert("Error adding staff: " + error);
    } else {
      setIsAddStaffModalOpen(false);
      setAddName('');
      setAddEmail('');
      setAddSName('');
      fetchData();
    }
    setIsAddingStaff(false);
  };

  useEffect(() => {
    const cachedLoc = localStorage.getItem("nexus_management_loc");
    if (cachedLoc) setSelectedLocation(cachedLoc);
  }, []);

  const handleLocationChange = (loc: string) => {
    setSelectedLocation(loc);
    localStorage.setItem("nexus_management_loc", loc);
  };

  useEffect(() => {
    const fetchAvail = async () => {
      if (!targetPeriod) return;
      setIsFetchingAvail(true);
      const { getAvailabilityForPeriod } = await import('../actions/management');
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
    const { getStaffTableData } = await import('../actions/management');
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
  });

  if (!role) return null;

  return (
    <main className="min-h-[100dvh] w-screen flex flex-col bg-[#c2e2f5] font-sans overflow-x-hidden overflow-y-auto relative">
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
            <div className="flex justify-end mb-4 min-w-[700px]">
              <button onClick={() => setIsAddStaffModalOpen(true)} className="bg-[#8ab4f8] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:opacity-90 hover:shadow transition-all flex items-center gap-2">
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
                {sortedStaffData.map(staff => (
                  <StaffRow key={staff.id} staff={staff} onSave={fetchData} />
                ))}
                {staffData.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No staff records found.
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
            <div className="w-full flex flex-col gap-6">
              
              {/* SEARCH & FILTER BAR */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full">
                <div className="relative w-full sm:w-80">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                  <input 
                    type="text" 
                    placeholder="Search staff name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm"
                  />
                </div>
                <div className="w-full sm:w-auto flex items-center gap-2">
                   <span className="text-sm font-medium text-gray-500">Location:</span>
                   <select 
                     value={selectedLocation} 
                     onChange={(e) => handleLocationChange(e.target.value)}
                     className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 py-2 pl-3 pr-8 appearance-none cursor-pointer"
                     style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19.5 8.25l-7.5 7.5-7.5-7.5\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1em 1em' }}
                   >
                     <option value="All">All Locations</option>
                     <option value="Whyte">Whyte</option>
                     <option value="Downtown">Downtown</option>
                     <option value="Heritage">Heritage</option>
                   </select>
                </div>
              </div>

              {/* TOP CARD */}
              <div className="w-full bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.05)] border border-gray-100 p-6 sm:p-8 min-h-[300px] flex flex-col relative overflow-hidden transition-all duration-300">
                 {isFetchingAvail ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                      <p className="text-lg font-medium animate-pulse">Loading availability data...</p>
                    </div>
                 ) : !selectedDate ? (
                    !searchQuery.trim() ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>
                        <p className="text-lg font-medium text-center">Please choose a day from the calendar below</p>
                      </div>
                    ) : (
                      // Display List of Availability for the searched staff
                      (() => {
                         const searchLower = searchQuery.toLowerCase();
                         const matchedStaffRecords = periodAvailability.filter(r => (r.staff?.name?.toLowerCase().includes(searchLower) || r.staff?.s_name?.toLowerCase().includes(searchLower)));
                         
                         if (matchedStaffRecords.length === 0) {
                            return (
                               <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                 <p className="text-lg font-medium">No staff found matching "{searchQuery}"</p>
                               </div>
                            )
                         }
                         
                         // Display the first matched staff's availability
                         const record = matchedStaffRecords[0];
                         return (
                            <div className="flex-1 flex flex-col">
                               <h2 className="text-2xl font-bold text-gray-800 mb-4">{record.staff.name}'s Availability</h2>
                               <div className="flex-1 overflow-y-auto bg-gray-50 border border-gray-100 rounded-xl p-4">
                                  <ul className="list-disc list-inside font-medium space-y-2 text-sm sm:text-base">
                                     {validDates.map(d => {
                                        const dayStr = d.toISOString().split('T')[0];
                                        const cache = record.schedule_data && record.schedule_data[dayStr];
                                        let suffix = ": No Availability Given";
                                        let color = "text-gray-400";
                                        
                                        if (cache) {
                                           if (cache.isUnavailable) {
                                              suffix = ": Unavailable";
                                              color = "text-gray-700";
                                           } else {
                                              const locs = Object.values(cache.locations || {}) as any[];
                                              if (locs.length > 0) {
                                                 const startD = new Date(locs[0][0].start.dateTime);
                                                 const endD = new Date(locs[0][0].end.dateTime);
                                                 const startH = startD.getHours().toString().padStart(2, '0');
                                                 const startM = startD.getMinutes().toString().padStart(2, '0');
                                                 const endH = endD.getHours().toString().padStart(2, '0');
                                                 const endM = endD.getMinutes().toString().padStart(2, '0');
                                                 suffix = `: ${startH}:${startM}-${endH}:${endM}`;
                                                 color = "text-gray-700";
                                              } else {
                                                 suffix = ": Available";
                                                 color = "text-gray-700";
                                              }
                                           }
                                        }
                                        
                                        return (
                                           <li key={d.toISOString()} className={color}>
                                              {d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}{suffix}
                                           </li>
                                        );
                                     })}
                                  </ul>
                               </div>
                            </div>
                         )
                      })()
                    )
                 ) : (
                    // GANTT CHART VIEW
                    <div className="flex-1 flex flex-col">
                       <div className="flex justify-between items-center mb-6">
                         <h2 className="text-2xl font-bold text-gray-800">
                           {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                         </h2>
                         <div className="flex gap-2">
                            <button onClick={() => {
                               if (!selectedDate || validDates.length === 0) return;
                               const idx = validDates.findIndex(d => d.toDateString() === selectedDate.toDateString());
                               if (idx > 0) setSelectedDate(validDates[idx - 1]);
                            }} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors shadow-sm disabled:opacity-50" disabled={!selectedDate || validDates.findIndex(d => d.toDateString() === selectedDate.toDateString()) <= 0}>
                               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                            </button>
                            <button onClick={() => {
                               if (!selectedDate || validDates.length === 0) return;
                               const idx = validDates.findIndex(d => d.toDateString() === selectedDate.toDateString());
                               if (idx >= 0 && idx < validDates.length - 1) setSelectedDate(validDates[idx + 1]);
                            }} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors shadow-sm disabled:opacity-50" disabled={!selectedDate || validDates.findIndex(d => d.toDateString() === selectedDate.toDateString()) >= validDates.length - 1}>
                               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                            </button>
                         </div>
                       </div>
                      
                      {/* Gantt Chart Container */}
                      <div className="relative flex-1 bg-gray-50/50 rounded-xl border border-gray-100 p-4 min-h-[300px] overflow-x-auto overflow-y-hidden">
                         
                         <div className="min-w-[700px] relative flex flex-col">
                            {/* X-Axis Timeline (10am to 10pm) */}
                            <div className="ml-32 relative h-10 pointer-events-none" style={{ zIndex: 0 }}>
                               {[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((hour) => (
                                  <div key={hour} className={`absolute top-0 flex flex-col items-center pointer-events-none ${(hour === 12 || hour === 17 || hour === 22) ? 'z-10' : ''}`} style={{ left: `${((hour - 10) / 12) * 100}%`, transform: 'translateX(-50%)', height: '2000px' }}>
                                     <span className={`text-xs font-bold mt-1 bg-gray-50 px-1 rounded ${(hour === 12 || hour === 17 || hour === 22) ? 'text-gray-600' : 'text-gray-400'}`}>{hour > 12 ? hour - 12 : hour}{hour === 12 ? 'p' : hour > 12 ? 'p' : 'a'}</span>
                                     <div className={`flex-1 mt-1 ${(hour === 12 || hour === 17 || hour === 22) ? 'w-[2px] bg-gray-400/80' : 'w-px bg-gray-200'}`} />
                                  </div>
                               ))}
                            </div>
                            
                            {/* Gantt Rows */}
                            <div className="mt-4 flex flex-col gap-3 relative z-10 w-full">
                            {(() => {
                               const dayStr = selectedDate.toISOString().split('T')[0];
                               let rows: any[] = [];
                               
                               periodAvailability.forEach(record => {
                                  if (searchQuery && !record.staff.name.toLowerCase().includes(searchQuery.toLowerCase()) && !record.staff.s_name.toLowerCase().includes(searchQuery.toLowerCase())) return;
                                  
                                  const cache = record.schedule_data && record.schedule_data[dayStr];
                                  if (cache && !cache.isUnavailable) {
                                     for (const [loc, shifts] of Object.entries(cache.locations || {}) as [string, any[]][]) {
                                        if (selectedLocation !== 'All' && loc.toLowerCase() !== selectedLocation.toLowerCase()) continue;
                                        
                                        shifts.forEach(shift => {
                                           const startD = new Date(shift.start.dateTime);
                                           const endD = new Date(shift.end.dateTime);
                                           
                                           const startHour = startD.getHours() + (startD.getMinutes() / 60);
                                           const endHour = endD.getHours() + (endD.getMinutes() / 60);
                                           
                                           if (endHour <= 10 || startHour >= 22) return; // Out of bounds
                                           
                                           // Clamping
                                           const cStart = Math.max(10, startHour);
                                           const cEnd = Math.min(22, endHour);
                                           
                                           const leftPerc = ((cStart - 10) / 12) * 100;
                                           const widthPerc = ((cEnd - cStart) / 12) * 100;
                                           
                                           let colorClass = "bg-[#A0B99B]/30 border-[#A0B99B] text-[#42523f]";
                                           if (loc.toLowerCase() === 'whyte') colorClass = "bg-[#CAB1E3]/30 border-[#CAB1E3] text-[#5b4a6e]";
                                           if (loc.toLowerCase() === 'heritage') colorClass = "bg-[#ED9BB4]/30 border-[#ED9BB4] text-[#8a3e56]";
                                           
                                           rows.push({
                                              name: record.staff.name,
                                              loc: loc,
                                              left: leftPerc,
                                              width: widthPerc,
                                              colorClass,
                                              startH: startD.getHours() > 12 ? startD.getHours() - 12 : startD.getHours(),
                                              startM: startD.getMinutes().toString().padStart(2,'0'),
                                              startP: startD.getHours() >= 12 ? 'p' : 'a',
                                              endH: endD.getHours() > 12 ? endD.getHours() - 12 : endD.getHours(),
                                              endM: endD.getMinutes().toString().padStart(2,'0'),
                                              endP: endD.getHours() >= 12 ? 'p' : 'a',
                                              startTime: startHour
                                           });
                                        });
                                     }
                                  }
                               });
                               
                               if (selectedLocation === 'All') {
                                  const locOrder: Record<string, number> = { 'whyte': 1, 'downtown': 2, 'heritage': 3 };
                                  rows.sort((a, b) => {
                                     const locA = (a.loc || '').toLowerCase();
                                     const locB = (b.loc || '').toLowerCase();
                                     const orderA = locOrder[locA] || 99;
                                     const orderB = locOrder[locB] || 99;
                                     if (orderA !== orderB) return orderA - orderB;
                                     return (a.startTime || 0) - (b.startTime || 0);
                                  });
                               }
                               
                               if (rows.length === 0) {
                                  return (
                                     <div className="text-gray-400 text-center mt-10 w-full ml-[-20px] font-medium text-sm">
                                        No availability for this day and location.
                                     </div>
                                  )
                               }
                               
                               return rows.map((r, idx) => (
                                  <div key={idx} className="flex items-center w-full">
                                     <div className="w-32 flex-shrink-0 text-sm font-semibold text-gray-700 truncate pr-2" title={r.name}>
                                        {r.name}
                                     </div>
                                     <div className="flex-1 relative h-10 bg-transparent rounded-lg">
                                        <div 
                                           className={`absolute top-1 bottom-1 rounded-md border flex items-center shadow-sm overflow-hidden whitespace-nowrap ${r.colorClass}`}
                                           style={{ left: `${r.left}%`, width: `${r.width}%` }}
                                           title={`${r.name} at ${r.loc} (${r.startH}:${r.startM}${r.startP} - ${r.endH}:${r.endM}${r.endP})`}
                                        >
                                           <div className="flex justify-between items-center w-full px-2">
                                              <span className="text-[10px] font-medium opacity-70">{r.startH}:{r.startM}{r.startP}</span>
                                              <span className="truncate font-bold text-xs px-1">{r.loc}</span>
                                              <span className="text-[10px] font-medium opacity-70">{r.endH}:{r.endM}{r.endP}</span>
                                           </div>
                                        </div>
                                     </div>
                                  </div>
                               ));
                            })()}
                          </div>
                       </div>
                    </div>
                 </div>
                 )}
              </div>

              {/* BOTTOM CARD: CALENDAR */}
              <div className="w-full bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.05)] border border-gray-100 p-6 sm:p-8 flex flex-col">
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
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          aspect-square p-1 sm:p-2 flex flex-col items-center justify-start relative transition-all bg-white hover:bg-gray-50 rounded-xl
                          ${isSelected ? 'border-2 border-black bg-sky-50/50 shadow-sm' : 'border border-gray-100'}
                        `}
                      >
                        <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${isSelected ? 'font-bold' : ''}`}>
                           <span className={`text-sm ${isSelected ? 'text-black' : 'text-gray-700'}`}>{day.getDate()}</span>
                        </div>
                      </button>
                    )
                  })}
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ADD STAFF MODAL */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Add New Staff</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 ml-1">Full Name</label>
                <input type="text" value={addName} onChange={e => setAddName(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 ml-1">Temp Email</label>
                <input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50" placeholder="e.g. john@example.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 ml-1">Schedule Name</label>
                <input type="text" value={addSName} onChange={e => setAddSName(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50" placeholder="e.g. John.D" />
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setIsAddStaffModalOpen(false)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                <button onClick={handleAddStaff} disabled={isAddingStaff} className="flex-1 bg-[#8ab4f8] text-white font-bold py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50">
                  {isAddingStaff ? "Adding..." : "Add Staff"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StaffRow({ staff, onSave }: { staff: any, onSave: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [name, setName] = useState(staff.name || '');
  const [tempEmail, setTempEmail] = useState(staff.temp_email || '');
  const [sName, setSName] = useState(staff.s_name || '');
  const [role, setRole] = useState(staff.role || '');

  const handleDelete = async () => {
    setIsDeleting(true);
    const { deleteStaffRecord } = await import('../actions/management');
    const { success, error } = await deleteStaffRecord(staff.id);
    
    setIsDeleting(false);
    if (success) {
      setIsDeleteDialogOpen(false);
      onSave(); // Refresh table
    } else {
      alert("Failed to delete: " + error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { updateStaffRecord } = await import('../actions/management');
    const { success, error } = await updateStaffRecord(staff.id, {
      name,
      temp_email: tempEmail,
      s_name: sName,
      role
    });
    
    setIsSaving(false);
    if (success) {
      setIsEditing(false);
      onSave();
    } else {
      alert("Failed to save: " + error);
    }
  };

  const handleCancel = () => {
    setName(staff.name || '');
    setTempEmail(staff.temp_email || '');
    setSName(staff.s_name || '');
    setRole(staff.role || '');
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3">
        {isEditing ? (
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full max-w-[120px] p-1 border rounded text-[13px] focus:ring-1 focus:ring-black outline-none" />
        ) : (
          <div className="font-medium text-gray-900 max-w-[120px] truncate" title={staff.name}>{staff.name || '-'}</div>
        )}
      </td>
      <td className="px-3 py-3">
        {isEditing ? (
          <input type="text" value={tempEmail} onChange={e => setTempEmail(e.target.value)} className="w-full max-w-[120px] p-1 border rounded text-[13px] focus:ring-1 focus:ring-black outline-none" />
        ) : (
          <div 
            className="text-gray-500 max-w-[120px] truncate cursor-pointer hover:text-sky-500 hover:underline transition-all" 
            title={staff.temp_email ? "Click to copy" : ""}
            onClick={() => staff.temp_email && navigator.clipboard.writeText(staff.temp_email)}
          >
            {staff.temp_email || '-'}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-gray-500">
        <div 
          className="max-w-[120px] truncate cursor-pointer hover:text-sky-500 hover:underline transition-all" 
          title={staff.email ? "Click to copy" : ""}
          onClick={() => staff.email && navigator.clipboard.writeText(staff.email)}
        >
          {staff.email || '-'}
        </div>
      </td>
      <td className="px-3 py-3">
        {isEditing ? (
          <input type="text" value={sName} onChange={e => setSName(e.target.value)} className="w-full max-w-[90px] p-1 border rounded text-[13px] focus:ring-1 focus:ring-black outline-none" />
        ) : (
          <div className="max-w-[90px] truncate" title={staff.s_name}>{staff.s_name || '-'}</div>
        )}
      </td>
      <td className="px-3 py-3">
        {isEditing ? (
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full min-w-[110px] p-1 border rounded text-[13px] focus:ring-1 focus:ring-black outline-none bg-white">
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="assistant supervisor">Assistant Supervisor</option>
            <option value="staff">Staff</option>
            <option value="unclaimed">Unclaimed</option>
          </select>
        ) : (
          <span className="capitalize">{staff.role || '-'}</span>
        )}
      </td>
      <td className="px-3 py-3 text-gray-500 text-xs">
        {formatDate(staff.created_at)}
      </td>
      <td className="px-3 py-3">
        <span className={`text-[13px] font-medium whitespace-nowrap ${staff.statusColor} ${staff.isClickable ? 'cursor-pointer hover:underline' : ''}`}>
           {staff.statusText}
        </span>
      </td>
      <td className="px-3 py-3 text-right w-[140px]">
        {isEditing ? (
          <div className="flex items-center justify-end gap-2">
            <button onClick={handleSave} disabled={isSaving} className="text-teal-500 hover:text-teal-600 text-xs font-medium disabled:opacity-50 whitespace-nowrap cursor-pointer disabled:cursor-default">
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleCancel} disabled={isSaving} className="text-gray-400 hover:text-gray-600 text-xs font-medium whitespace-nowrap cursor-pointer disabled:cursor-default">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setIsEditing(true)} className="text-[#8ab4f8] hover:text-sky-400 text-xs font-medium whitespace-nowrap cursor-pointer">
              Edit
            </button>
            <button onClick={() => setIsDeleteDialogOpen(true)} className="text-rose-400 hover:text-rose-500 text-xs font-medium whitespace-nowrap cursor-pointer">
              Delete
            </button>
          </div>
        )}

        {isDeleteDialogOpen && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl relative animate-in fade-in zoom-in duration-200 whitespace-normal">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Delete Staff Member?</h2>
              <p className="text-gray-500 mb-6 text-sm text-left">Are you sure you want to delete <span className="font-bold text-gray-700">{staff.name}</span>? This will permanently erase their data, availability, and schedule mappings. This cannot be undone.</p>
              
              <div className="flex gap-3">
                <button onClick={handleDelete} disabled={isDeleting} className="w-1/3 bg-rose-400 text-white font-bold py-3 rounded-xl hover:bg-rose-500 transition-colors disabled:opacity-50">
                  {isDeleting ? "..." : "Delete"}
                </button>
                <button onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
