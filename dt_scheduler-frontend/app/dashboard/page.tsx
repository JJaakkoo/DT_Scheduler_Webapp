"use client";

import { useState } from "react";

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Added TypeScript generics here to tell TS what type of data to expect
  const [employeeName, setEmployeeName] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSchedule = async (forceSync = false) => {
    if (!employeeName.trim()) {
      setError("Please enter a name first.");
      return;
    }

    setIsLoading(true);
    setError("");
    setMetadata(null);
    setShifts([]);

    try {
      // Ping our brand new JSON endpoint in Python!
      const response = await fetch(`/api/schedule?name=${encodeURIComponent(employeeName)}&force_sync=${forceSync}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch schedule.");
      }

      setShifts(data.shifts || []);
      setMetadata(data.metadata || null);

      if (data.shifts.length === 0) {
         // Friendly warning if the array is empty
         setError(`No shifts found for ${employeeName} this period.`);
      }
    } catch (err: any) { // Explicitly cast the error object to 'any'
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (isoString: string) => { // Explicitly typed as string
    if (!isoString) return "Unknown";
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  return (
    <main className="h-screen w-screen flex bg-gray-50 overflow-hidden font-inter">
      
      {/* LEFT SIDEBAR */}
      <aside className={`h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center px-4 border-b border-gray-100 mb-4">
          <img
            src="/dreamtealogo.svg"
            alt="Dream Tea Logo"
            className="object-contain w-8 h-8 flex-shrink-0"
          />
          {isSidebarOpen && (
            <span className="ml-3 font-bold text-lg text-text-primary whitespace-nowrap">
              Nexus Portal
            </span>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <button className="w-full flex items-center px-3 py-2.5 bg-dreamtea-light/30 text-dreamtea-blue rounded-xl hover:bg-dreamtea-light/50 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            {isSidebarOpen && <span className="ml-3 font-medium text-sm">Dashboard</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="w-9 h-9 rounded-full bg-dreamtea-blue text-white flex items-center justify-center font-bold flex-shrink-0">
              J
            </div>
            {isSidebarOpen && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-semibold text-text-primary truncate">Jako Zeng</p>
                <p className="text-xs text-text-tertiary truncate">Manager</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {}
      <div className="flex-1 flex flex-col h-full relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <h2 className="font-bold text-xl text-text-primary">Overview</h2>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto w-full">
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider">
                  View Schedule For
                </label>
                <input 
                  type="text"
                  placeholder="Enter employee name (e.g., jako)"
                  className="input-nexus w-full max-w-md"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchSchedule(false)}
                />
              </div>
              <button 
                onClick={() => fetchSchedule(false)} 
                disabled={isLoading}
                className="btn-nexus disabled:opacity-50 min-w-[140px]"
              >
                {isLoading ? "Fetching..." : "Get Schedule"}
              </button>
            </div>

            {}
            {isLoading && (
              <div className="text-center p-8">
                <p className="text-dreamtea-blue font-semibold animate-pulse">
                  Querying the Nexus... 
                </p>
                <p className="text-xs text-text-tertiary mt-2">Checking caches and inboxes...</p>
              </div>
            )}

            {error && !isLoading && (
              <div className="bg-orange-50 border border-orange-200 text-orange-600 p-4 rounded-xl mb-6 text-sm">
                {error}
              </div>
            )}

            {}
            {metadata && !isLoading && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-text-primary">
                      Period {metadata.period} ({metadata.month}/{metadata.year})
                    </h3>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-xs text-text-secondary">
                        <span className="font-semibold">Manager Sent Email:</span> {formatDate(metadata.email_timestamp)}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        <span className="font-semibold">Last Server Sync:</span> {formatDate(metadata.last_synced_at)}
                      </span>
                    </div>
                  </div>
                  
                  {/* THE OVERRIDE BUTTON */}
                  <button 
                    onClick={() => fetchSchedule(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-text-secondary hover:bg-gray-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Force Sync Revision
                  </button>
                </div>
              </div>
            )}

            {}
            {shifts.length > 0 && !isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shifts.map((shift, idx) => {
                  const startDate = new Date(shift.start.dateTime);
                  const endDate = new Date(shift.end.dateTime);
                  
                  return (
                    <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 border-l-4 border-l-dreamtea-blue">
                      <div className="font-bold text-text-primary text-sm mb-1">
                        {startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-dreamtea-blue font-semibold text-lg mb-2">
                        {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                      <div className="text-xs text-text-secondary flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-text-tertiary">
                          <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.02.01.006.004zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                        </svg>
                        {shift.summary.replace("Work at ", "")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

      </div>
    </main>
  );
}