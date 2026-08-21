import React, { useState, useEffect, useMemo } from "react";
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

  // Helper to format Date to YYYY-MM-DD local
  const formatDateLocal = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const selectedDateStr = selectedDate ? formatDateLocal(selectedDate) : "";

  // Get shifts for the currently selected date and location
  const currentShifts = useMemo(() => {
    const shifts: { employee: string, start: string, end: string, originalIndex: number }[] = [];
    if (!selectedDateStr) return shifts;

    for (const [emp, empShifts] of Object.entries(draftData)) {
      empShifts.forEach((shift: any, idx: number) => {
        if (!shift.start || !shift.start.dateTime) return;
        const shiftDateStr = shift.start.dateTime.split("T")[0];
        const shiftLoc = shift.location || shift.summary.replace("Work at ", "");
        
        if (shiftDateStr === selectedDateStr && shiftLoc.includes(selectedLocation)) {
           // extract HH:MM
           const startTime = shift.start.dateTime.split("T")[1].substring(0, 5);
           const endTime = shift.end.dateTime.split("T")[1].substring(0, 5);
           shifts.push({ employee: emp, start: startTime, end: endTime, originalIndex: idx });
        }
      });
    }
    
    // Sort by start time
    return shifts.sort((a, b) => a.start.localeCompare(b.start));
  }, [draftData, selectedDateStr, selectedLocation]);

  const addShift = () => {
    const tempEmp = `_NewShift_${Math.random()}`; // Temporary key until user selects someone
    setDraftData(prev => {
      const copy = { ...prev };
      if (!copy[tempEmp]) copy[tempEmp] = [];
      
      const newShift = {
        start: { dateTime: `${selectedDateStr}T09:00:00-06:00` },
        end: { dateTime: `${selectedDateStr}T17:00:00-06:00` },
        summary: `Work at ${selectedLocation}`,
        location: selectedLocation
      };
      
      copy[tempEmp].push(newShift);
      return copy;
    });
  };

  const updateShift = (oldEmp: string, originalIndex: number, field: 'employee' | 'start' | 'end', value: string) => {
    setDraftData(prev => {
      const copy = { ...prev };
      const shiftToUpdate = copy[oldEmp][originalIndex];
      
      if (field === 'employee') {
        // Move shift to new employee array
        copy[oldEmp].splice(originalIndex, 1);
        if (copy[oldEmp].length === 0) delete copy[oldEmp];
        
        if (!copy[value]) copy[value] = [];
        copy[value].push(shiftToUpdate);
      } else if (field === 'start') {
        shiftToUpdate.start.dateTime = `${selectedDateStr}T${value}:00-06:00`;
      } else if (field === 'end') {
        shiftToUpdate.end.dateTime = `${selectedDateStr}T${value}:00-06:00`;
      }
      
      return copy;
    });
  };

  const deleteShift = (emp: string, originalIndex: number) => {
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
    
    const results: { name: string, status: string, time: string, isAvailable: boolean }[] = [];
    
    // Default all staff to unavailable unless we find records
    staffData.forEach(staff => {
       const availRecord = periodAvailability.find(a => a.staff_id === staff.id);
       if (!availRecord || !availRecord.schedule_data || !availRecord.schedule_data[selectedDateStr]) {
         results.push({ name: staff.name, status: "Unavailable", time: "", isAvailable: false });
         return;
       }
       
       const dayData = availRecord.schedule_data[selectedDateStr];
       if (!dayData.locations || Object.keys(dayData.locations).length === 0) {
         results.push({ name: staff.name, status: "Unavailable", time: "", isAvailable: false });
         return;
       }
       
       // Check if available at selected location
       const locData = dayData.locations[selectedLocation];
       if (locData && locData.length > 0) {
         const times = locData.map((t: any) => `${t.start}-${t.end}`).join(", ");
         results.push({ name: staff.name, status: "Available", time: times, isAvailable: true });
       } else {
         // Available somewhere else
         results.push({ name: staff.name, status: "Other Loc", time: "", isAvailable: false });
       }
    });
    
    // Sort: Available first, then name
    return results.sort((a, b) => {
       if (a.isAvailable === b.isAvailable) return a.name.localeCompare(b.name);
       return a.isAvailable ? -1 : 1;
    });
  }, [selectedDateStr, selectedLocation, periodAvailability, staffData]);

  if (!targetPeriod) return <div className="p-8 text-center text-gray-500">Loading period...</div>;

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="w-full flex flex-col gap-6 relative">
      {toast && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-2 rounded-full shadow-lg text-sm font-bold animate-in fade-in slide-in-from-top-4">
          {toast}
        </div>
      )}

      {/* TOP HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
         <div className="flex items-center gap-4 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-200">
               <button 
                 onClick={handlePrevPeriod}
                 className="p-2 hover:bg-white rounded-lg transition-colors text-gray-500 hover:text-gray-800 hover:shadow-sm"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
               </button>
               <div className="px-4 py-1 text-sm font-bold text-gray-700 min-w-[110px] text-center">
                 {MONTHS[targetPeriod.month - 1]} P{targetPeriod.period}
               </div>
               <button 
                 onClick={handleNextPeriod}
                 disabled={maxTargetPeriod?.year === targetPeriod.year && maxTargetPeriod?.month === targetPeriod.month && maxTargetPeriod?.period === targetPeriod.period}
                 className="p-2 hover:bg-white rounded-lg transition-colors text-gray-500 hover:text-gray-800 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
               </button>
            </div>
            
            <select 
               value={selectedDateStr}
               onChange={e => {
                 const d = validDates.find(vd => formatDateLocal(vd) === e.target.value);
                 if (d) setSelectedDate(d);
               }}
               className="bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 py-2.5 pl-3 pr-8 cursor-pointer shadow-sm"
               style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19.5 8.25l-7.5 7.5-7.5-7.5\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1em 1em' }}
            >
               {validDates.map((d, i) => (
                 <option key={i} value={formatDateLocal(d)}>
                    {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                 </option>
               ))}
            </select>
         </div>

         <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-sm font-medium text-gray-500 whitespace-nowrap">Location:</span>
            <select 
              value={selectedLocation} 
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 py-2 pl-3 pr-8 cursor-pointer w-full sm:w-auto shadow-sm"
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
                  <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between ${s.isAvailable ? 'bg-teal-50/50 border-teal-100' : 'bg-gray-50 border-gray-100'}`}>
                     <div className="flex flex-col">
                        <span className={`font-semibold text-sm ${s.isAvailable ? 'text-teal-900' : 'text-gray-500'}`}>{s.name}</span>
                        {s.isAvailable && <span className="text-xs text-teal-600 font-medium">{s.time}</span>}
                     </div>
                     {!s.isAvailable && (
                       <span className="text-[10px] uppercase font-bold text-gray-400">{s.status}</span>
                     )}
                  </div>
                ))}
             </div>
          </div>

          {/* RIGHT PANEL: SPREADSHEET BUILDER */}
          <div className="w-full lg:w-2/3 bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.05)] border border-gray-100 p-6 flex flex-col h-[550px]">
             <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <h3 className="text-gray-800 font-bold text-lg">Shift Builder</h3>
                <div className="flex items-center gap-2">
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

             <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2">
                {currentShifts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                     <p className="text-sm">No shifts scheduled for this location today.</p>
                  </div>
                ) : (
                  currentShifts.map((shift, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100 group transition-colors hover:bg-gray-100/50">
                      <input 
                        type="time" 
                        value={shift.start} 
                        onChange={(e) => updateShift(shift.employee, shift.originalIndex, 'start', e.target.value)}
                        className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium focus:outline-none focus:border-sky-400 w-28 text-gray-700"
                      />
                      <span className="text-gray-400 text-sm font-medium">to</span>
                      <input 
                        type="time" 
                        value={shift.end} 
                        onChange={(e) => updateShift(shift.employee, shift.originalIndex, 'end', e.target.value)}
                        className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium focus:outline-none focus:border-sky-400 w-28 text-gray-700"
                      />
                      <select
                        value={shift.employee.startsWith("_NewShift_") ? "" : shift.employee}
                        onChange={(e) => updateShift(shift.employee, shift.originalIndex, 'employee', e.target.value)}
                        className={`flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-sky-400 cursor-pointer appearance-none ${shift.employee.startsWith("_NewShift_") ? 'text-gray-400' : 'text-gray-700'}`}
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9\'/%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1em 1em' }}
                      >
                        <option value="" disabled>Select Staff...</option>
                        {staffData.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => deleteShift(shift.employee, shift.originalIndex)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                        title="Delete Shift"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))
                )}
                
                <button 
                  onClick={addShift}
                  className="mt-2 w-full py-3 border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-all font-bold text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Add Shift
                </button>
             </div>
          </div>

        </div>
      )}
    </div>
  );
}
