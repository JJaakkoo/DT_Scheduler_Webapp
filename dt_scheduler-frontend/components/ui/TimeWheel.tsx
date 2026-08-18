import React, { useEffect, useRef } from 'react';

export interface TimeWheelProps {
  /** The currently selected value. */
  value: string;
  /** Callback fired when the value changes. */
  onChange: (value: string) => void;
  /** Array of string options to display in the wheel. */
  options: string[];
  /** If true, formats the display value to standard 12-hour format (e.g. 13 -> 1). */
  isHour?: boolean;
}

export function TimeWheel({ value, onChange, options, isHour = false }: TimeWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticScroll = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-val="${value}"]`) as HTMLElement | null;
    if (el) {
      isProgrammaticScroll.current = true;
      const top = el.offsetTop - containerRef.current.offsetTop - 50;
      containerRef.current.scrollTo({ top, behavior: 'smooth' });
      
      const timeoutId = setTimeout(() => { 
        isProgrammaticScroll.current = false; 
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [value]);

  const handleScroll = () => {
    if (isProgrammaticScroll.current) return;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const center = container.scrollTop + (container.clientHeight / 2);
      
      let closestVal = value;
      let minDiff = Infinity;
      
      const children = Array.from(container.querySelectorAll('button'));
      
      children.forEach((child) => {
        const childCenter = child.offsetTop + (child.offsetHeight / 2) - container.offsetTop;
        const diff = Math.abs(childCenter - center);
        if (diff < minDiff) {
          minDiff = diff;
          closestVal = child.dataset.val || value;
        }
      });
      
      if (closestVal !== value) {
        onChange(closestVal);
      }
    }, 150);
  };

  return (
    <div 
      ref={containerRef} 
      onScroll={handleScroll} 
      className="time-wheel h-[150px] overflow-y-auto overflow-x-hidden w-[70px] sm:w-[90px] flex flex-col items-center snap-y snap-mandatory pt-[50px] pb-[50px]"
    >
      {options.map((o) => {
        let display = o;
        if (isHour) {
          const num = parseInt(o, 10);
          display = (num > 12 ? num - 12 : num).toString();
        }

        const isSelected = value === o;

        return (
          <button 
            key={o} 
            data-val={o}
            onClick={() => onChange(o)}
            className={`w-full h-[50px] shrink-0 snap-center text-2xl sm:text-3xl font-bold transition-all ${
              isSelected ? 'text-[#8ab4f8] scale-110' : 'text-gray-300 hover:text-gray-400'
            }`}
            aria-label={isSelected ? `Selected time: ${display}` : `Select time: ${display}`}
          >
            {display}
          </button>
        );
      })}
    </div>
  );
}
