"use client";

import { useState } from "react";

export default function Home() {

  // State for the "Remember me" button
  const [isRemembered, setIsRemembered] = useState(false);

  return (
    <main className="h-screen w-screen flex items-center justify-center bg-dreamtea-light p-8">
      <div className="w-full max-w-5xl h-[540] bg-white rounded-3xl flex-row overflow-hidden shadow-xl">
        <div className="w-full max-w-5xl h-[540] relative overflow-hidden">
          <img
            src="/Background Image.png"
            alt="The inside of Dream Tea"
            className="absolute top-0 right-0 h-full w-max-0.7 object-cover"
          />

          {/* Log In Page Container */}
          <div className="relative z-10 max-w-[448] h-[540] bg-dreamtea-white rounded-3xl flex flex-col items-center shrink-0 p-8">
            
            {/* Logo and Title Container */}
            <div className="flex flex-row items-center mb-6">
              <img
                src="/dreamtealogo.svg"
                alt="Dream Tea Logo"
                className="object-contain"
              />
              <h1 className="font-inter font-bold text-[16px] text-left text-text-primary p-1">
                Dream Tea Nexus
              </h1>
            </div>

            {/* Welcome Back Container */}
            <h1 className="font-inter font-bold text-[40px] text-text-primary p-8">
              Welcome Back
            </h1>

            {/* Nexus Portal Login */}
            <h1 className="font-inter font-bold text-[16px] text-text-primary p-2">
              Nexus Portal Login
            </h1>

            {/* Login Items Container*/}
            <div className="border-2 w-full flex flex-col items-center justify-center m-[30] gap-3">

              {/* User Name Container */}
              <div className="border-2 w-[240] h-[54] flex items-center justify-center rounded-3xl">

              </div>

              {/* Password Container */}
              <div className="border-2 w-[240] h-[54] flex items-center justify-center rounded-3xl">

              </div>

              {/* Log In Button & Remember Me Container */}
              <div className="border-2 w-[240] h-[42] flex items-center p-[2]">
                
                {/* Remember me button */}
                <button 
                  type="button"
                  onClick={() => setIsRemembered(!isRemembered)}
                  className="w-4 h-4 rounded-full flex items-center justify-center transition-all focus:outline-none border-[2] border-[#8C8C8D] bg-transparent hover:bg-gray-100">
                
                  {isRemembered && (
                    <div className="w-2 h-2 rounded-full bg-black" />
                  )}
                </button>

                {/* Optional text label next to the button inside the flex row */}
                <span className="text-xs ml-1 text-gray-700 select-none">
                  Remember me
                </span>

              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );

}``