"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { getCurrentUserRole } from "@/app/actions/claim";
import { getLocationTheme } from "@/utils/theme";
import { ShiftTimeline } from "@/components/dashboard/ShiftTimeline";
import { LocationCalendar } from "@/components/dashboard/LocationCalendar";

// Types
type SchedulePeriod = {
  year: number;
  month: number;
  period: number;
};

const STAFF_ROLES = ['staff', 'admin', 'manager', 'supervisor', 'assistant supervisor'];

export default function Dashboard() {
  const supabase = createClient();
  const router = useRouter();

  // Role & Auth State
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Search States
  const [employeeName, setEmployeeName] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Live Status States
  const [masterShifts, setMasterShifts] = useState<any[]>([]);
  const [isMasterLoading, setIsMasterLoading] = useState(true); // PREVENTS LAYOUT SHIFT!
  const [currentTime, setCurrentTime] = useState(new Date());
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 0. Extract Google OAuth provider token if available
    supabase.auth.getSession().then(({ data }: any) => {
      const loginTime = localStorage.getItem("nexus_login_time");
      const now = Date.now();
      if (!loginTime) {
        localStorage.setItem("nexus_login_time", now.toString());
      } else if (now - parseInt(loginTime, 10) > 48 * 60 * 60 * 1000) {
        supabase.auth.signOut().then(() => {
          localStorage.removeItem("nexus_role");
          localStorage.removeItem("google_access_token");
          localStorage.removeItem("nexus_login_time");
          document.cookie = "nexus_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          router.push("/");
          router.refresh();
        });
        return;
      }

      if (data?.session?.provider_token) {
        localStorage.setItem("google_access_token", data.session.provider_token);
      }
      
      // Also check the URL hash for a freshly forwarded provider_token (from SSR callback)
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashStr = window.location.hash.substring(1);
        const params = new URLSearchParams(hashStr);
        const pToken = params.get('provider_token');
        if (pToken) {
          localStorage.setItem("google_access_token", pToken);
          // Clean up the URL securely without triggering a reload
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
      if (data?.session?.user?.email) {
        setEmail(data.session.user.email);
      }
    });

    // 1. Check user role
    const currentRole = localStorage.getItem("nexus_role");
    
    if (currentRole === 'guest') {
      setRole('guest');
    } else {
      // Validate with database
      getCurrentUserRole().then((result) => {
        const fetchedRole = result.role;
        localStorage.setItem("nexus_role", fetchedRole);
        document.cookie = `nexus_role=${fetchedRole}; path=/; max-age=86400`;
        setRole(fetchedRole);
      });
    }

    // 2. Initialize Google Client for On-Demand Syncing
    function initGoogleClient() {
      const google = (window as any).google;
      if (google) {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID",
          scope: "https://www.googleapis.com/auth/gmail.readonly",
          callback: (tokenResponse: any) => {
            if (tokenResponse.error) {
              setError("Google sync was cancelled. Using cached schedule.");
              return;
            }
            // Save the new token and instantly trigger a force sync!
            localStorage.setItem("google_access_token", tokenResponse.access_token);
            if (activeQuery) {
               executeSearch(activeQuery, true); // Re-run the search with the new token
            }
          },
        });
        (window as any).googleTokenClient = client;
      }
    }

    const scriptId = "google-gsi-script";
    const existingScript = document.getElementById(scriptId);

    if (!existingScript) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogleClient;
      document.head.appendChild(script);
    } else {
      initGoogleClient();
    }
  }, [router, activeQuery]);

  // 1. SILENT BACKGROUND FETCH FOR LIVE STATUS
  const fetchMaster = useCallback(async () => {
    setIsMasterLoading(true);
    try {
      const token = localStorage.getItem("google_access_token");
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/schedule?name=MASTER`, { headers });
      const data = await response.json();
      if (response.ok) {
        setMasterShifts(data.shifts || []);
        if (data.metadata) setMetadata(data.metadata);
      }
    } catch (e) {
      console.error("Failed to load master schedule", e);
    } finally {
      // Guaranteed to clear loading state whether it succeeds or fails
      setIsMasterLoading(false);
    }
  }, []);

  useEffect(() => {
    const defaultSearchName = localStorage.getItem("nexus_default_search_name");
    if (!defaultSearchName) {
      fetchMaster();
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, [fetchMaster]);

  // DEBOUNCED AUTO-SEARCH
  useEffect(() => {
    const query = employeeName.trim();
    if (!query) return;

    const timeoutId = setTimeout(() => {
      // Only execute if they stopped typing and it's a new query
      if (query !== activeQuery) {
        executeSearch(query, false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [employeeName, activeQuery]);

  const liveLocations = useMemo(() => {
    const locations: Record<string, { now: any[], allNext: any[], next: any[], lastCompleted: any[] }> = {};

    masterShifts.forEach(shift => {
      const loc = (shift.location || shift.summary.replace("Work at ", "")).trim();
      if (!locations[loc]) locations[loc] = { now: [], allNext: [], next: [], lastCompleted: [] };
    });

    Object.keys(locations).forEach(loc => {
      const locShifts = masterShifts.filter(s => (s.location || s.summary.replace("Work at ", "")).trim() === loc);
      
      const nowShifts = locShifts.filter(s => {
        const start = new Date(s.start.dateTime);
        const end = new Date(s.end.dateTime);
        return currentTime >= start && currentTime < end;
      });

      const pastShifts = locShifts.filter(s => {
        const end = new Date(s.end.dateTime);
        return end <= currentTime;
      });

      const futureShifts = locShifts.filter(s => {
        const start = new Date(s.start.dateTime);
        return start > currentTime;
      });

      // Find 'now' shifts
      locations[loc].now = nowShifts.map(s => ({ name: s.employee || "Staff", end: new Date(s.end.dateTime) }));

      // Find 'lastCompleted' shifts (most recent end time)
      if (pastShifts.length > 0) {
        pastShifts.sort((a, b) => new Date(b.end.dateTime).getTime() - new Date(a.end.dateTime).getTime());
        const lastEndTime = new Date(pastShifts[0].end.dateTime).getTime();
        const lastCompletedShifts = pastShifts.filter(s => new Date(s.end.dateTime).getTime() === lastEndTime);
        locations[loc].lastCompleted = lastCompletedShifts.map(s => ({ name: s.employee || "Staff", end: new Date(s.end.dateTime) }));
      }

      locations[loc].allNext = futureShifts.map(s => ({ name: s.employee || "Staff", start: new Date(s.start.dateTime) }));
      locations[loc].allNext.sort((a, b) => a.start.getTime() - b.start.getTime());

      if (locations[loc].allNext.length > 0) {
        const firstNextTime = locations[loc].allNext[0].start.getTime();
        locations[loc].next = locations[loc].allNext.filter((s: any) => s.start.getTime() - firstNextTime < 3 * 60 * 60 * 1000);
      }
    });

    return locations;
  }, [masterShifts, currentTime]);

  // SCROLL TO UPCOMING SHIFT
  useEffect(() => {
    if (shifts.length > 0 && !isLoading) {
      const now = new Date();
      const targetIdx = shifts.findIndex(shift => new Date(shift.end.dateTime) >= now);
      
      if (targetIdx !== -1) {
        // Increase timeout to ensure DOM is fully painted and browser allows scroll on load
        setTimeout(() => {
          const el = document.getElementById(`shift-${targetIdx}`);
          if (el) {
            // Use block: 'nearest' to avoid scrolling the whole page too aggressively, or block: 'center'
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Also ensure the schedule lookup section itself is visible on mobile
            if (window.innerWidth < 768) {
               const section = document.getElementById('schedule-lookup-section');
               if (section) {
                 const rect = section.getBoundingClientRect();
                 if (rect.top > window.innerHeight) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                 }
               }
            }
          }
        }, 400);
      }
    }
  }, [shifts, isLoading]);

  const toggleFlip = (loc: string) => {
    setFlippedCards(prev => ({ ...prev, [loc]: !prev[loc] }));
  };

  const executeSearch = async (nameToSearch: string, forceSync = false) => {
    const query = nameToSearch.trim();
    if (!query) return;
    if (query === activeQuery && !forceSync) return;
    
    setActiveQuery(query);
    localStorage.setItem("nexus_default_search_name", query);
    setError(null);
    setAuthError(null);
    
    if (forceSync) setIsSyncing(true);
    else setIsLoading(true);

    try {
      const token = localStorage.getItem("google_access_token");
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/schedule?name=${encodeURIComponent(query)}&force_sync=${forceSync}`, {
        headers
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch schedule.");
      }

      // --- TOKEN LOGIC ENGINE ---
      if (data.sync_status === "TOKEN_REQUIRED" || data.sync_status === "TOKEN_EXPIRED") {
        const client = (window as any).googleTokenClient;
        if (client && STAFF_ROLES.includes(role || '')) {
           setAuthError("Schedule needs updating! Please link your Google account to sync the latest version from Jacky.");
           client.requestAccessToken(); // Pops open the Google Window!
        }
      } else if (data.sync_status === "EMAIL_NOT_FOUND") {
        setError("Your Google login has expired, please log in again.");
      }

      setShifts(data.shifts || []);
      setMetadata(data.metadata || null);

      if (data.shifts && data.shifts.length === 0 && !data.error) {
        setError(`No shifts found for ${query} this period.`);
      }

      // Refresh master list quietly in background so live status updates too
      fetchMaster(); 

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return "Unknown";
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Edmonton'
    });
  };

  const formatFutureTime = (date: Date) => {
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth();
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' });
    
    if (isToday) return `Today at ${timeStr}`;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth();
    
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${timeStr}`;
  };

  useEffect(() => {
    const defaultSearchName = localStorage.getItem("nexus_default_search_name");
    if (defaultSearchName && !activeQuery) {
      setEmployeeName(defaultSearchName);
      executeSearch(defaultSearchName, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownloadICS = () => {
    if (!activeQuery) return;
    // Download hits the endpoint which reads from cache. No token strictly required for download!
    window.location.href = `/api/download-schedule?name=${encodeURIComponent(activeQuery)}`;
    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 3000);
  };

  const hasLiveStatus = Object.values(liveLocations).some(data => data.now.length > 0 || data.next.length > 0 || data.lastCompleted.length > 0);

  if (!role) return null; // Prevent hydration flash

  const handleLogOut = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('nexus_') || key.startsWith('google_')) {
        localStorage.removeItem(key);
      }
    });
    document.cookie = "nexus_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-[100dvh] w-screen flex flex-col bg-[#c2e2f5] font-sans overflow-x-hidden overflow-y-auto">
      
      {!STAFF_ROLES.includes(role || '') && role !== 'guest' && (
         <div className="w-full bg-[#fce7bb] text-[#8a6826] px-4 py-3 text-sm font-medium flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 shadow-sm z-[60] border-b border-[#f3d396]">
            <span>Your account is not linked.</span>
            <Link href="/claim" className="bg-[#8a6826] text-white hover:bg-[#73561d] px-4 py-1.5 rounded-full text-xs font-bold transition-colors">
               Link Account
            </Link>
         </div>
      )}

      <div className="w-full bg-white/90 backdrop-blur-md shadow-sm z-50 px-4 py-3 sm:px-8 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <img src="/dreamtealogo.svg" alt="Dream Tea" className="hidden sm:block h-8 w-auto mr-2 opacity-90" />
          {/* DESKTOP NAV (Hidden on mobile) */}
          <div className="relative hidden sm:block">
            <button onClick={() => setIsNavOpen(!isNavOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none">
              <MenuIcon />
            </button>
            {isNavOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                 <Link href="/availability" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <AvailabilityIcon />
                    My Availability
                 </Link>
                 {role === 'admin' && (
                    <Link href="/management" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                      <ManagementIcon />
                      Management
                    </Link>
                 )}
                 <Link href="/privacy-policy" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <PrivacyIcon />
                    Privacy Policy
                 </Link>
                 <Link href="/terms-of-service" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <TermsIcon />
                    Terms of Service
                 </Link>
                 <button onClick={handleLogOut} disabled={isLoggingOut} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 text-red-600">
                    <LogoutIcon />
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
                    {role === 'admin' ? <AdminBadgeIcon /> : <LinkedBadgeIcon />}
                    {role === 'admin' ? 'Admin' : 'Linked'}
                  </div>
                )}
              </div>
            ) : null}
            <div className="text-gray-600 font-medium text-sm bg-gray-100/80 px-3 py-1.5 rounded-full hidden sm:flex items-center gap-2">
              <ClockIcon />
              {currentTime.toLocaleString('en-US', { month: 'long', day: 'numeric' })}, {currentTime.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>

          {/* MOBILE NAV (Hidden on desktop) */}
          <div className="relative block sm:hidden">
            <button onClick={() => setIsNavOpen(!isNavOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none">
              <MenuIcon />
            </button>
            {isNavOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                 {/* Email moved to top left on mobile */}
                 {role !== 'guest' && (
                   <Link href="/availability" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                      <AvailabilityIcon />
                      My Availability
                   </Link>
                 )}
                 {role === 'admin' && (
                   <Link href="/management" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                      <ManagementMobileIcon />
                      Management
                   </Link>
                 )}
                 <Link href="/privacy-policy" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <PrivacyIcon />
                    Privacy Policy
                 </Link>
                 <Link href="/terms-of-service" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <TermsIcon />
                    Terms of Service
                 </Link>
                 <button onClick={handleLogOut} disabled={isLoggingOut} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 text-red-600">
                    <LogoutIcon />
                    {isLoggingOut ? "Logging out..." : "Log Out"}
                 </button>
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="flex-1 w-full flex flex-col items-center py-6 px-4 sm:px-8">

      {/* === MAIN LAYOUT WRAPPER === */}
      {/* Uses flex-col for mobile (stacked), and md:flex-row for desktop (side-by-side) */}
      <div className="w-full max-w-[850px] flex flex-col md:flex-row items-center md:items-start justify-center gap-8 md:gap-10 relative z-10 my-auto">
        
        {/* === LEFT COLUMN: SCHEDULE & SEARCH === */}
        {/* Gap changed to match the right column perfectly */}
        <div id="schedule-lookup-section" className="w-full max-w-[400px] flex flex-col gap-4 shrink-0">
          
          {/* === CONDITIONAL RENDERING: STAFF VS GUEST === */}
          {role === "guest" ? (
             <div className="w-full flex flex-col items-center justify-center mb-2 pt-8 shrink-0">
                <img src="/dreamtealogo.svg" alt="Dream Tea Logo" className="object-contain w-40 h-auto drop-shadow-sm opacity-90" />
                <h2 className="text-[#628ebf] font-bold text-xl mt-6 tracking-wide">Nexus Live Status</h2>
             </div>
          ) : (
          <>
            {/* Added matched header for perfect horizontal alignment! */}
            <h3 className="font-bold text-[#628ebf] text-sm uppercase tracking-widest pl-2 flex items-center">
              Schedule Lookup
              {isLoading && (
                <div className="ml-2 flex items-center justify-center">
                  <SpinnerIcon />
                </div>
              )}
            </h3>
            
            <div className="w-full bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden border-4 border-white max-h-[85vh] flex-shrink-0">
              
              <div className="px-8 pt-8 pb-4 shrink-0 bg-white z-20">
                <div className="flex justify-center mb-6">
                  <img src="/dreamtealogo.svg" alt="Dream Tea Logo" className="object-contain w-28 h-auto" />
                </div>

                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Enter your name.."
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        executeSearch(employeeName, false);
                      }
                    }}
                    className="w-full h-[48px] border-[1.5px] border-gray-300 rounded-full pl-5 pr-10 text-[15px] text-gray-700 bg-transparent outline-none focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#8ab4f8] transition-all placeholder:text-gray-400"
                  />
                  {employeeName && (
                    <button 
                      onClick={() => { setEmployeeName(''); executeSearch('', false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200/50 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-8 pb-4 no-scrollbar">
                {isLoading && (
                  <div className="flex flex-col gap-3 pt-2 h-full">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between shrink-0">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gray-200"></div>
                        <div className="ml-2">
                          <div className="h-4 w-32 skeleton-shimmer rounded-md mb-2"></div>
                          <div className="h-6 w-48 skeleton-shimmer rounded-md mb-2"></div>
                          <div className="h-3 w-24 skeleton-shimmer rounded-md mt-2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {authError && !isLoading && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-2xl text-center text-sm font-medium mt-2 mb-3">
                    {authError}
                  </div>
                )}

                {error && !isLoading && !authError && (
                  <div className="bg-orange-50 border border-orange-200 text-orange-600 p-4 rounded-2xl text-center text-sm font-medium mt-2">
                    {error}
                  </div>
                )}

                {shifts.length > 0 && !isLoading && (
                  <div className="flex flex-col gap-3 pt-2">
                    {shifts.map((shift, idx) => {
                      const startDate = new Date(shift.start.dateTime);
                      const endDate = new Date(shift.end.dateTime);
                      const theme = getLocationTheme(shift.location || shift.summary);
                      
                      return (
                        <div 
                          key={idx} 
                          id={`shift-${idx}`} 
                          className={`bg-white rounded-2xl border ${theme.border} p-4 shadow-sm relative overflow-hidden flex flex-col justify-between shrink-0`}
                          style={endDate < new Date() ? { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.04) 10px, rgba(0,0,0,0.04) 20px)' } : {}}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${theme.leftBar}`}></div>
                          <div>
                            <div className="font-bold text-gray-700 text-sm mb-1 pl-2">
                              {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Edmonton' })}
                            </div>
                            <div className={`font-medium text-lg mb-1 pl-2 ${theme.text}`}>
                              {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })} - {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })}
                            </div>
                            <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-1 pl-2">
                              <LocationPinIcon className={theme.icon} />
                              {shift.location || shift.summary.replace("Work at ", "")}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="shrink-0 bg-white px-8 pb-8 pt-4 z-20 border-t border-gray-50">
                {metadata && (
                  <div className="flex flex-col gap-0.5 text-center mb-4">
                    <span className="text-[11px] text-gray-500">
                      <span className="font-bold text-gray-700">Jacky Sent Attachment:</span> {formatDate(metadata.email_timestamp)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Last Server Sync: {formatDate(metadata.last_synced_at)}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button 
                    type="button" 
                    disabled={isLoading || isSyncing || !activeQuery}
                    className={`w-full h-[48px] text-white text-[15px] font-bold rounded-full transition-all shadow-[0_4px_14px_rgba(139,185,217,0.4)] flex items-center justify-center gap-2 focus:outline-none
                      ${(isLoading || isSyncing || !activeQuery) ? 'bg-gray-400 cursor-not-allowed' : (isDownloaded ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-[#8ab4f8] hover:bg-blue-400')}`}
                    onClick={() => handleDownloadICS()}
                  >
                    {isDownloaded ? (
                      <>
                        <CheckIcon />
                        Downloaded!
                      </>
                    ) : (
                      <>
                        <SaveCalendarIcon />
                        Save to Calendar
                      </>
                    )}
                  </button>

                  <button 
                    onClick={() => executeSearch(activeQuery, true)}
                    disabled={isSyncing || isLoading || !activeQuery}
                    className="w-full h-[40px] bg-white border-2 border-gray-200 text-gray-500 font-semibold rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-50 focus:outline-none"
                  >
                    {isSyncing ? (
                        <SpinnerIcon />
                    ) : (
                      <SyncIcon />
                    )}
                    Force Sync Update
                  </button>
                </div>
              </div>
            </div>
          </>
          )}
        </div>

        {/* === RIGHT COLUMN: LIVE STORE STATUS CARDS (3D FLIP) === */}
        {(isMasterLoading || hasLiveStatus) && (
          <div className="w-full max-w-[400px] flex flex-col gap-4 pb-12 md:pb-0 shrink-0">
            <h3 className="font-bold text-[#628ebf] text-sm uppercase tracking-widest pl-2">Live Store Status</h3>
            
            {/* Added Spinner logic based on the new isMasterLoading state! */}
            {isMasterLoading ? (
              <div className="flex flex-col gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white border-2 border-transparent p-5 shadow-[0_4px_24px_rgba(0,0,0,0.05)] rounded-3xl flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-gray-200"></div>
                    
                    <div className="flex justify-between items-start ml-2">
                       <div className="h-6 w-24 skeleton-shimmer rounded-md"></div>
                       <div className="h-5 w-20 skeleton-shimmer rounded-full"></div>
                    </div>
                    
                    <div className="ml-2">
                      <div className="h-3 w-28 skeleton-shimmer rounded-md mb-3"></div>
                      <div className="flex flex-wrap gap-2">
                        <div className="h-8 w-32 skeleton-shimmer rounded-lg"></div>
                        <div className="h-8 w-24 skeleton-shimmer rounded-lg"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              Object.entries(liveLocations).map(([loc, data]) => {
                if (data.now.length === 0 && data.next.length === 0 && data.lastCompleted.length === 0) return null;
                const theme = getLocationTheme(loc);
                
                const defaultFlipped = data.now.length === 0 && data.next.length > 0 && data.lastCompleted.length === 0;
                const isFlipped = flippedCards[loc] !== undefined ? flippedCards[loc] : defaultFlipped;
                
                return (
                  <div key={loc} className="relative w-full cursor-pointer group" style={{ perspective: '1000px' }} onClick={() => toggleFlip(loc)}>
                    <div 
                      className="w-full transition-transform duration-500 rounded-3xl"
                      style={{ 
                        transformStyle: 'preserve-3d', 
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        display: 'grid' 
                      }}
                    >
                      
                      {/* === FRONT FACE (WORKING NOW) === */}
                      <div 
                        className={`bg-white border-2 ${theme.border} p-5 shadow-[0_4px_24px_rgba(0,0,0,0.05)] rounded-3xl flex flex-col gap-3 relative overflow-hidden`}
                        style={{ gridArea: '1 / 1', backfaceVisibility: 'hidden' }}
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-2 ${theme.leftBar}`}></div>
                        
                        <div className="flex justify-between items-start ml-2">
                          <h4 className="font-semibold text-lg text-gray-700">{loc}</h4>
                          <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-full group-hover:bg-gray-100 transition-colors">
                             <FlipIcon />
                             Flip to Next
                          </div>
                        </div>
                        
                        <div className="ml-2">
                          <div className="text-[11px] font-bold text-gray-400 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                             <StaffIcon className={data.now.length > 0 ? 'text-emerald-500' : 'text-gray-400'} />
                             {data.now.length > 0 ? "On Shift Now" : "Closed By"}
                          </div>
                          {data.now.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {data.now.map((s, i) => (
                                <span key={i} className={`bg-white px-3 py-1.5 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[13px] font-bold text-gray-700 capitalize border ${theme.border} flex items-center gap-1.5 whitespace-nowrap`}>
                                  {s.name} 
                                  <span className="text-gray-400 font-medium text-[10px]">
                                    Until {s.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : data.lastCompleted.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {data.lastCompleted.map((s, i) => (
                                <span key={i} className="bg-gray-50 px-3 py-1.5 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-[13px] font-bold text-gray-600 capitalize border border-gray-200 flex items-center gap-1.5 whitespace-nowrap opacity-80">
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No one currently on shift.</p>
                          )}
                        </div>
                      </div>

                      {/* === BACK FACE (UP NEXT) === */}
                      <div 
                        className={`bg-white border-2 ${theme.border} p-5 shadow-[0_4px_24px_rgba(0,0,0,0.05)] rounded-3xl flex flex-col gap-3 relative overflow-hidden`}
                        style={{ gridArea: '1 / 1', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        <div className={`absolute right-0 top-0 bottom-0 w-2 ${theme.leftBar}`}></div>
                        
                        <div className="flex justify-between items-start mr-2">
                          <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-full group-hover:bg-gray-100 transition-colors">
                             <BackToNowIcon />
                             Back to Now
                          </div>
                          <h4 className="font-semibold text-lg text-gray-700">{loc}</h4>
                        </div>
                        
                        <div className="mr-2">
                           <div className="text-[11px] font-bold text-gray-400 mb-2 flex items-center gap-1.5 uppercase tracking-wider justify-end">
                             Up Next
                             <UpNextIcon />
                          </div>
                          {data.next.length > 0 ? (
                            <div className="flex flex-wrap gap-2 justify-end">
                              {data.next.map((s, i) => (
                                <span key={i} className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 text-[13px] font-bold text-gray-700 capitalize flex items-center gap-1.5 whitespace-nowrap shadow-sm">
                                  {s.name} 
                                  <span className="text-gray-400 font-medium text-[10px]">
                                    {formatFutureTime(s.start)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic text-right">No upcoming shifts scheduled.</p>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
      
      {role !== 'guest' && (
        <>
          <ShiftTimeline 
            searchedShifts={shifts} 
            masterShifts={masterShifts} 
            searchIdentifier={activeQuery} 
            isLoadingMaster={isMasterLoading}
          />

          <LocationCalendar activeQuery={activeQuery} masterShifts={masterShifts} searchedShifts={shifts} />
        </>
      )}

      </div>
    </main>
  );
}

// Icon Components
const SpinnerIcon = () => (
  <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-gray-700">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

const AvailabilityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
  </svg>
);

const ManagementIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const ManagementMobileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.99l1.005.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const PrivacyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const TermsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  </svg>
);

const AdminBadgeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 sm:w-4 sm:h-4 text-sky-600">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
  </svg>
);

const LinkedBadgeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const LocationPinIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 ${className || ''}`}>
    <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const SaveCalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const SyncIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const StaffIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 ${className || ''}`}>
    <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
  </svg>
);

const BackToNowIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
  </svg>
);

const UpNextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#8ab4f8]">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
  </svg>
);

const FlipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);