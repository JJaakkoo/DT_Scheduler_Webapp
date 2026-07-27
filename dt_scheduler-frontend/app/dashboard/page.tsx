"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  // --- AUTH & ROLE STATE ---
  const [role, setRole] = useState<string | null>(null);

  // --- SCHEDULE STATE ---
  const [employeeName, setEmployeeName] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- LIVE STATUS STATE (MOCK DATA FOR UI) ---
  const [showNext, setShowNext] = useState<Record<string, boolean>>({
    "Downtown": false,
    "Whyte Avenue": false,
    "Heritage Square": false
  });

  const liveLocations = {
    "Downtown": {
      now: [],
      next: [
        { name: "Amy", time: "Tomorrow At 10:30 AM" },
        { name: "Gian", time: "Tomorrow At 12:00 PM" },
        { name: "Shez", time: "Tomorrow At 12:00 PM" }
      ]
    },
    "Whyte Avenue": {
      now: [{ name: "Kim", time: "Tomorrow At 10:00 AM" }],
      next: [
        { name: "Phoebe", time: "Tomorrow At 11:00 AM" },
        { name: "Sherry", time: "Tomorrow At 12:00 PM" },
        { name: "Sheldon", time: "Tomorrow At 12:00 PM" }
      ]
    },
    "Heritage Square": {
      now: [],
      next: [
        { name: "Chelsey", time: "Tomorrow At 10:30 AM" },
        { name: "Yujung", time: "Tomorrow At 12:00 PM" }
      ]
    }
  };

  const hasLiveStatus = true; // Hardcoded true for UI display

  // --- INITIALIZE GOOGLE TOKEN CLIENT ---
  useEffect(() => {
    // Check role on mount
    const savedRole = localStorage.getItem("nexus_role");
    if (savedRole) setRole(savedRole);

    function initGoogleClient() {
      const google = (window as any).google;
      if (google) {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_CLIENT_ID",
          scope: "https://www.googleapis.com/auth/gmail.readonly",
          callback: (tokenResponse: any) => {
            if (tokenResponse.error) {
              setError("Google Sync was cancelled.");
              setIsSyncing(false);
              return;
            }
            // Token received! Save it and retry the sync automatically
            localStorage.setItem("google_access_token", tokenResponse.access_token);
            fetchSchedule(true); 
          },
        });
        (window as any).googleTokenClient = client;
      }
    }

    const scriptId = "google-gsi-script";
    if (!document.getElementById(scriptId)) {
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
  }, []);

  // --- FETCH SCHEDULE ---
  const fetchSchedule = useCallback(async (forceSync = false) => {
    if (!employeeName.trim()) return;

    setError(null);
    if (forceSync) setIsSyncing(true);
    else setIsLoading(true);

    try {
      const token = localStorage.getItem("google_access_token") || "";
      const response = await fetch(`/api/schedule?name=${encodeURIComponent(employeeName.trim())}&force_sync=${forceSync}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch schedule.");
      }

      // Check for Google Auth requirement
      if (data.sync_status === "TOKEN_REQUIRED") {
        const client = (window as any).googleTokenClient;
        if (client) {
          setError("Cache is older than 24 hours. Requesting Google Sync...");
          client.requestAccessToken();
          return; // Stop here, the callback will re-trigger fetchSchedule
        }
      }

      setShifts(data.shifts || []);
      setMetadata(data.metadata || null);

      if (data.shifts && data.shifts.length === 0) {
        setError(`No shifts found for ${employeeName} this period.`);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [employeeName]);

  const formatDate = (isoString: string) => {
    if (!isoString) return "Unknown";
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton'
    });
  };

  const getLocationTheme = (loc: string) => {
    switch (loc) {
      case "Downtown": return "border-[#ff4b72] text-[#ff4b72]";
      case "Whyte Avenue": return "border-[#ffbe0b] text-[#ffbe0b]";
      case "Heritage Square": return "border-[#06d6a0] text-[#06d6a0]";
      case "North Location": return "border-[#118ab2] text-[#118ab2]";
      default: return "border-[#8ab4f8] text-[#8ab4f8]";
    }
  };

  // Prevent hydration flash
  if (!role) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      {/* === MAIN LAYOUT WRAPPER === */}
      <div className="w-full max-w-[850px] flex flex-col md:flex-row items-center md:items-start justify-center gap-8 md:gap-10 relative z-10">
        
        {/* === LEFT COLUMN: SCHEDULE & SEARCH === */}
        <div className="w-full max-w-[400px] flex flex-col gap-4 shrink-0">
          
          {/* === CONDITIONAL RENDERING: STAFF VS GUEST === */}
          {role === "guest" ? (
             <div className="w-full flex flex-col items-center justify-center mb-2 pt-8 shrink-0">
                <img src="/dreamtealogo.svg" alt="Dream Tea Logo" className="object-contain w-40 h-auto drop-shadow-sm opacity-90" />
                <h2 className="text-[#628ebf] font-bold text-xl mt-6 tracking-wide">Nexus Live Status</h2>
             </div>
          ) : (
          <>
            <h3 className="font-bold text-[#628ebf] text-sm uppercase tracking-widest pl-2">Schedule Lookup</h3>
            
            <div className="w-full bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden max-h-[80vh] flex-shrink-0">
              
              {/* Header / Logo */}
              <div className="px-8 pt-8 pb-4 shrink-0 bg-white z-20 flex justify-center">
                <div className="relative mb-2">
                  <div className="w-16 h-8 bg-[#8ab4f8] rounded-full absolute top-2 left-[-10px] opacity-80"></div>
                  <div className="w-20 h-12 bg-[#8ab4f8] rounded-full relative z-10 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    Dream Tea
                  </div>
                  <div className="w-12 h-12 bg-[#8ab4f8] rounded-full absolute top-[-10px] right-0 opacity-90"></div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="px-8 pb-4 shrink-0 bg-white z-20">
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchSchedule(false)}
                  className="w-full text-center px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:border-[#8ab4f8] focus:ring-2 focus:ring-sky-100 transition-all text-gray-700 font-medium"
                  placeholder="e.g. sophia.h"
                />
              </div>

              {/* Scrollable Shifts Area */}
              <div className="flex-1 overflow-y-auto px-8 pb-4 min-h-[250px] relative">
                {isLoading && (
                  <div className="flex flex-col items-center justify-center h-full space-y-4 text-sky-600 py-10">
                    <svg className="animate-spin h-8 w-8 text-[#8ab4f8]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <p className="font-medium animate-pulse">Fetching latest schedule...</p>
                  </div>
                )}

                {error && !isLoading && (
                  <div className="bg-orange-50 border border-orange-200 text-orange-600 p-4 rounded-2xl mb-4 text-center text-sm font-medium">
                    {error}
                  </div>
                )}

                {shifts.length > 0 && !isLoading && (
                  <div className="flex flex-col gap-4">
                    {shifts.map((shift, idx) => {
                      const startDate = new Date(shift.start.dateTime);
                      const endDate = new Date(shift.end.dateTime);
                      const locationName = shift.summary.replace("Work at ", "");
                      const theme = getLocationTheme(locationName);
                      
                      return (
                        <div key={idx} className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative overflow-hidden border-l-4 ${theme}`}>
                          <div className="font-bold text-gray-800 text-[15px] mb-1">
                            {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Edmonton' })}
                          </div>
                          
                          {/* BIG BOLD TIMES */}
                          <div className={`font-black text-xl mb-1 ${theme.split(" ")[1]}`}>
                            {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })} - {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' })}
                          </div>
                          
                          {/* SOFT GREY LOCATION */}
                          <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3 h-3 ${theme.split(" ")[1]}`}>
                              <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                            </svg>
                            {locationName}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="p-6 bg-white shrink-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                {metadata && (
                  <div className="flex flex-col gap-1 text-center mb-4">
                    <span className="text-[10px] text-gray-600">
                      <span className="font-bold text-gray-800">Jacky Sent Attachment:</span> {formatDate(metadata.email_timestamp)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Last Server Sync: {formatDate(metadata.last_synced_at)}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => window.location.href = `/api/download-schedule?name=${encodeURIComponent(employeeName.trim())}`}
                    className="w-full bg-[#8ab4f8] text-white font-semibold py-3 px-4 rounded-full shadow-md hover:bg-blue-400 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    Save to Calendar
                  </button>
                  <button 
                    onClick={() => fetchSchedule(true)}
                    disabled={isSyncing}
                    className="w-full bg-white border border-gray-200 text-gray-500 font-medium py-3 px-4 rounded-full hover:bg-gray-50 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                    )}
                    Force Sync Update
                  </button>
                </div>
              </div>
            </div>
          </>
          )}
        </div>

        {/* === RIGHT COLUMN: LIVE STORE STATUS CARDS === */}
        {hasLiveStatus && (
          <div className="w-full max-w-[400px] flex flex-col gap-4 pb-12 md:pb-0 shrink-0">
            <h3 className="font-bold text-[#628ebf] text-sm uppercase tracking-widest pl-2">Live Store Status</h3>
            
            {Object.entries(liveLocations).map(([loc, data]) => {
              if (data.now.length === 0 && data.next.length === 0) return null;
              const theme = getLocationTheme(loc);
              const isFlipped = showNext[loc];
              
              return (
                <div key={loc} className="relative w-full h-[180px] perspective-1000 group">
                  <div className={`w-full h-full absolute top-0 left-0 transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-x-180' : ''}`}>
                    
                    {/* FRONT OF CARD (NOW) */}
                    <div className={`absolute w-full h-full backface-hidden bg-white rounded-3xl p-5 shadow-sm flex flex-col border-r-[6px] ${theme}`}>
                      <div className="flex justify-between items-center mb-4">
                        <button 
                          onClick={() => setShowNext({...showNext, [loc]: true})}
                          className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 uppercase tracking-wider"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Up Next
                        </button>
                        <h4 className="font-black text-gray-800 text-lg">{loc}</h4>
                      </div>
                      <div className="flex-1 flex flex-wrap gap-2 content-start overflow-hidden">
                        {data.now.length > 0 ? data.now.map((emp, i) => (
                          <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg py-1.5 px-3 flex items-center gap-2">
                            <span className="font-bold text-gray-800 text-sm">{emp.name}</span>
                            <span className="text-[10px] text-gray-400 font-medium">{emp.time}</span>
                          </div>
                        )) : (
                          <div className="w-full flex items-center justify-center h-full text-gray-400 text-sm font-medium">No one currently scheduled.</div>
                        )}
                      </div>
                    </div>

                    {/* BACK OF CARD (NEXT) */}
                    <div className={`absolute w-full h-full backface-hidden bg-white rounded-3xl p-5 shadow-sm flex flex-col border-r-[6px] rotate-x-180 ${theme}`}>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-black text-gray-800 text-lg">{loc}</h4>
                        <button 
                          onClick={() => setShowNext({...showNext, [loc]: false})}
                          className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 uppercase tracking-wider"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                          Back to Now
                        </button>
                      </div>
                      <div className="flex-1 flex flex-wrap gap-2 content-start overflow-hidden justify-end">
                         {data.next.map((emp, i) => (
                          <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg py-1.5 px-3 flex items-center gap-2">
                            <span className="font-bold text-gray-800 text-sm">{emp.name}</span>
                            <span className="text-[10px] text-gray-400 font-medium">{emp.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
      
      {/* Required CSS for 3D Flips */}
      <style dangerouslySetInnerHTML={{__html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-x-180 { transform: rotateX(180deg); }
      `}} />
    </div>
  );
}