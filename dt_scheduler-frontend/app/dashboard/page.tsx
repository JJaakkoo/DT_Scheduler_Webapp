"use client";

import { useState } from "react";

export default function Dashboard() {
  // State to hold the name entered by the user
  const [employeeName, setEmployeeName] = useState("");
  // New state for loading and messages
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleDownload = async () => {
    if (!employeeName.trim()) {
      setMessage("Please enter your name.");
      return;
    }
    
    setIsLoading(true);
    setMessage("Fetching schedule from Nexus...");
    
    try {
      // Call your local Flask server
      const response = await fetch(`http://localhost:5328/api/download-schedule?name=${employeeName}`);
      
      // If the backend returns a 404 (no shifts) or 500 (error)
      if (!response.ok) {
        const errorData = await response.json();
        setMessage(errorData.error || errorData.message || "Failed to find schedule.");
        setIsLoading(false);
        return;
      }

      // Convert the response into a Blob (a raw file object)
      const blob = await response.blob();
      
      // Create a temporary hidden link to trigger the browser's download prompt
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DreamTea_Schedule_${employeeName}.ics`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up the temporary link
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setMessage("Download complete! Check your downloads folder.");
    } catch (error) {
      console.error(error);
      setMessage("Error connecting to the backend server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="h-screen w-screen flex items-center justify-center p-8 bg-dreamtea-light">
      
      {/* Main Card Container */}
      <div className="w-full max-w-[400px] bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.1)] flex flex-col items-center p-10 space-y-10 relative z-10">
        
        {/* Dream Tea Logo */}
        <img
          src="/dreamtealogo.svg"
          alt="Dream Tea Logo"
          className="object-contain w-32 h-auto mt-2"
        />

        {/* Name Input Field */}
        <input
          type="text"
          placeholder="Enter your name.."
          value={employeeName}
          onChange={(e) => setEmployeeName(e.target.value)}
          className="w-full max-w-[280px] h-[48px] border-[1.5px] border-gray-500 rounded-full px-5 text-[15px] text-text-primary bg-transparent outline-none focus:border-dreamtea-blue focus:ring-1 focus:ring-dreamtea-blue transition-all placeholder:text-gray-400"
        />

        {/* Status Message Display */}
        {message && (
          <p className={`text-sm text-center -my-4 ${message.includes("Download complete") || message.includes("Fetching") ? "text-green-600" : "text-red-500"}`}>
            {message}
          </p>
        )}

        {/* Download Schedule Button */}
        <button 
          type="button" 
          disabled={isLoading}
          className={`w-full max-w-[280px] h-[48px] text-white text-[16px] font-bold rounded-full transition-all shadow-[0_4px_14px_rgba(139,185,217,0.5)] focus:outline-none mb-2 ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-dreamtea-blue hover:bg-dreamtea-blue-hover'}`}
          onClick={handleDownload}
        >
          {isLoading ? "Downloading..." : "Download Schedule"}
        </button>

      </div>
    </main>
  );
}