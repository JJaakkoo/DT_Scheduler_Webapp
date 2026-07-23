"use client";

import { useState } from "react";

export default function Dashboard() {
  const [employeeName, setEmployeeName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  // New state to manage the specific type of message being displayed
  const [statusType, setStatusType] = useState<"idle" | "loading" | "success" | "error" | "info">("idle");

  const handleDownload = async () => {
    if (!employeeName.trim()) {
      setMessage("Please enter your name.");
      setStatusType("error");
      return;
    }
    
    setIsLoading(true);
    setMessage("Fetching schedule from Nexus...");
    setStatusType("loading");
    
    try {
      // Smart Routing: Use localhost for local dev, but relative path for Vercel production!
      const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5328' : '';
      const response = await fetch(`${baseUrl}/api/download-schedule?name=${employeeName}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.error || errorData.message || "Failed to find schedule.";
        setMessage(errorMsg);

        // Check if the 404 is simply because the person has no shifts
        if (response.status === 404 && errorMsg.toLowerCase().includes("no shifts")) {
          setStatusType("info"); 
        } else {
          setStatusType("error"); 
        }

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
      setStatusType("success");
    } catch (error) {
      console.error(error);
      setMessage("Error connecting to the backend server.");
      setStatusType("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to dynamically change the text color based on the status
  const getMessageColor = () => {
    switch (statusType) {
      case "loading": return "text-blue-500";
      case "success": return "text-green-600";
      case "info": return "text-orange-500"; // Orange for "No shifts" warning
      case "error": return "text-red-500";   // Red for actual failures
      default: return "text-transparent";
    }
  };

  return (
    <main className="min-h-screen w-screen flex items-center justify-center p-4 sm:p-8 bg-dreamtea-light">
      
      {/* Main Card Container - Adjusted padding for mobile */}
      <div className="w-full max-w-[400px] bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.1)] flex flex-col items-center p-8 sm:p-10 relative z-10">
        
        {/* Dream Tea Logo */}
        <img
          src="/dreamtealogo.svg"
          alt="Dream Tea Logo"
          className="object-contain w-32 h-auto mb-8 sm:mb-10"
        />

        {/* Name Input Field */}
        <input
          type="text"
          placeholder="Enter your name.."
          value={employeeName}
          onChange={(e) => setEmployeeName(e.target.value)}
          className="w-full h-[48px] border-[1.5px] border-gray-300 rounded-full px-5 text-[15px] text-text-primary bg-transparent outline-none focus:border-dreamtea-blue focus:ring-1 focus:ring-dreamtea-blue transition-all placeholder:text-gray-400 mb-6"
        />

        {/* Status Message Display Container - Fixed minimum height to prevent layout shifting */}
        <div className="min-h-[44px] flex items-center justify-center w-full mb-4">
          {message && (
            <p className={`text-sm text-center font-medium px-2 leading-tight ${getMessageColor()}`}>
              {message}
            </p>
          )}
        </div>

        {/* Download Schedule Button */}
        <button 
          type="button" 
          disabled={isLoading}
          className={`w-full h-[48px] text-white text-[16px] font-bold rounded-full transition-all shadow-[0_4px_14px_rgba(139,185,217,0.5)] focus:outline-none ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-dreamtea-blue hover:bg-dreamtea-blue-hover'}`}
          onClick={handleDownload}
        >
          {isLoading ? "Downloading..." : "Download Schedule"}
        </button>

      </div>
    </main>
  );
}