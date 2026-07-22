"use client";

import { useState } from "react";

export default function Home() {
  // State for the "Remember me" button
  const [isRemembered, setIsRemembered] = useState(false);
  
  // State for the password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  return (
    // Fallback background color added just in case 'bg-dreamtea-light' isn't in your tailwind config yet
    <main className="h-screen w-screen flex items-center justify-center bg-[#B3E5FC] bg-dreamtea-light p-8">
      
      {/* Main Container - Changed to relative for absolute image layering */}
      <div className="w-full max-w-5xl h-[540px] rounded-3xl flex overflow-hidden shadow-xl relative bg-white">
        
        {/* Background Image - Anchored right, tucked exactly 1/3 under the left panel to center the light bulb */}
        <img
          src="/Background Image.png"
          alt="The inside of Dream Tea"
          className="absolute top-0 right-0 bottom-0 w-[calc(100%-300px)] h-full object-cover z-0"
        />

        {/* LEFT PANEL: Login Form */}
        <div className="w-[448px] h-full bg-white rounded-3xl shadow-[4px_0_24px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center p-8 shrink-0 relative z-10">
          
          {/* Logo and Title Container */}
          <div className="flex flex-row items-center w-full justify-center mb-6">
            <img
              src="/dreamtealogo.svg"
              alt="Dream Tea Logo"
              className="object-contain w-8 h-8 mr-2"
            />
            <h1 className="font-inter font-bold text-lg text-gray-800">
              Dream Tea Nexus
            </h1>
          </div>

          {/* Headers */}
          <h1 className="font-inter font-bold text-[36px] text-gray-900">
            Welcome Back
          </h1>
          <h2 className="font-inter font-bold text-[14px] text-gray-700 mt-2 mb-8">
            Nexus Portal Login
          </h2>

          {/* Login Items Container */}
          <div className="w-full flex flex-col items-center gap-4">

            {/* Username Container */}
            <input
              type="text"
              placeholder="Username or Email"
              className="w-full max-w-[280px] h-[48px] border border-gray-500 rounded-full px-5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />

            {/* Password Container */}
            <div className="w-full max-w-[280px] h-[48px] border border-gray-500 rounded-full px-5 flex items-center bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="w-full bg-transparent text-sm outline-none"
              />
              {/* Eye Icon Toggle */}
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                )}
              </button>
            </div>

            {/* Remember Me & Log In Button Row */}
            <div className="w-full max-w-[280px] flex items-center justify-between mt-2">
              
              {/* Remember me toggle */}
              <div className="flex items-center cursor-pointer" onClick={() => setIsRemembered(!isRemembered)}>
                <button 
                  type="button"
                  className="w-4 h-4 rounded-full flex items-center justify-center transition-all focus:outline-none border-[1.5px] border-gray-500 bg-transparent"
                >
                  {isRemembered && (
                    <div className="w-2 h-2 rounded-full bg-gray-600" />
                  )}
                </button>
                <span className="text-xs ml-2 text-gray-500 select-none">
                  Remember me
                </span>
              </div>

              {/* Log In Button */}
              <button type="button" className="bg-[#8BB9D9] hover:bg-[#7aa8c8] text-white text-sm font-semibold py-2 px-8 rounded-full transition-colors shadow-sm">
                Log In
              </button>
            </div>

            {/* Forgot Password */}
            <span className="text-[10px] text-gray-400 cursor-pointer hover:underline mt-1">
              Forgot Password?
            </span>

            {/* OR Divider */}
            <div className="w-full max-w-[280px] flex items-center gap-3 my-2">
              <div className="flex-1 border-t border-gray-400"></div>
              <span className="text-xs text-gray-600 font-medium">or</span>
              <div className="flex-1 border-t border-gray-400"></div>
            </div>

            {/* Temporary Placeholder for Google Button */}
            <div className="w-full max-w-[280px] h-[40px] border border-gray-400 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium text-gray-700">Sign in with Google</span>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}