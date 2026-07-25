"use client";

import React, { useState, useEffect, useCallback } from "react";

export default function Dashboard() {
  const [employeeName, setEmployeeName] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any | null>(null);
  
  const [isLoading, setIsLoading] = useState(true); // Starts true for the auto-fetch
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState("Fetching the latest schedule...");
  const [statusType, setStatusType] = useState<"idle" | "loading" | "success" | "error" | "info" | "warning">("loading");

  // The main fetch function, wrapped in useCallback so we can trigger it in useEffect
  const fetchSchedule = useCallback(async (forceSync = false) => {
    if (!employeeName.trim()) return;
    
    if (forceSync) {
      setIsSyncing(true);
      setMessage("Forcing sync with Jacky's email...");
      setStatusType("loading");
    } else {
      setIsLoading(true);
      setMessage("Fetching the latest schedule...");
      setStatusType("loading");
    }

    try {
      const response = await fetch(`/api/schedule?name=${encodeURIComponent(employeeName.trim())}&force_sync=${forceSync}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch schedule.");
      }

      setShifts(data.shifts || []);
      setMetadata(data.metadata || null);

      if (data.shifts && data.shifts.length === 0) {
        setStatusType("warning");
        setMessage(`No shifts found for ${employeeName} this period.`);
      } else {
        setStatusType("success");
        setMessage("Schedule loaded successfully!");
      }
    } catch (err: any) {
      setStatusType("error");
      setMessage(err.message || "An unexpected error occurred.");
      setShifts([]);
      setMetadata(null);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [employeeName]);

  // AUTO-FETCH ON LOAD
  useEffect(() => {
    fetchSchedule(false);
  }, [fetchSchedule]);

  // Your exact ICS download logic, wrapped cleanly
  const handleDownloadICS = async () => {
    if (!employeeName.trim()) return;
    
    // We don't clear the screen, just update the status text
    setStatusType("loading");
    setMessage("Generating calendar file...");

    const apiUrl = `/api/download-schedule?name=${encodeURIComponent(employeeName.trim())}`;

    try {
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to download schedule.");
      }

      const icsText = await response.text();
      const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
      
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `schedule_${employeeName.toLowerCase()}.ics`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setStatusType("success");
      setMessage("Calendar file downloaded!");
    } catch (err: any) {
      setStatusType("error");
      setMessage(err.message || "Error generating calendar.");
    }
  };

  // Formatter strictly locked to Edmonton time to correct the 15-hour drift
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

  // Helper function to dynamically change the text color based on the status
  const getMessageColor = () => {
    switch (statusType) {
      case "loading": return "text-blue-500 animate-pulse";
      case "success": return "text-green-600";
      case "info": return "text-blue-500"; 
      case "warning": return "text-orange-500"; 
      case "error": return "text-red-500";   
      default: return "text-transparent";
    }
  };

  return (
    <main className="min-h-[100dvh] w-screen flex items-center justify-center p-4 sm:p-8 bg-[#B0E3F6] font-sans">
      
      {/* Main Card Container */}
      <div className="w-full max-w-[440px] bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.1)] flex flex-col p-6 sm:p-10 relative z-10 my-auto max-h-[90dvh] overflow-hidden">
        
        {/* 1. FIXED TOP SECTION */}
        <div className="w-full flex flex-col items-center shrink-0">
          
          {/* Dream Tea Logo */}
          <img
            src="/dreamtealogo.svg"
            alt="Dream Tea Logo"
            className="object-contain w-28 h-auto mb-6 shrink-0"
          />

          {/* Name Input Field */}
          <input
            type="text"
            placeholder="Enter your name.."
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchSchedule(false)}
            className="w-full h-[48px] shrink-0 border-[1.5px] border-gray-300 rounded-full px-5 text-[15px] text-gray-800 bg-transparent outline-none focus:border-[#8BB9D9] focus:ring-1 focus:ring-[#8BB9D9] transition-all placeholder:text-gray-400 mb-4"
          />

          {/* Status Message Display Container */}
          <div className="min-h-[24px] flex items-center justify-center w-full mb-4 shrink-0">
            {message && (
              <p className={`text-sm text-center font-medium px-2 leading-tight ${getMessageColor()}`}>
                {message}
              </p>
            )}
          </div>
        </div>

        {/* 2. SCROLLABLE MIDDLE SECTION (Only the shifts move!) */}
        <div className="w-full flex-1 overflow-y-auto no-scrollbar min-h-0 relative">
          {shifts.length > 0 && !isLoading && (
            <div className="w-full flex flex-col gap-3 pb-4">
              {shifts.map((shift, idx) => {
                const startDate = new Date(shift.start.dateTime);
                const endDate = new Date(shift.end.dateTime);
                
                return (
                  <div key={idx} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 relative overflow-hidden text-left shrink-0">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#8BB9D9]"></div>
                    <div className="font-bold text-gray-800 text-sm mb-1 pl-2">
                      {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/Edmonton' })}
                    </div>
                    <div className="text-[#8BB9D9] font-black text-lg mb-1 pl-2 tracking-tight">
                      {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' }).toLowerCase()} - {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' }).toLowerCase()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. FIXED BOTTOM SECTION */}
        <div className="w-full flex flex-col shrink-0 pt-4 border-t border-gray-100 mt-2">
          {/* Metadata Area */}
          {metadata && !isLoading && (
            <div className="w-full flex flex-col items-center gap-1 mb-6 shrink-0 text-center">
              <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
                Jacky Sent Attachment: <span className="font-bold text-gray-700">{formatDate(metadata.email_timestamp)}</span>
              </span>
              <span className="text-[10px] text-gray-400">
                Last Server Sync: {formatDate(metadata.last_synced_at)}
              </span>
            </div>
          )}

          {/* Action Buttons Stack */}
          <div className="w-full flex flex-col gap-3 shrink-0">
            {/* Download Schedule Button */}
            <button 
              type="button" 
              disabled={isLoading || isSyncing}
              className={`w-full h-[48px] flex items-center justify-center gap-2 text-white text-[15px] font-bold rounded-full transition-all shadow-[0_4px_14px_rgba(139,185,217,0.5)] focus:outline-none disabled:opacity-70 ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#8BB9D9] hover:bg-[#7aa8c8]'}`}
              onClick={handleDownloadICS}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Save to Calendar
            </button>

            {/* Force Sync Button */}
            <button 
              type="button" 
              disabled={isLoading || isSyncing}
              className="w-full h-[48px] flex items-center justify-center gap-2 text-gray-500 text-[14px] font-semibold rounded-full border-2 border-gray-200 bg-transparent transition-all hover:bg-gray-50 hover:text-gray-700 focus:outline-none disabled:opacity-50"
              onClick={() => fetchSchedule(true)}
            >
              {isSyncing ? (
                 <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              )}
              {isSyncing ? "Syncing with Inbox..." : "Force Sync Update"}
            </button>
          </div>
        </div>
      </div>
      
      {/* Hidden scrollbar styling for the inner card */}
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