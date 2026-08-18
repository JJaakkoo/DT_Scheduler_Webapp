import React, { useState, useEffect } from "react";

interface TargetPeriod {
  year: number;
  month: number;
  period: number;
}

interface AvailabilityTabProps {
  staffData?: any[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedLocation: string;
  handleLocationChange: (loc: string) => void;
  isFetchingAvail: boolean;
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  validDates: Date[];
  periodAvailability: any[];
  targetPeriod: TargetPeriod | null;
  maxTargetPeriod: TargetPeriod | null;
  handlePrevPeriod: () => void;
  handleNextPeriod: () => void;
}

export function AvailabilityTab({
  staffData = [],
  searchQuery,
  setSearchQuery,
  selectedLocation,
  handleLocationChange,
  isFetchingAvail,
  selectedDate,
  setSelectedDate,
  validDates,
  periodAvailability,
  targetPeriod,
  maxTargetPeriod,
  handlePrevPeriod,
  handleNextPeriod
}: AvailabilityTabProps) {
  const [isIndividualView, setIsIndividualView] = useState(true);

  useEffect(() => {
    const cachedIV = localStorage.getItem("nexus_management_iv");
    if (cachedIV !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsIndividualView(cachedIV === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("nexus_management_iv", String(isIndividualView));
  }, [isIndividualView]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* SEARCH & FILTER BAR */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
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
          <button 
            onClick={() => {
              const nextState = !isIndividualView;
              setIsIndividualView(nextState);
              if (!nextState) setSearchQuery('');
            }}
            className={`w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border flex items-center justify-center gap-2 ${
              isIndividualView 
                ? 'bg-[#8ab4f8] text-white border-[#8ab4f8] shadow-sm hover:opacity-90' 
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
            Individual View {isIndividualView ? 'On' : 'Off'}
          </button>
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
         ) : isIndividualView ? (
            !searchQuery.trim() ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <p className="text-xl font-medium text-center text-gray-500 mb-2">Search a name</p>
                <div className="flex items-center gap-4 my-2 opacity-50">
                   <div className="h-px w-12 bg-gray-300"></div>
                   <span className="text-sm font-bold uppercase tracking-widest text-gray-400">or</span>
                   <div className="h-px w-12 bg-gray-300"></div>
                </div>
                <p className="text-xl font-medium text-center text-gray-500 mt-2">Choose a day from the calendar below</p>
              </div>
            ) : (
              // Display List of Availability for the searched staff
              (() => {
                 const searchLower = searchQuery.toLowerCase();
                 
                 // First, search against ALL staff
                 const matchedStaff = staffData.filter(s => (s.name?.toLowerCase().includes(searchLower) || s.s_name?.toLowerCase().includes(searchLower)));

                 if (matchedStaff.length === 0) {
                    return (
                       <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                         <p className="text-lg font-medium">No staff found matching &quot;{searchQuery}&quot;</p>
                       </div>
                    )
                 }

                 // Get the first matched staff
                 const selectedStaff = matchedStaff[0];
                 
                 // Then find if they have submitted availability for this period
                 const record = periodAvailability.find(r => r.staff_id === selectedStaff.id || r.staff?.id === selectedStaff.id || r.staff?.name === selectedStaff.name);

                 if (!record) {
                    return (
                       <div className="flex-1 flex flex-col">
                          <h2 className="text-2xl font-bold text-gray-800 mb-4">{selectedStaff.name}&apos;s Availability</h2>
                          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 border border-gray-100 rounded-xl p-4 text-gray-400 min-h-[300px]">
                             <p className="text-lg font-medium">Availability not submitted for this period</p>
                          </div>
                       </div>
                    )
                 }
                 
                 return (
                    <div className="flex-1 flex flex-col">
                       <h2 className="text-2xl font-bold text-gray-800 mb-4">{record.staff.name}&apos;s Availability</h2>
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
                                const rows: any[] = [];
                                validDates.forEach(d => {
                                   const dayStr = d.toISOString().split('T')[0];
                                   const cache = record.schedule_data && record.schedule_data[dayStr];
                                   const shiftsForDay: any[] = [];
                                   
                                   if (cache && !cache.isUnavailable) {
                                      for (const [loc, shifts] of Object.entries(cache.locations || {}) as [string, any[]][]) {
                                         if (selectedLocation !== 'All' && loc.toLowerCase() !== selectedLocation.toLowerCase()) continue;
                                         
                                         shifts.forEach(shift => {
                                            const startD = new Date(shift.start.dateTime);
                                            const endD = new Date(shift.end.dateTime);
                                            
                                            const startHour = startD.getHours() + (startD.getMinutes() / 60);
                                            const endHour = endD.getHours() + (endD.getMinutes() / 60);
                                            
                                            if (endHour <= 10 || startHour >= 22) return;
                                            
                                            const cStart = Math.max(10, startHour);
                                            const cEnd = Math.min(22, endHour);
                                            
                                            const leftPerc = ((cStart - 10) / 12) * 100;
                                            const widthPerc = ((cEnd - cStart) / 12) * 100;
                                            
                                            let colorClass = "bg-[#A0B99B]/30 border-[#A0B99B] text-[#42523f]";
                                            if (loc.toLowerCase() === 'whyte') colorClass = "bg-[#CAB1E3]/30 border-[#CAB1E3] text-[#5b4a6e]";
                                            if (loc.toLowerCase() === 'heritage') colorClass = "bg-[#ED9BB4]/30 border-[#ED9BB4] text-[#8a3e56]";
                                            
                                            shiftsForDay.push({
                                               loc, leftPerc, widthPerc, colorClass,
                                               startH: startD.getHours() > 12 ? startD.getHours() - 12 : startD.getHours(),
                                               startM: startD.getMinutes().toString().padStart(2,'0'),
                                               startP: startD.getHours() >= 12 ? 'p' : 'a',
                                               endH: endD.getHours() > 12 ? endD.getHours() - 12 : endD.getHours(),
                                               endM: endD.getMinutes().toString().padStart(2,'0'),
                                               endP: endD.getHours() >= 12 ? 'p' : 'a'
                                            });
                                         });
                                      }
                                   }
                                   
                                   rows.push({
                                      date: d,
                                      isUnavailable: cache?.isUnavailable,
                                      hasCache: !!cache,
                                      shifts: shiftsForDay
                                   });
                                });
                                
                                return rows.map((r, idx) => (
                                   <div key={idx} className="flex items-center w-full">
                                      <div className="w-32 flex-shrink-0 text-sm font-semibold text-gray-700 truncate pr-2">
                                         {r.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                      </div>
                                      <div className="flex-1 relative h-10 bg-transparent rounded-lg">
                                         {!r.hasCache ? (
                                            <div className="absolute inset-0 flex items-center px-2 text-xs text-gray-400 font-medium">No Availability Given</div>
                                         ) : r.isUnavailable ? (
                                            <div className="absolute inset-0 flex items-center px-2 text-xs text-gray-500 font-medium opacity-60">Unavailable</div>
                                         ) : r.shifts.length === 0 ? (
                                            <div className="absolute inset-0 flex items-center px-2 text-xs text-gray-400 font-medium opacity-60">Not Available</div>
                                         ) : (
                                            r.shifts.map((shift: any, sIdx: number) => {
                                               const totalShifts = r.shifts.length;
                                               const isMulti = totalShifts > 1;
                                               
                                               const topStyle = isMulti 
                                                  ? `calc(4px + ${sIdx} * ((100% - 8px) / ${totalShifts}))` 
                                                  : '4px';
                                               const heightStyle = isMulti 
                                                  ? `calc((100% - 8px) / ${totalShifts})` 
                                                  : 'calc(100% - 8px)';
                                               
                                               return (
                                                  <div key={sIdx} className={`absolute rounded-md border flex items-center shadow-sm overflow-hidden whitespace-nowrap ${shift.colorClass}`} style={{ left: `${shift.leftPerc}%`, width: `${shift.widthPerc}%`, top: topStyle, height: heightStyle }}>
                                                     <div className={`flex justify-between items-center w-full ${isMulti ? 'px-1' : 'px-2'}`}>
                                                        <span className={`${isMulti ? 'text-[8px]' : 'text-[10px]'} font-medium opacity-70`}>{shift.startH}:{shift.startM}{shift.startP}</span>
                                                        <span className={`truncate font-bold ${isMulti ? 'text-[10px]' : 'text-xs'} px-1`}>
                                                           {isMulti ? shift.loc.charAt(0).toUpperCase() : shift.loc}
                                                        </span>
                                                        <span className={`${isMulti ? 'text-[8px]' : 'text-[10px]'} font-medium opacity-70`}>{shift.endH}:{shift.endM}{shift.endP}</span>
                                                     </div>
                                                  </div>
                                               );
                                            })
                                         )}
                                      </div>
                                   </div>
                                ));
                             })()}
                             </div>
                          </div>
                       </div>
                    </div>
                 )
              })()
            )
         ) : !selectedDate ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>
              <p className="text-lg font-medium text-center">Please choose a day from the calendar below</p>
            </div>
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
                       const rows: any[] = [];
                       
                       periodAvailability.forEach(record => {
                          if (searchQuery && !record.staff.name.toLowerCase().includes(searchQuery.toLowerCase()) && !record.staff.s_name.toLowerCase().includes(searchQuery.toLowerCase())) return;
                          
                          const cache = record.schedule_data && record.schedule_data[dayStr];
                          if (cache && !cache.isUnavailable) {
                             for (const [loc, shifts] of Object.entries(cache.locations || {}) as [string, any[]][]) {
                                if (selectedLocation !== 'All' && loc.toLowerCase() !== selectedLocation.toLowerCase()) continue;
                                
                                (shifts as any[]).forEach(shift => {
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
              const isAtMaxPeriod = Boolean(targetPeriod && maxTargetPeriod
                && targetPeriod.year === maxTargetPeriod.year
                && targetPeriod.month === maxTargetPeriod.month
                && targetPeriod.period === maxTargetPeriod.period);
              
              return (
                <button 
                  onClick={handleNextPeriod} 
                  disabled={isAtMaxPeriod}
                  className={`p-2 rounded-lg transition-colors ${isAtMaxPeriod ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
              );
            })()}
          </div>
          
          <div className="grid grid-cols-7 gap-2 sm:gap-3 w-full">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-bold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-2">
                {day}
              </div>
            ))}
            {validDates.length > 0 && Array.from({ length: validDates[0].getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2 border border-transparent"></div>
            ))}
            {validDates.map((date, idx) => {
              const isSelected = selectedDate?.toDateString() === date.toDateString();
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedDate(date);
                    setIsIndividualView(false);
                  }}
                  className={`
                    flex flex-col items-center justify-start pt-3 sm:pt-4 p-2 min-h-[80px] sm:min-h-[100px] rounded-2xl text-sm font-bold transition-all focus:outline-none border
                    ${isSelected 
                      ? 'bg-[#8ab4f8] border-[#8ab4f8] text-white shadow-md scale-[1.02]' 
                      : 'bg-white border-gray-100/80 text-gray-700 hover:border-gray-300 hover:shadow-sm'
                    }
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
      </div>
    </div>
  );
}
