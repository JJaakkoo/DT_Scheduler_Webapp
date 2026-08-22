import React, { useMemo, useRef, useState, useEffect } from "react";

interface AvailabilityFullViewProps {
  staffData: any[];
  validDates: Date[];
  periodAvailability: any[];
}

export function AvailabilityFullView({ staffData, validDates, periodAvailability }: AvailabilityFullViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [draggedStaffId, setDraggedStaffId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const columnRefs = useRef<{ [key: string]: HTMLTableCellElement | null }>({});

  useEffect(() => {
    const savedOrder = localStorage.getItem("nexus_management_full_view_order");
    if (savedOrder) {
      try {
        setManualOrder(JSON.parse(savedOrder));
      } catch (e) {
        console.error("Failed to parse manual order from local storage");
      }
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sort staff by manual order, then active status, then location, then alphabetically
  const sortedStaff = useMemo(() => {
    return [...staffData].sort((a, b) => {
      // 0. Manual Order
      if (manualOrder.length > 0) {
        const indexA = manualOrder.indexOf(a.id);
        const indexB = manualOrder.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
      }

      // 1. Active status (active first)
      const activeA = a.is_active !== false ? 1 : 0;
      const activeB = b.is_active !== false ? 1 : 0;
      if (activeA !== activeB) return activeB - activeA;

      // 2. Main Location (Alphabetical)
      const locA = (a.main_location || "zzz").toLowerCase();
      const locB = (b.main_location || "zzz").toLowerCase();
      if (locA !== locB) return locA.localeCompare(locB);

      // 3. Name
      const nameA = (a.s_name || "").toLowerCase();
      const nameB = (b.s_name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [staffData, manualOrder]);

  useEffect(() => {
    if (!searchQuery) return;
    const query = searchQuery.toLowerCase();
    const match = sortedStaff.find(s => 
      (s.s_name || '').toLowerCase().includes(query) || 
      (s.name || '').toLowerCase().includes(query)
    );
    if (match && columnRefs.current[match.id]) {
      columnRefs.current[match.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [searchQuery, sortedStaff]);

  const handleDragStart = (e: React.DragEvent, staffId: string) => {
    setDraggedStaffId(staffId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStaffId: string) => {
    e.preventDefault();
    if (!draggedStaffId || draggedStaffId === targetStaffId) return;

    let newOrder = manualOrder.length > 0 ? [...manualOrder] : sortedStaff.map(s => s.id);
    
    if (!newOrder.includes(draggedStaffId) || !newOrder.includes(targetStaffId)) {
        newOrder = sortedStaff.map(s => s.id);
    }
    
    const draggedIdx = newOrder.indexOf(draggedStaffId);
    newOrder.splice(draggedIdx, 1);
    
    const targetIdx = newOrder.indexOf(targetStaffId);
    newOrder.splice(targetIdx, 0, draggedStaffId);

    setManualOrder(newOrder);
    localStorage.setItem("nexus_management_full_view_order", JSON.stringify(newOrder));
    setDraggedStaffId(null);
  };

  const getFormatHr = (isoString: string) => {
    const d = new Date(isoString);
    const hr = d.getHours();
    const min = d.getMinutes();
    const fHr = hr % 12 || 12;
    if (min === 0) return `${fHr}`;
    return `${fHr}:${min.toString().padStart(2, '0')}`;
  };

  const getCellData = (date: Date, staffId: string) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const availRecord = periodAvailability.find(a => a.staff_id === staffId);
    
    if (!availRecord || !availRecord.schedule_data || !availRecord.schedule_data[dateStr] || availRecord.schedule_data[dateStr].isUnavailable) {
      return null;
    }

    const dayData = availRecord.schedule_data[dateStr];
    if (!dayData.locations || Object.keys(dayData.locations).length === 0) {
      return null;
    }

    const cellEntries: { text: string, color: string }[] = [];

    for (const [loc, shifts] of Object.entries(dayData.locations)) {
      if ((shifts as any[]).length === 0) continue;
      
      let locPrefix = "H";
      let bgColor = "#e36c09"; // Heritage orange
      
      const lowerLoc = loc.toLowerCase();
      if (lowerLoc === 'whyte' || lowerLoc === 'strathcona') {
        locPrefix = "S";
        bgColor = "#ffeb84"; // Strathcona yellow
      } else if (lowerLoc === 'downtown') {
        locPrefix = "DT";
        bgColor = "#bfbfbf"; // Downtown gray
      }

      for (const t of (shifts as any[])) {
        if (t.start?.dateTime && t.end?.dateTime) {
          const sTime = getFormatHr(t.start.dateTime);
          const eTime = getFormatHr(t.end.dateTime);
          cellEntries.push({
            text: `${locPrefix}${sTime}-${eTime}`,
            color: bgColor
          });
        }
      }
    }

    return cellEntries;
  };

  const formatDateShort = (d: Date) => {
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `${day} ${month} ${weekday}`;
  };

  return (
    <div className="w-full bg-white relative overflow-auto border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.05)] rounded-xl" style={{ maxHeight: "calc(100vh - 200px)" }}>
      <table className="w-max border-collapse text-[11px] font-bold text-center">
        {/* TOP HEADER */}
        <thead className="sticky top-0 z-20 bg-gray-100 shadow-sm">
          <tr>
            <th className="sticky left-0 z-30 bg-gray-100 min-w-[120px] p-1.5 border border-gray-300 align-bottom">
              <div className="w-full flex flex-col gap-1">
                {manualOrder.length > 0 && (
                  <button 
                    onClick={() => { setManualOrder([]); localStorage.removeItem("nexus_management_full_view_order"); }} 
                    className="w-full text-[10px] text-gray-500 hover:text-gray-700 bg-gray-200/50 rounded py-0.5 cursor-pointer font-bold transition-colors"
                  >
                    Reset Order
                  </button>
                )}
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search (Ctrl+F)"
                  className="w-full text-[10px] p-1 border border-gray-300 rounded outline-none focus:border-[#8ab4f8] font-normal placeholder-gray-400"
                />
              </div>
            </th>
            {sortedStaff.map((staff, idx) => (
              <th 
                key={staff.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, staff.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, staff.id)}
                ref={el => { columnRefs.current[staff.id] = el; }}
                className={`min-w-[70px] p-0 border border-gray-300 text-gray-700 bg-gray-100 uppercase tracking-tight align-top cursor-grab active:cursor-grabbing ${draggedStaffId === staff.id ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-col w-full h-full">
                  {staff.is_new ? (
                    <div className="w-full bg-emerald-100 text-emerald-700 text-[9px] py-1 border-b border-gray-300 leading-none">NEW</div>
                  ) : (
                    <div className="w-full h-[17px] border-b border-gray-300"></div>
                  )}
                  <div className="flex-1 flex items-center justify-center p-2 min-h-[32px]">
                    {staff.s_name || staff.name}
                  </div>
                </div>
              </th>
            ))}
            <th className="sticky right-0 z-30 bg-gray-100 min-w-[80px] p-2 border border-gray-300">
              {/* Top Right Corner */}
            </th>
          </tr>
        </thead>
        
        {/* BODY */}
        <tbody>
          {validDates.map((date, rIdx) => {
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <tr key={rIdx}>
                {/* STICKY DATE COLUMN */}
                <td className={`sticky left-0 z-10 border border-gray-300 px-3 py-1 font-bold whitespace-nowrap text-left ${isWeekend ? 'bg-gray-100 text-gray-800' : 'bg-white text-gray-600'}`}>
                  {formatDateShort(date)}
                </td>
                
                {/* STAFF CELLS */}
                {sortedStaff.map((staff) => {
                  const cellEntries = getCellData(date, staff.id);
                  if (!cellEntries || cellEntries.length === 0) {
                    return <td key={staff.id} className="border border-gray-300 bg-white"></td>;
                  }

                  return (
                    <td key={staff.id} className="border border-gray-300 p-0 align-top">
                      <div className="flex flex-col w-full h-full min-h-[30px]">
                        {cellEntries.map((entry, i) => (
                          <div 
                            key={i} 
                            className="flex-1 flex items-center justify-center p-1 font-black text-gray-900 border-b border-black/10 last:border-0 uppercase"
                            style={{ backgroundColor: entry.color }}
                          >
                            {entry.text}
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
                {/* STICKY DATE COLUMN RIGHT */}
                <td className={`sticky right-0 z-10 border border-gray-300 px-3 py-1 font-bold whitespace-nowrap text-right ${isWeekend ? 'bg-gray-100 text-gray-800' : 'bg-white text-gray-600'}`}>
                  {formatDateShort(date)}
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* BOTTOM HEADER */}
        <tfoot className="sticky bottom-0 z-20 bg-gray-100 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
          <tr>
            <th className="sticky left-0 z-30 bg-gray-100 min-w-[80px] p-2 border border-gray-300">
              {/* Bottom Left Corner */}
            </th>
            {sortedStaff.map((staff) => (
              <th key={staff.id} className="min-w-[70px] p-0 border border-gray-300 text-gray-700 bg-gray-100 uppercase tracking-tight align-bottom">
                <div className="flex flex-col w-full h-full">
                  {staff.is_new ? (
                    <div className="w-full bg-emerald-100 text-emerald-700 text-[9px] py-1 border-b border-gray-300 leading-none">NEW</div>
                  ) : (
                    <div className="w-full h-[17px] border-b border-gray-300"></div>
                  )}
                  <div className="flex-1 flex items-center justify-center p-2 min-h-[32px]">
                    {staff.s_name || staff.name}
                  </div>
                </div>
              </th>
            ))}
            <th className="sticky right-0 z-30 bg-gray-100 min-w-[80px] p-2 border border-gray-300">
              {/* Bottom Right Corner */}
            </th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
