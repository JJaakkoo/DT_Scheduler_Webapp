import React, { useMemo } from 'react';
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

export interface ShiftTimelineProps {
  searchedShifts: Shift[];
  masterShifts: Shift[];
  searchIdentifier: string;
  isLoadingMaster?: boolean;
}

function useOverlappingShifts(searchedShifts: Shift[], masterShifts: Shift[], searchIdentifier: string) {
  return useMemo(() => {
    if (!searchedShifts || searchedShifts.length === 0) return [];

    return searchedShifts.map(userShift => {
      if (!userShift.start.dateTime || !userShift.end.dateTime) return { userShift, coworkers: [] };

      const userStart = new Date(userShift.start.dateTime);
      const userEnd = new Date(userShift.end.dateTime);
      const userLocation = (userShift.location || userShift.summary.replace("Work at ", "")).trim();
      const userDay = userStart.toDateString();

      const overlappingCoworkers = masterShifts.filter(coworkerShift => {
        if (!coworkerShift.start.dateTime || !coworkerShift.end.dateTime) return false;
        
        const coworkerStart = new Date(coworkerShift.start.dateTime);
        const coworkerEnd = new Date(coworkerShift.end.dateTime);
        const coworkerLocation = (coworkerShift.location || coworkerShift.summary.replace("Work at ", "")).trim();
        const coworkerDay = coworkerStart.toDateString();

        if (coworkerDay !== userDay || coworkerLocation !== userLocation) return false;
        if (coworkerShift.employee?.toLowerCase() === searchIdentifier.toLowerCase()) return false;
        if (coworkerStart >= userEnd) return false;
        if (coworkerEnd <= userStart) return false;

        return true;
      });

      overlappingCoworkers.sort((a, b) => new Date(a.start.dateTime!).getTime() - new Date(b.start.dateTime!).getTime());

      return { userShift, coworkers: overlappingCoworkers };
    });
  }, [searchedShifts, masterShifts, searchIdentifier]);
}

export const ShiftTimeline: React.FC<ShiftTimelineProps> = ({ searchedShifts, masterShifts, searchIdentifier, isLoadingMaster }) => {
  const timelines = useOverlappingShifts(searchedShifts, masterShifts, searchIdentifier);

  if (!searchedShifts || searchedShifts.length === 0) return null;

  const formatShiftTime = (date: Date) => {
    const minutes = date.getMinutes();
    if (minutes === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric' });
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="w-full max-w-[850px] mx-auto mt-8 bg-white rounded-[32px] border-4 border-white p-6 md:p-8 shadow-[var(--shadow-panel)] relative z-10">
      <h3 className="font-bold text-[#628ebf] text-sm uppercase tracking-widest mb-6 pl-2 flex items-center">
        Who you are working with
        {isLoadingMaster && (
          <div className="ml-2 flex items-center justify-center">
            <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </h3>
      
      <div className="flex flex-col gap-8">
        {timelines.map((timeline, idx) => {
          if (!timeline.userShift.start.dateTime || !timeline.userShift.end.dateTime) return null;

          const locTheme = getLocationTheme(timeline.userShift.location || timeline.userShift.summary.replace("Work at ", ""));
          
          let showDivider = false;
          if (idx > 0 && timelines[idx - 1].userShift.start.dateTime) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const prevStart = new Date(timelines[idx - 1].userShift.start.dateTime!);
            const currStart = new Date(timeline.userShift.start.dateTime);
            if (prevStart < now && currStart >= now) {
              showDivider = true;
            }
          }

          return (
          <React.Fragment key={idx}>
            {showDivider && (
              <div className="w-full border-t border-gray-100 my-6"></div>
            )}
            <div className="flex flex-col">
            <h4 className="font-bold text-gray-700 text-sm mb-4 border-b border-gray-100 pb-2 pl-2">
              {new Date(timeline.userShift.start.dateTime).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} @ {timeline.userShift.location || timeline.userShift.summary.replace("Work at ", "")}
            </h4>
            
            <div className="flex flex-row flex-wrap gap-3">
              <div className="bg-[#8ab4f8]/20 border-2 border-transparent rounded-xl p-3 min-w-[140px] shadow-sm">
                <p className="font-medium text-gray-700 text-sm">
                  {formatShiftTime(new Date(timeline.userShift.start.dateTime))} - {formatShiftTime(new Date(timeline.userShift.end.dateTime))}
                </p>
                <p className="text-xs font-bold text-gray-700 mt-1 capitalize">You</p>
              </div>

              {timeline.coworkers.length > 0 ? timeline.coworkers.map((coworker, cIdx) => (
                <div key={cIdx} className={`bg-white border-2 ${locTheme.border} rounded-xl p-3 min-w-[140px] shadow-sm`}>
                  <p className="font-medium text-gray-700 text-sm">
                    {formatShiftTime(new Date(coworker.start.dateTime!))} - {formatShiftTime(new Date(coworker.end.dateTime!))}
                  </p>
                  <p className="text-xs font-bold text-gray-700 mt-1 capitalize">{coworker.employee}</p>
                </div>
              )) : (
                <div className="flex items-center justify-center bg-gray-50 border border-dashed border-gray-200 rounded-xl p-3 min-w-[140px] text-xs font-medium text-gray-400 italic">
                  No coworkers
                </div>
              )}
            </div>
          </div>
          </React.Fragment>
        )})}
      </div>
    </div>
  );
};
