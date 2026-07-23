"use client";

export default function Dashboard() {
  return (
    <main className="h-screen w-screen flex items-center justify-center bg-dreamtea-light p-4">
      
      {}
      {/* We use standard Tailwind sizes and reuse your custom shadow from globals.css */}
      <div className="w-full max-w-[400px] h-[320px] bg-white rounded-[32px] shadow-[var(--shadow-panel)] flex flex-col items-center justify-center p-8 relative z-10">
        
        {}
        <div className="flex-1 flex items-end justify-center pb-8 w-full">
          <img
            src="/dreamtealogo.svg"
            alt="Dream Tea Logo"
            className="object-contain w-28 h-auto"
          />
        </div>

        {}
        <div className="flex-1 flex items-start justify-center pt-2 w-full">
          <button 
            type="button" 
            className="w-full max-w-[260px] h-[48px] bg-dreamtea-blue hover:bg-dreamtea-blue-hover text-white text-[15px] font-semibold rounded-full transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-dreamtea-blue"
            onClick={() => {
              // TODO: Add logic here later to actually download the schedule file!
              console.log("Downloading schedule...");
            }}
          >
            Download Schedule
          </button>
        </div>

      </div>
    </main>
  );
}