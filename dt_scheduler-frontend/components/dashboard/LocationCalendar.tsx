import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getLocationTheme } from '@/utils/theme';

export interface Shift {
  employee?: string;
  location?: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

export interface LocationCalendarProps {
  activeQuery: string;
  masterShifts: Shift[];
  searchedShifts: Shift[];
}

export const LocationCalendar: React.FC<LocationCalendarProps> = ({ activeQuery, masterShifts: initialMasterShifts, searchedShifts: initialSearchedShifts }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [masterShifts, setMasterShifts] = useState<Shift[]>(initialMasterShifts);
  const [searchedShifts, setSearchedShifts] = useState<Shift[]>(initialSearchedShifts);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>("All Locations");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    if (currentMonth.getMonth() === now.getMonth() && currentMonth.getFullYear() === now.getFullYear()) {
      setMasterShifts(initialMasterShifts);
      setSearchedShifts(initialSearchedShifts);
    }
  }, [initialMasterShifts, initialSearchedShifts, currentMonth]);

  useEffect(() => {
    const fetchMonthData = async () => {
      const now = new Date();
      if (currentMonth.getMonth() === now.getMonth() && currentMonth.getFullYear() === now.getFullYear()) {
        return;
      }
      setIsLoadingMonth(true);
      try {
        const token = localStorage.getItem("google_access_token");
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const month = currentMonth.getMonth() + 1;
        const year = currentMonth.getFullYear();
        
        const masterRes = await fetch(`/api/schedule?name=MASTER&month=${month}&year=${year}`, { headers });
        const masterData = await masterRes.json();
        if (masterRes.ok) setMasterShifts(masterData.shifts || []);

        if (activeQuery) {
          const searchRes = await fetch(`/api/schedule?name=${encodeURIComponent(activeQuery)}&month=${month}&year=${year}`, { headers });
          const searchData = await searchRes.json();
          if (searchRes.ok) setSearchedShifts(searchData.shifts || []);
        }
      } catch (e) {
        console.error("Failed to load historical schedule", e);
      } finally {
        setIsLoadingMonth(false);
      }
    };
    fetchMonthData();
  }, [currentMonth, activeQuery]);

  useEffect(() => {
    if (selectedDate && detailsRef.current) {
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [selectedDate]);

  const locations = useMemo(() => {
    const locs = new Set<string>();
    masterShifts.forEach(s => {
      const loc = (s.location || s.summary.replace("Work at ", "")).trim();
      if (loc) locs.add(loc);
    });
    return ["All Locations", ...Array.from(locs).sort()];
  }, [masterShifts]);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1));

  const getShiftsForDay = (date: Date) => {
    return masterShifts.filter(s => {
      if (!s.start || (!s.start.dateTime && !s.start.date)) return false;
      const shiftDate = new Date(s.start.dateTime || s.start.date || "");
      if (shiftDate.getDate() !== date.getDate() || shiftDate.getMonth() !== date.getMonth() || shiftDate.getFullYear() !== date.getFullYear()) {
        return false;
      }
      if (selectedLocation !== "All Locations") {
        const loc = (s.location || s.summary.replace("Work at ", "")).trim();
        if (loc !== selectedLocation) return false;
      }
      return true;
    });
  };

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  
  const formatShiftTime = (date: Date) => {
    const minutes = date.getMinutes();
    if (minutes === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric' });
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="w-full max-w-[850px] mx-auto mt-8 bg-white rounded-[32px] border-4 border-white p-6 md:p-8 shadow-[var(--shadow-panel)] relative z-10 mb-8">
      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center mb-6 gap-4">
        <select 
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className="bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-blue-500 transition-colors cursor-pointer"
        >
          {locations.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-between items-center mb-4 px-2">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-600"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        </button>
        <h4 className="font-bold text-gray-800 text-lg flex items-center justify-center relative">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          {isLoadingMonth && (
            <div className="absolute -right-7 flex items-center justify-center">
              <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </h4>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-600"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-6">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-bold text-gray-400 py-2">
            {day}
          </div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="p-2"></div>
        ))}
        {days.map(day => {
          const personShiftsThisDay = searchedShifts.filter(s => {
            if (!s.start || (!s.start.dateTime && !s.start.date)) return false;
            const shiftDate = new Date(s.start.dateTime || s.start.date || "");
            if (shiftDate.getDate() !== day.getDate() || shiftDate.getMonth() !== day.getMonth() || shiftDate.getFullYear() !== day.getFullYear()) {
              return false;
            }
            if (selectedLocation !== "All Locations") {
              const loc = (s.location || s.summary.replace("Work at ", "")).trim();
              if (loc !== selectedLocation) return false;
            }
            return true;
          });

          const hasPersonalShifts = personShiftsThisDay.length > 0;
          const isDayInteractable = getShiftsForDay(day).length > 0;
          const isSelected = selectedDate?.toDateString() === day.toDateString();
          const isToday = new Date().toDateString() === day.toDateString();

          return (
            <button
              key={day.toISOString()}
              onClick={() => isDayInteractable && setSelectedDate(day)}
              disabled={!isDayInteractable}
              className={`
                aspect-square p-1 sm:p-2 rounded-xl flex flex-col items-center justify-center relative transition-all 
                ${isDayInteractable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}
                ${isSelected ? 'bg-[#8ab4f8] text-white shadow-md' : (isDayInteractable ? 'hover:bg-gray-50 text-gray-700' : 'text-gray-400')}
                ${isToday && !isSelected ? 'ring-2 ring-[#8ab4f8]/50 font-bold' : ''}
              `}
            >
              <span className="text-sm font-medium">{day.getDate()}</span>
              {hasPersonalShifts && (
                <div className="absolute bottom-1 left-0 right-0 flex flex-col items-center gap-[2px] w-full px-0.5">
                  {personShiftsThisDay.map((ps, idx) => {
                    const loc = (ps.location || ps.summary.replace("Work at ", "")).trim();
                    const theme = getLocationTheme(loc);
                    const formatMin = (dtStr: string) => {
                      const d = new Date(dtStr);
                      return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
                    };
                    return (
                      <span key={idx} className={`text-[8.5px] leading-none sm:text-[10px] font-bold tracking-tighter ${isSelected ? 'text-white drop-shadow-sm' : theme.text}`}>
                        {formatMin(ps.start.dateTime || ps.start.date || "")}-{formatMin(ps.end.dateTime || ps.end.date || "")}
                      </span>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div ref={detailsRef} className="mt-6 border-t border-gray-100 pt-6">
          <h4 className="font-bold text-gray-800 mb-4 pl-2">
            Shifts for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h4>
          <div className="flex flex-col gap-3">
            {(() => {
              const dayShifts = getShiftsForDay(selectedDate);
              if (dayShifts.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500 text-sm italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No shifts scheduled for this location on this date.
                  </div>
                );
              }

              // Sort by start time
              const sortedShifts = [...dayShifts].sort((a, b) => {
                return new Date(a.start.dateTime || a.start.date || "").getTime() - new Date(b.start.dateTime || b.start.date || "").getTime();
              });

              // Group by location
              const groupedShifts = sortedShifts.reduce((acc, shift) => {
                const loc = (shift.location || shift.summary.replace("Work at ", "")).trim();
                if (!acc[loc]) acc[loc] = [];
                acc[loc].push(shift);
                return acc;
              }, {} as Record<string, Shift[]>);

              // Render groups
              return Object.entries(groupedShifts)
                .sort(([locA], [locB]) => locA.localeCompare(locB))
                .map(([loc, shifts], gIdx) => {
                  const locTheme = getLocationTheme(loc);
                  return (
                    <div key={gIdx} className="mb-4 last:mb-0">
                      <h5 className={`font-bold text-sm mb-3 pl-1 ${locTheme.text}`}>{loc}</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {shifts.map((shift, idx) => {
                          let showDivider = false;
                          if (idx > 0) {
                            const prevStartHour = new Date(shifts[idx - 1].start.dateTime || shifts[idx - 1].start.date || "").getHours();
                            const currStartHour = new Date(shift.start.dateTime || shift.start.date || "").getHours();
                            if (prevStartHour < 17 && currStartHour >= 17) {
                              showDivider = true;
                            }
                          }

                          return (
                            <React.Fragment key={idx}>
                              {showDivider && (
                                <div className="col-span-full my-2">
                                  <div className="h-[2px] bg-gray-200 w-full rounded-full"></div>
                                </div>
                              )}
                              <div className={`bg-white border-2 ${locTheme.border} rounded-xl p-3 shadow-sm`}>
                                <div className="flex justify-between items-start mb-1">
                                  <p className="font-bold text-gray-700 capitalize truncate">{shift.employee || 'Unknown'}</p>
                                </div>
                                <p className="font-medium text-gray-600 text-sm mb-2">
                                  {formatShiftTime(new Date(shift.start.dateTime || shift.start.date || ""))} - {formatShiftTime(new Date(shift.end.dateTime || shift.end.date || ""))}
                                </p>
                                <span className={`text-xs font-bold px-2 py-1 rounded-md border ${locTheme.border} ${locTheme.text}`}>
                                  {loc}
                                </span>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
