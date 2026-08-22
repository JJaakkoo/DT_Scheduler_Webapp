import React, { useMemo } from "react";

interface AvailabilityFullViewProps {
  staffData: any[];
  validDates: Date[];
  periodAvailability: any[];
}

export function AvailabilityFullView({ staffData, validDates, periodAvailability }: AvailabilityFullViewProps) {
  // Sort staff by active status, then location, then alphabetically
  const sortedStaff = useMemo(() => {
    return [...staffData].sort((a, b) => {
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
  }, [staffData]);

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
            <th className="sticky left-0 z-30 bg-gray-100 min-w-[80px] p-2 border border-gray-300">
              {/* Top Left Corner */}
            </th>
            {sortedStaff.map((staff, idx) => (
              <th key={staff.id} className="min-w-[70px] p-2 border border-gray-300 text-gray-700 bg-gray-100 uppercase tracking-tight align-top">
                <div className="flex flex-col items-center justify-center gap-1 min-h-[32px]">
                  <span>{staff.s_name || staff.name}</span>
                  {staff.is_new && (
                    <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded border border-emerald-200 leading-none">NEW</span>
                  )}
                </div>
              </th>
            ))}
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
              <th key={staff.id} className="min-w-[70px] p-2 border border-gray-300 text-gray-700 bg-gray-100 uppercase tracking-tight align-bottom">
                <div className="flex flex-col items-center justify-center gap-1 min-h-[32px]">
                  {staff.is_new && (
                    <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded border border-emerald-200 leading-none">NEW</span>
                  )}
                  <span>{staff.s_name || staff.name}</span>
                </div>
              </th>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
