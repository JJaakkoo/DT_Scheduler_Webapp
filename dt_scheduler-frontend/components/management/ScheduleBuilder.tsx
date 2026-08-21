import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { getDraftSchedule, saveDraftSchedule, publishSchedule } from "@/app/actions/scheduling";

interface TargetPeriod {
  year: number;
  month: number;
  period: number;
}

interface ScheduleBuilderProps {
  staffData?: any[];
  periodAvailability: any[];
  targetPeriod: TargetPeriod | null;
  maxTargetPeriod: TargetPeriod | null;
  validDates: Date[];
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  handlePrevPeriod: () => void;
  handleNextPeriod: () => void;
}

const LOCATIONS = ["Whyte", "Downtown", "Heritage"];

export function ScheduleBuilder({
  staffData = [],
  periodAvailability,
  targetPeriod,
  maxTargetPeriod,
  validDates,
  selectedDate,
  setSelectedDate,
  handlePrevPeriod,
  handleNextPeriod
}: ScheduleBuilderProps) {
  const [selectedLocation, setSelectedLocation] = useState("Whyte");
  const [draftData, setDraftData] = useState<Record<string, any[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Gantt Drag State
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{ originalIndex: number, employee: string, edge: 'left' | 'right', startX: number, initialTime: number } | null>(null);
  const [tempShift, setTempShift] = useState<{ originalIndex: number, startHour: number, endHour: number } | null>(null);
  
  // Add Staff Search State
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Fetch draft when target period changes
  useEffect(() => {
    async function loadDraft() {
      if (!targetPeriod) return;
      setIsLoading(true);
      const res = await getDraftSchedule(targetPeriod.year, targetPeriod.month, targetPeriod.period);
      if (res.schedule_data) {
        setDraftData(res.schedule_data);
      } else {
        setDraftData({});
      }
      setIsLoading(false);
    }
    loadDraft();
  }, [targetPeriod]);

  // If no date selected, select the first valid date
  useEffect(() => {
    if (!selectedDate && validDates.length > 0) {
      setSelectedDate(validDates[0]);
    }
  }, [validDates, selectedDate, setSelectedDate]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveDraft = async () => {
    if (!targetPeriod) return;
    setIsSaving(true);
    const res = await saveDraftSchedule(targetPeriod.year, targetPeriod.month, targetPeriod.period, draftData);
    setIsSaving(false);
    if (res.success) {
      showToast("Draft saved successfully!");
    } else {
      showToast(`Error: ${res.error}`);
    }
  };

  const handlePublish = async () => {
    if (!targetPeriod) return;
    if (!confirm("Are you sure you want to publish this schedule? It will overwrite any existing official schedule for this period.")) return;
    setIsPublishing(true);
    const res = await publishSchedule(targetPeriod.year, targetPeriod.month, targetPeriod.period, draftData);
    setIsPublishing(false);
    if (res.success) {
      showToast("Schedule Published Successfully!");
    } else {
      showToast(`Error: ${res.error}`);
    }
  };

  const selectedDateStr = selectedDate ? selectedDate.toISOString().split('T')[0] : "";

  // Stable sort order reference
  const employeeOrderRef = useRef<string[]>([]);
  useEffect(() => {
      employeeOrderRef.current = [];
  }, [selectedDateStr, selectedLocation]);

  // Get shifts for the currently selected date and location
  const currentShifts = useMemo(() => {
    const shifts: { employee: string, startHour: number, endHour: number, originalIndex: number }[] = [];
    if (!selectedDateStr) return shifts;
    
    for (const employee in draftData) {
       const employeeShifts = draftData[employee];
       employeeShifts.forEach((shift, index) => {
          // Check if this shift is for the selected date and location
          const shiftStart = new Date(shift.start.dateTime);
          const shiftDateStr = shiftStart.toISOString().split('T')[0];
          
          if (shiftDateStr === selectedDateStr && shift.location === selectedLocation) {
             const startHour = shiftStart.getHours() + shiftStart.getMinutes() / 60;
             const shiftEnd = new Date(shift.end.dateTime);
             const endHour = shiftEnd.getHours() + shiftEnd.getMinutes() / 60;
             shifts.push({
                employee,
                startHour,
                endHour,
                originalIndex: index
             });
          }
       });
    }
    
    // Sort using stable order to prevent jumping while dragging
    shifts.sort((a, b) => {
        let idxA = employeeOrderRef.current.indexOf(a.employee);
        let idxB = employeeOrderRef.current.indexOf(b.employee);
        
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        
        return a.startHour - b.startHour;
    });
    
    // Update stable order
    employeeOrderRef.current = shifts.map(s => s.employee);
    
    return shifts;
  }, [draftData, selectedDateStr, selectedLocation]);

  // Gantt Chart Time Math Utilities
  const timeToPerc = (hour: number) => {
     const clamped = Math.max(10, Math.min(22, hour));
     return ((clamped - 10) / 12) * 100;
  };
  
  const widthPerc = (startHour: number, endHour: number) => {
     const clampedStart = Math.max(10, Math.min(22, startHour));
     const clampedEnd = Math.max(10, Math.min(22, endHour));
     return ((clampedEnd - clampedStart) / 12) * 100;
  };

  const pxToHourDelta = (pxDelta: number) => {
     if (!containerRef.current) return 0;
     const containerWidth = containerRef.current.clientWidth - 128; // Subtract name col width (w-32 is 128px)
     const hourWidthPx = containerWidth / 12; // 12 hours from 10 to 22
     
     // Convert px delta to hour delta
     const hourDelta = pxDelta / hourWidthPx;
     
     // Snap to 15-minute increments (0.25 hours)
     return Math.round(hourDelta * 4) / 4;
  };

  const handlePointerDown = (e: React.PointerEvent, shift: any, edge: 'left' | 'right') => {
     e.preventDefault();
     setDragState({
        originalIndex: shift.originalIndex,
        employee: shift.employee,
        edge,
        startX: e.clientX,
        initialTime: edge === 'left' ? shift.startHour : shift.endHour
     });
     setTempShift({
        originalIndex: shift.originalIndex,
        startHour: shift.startHour,
        endHour: shift.endHour
     });
     document.body.style.cursor = 'ew-resize';
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
     if (!dragState || !tempShift) return;
     
     const pxDelta = e.clientX - dragState.startX;
     const hourDelta = pxToHourDelta(pxDelta);
     
     let newTime = dragState.initialTime + hourDelta;
     newTime = Math.max(10, Math.min(22, newTime)); // Clamp to 10am-10pm
     
     if (dragState.edge === 'left') {
        newTime = Math.min(newTime, tempShift.endHour - 1); // At least 1 hour long
        setTempShift({ ...tempShift, startHour: newTime });
     } else {
        newTime = Math.max(newTime, tempShift.startHour + 1); // At least 1 hour long
        setTempShift({ ...tempShift, endHour: newTime });
     }
  }, [dragState, tempShift]);

  const updateDraftTime = (employee: string, originalIndex: number, newStartHour: number, newEndHour: number) => {
     if (!selectedDateStr) return;
     
     const dateObj = new Date(selectedDateStr + 'T12:00:00'); // Midday to avoid TZ shifts
     const year = dateObj.getFullYear();
     const month = String(dateObj.getMonth() + 1).padStart(2, '0');
     const day = String(dateObj.getDate()).padStart(2, '0');
     
     const formatIso = (hr: number) => {
        const floorHr = Math.floor(hr);
        const mins = (hr - floorHr) * 60;
        const hrStr = String(floorHr).padStart(2, '0');
        const minStr = String(Math.round(mins)).padStart(2, '0');
        // We output standard ISO format with timezone matching local
        const offset = new Date().getTimezoneOffset();
        const sign = offset > 0 ? "-" : "+";
        const absOffset = Math.abs(offset);
        const tzHr = String(Math.floor(absOffset / 60)).padStart(2, '0');
        const tzMin = String(absOffset % 60).padStart(2, '0');
        return `${year}-${month}-${day}T${hrStr}:${minStr}:00${sign}${tzHr}:${tzMin}`;
     };

     setDraftData(prev => {
        const newData = { ...prev };
        if (newData[employee] && newData[employee][originalIndex]) {
           newData[employee][originalIndex].start.dateTime = formatIso(newStartHour);
           newData[employee][originalIndex].end.dateTime = formatIso(newEndHour);
        }
        return newData;
     });
  };

  const handlePointerUp = useCallback(() => {
     if (dragState && tempShift) {
        updateDraftTime(dragState.employee, dragState.originalIndex, tempShift.startHour, tempShift.endHour);
     }
     setDragState(null);
     setTempShift(null);
     document.body.style.cursor = 'default';
  }, [dragState, tempShift]);

  useEffect(() => {
     if (dragState) {
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
           window.removeEventListener('pointermove', handlePointerMove);
           window.removeEventListener('pointerup', handlePointerUp);
        };
     }
  }, [dragState, handlePointerMove, handlePointerUp]);

  const handleAddStaffToGantt = (employeeName: string) => {
     if (!selectedDateStr) return;
     
     const staffInfo = staffAvailabilityForDate.find(s => s.name === employeeName);
     let startHour = 12; // Default 12pm
     let endHour = 22;   // Default 10pm
     
     if (staffInfo && staffInfo.availableLocs) {
        // Try to find availability at selected location
        const locInfo = staffInfo.availableLocs.find(l => l.isSelected);
        if (locInfo && locInfo.time) {
           const timeMatch = locInfo.time.match(/(\d+):(\d+)([ap])\s*-\s*(\d+):(\d+)([ap])/);
           if (timeMatch) {
              let [_, sH, sM, sP, eH, eM, eP] = timeMatch;
              startHour = (parseInt(sH) % 12) + (sP === 'p' ? 12 : 0) + (parseInt(sM) / 60);
              endHour = (parseInt(eH) % 12) + (eP === 'p' ? 12 : 0) + (parseInt(eM) / 60);
           }
        }
     }
     
     const dateObj = new Date(selectedDateStr + 'T12:00:00'); 
     const year = dateObj.getFullYear();
     const month = String(dateObj.getMonth() + 1).padStart(2, '0');
     const day = String(dateObj.getDate()).padStart(2, '0');
     
     const formatIso = (hr: number) => {
        const floorHr = Math.floor(hr);
        const mins = (hr - floorHr) * 60;
        const hrStr = String(floorHr).padStart(2, '0');
        const minStr = String(Math.round(mins)).padStart(2, '0');
        const offset = new Date().getTimezoneOffset();
        const sign = offset > 0 ? "-" : "+";
        const absOffset = Math.abs(offset);
        const tzHr = String(Math.floor(absOffset / 60)).padStart(2, '0');
        const tzMin = String(absOffset % 60).padStart(2, '0');
        return `${year}-${month}-${day}T${hrStr}:${minStr}:00${sign}${tzHr}:${tzMin}`;
     };

     setDraftData(prev => {
        const newData = { ...prev };
        if (!newData[employeeName]) newData[employeeName] = [];
        newData[employeeName].push({
           start: { dateTime: formatIso(startHour) },
           end: { dateTime: formatIso(endHour) },
           location: selectedLocation
        });
        return newData;
     });
     
     setStaffSearchQuery("");
     setIsSearchFocused(false);
  };

  const handleDeleteShift = (emp: string, originalIndex: number) => {
    setDraftData(prev => {
      const copy = { ...prev };
      copy[emp].splice(originalIndex, 1);
      if (copy[emp].length === 0) delete copy[emp];
      return copy;
    });
  };

  // Availability for Left Panel
  const staffAvailabilityForDate = useMemo(() => {
    if (!selectedDateStr) return [];
    
    const results: { 
       name: string, 
       status: string, // 'Available', 'Other Location', 'Unavailable'
       availableLocs: { loc: string, time: string, colorClass: string, isSelected: boolean }[] 
    }[] = [];
    
    // Default all staff to unavailable unless we find records
    staffData.forEach(staff => {
       const availRecord = periodAvailability.find(a => a.staff_id === staff.id);
       
       if (!availRecord || !availRecord.schedule_data || !availRecord.schedule_data[selectedDateStr] || availRecord.schedule_data[selectedDateStr].isUnavailable) {
         results.push({ name: staff.name, status: "Unavailable", availableLocs: [] });
         return;
       }
       
       const dayData = availRecord.schedule_data[selectedDateStr];
       if (!dayData.locations || Object.keys(dayData.locations).length === 0) {
         results.push({ name: staff.name, status: "Unavailable", availableLocs: [] });
         return;
       }
       
       const availableLocs: { loc: string, time: string, colorClass: string, isSelected: boolean }[] = [];
       let isAvailableAtSelected = false;

       for (const [loc, shifts] of Object.entries(dayData.locations)) {
           if ((shifts as any[]).length === 0) continue;
           
           const times = (shifts as any[]).map((t: any) => {
               if (t.start?.dateTime && t.end?.dateTime) {
                   const formatTime = (isoString: string) => {
                       const d = new Date(isoString);
                       const hr = d.getHours();
                       const min = d.getMinutes().toString().padStart(2, '0');
                       const suffix = hr >= 12 ? 'p' : 'a';
                       const fHr = hr % 12 || 12;
                       return `${fHr}:${min}${suffix}`;
                   };
                   return `${formatTime(t.start.dateTime)} - ${formatTime(t.end.dateTime)}`;
               }
               return "Unknown Time";
           }).join(", ");
           const isSelected = loc.toLowerCase() === selectedLocation.toLowerCase();
           if (isSelected) isAvailableAtSelected = true;

           let colorClass = "text-[#7b9177]"; // Downtown Green Softer
           if (loc.toLowerCase() === 'whyte') colorClass = "text-[#8f80a3]"; // Whyte Purple Softer
           if (loc.toLowerCase() === 'heritage') colorClass = "text-[#b06f84]"; // Heritage Pink Softer

           availableLocs.push({ loc, time: times, colorClass, isSelected });
       }
       
       if (availableLocs.length > 0) {
           results.push({ 
             name: staff.name, 
             status: isAvailableAtSelected ? "Available" : "Other Location", 
             availableLocs 
           });
       } else {
           results.push({ name: staff.name, status: "Unavailable", availableLocs: [] });
       }
    });
    
    // Sort: Available first, then Other Location, then Unavailable, then alphabetical
    return results.sort((a, b) => {
       const getRank = (status: string) => status === "Available" ? 1 : status === "Other Location" ? 2 : 3;
       if (getRank(a.status) !== getRank(b.status)) return getRank(a.status) - getRank(b.status);
       return a.name.localeCompare(b.name);
    });
  }, [selectedDateStr, selectedLocation, periodAvailability, staffData]);

  if (!targetPeriod) return <div className="p-8 text-center text-gray-500">Loading period...</div>;

  return (
    <div className="w-full flex flex-col gap-6 relative">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
         <h2 className="text-lg font-bold text-gray-800 px-2">
            {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
         </h2>

         <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Location:</span>
            <select 
              value={selectedLocation} 
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 py-2 pl-3 pr-8 appearance-none cursor-pointer"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19.5 8.25l-7.5 7.5-7.5-7.5\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1em 1em' }}
            >
              {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
         </div>
      </div>

      {isLoading ? (
        <div className="w-full flex justify-center py-12 text-gray-400 font-medium">Loading Draft...</div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 w-full">
          
          {/* LEFT PANEL: AVAILABILITY */}
          <div className="w-full lg:w-1/3 bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.05)] border border-gray-100 p-6 flex flex-col h-[550px]">
             <h3 className="text-gray-800 font-bold text-lg mb-4 flex items-center justify-between border-b border-gray-50 pb-3">
                Staff Availability
                <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-1 rounded-md">{selectedLocation}</span>
             </h3>
             <div className="overflow-y-auto pr-2 space-y-2 no-scrollbar flex-1">
                {staffAvailabilityForDate.map((s, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border flex flex-col justify-center gap-1.5 ${s.status === 'Available' ? 'bg-teal-50/50 border-teal-100' : 'bg-gray-50 border-gray-100'}`}>
                     <div className="flex items-center justify-between">
                        <span className={`font-semibold text-sm ${s.status === 'Available' ? 'text-teal-900' : 'text-gray-500'}`}>{s.name}</span>
                        {s.status === 'Unavailable' && (
                           <span className="text-[10px] uppercase font-bold text-gray-400">Unavailable</span>
                        )}
                        {s.status === 'Other Location' && (
                           <span className="text-[10px] uppercase font-bold text-gray-400">Other Location</span>
                        )}
                     </div>
                     
                     {s.availableLocs.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1">
                           {s.availableLocs.map((locInfo, locIdx) => (
                              <div key={locIdx} className="flex items-center justify-between">
                                 <span className={`text-[11px] font-semibold tracking-wide uppercase ${locInfo.colorClass}`}>
                                    {locInfo.loc}
                                 </span>
                                 <span className={`text-xs font-medium ${locInfo.isSelected ? 'text-teal-600' : 'text-gray-500'}`}>
                                    {locInfo.time}
                                 </span>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
                ))}
             </div>
          </div>

          {/* RIGHT PANEL: INTERACTIVE GANTT CHART BUILDER */}
          <div className="w-full lg:w-2/3 bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.05)] border border-gray-100 p-6 flex flex-col h-[550px]">
             <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-3">
                <div className="flex items-center gap-2">
                   <h3 className="text-gray-800 font-bold text-lg">Shift Builder</h3>
                   <span className="bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded text-xs">{selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                </div>
                <div className="flex gap-2 items-center">
                  {toast && <span className="text-sm font-bold text-emerald-500 mr-2 animate-pulse">{toast}</span>}
                  <button 
                    onClick={handleSaveDraft}
                    disabled={isSaving || isPublishing}
                    className="text-gray-500 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Draft"}
                  </button>
                  <button 
                    onClick={handlePublish}
                    disabled={isSaving || isPublishing}
                    className="bg-[#8ab4f8] hover:bg-blue-400 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-[0_2px_8px_rgba(139,185,217,0.4)] hover:shadow-md transition-all disabled:opacity-50"
                  >
                    {isPublishing ? "Publishing..." : "Publish Live"}
                  </button>
                </div>
             </div>

             <div className="relative flex-1 bg-gray-50/50 rounded-xl border border-gray-100 p-4 min-h-[300px] overflow-x-auto overflow-y-auto no-scrollbar">
                <div className="min-w-[500px] min-h-full relative flex flex-col" ref={containerRef}>
                   {/* X-Axis Timeline (10am to 10pm) */}
                   <div className="ml-32 absolute top-0 bottom-0 left-0 right-0 pointer-events-none" style={{ zIndex: 0 }}>
                      {[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((hour) => (
                         <div key={hour} className={`absolute top-0 bottom-0 flex flex-col items-center pointer-events-none ${(hour === 12 || hour === 17 || hour === 22) ? 'z-10' : ''}`} style={{ left: `${((hour - 10) / 12) * 100}%`, transform: 'translateX(-50%)' }}>
                            <span className={`text-xs font-bold mt-1 bg-gray-50 px-1 rounded ${(hour === 12 || hour === 17 || hour === 22) ? 'text-gray-600' : 'text-gray-400'}`}>{hour > 12 ? hour - 12 : hour}{hour === 12 ? 'p' : hour > 12 ? 'p' : 'a'}</span>
                            <div className={`flex-1 mt-1 ${(hour === 12 || hour === 17 || hour === 22) ? 'w-[2px] bg-gray-400/80' : 'w-px bg-gray-200'}`} />
                         </div>
                      ))}
                   </div>
                   
                   {/* Gantt Rows */}
                   <div className="mt-4 flex flex-col gap-3 relative z-10 w-full">
                     {currentShifts.length === 0 && (
                        <div className="absolute top-10 bottom-0 left-32 right-0 flex items-start justify-center pointer-events-none z-20">
                           <span className="text-gray-400 font-bold text-sm bg-white/90 px-5 py-2.5 rounded-2xl shadow-sm border border-gray-100 backdrop-blur-sm">
                              No shifts scheduled for {selectedLocation} today.
                           </span>
                        </div>
                     )}
                     
                     {currentShifts.map((shift, idx) => {
                        const isDraggingThis = dragState && dragState.originalIndex === shift.originalIndex && dragState.employee === shift.employee;
                        const renderStart = isDraggingThis && tempShift ? tempShift.startHour : shift.startHour;
                        const renderEnd = isDraggingThis && tempShift ? tempShift.endHour : shift.endHour;
                        
                        const left = timeToPerc(renderStart);
                        const width = widthPerc(renderStart, renderEnd);
                        
                        let colorClass = "bg-[#8ab4f8]/30 border-[#8ab4f8] text-[#3b6bb8]"; // Default Blue
                        if (selectedLocation.toLowerCase() === 'whyte') colorClass = "bg-[#CAB1E3]/30 border-[#CAB1E3] text-[#5b4a6e]";
                        if (selectedLocation.toLowerCase() === 'heritage') colorClass = "bg-[#ED9BB4]/30 border-[#ED9BB4] text-[#8a3e56]";
                        if (selectedLocation.toLowerCase() === 'downtown') colorClass = "bg-[#A0B99B]/30 border-[#A0B99B] text-[#42523f]";

                        // Check bounds against staff availability
                        const staffInfo = staffAvailabilityForDate.find(s => s.name === shift.employee);
                        let isOutOfBounds = true;
                        
                        if (staffInfo && staffInfo.availableLocs) {
                           const locInfo = staffInfo.availableLocs.find(l => l.isSelected); // must be available at this location
                           if (locInfo && locInfo.time) {
                              const timeMatch = locInfo.time.match(/(\d+):(\d+)([ap])\s*-\s*(\d+):(\d+)([ap])/);
                              if (timeMatch) {
                                 let [_, sH, sM, sP, eH, eM, eP] = timeMatch;
                                 const availStart = (parseInt(sH) % 12) + (sP === 'p' ? 12 : 0) + (parseInt(sM) / 60);
                                 const availEnd = (parseInt(eH) % 12) + (eP === 'p' ? 12 : 0) + (parseInt(eM) / 60);
                                 if (renderStart >= availStart && renderEnd <= availEnd) {
                                    isOutOfBounds = false;
                                 }
                              }
                           }
                        }
                        
                        const formatHr = (hr: number) => {
                           const fHr = Math.floor(hr) % 12 || 12;
                           const m = Math.round((hr - Math.floor(hr)) * 60).toString().padStart(2, '0');
                           const p = hr >= 12 ? 'p' : 'a';
                           return `${fHr}:${m}${p}`;
                        };

                        return (
                           <div key={`${shift.employee}-${idx}`} className="flex items-center w-full group relative">
                              <div className="w-32 flex-shrink-0 text-sm font-bold text-gray-700 truncate pr-2 flex items-center justify-between">
                                 {shift.employee}
                                 <button onClick={() => handleDeleteShift(shift.employee, shift.originalIndex)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" /></svg>
                                 </button>
                              </div>
                              <div className="flex-1 relative h-10 bg-transparent rounded-lg">
                                 <div 
                                    className={`absolute top-1 bottom-1 rounded-md border flex items-center shadow-sm whitespace-nowrap transition-all duration-75 ${colorClass} ${isDraggingThis ? 'ring-2 ring-sky-400 z-50' : 'hover:ring-1 hover:ring-sky-400'}`}
                                    style={{ left: `${left}%`, width: `${width}%` }}
                                 >
                                    {/* Left Handle */}
                                    <div 
                                       className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/10 z-10 rounded-l-md"
                                       onPointerDown={(e) => handlePointerDown(e, shift, 'left')}
                                    />
                                    
                                    <div className="flex justify-between items-center w-full px-2 pointer-events-none select-none relative overflow-hidden h-full">
                                       <span className="text-[10px] font-bold opacity-80 shrink-0">{formatHr(renderStart)}</span>
                                       
                                       {isOutOfBounds && (
                                          <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-black text-red-600/80 uppercase truncate px-8 ${width < 25 ? 'hidden' : ''}`}>
                                             (Outside of Availability)
                                          </span>
                                       )}
                                       {isOutOfBounds && width < 25 && (
                                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-red-600/80" title="Outside of Availability">
                                             (!)
                                          </span>
                                       )}
                                       
                                       <span className={`text-[10px] font-bold opacity-80 shrink-0 ${width < 10 ? 'hidden' : ''}`}>{formatHr(renderEnd)}</span>
                                    </div>

                                    {/* Right Handle */}
                                    <div 
                                       className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/10 z-10 rounded-r-md"
                                       onPointerDown={(e) => handlePointerDown(e, shift, 'right')}
                                    />
                                 </div>
                              </div>
                           </div>
                        )
                     })}
                   </div>
                </div>
             </div>
             
             {/* Add Staff Footer */}
             <div className="mt-4 flex items-center justify-center relative w-full max-w-xs mx-auto">
                 <div className="relative w-full">
                     <div className="relative">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 absolute left-3 top-2.5 text-gray-400">
                             <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                         </svg>
                         <input 
                            type="text" 
                            placeholder="Search & Add Staff..." 
                            value={staffSearchQuery}
                            onChange={(e) => {
                                setStaffSearchQuery(e.target.value);
                                setIsSearchFocused(true);
                            }}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                            className="w-full bg-white border border-gray-200 text-gray-700 py-2.5 pl-10 pr-4 rounded-xl text-sm font-bold shadow-[0_2px_10px_rgba(0,0,0,0.02)] focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 outline-none transition-all placeholder:text-gray-400 placeholder:font-semibold"
                         />
                     </div>
                     
                     {isSearchFocused && (
                         <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-gray-100 rounded-xl max-h-60 overflow-y-auto z-50 flex flex-col p-1">
                            {(() => {
                               const filtered = staffData.filter(s => 
                                   !currentShifts.some(shift => shift.employee === s.name) && 
                                   s.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
                               );
                               
                               if (filtered.length === 0) {
                                  return <div className="p-3 text-center text-sm font-medium text-gray-400">No available staff found</div>;
                               }
                               
                               return filtered.map(s => (
                                   <button 
                                      key={s.id} 
                                      onMouseDown={(e) => { e.preventDefault(); handleAddStaffToGantt(s.name); }}
                                      className="w-full text-left px-3 py-2.5 hover:bg-sky-50 rounded-lg text-sm font-bold text-gray-700 transition-colors flex items-center justify-between group"
                                   >
                                      {s.name}
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clipRule="evenodd" />
                                      </svg>
                                   </button>
                               ));
                            })()}
                         </div>
                     )}
                 </div>
             </div>
          </div>

        </div>
      )}

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
                  onClick={() => setSelectedDate(date)}
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
