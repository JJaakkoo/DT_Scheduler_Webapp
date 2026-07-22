"use client";

import { useState, useEffect } from "react";

export default function Home() {
  // State for the "Remember me" button
  const [isRemembered, setIsRemembered] = useState(false);
  
  // State for the password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // State for the dummy login error
  const [loginError, setLoginError] = useState("");

  // Mount the Google Identity Services script
  useEffect(() => {
    // 1. Define the callback function LOCALLY
    // @ts-ignore - Tell VS Code to bypass strict parameter typing
    function handleGoogleResponse(response) {
      // TODO: Send response.credential to your backend database to verify the user!
    }

    // 2. Wrap initialization in a reusable function
    function initGoogleButton() {
      // @ts-ignore - Tell VS Code to bypass strict window type checking
      const google = window.google;
      if (google) {
        google.accounts.id.initialize({
          // Pull the ID securely from your environment variables!
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse, 
        });

        google.accounts.id.renderButton(
          document.getElementById("googleSignInDiv"),
          { 
            theme: "outline", 
            size: "large", 
            shape: "pill", // Matches your rounded design
            width: 280,
            text: "signin_with" 
          }
        );
      }
    }

    // 3. Singleton Script Loader (Prevents double-loading on Fast Refresh)
    const scriptId = "google-gsi-script";
    const existingScript = document.getElementById(scriptId);

    if (!existingScript) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogleButton;
      document.head.appendChild(script);
    } else {
      // If script is already loaded (like during a Fast Refresh), just re-render the button
      initGoogleButton();
    }
    
    // Notice we removed the cleanup function! 
    // We want to keep the script in the document so we don't redownload it constantly.
  }, []);

  return (
    // Background color and font are now handled globally in globals.css!
    <main className="h-screen w-screen flex items-center justify-center p-8">
      
      {/* Main Container */}
      <div className="w-full max-w-5xl h-[540px] rounded-3xl flex overflow-hidden shadow-xl relative bg-white">
        
        {/* Background Image - Anchored right, tucked exactly 1/3 under the left panel */}
        <img
          src="/Background Image.png"
          alt="The inside of Dream Tea"
          className="absolute top-0 right-0 bottom-0 w-[calc(100%-300px)] h-full object-cover z-0"
        />

        {/* LEFT PANEL: Login Form */}
        <div className="w-full max-w-[448px] h-full bg-white rounded-3xl shadow-[var(--shadow-panel)] flex flex-col items-center justify-center p-6 sm:p-8 shrink-0 relative z-10">
          
          {/* Logo and Title Container */}
          <div className="flex flex-row items-center w-full justify-center mb-6">
            <img
              src="/dreamtealogo.svg"
              alt="Dream Tea Logo"
              className="object-contain w-8 h-8 mr-2"
            />
            <h1 className="font-bold text-lg text-text-primary">
              Dream Tea Nexus
            </h1>
          </div>

          {/* Headers */}
          <h1 className="font-bold text-[36px] text-text-primary">
            Welcome Back
          </h1>
          <h2 className="font-bold text-[14px] text-text-secondary mt-2 mb-8">
            Nexus Portal Login
          </h2>

          {/* Login Items Container */}
          <div className="w-full flex flex-col items-center gap-4">

            {/* Username Container (Using our custom CSS component!) */}
            <input
              type="text"
              placeholder="Username or Email"
              className="input-nexus"
            />

            {/* Password Container (Using our custom CSS component!) */}
            <div className="input-nexus-group">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="w-full bg-transparent text-sm outline-none"
              />
              {/* Eye Icon Toggle */}
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="text-text-tertiary hover:text-text-secondary focus:outline-none transition-colors"
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
              <div className="flex items-center cursor-pointer group" onClick={() => setIsRemembered(!isRemembered)}>
                <button 
                  type="button"
                  className="w-4 h-4 rounded-full flex items-center justify-center transition-all focus:outline-none border-[1.5px] border-gray-500 bg-transparent group-hover:border-dreamtea-blue"
                >
                  {isRemembered && (
                    <div className="w-2 h-2 rounded-full bg-text-secondary" />
                  )}
                </button>
                <span className="text-xs ml-2 text-text-secondary select-none">
                  Remember me
                </span>
              </div>

              {/* Log In Button (Using our custom CSS component!) */}
              <button 
                type="button" 
                className="btn-nexus"
                onClick={() => setLoginError("Your username or password is incorrect.")}
              >
                Log In
              </button>
            </div>

            {/* Error Message Display */}
            {loginError && (
              <span className="text-red-500 text-xs font-medium -mt-2 text-center max-w-[280px]">
                {loginError}
              </span>
            )}

            {/* Forgot Password */}
            <span className="text-[10px] text-text-tertiary cursor-pointer hover:text-text-secondary hover:underline mt-1 transition-colors">
              Forgot Password?
            </span>

            {/* OR Divider (Using our custom CSS component!) */}
            <div className="w-full max-w-[280px] flex items-center gap-3 my-2">
              <div className="divider-nexus"></div>
              <span className="text-xs text-text-secondary font-medium">or</span>
              <div className="divider-nexus"></div>
            </div>

            {}
            {/* The Real Google Sign-In Button Container */}
            <div id="googleSignInDiv" className="w-full max-w-[280px] flex justify-center mt-1 min-h-[44px]"></div>

          </div>
        </div>

      </div>
    </main>
  );
}