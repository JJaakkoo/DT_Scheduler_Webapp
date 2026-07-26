"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

export default function Dashboard() {
  // Main Search States
  const [employeeName, setEmployeeName] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Live Status States
  const [masterShifts, setMasterShifts] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 1. SILENT BACKGROUND FETCH FOR LIVE STATUS
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const response = await fetch(`/api/schedule?name=MASTER`);
        const data = await response.json();
        if (response.ok) {
          setMasterShifts(data.shifts || []);
        }
      } catch (e) {
        console.error("Failed to load master schedule", e);
      }
    };
    fetchMaster();

    // Start the real-time clock to update the live status every 60 seconds
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 2. LIVE STATUS DATA ENGINE (Strictly locked to Edmonton time)
  const liveLocations = useMemo(() => {
    const locations: Record<string, { now: any[], next: any[] }> = {};
    const edmontonNowString = currentTime.toLocaleDateString('en-US', { timeZone: 'America/Edmonton' });

    masterShifts.forEach(shift => {
      const loc = (shift.location || shift.summary.replace("Work at ", "")).trim();
      if (!locations[loc]) locations[loc] = { now: [], next: [] };

      const start = new Date(shift.start.dateTime);
      const end = new Date(shift.end.dateTime);
      const shiftDateString = start.toLocaleDateString('en-US', { timeZone: 'America/Edmonton' });

      // Completely ignore shifts that aren't happening today
      if (shiftDateString !== edmontonNowString) return;

      if (currentTime >= start && currentTime < end) {
        locations[loc].now.push({ name: shift.employee || "Staff", end });
      } else if (currentTime < start) {
        locations[loc].next.push({ name: shift.employee || "Staff", start });
      }
    });

    // Sort the "Up Next" arrays so the soonest shift is listed first
    Object.keys(locations).forEach(loc => {
      locations[loc].next.sort((a, b) => a.start.getTime() - b.start.getTime());
    });

    return locations;
  }, [masterShifts, currentTime]);


  // 3. MAIN SEARCH FUNCTION
  const executeSearch = async (nameToSearch: string, forceSync = false) => {
    const query = nameToSearch.trim();
    if (!query) return;
    
    setActiveQuery(query);
    setError(null);
    
    if (forceSync) {
      setIsSyncing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch(`/api/schedule?name=${encodeURIComponent(query)}&force_sync=${forceSync}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch schedule.");
      }

      setShifts(data.shifts || []);
      setMetadata(data.metadata || null);

      if (data.shifts && data.shifts.length === 0) {
        setError(`No shifts found for ${query} this period.`);
      }
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

  const handleDownloadICS = () => {
    if (!activeQuery) return;
    window.location.href = `/api/download-schedule?name=${encodeURIComponent(activeQuery)}`;
    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 3000);
  };

  // Hardcoded Location Brand Colors
  const getLocationTheme = (location: string) => {
    const loc = (location || "").toLowerCase();
    if (loc.includes("whyte")) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "text-amber-500", leftBar: "bg-amber-400" };
    if (loc.includes("heritage")) return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "text-emerald-500", leftBar: "bg-emerald-400" };
    if (loc.includes("downtown") || loc.includes("dt")) return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", icon: "text-rose-500", leftBar: "bg-rose-400" };
    if (loc.includes("north")) return { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: "text-purple-500", leftBar: "bg-purple-400" };
    
    // Default Fallback
    return { bg: "bg-sky-50", text: "text-[#8ab4f8]", border: "border-[#e0eff8]", icon: "text-[#8ab4f8]", leftBar: "bg-[#8ab4f8]" };
  };

  // Only show the live section if there is actual data to display
  const hasLiveStatus = Object.values(liveLocations).some(data => data.now.length > 0 || data.next.length > 0);

  return (
    <main className="min-h-[100dvh] w-screen flex flex-col items-center py-6 px-4 sm:px-8 bg-[#c2e2f5] font-sans overflow-y-auto">
      
      <div className="w-full max-w-[400px] flex flex-col gap-6 relative z-10">
        
        {/* === MAIN SEARCH CARD === */}
        <div className="w-full bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden border-4 border-white max-h-[70vh] flex-shrink-0">
          
          {/* Fixed Header */}
          <div className="px-8 pt-8 pb-4 shrink-0 bg-white z-20">
            <div className="flex justify-center mb-6">
              <img
                src="/dreamtealogo.svg"
                alt="Dream Tea Logo"
                className="object-contain w-28 h-auto"
              />
            </div>

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
              className="w-full h-[48px] border-[1.5px] border-gray-300 rounded-full px-5 text-[15px] text-gray-700 bg-transparent outline-none focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#8ab4f8] transition-all placeholder:text-gray-400 mb-2"
            />
          </div>

          {/* Scrollable Shifts Area */}
          <div className="flex-1 overflow-y-auto px-8 pb-4 no-scrollbar">
            
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full space-y-4 text-[#8ab4f8]">
                <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="font-medium animate-pulse text-sm">Loading schedule...</p>
              </div>
            )}

            {error && !isLoading && (
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
                    <div key={idx} className={`bg-white rounded-2xl border ${theme.border} p-4 shadow-sm relative overflow-hidden flex flex-col justify-between shrink-0`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${theme.leftBar}`}></div>
                      <div>
                        <div className="font-bold text-gray-800 text-sm mb-1 pl-2">
                          {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Edmonton' })}
                        </div>
                        <div className="text-[#8ab4f8] font-black text-lg mb-1 pl-2">
                          {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })} - {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })}
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs font-bold ${theme.text} mt-2 pl-2`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 ${theme.icon}`}>
                          <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                        </svg>
                        {shift.location || shift.summary.replace("Work at ", "")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="shrink-0 bg-white px-8 pb-8 pt-4 z-20 border-t border-gray-50">
            {metadata && !isLoading && (
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
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Downloaded!
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
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
                    <svg className="animate-spin h-3.5 w-3.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                )}
                Force Sync Update
              </button>
            </div>
          </div>
        </div>

        {/* === LIVE STORE STATUS CARDS === */}
        {hasLiveStatus && (
          <div className="w-full flex flex-col gap-4 pb-12 mt-2">
            <h3 className="font-bold text-[#628ebf] text-sm uppercase tracking-widest pl-2">Live Store Status</h3>
            
            {Object.entries(liveLocations).map(([loc, data]) => {
              if (data.now.length === 0 && data.next.length === 0) return null;
              const theme = getLocationTheme(loc);
              
              return (
                <div key={loc} className={`relative overflow-hidden rounded-3xl border border-white ${theme.bg} p-5 shadow-[0_4px_24px_rgba(0,0,0,0.05)] flex flex-col gap-3`}>
                  
                  {/* Dynamic Color Bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${theme.leftBar}`}></div>
                  
                  <h4 className={`font-black text-lg ${theme.text} ml-1`}>{loc}</h4>
                  
                  {/* On Shift Now Segment */}
                  {data.now.length > 0 && (
                    <div className="ml-1">
                      <div className="text-[11px] font-bold text-gray-400 mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-emerald-500">
                           <path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                         </svg>
                         On Shift Now
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {data.now.map((s, i) => (
                          <span key={i} className="bg-white px-2.5 py-1.5 rounded-lg shadow-sm text-sm font-bold text-gray-700 capitalize border border-gray-100 flex items-center gap-1.5">
                            {s.name} 
                            <span className="text-gray-400 font-medium text-[11px]">
                              until {s.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Up Next Segment */}
                  {data.next.length > 0 && (
                    <div className="ml-1 mt-1">
                       <div className="text-[11px] font-bold text-gray-400 mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#8ab4f8]">
                           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                         </svg>
                         Up Next
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {data.next.map((s, i) => (
                          <span key={i} className="bg-white/60 px-2.5 py-1.5 rounded-lg border border-white text-sm font-bold text-gray-500 capitalize flex items-center gap-1.5">
                            {s.name} 
                            <span className="text-gray-400 font-medium text-[11px]">
                              at {s.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </main>
  );
}