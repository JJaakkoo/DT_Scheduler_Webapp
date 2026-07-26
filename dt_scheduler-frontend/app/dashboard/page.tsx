"use client";

import React, { useState } from "react";

export default function Dashboard() {
  // employeeName is STRICTLY for the text input box now
  const [employeeName, setEmployeeName] = useState("");
  
  // activeQuery locks in the name only AFTER they press Enter, preventing UI glitches
  const [activeQuery, setActiveQuery] = useState("");
  
  const [shifts, setShifts] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if the file was just downloaded to show a success message
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Notice we removed useCallback and useEffect! This ONLY runs when called manually.
  const executeSearch = async (nameToSearch: string, forceSync = false) => {
    const query = nameToSearch.trim();
    if (!query) return;
    
    // Lock in the name so our error messages don't change while typing
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
    
    // Trigger the success state, then reset it after 3 seconds
    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 3000);
  };

  const getLocationTheme = (location: string) => {
    const loc = (location || "").toLowerCase();
    
    // Hardcoded themes for your specific store branches
    if (loc.includes("whyte")) {
      return { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", icon: "text-amber-500", leftBar: "bg-amber-400" };
    }
    if (loc.includes("heritage")) {
      return { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", icon: "text-emerald-500", leftBar: "bg-emerald-400" };
    }
    if (loc.includes("downtown") || loc.includes("dt")) {
      return { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200", icon: "text-rose-500", leftBar: "bg-rose-400" };
    }
    if (loc.includes("north")) {
      return { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200", icon: "text-purple-500", leftBar: "bg-purple-400" };
    }
    
    // Default fallback colors if it's an unknown location
    return { bg: "bg-sky-50", text: "text-[#8ab4f8]", border: "border-[#e0eff8]", icon: "text-[#8ab4f8]", leftBar: "bg-[#8ab4f8]" };
  };

  return (
    <main className="min-h-[100dvh] w-screen flex items-center justify-center p-4 sm:p-8 bg-[#c2e2f5] font-sans fixed inset-0 overflow-hidden">
      
      <div className="w-full max-w-[400px] max-h-[90vh] sm:max-h-[800px] bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.1)] flex flex-col relative z-10 overflow-hidden border-4 border-white">
        
        {/* --- FIXED HEADER --- */}
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
            // ONLY triggers the search when the Enter key is pressed!
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                executeSearch(employeeName, false);
              }
            }}
            className="w-full h-[48px] border-[1.5px] border-gray-300 rounded-full px-5 text-[15px] text-gray-700 bg-transparent outline-none focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#8ab4f8] transition-all placeholder:text-gray-400 mb-2"
          />
        </div>

        {/* --- SCROLLABLE SHIFTS AREA --- */}
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

          {/* Error Message strictly uses activeQuery so it doesn't change while typing */}
          {error && !isLoading && (
            <div className="bg-orange-50 border border-orange-200 text-orange-600 p-4 rounded-2xl text-center text-sm font-medium mt-2">
              {error}
            </div>
          )}

          {}
          {shifts.length > 0 && !isLoading && (
            <div className="flex flex-col gap-3 pt-2">
              {shifts.map((shift, idx) => {
                const startDate = new Date(shift.start.dateTime);
                const endDate = new Date(shift.end.dateTime);
                
                // Get the unique color theme for this specific shift's location
                const theme = getLocationTheme(shift.location || shift.summary);
                
                return (
                  <div key={idx} className={`bg-white rounded-2xl border ${theme.border} p-4 shadow-sm relative overflow-hidden flex flex-col justify-between shrink-0`}>
                    
                    {/* Dynamic Colored Left Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${theme.leftBar}`}></div>
                    
                    <div>
                      <div className="font-bold text-gray-800 text-sm mb-1 pl-2">
                        {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Edmonton' })}
                      </div>
                      <div className="text-[#8ab4f8] font-black text-lg mb-1 pl-2">
                        {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })} - {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })}
                      </div>
                    </div>

                    {/* Location Footer with Map Pin */}
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

        {/* --- FIXED FOOTER --- */}
        {}
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