"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../utils/supabase/client";

function HomeContent() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRemembered, setIsRemembered] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'not-whitelisted') {
      setLoginError("This Google account is not authorized to access the portal.");
    } else if (errorParam === 'auth-failed') {
      setLoginError("Google Sign-In failed or was cancelled.");
    }
  }, [searchParams]);

  // Fix BFCache stuck loading state when user hits the back button during Google Auth
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setIsLoading(false);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // --- STAFF EMAIL/PASS LOGIN HANDLER ---
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setSuccessMessage("");
    
    if (!email || !password) {
      setLoginError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);

    try {
      // THE REAL SUPABASE LOGIN!
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        throw error;
      }
      
      // They logged in manually, so clear any old Google tokens to prevent expired token errors
      localStorage.removeItem("google_access_token"); 
      localStorage.setItem("nexus_role", "staff");
      
      router.push("/dashboard");
    } catch (err: any) {
      let msg = err?.message || err?.error_description || err?.msg || "Invalid email or password.";
      if (typeof msg === 'object') {
        msg = msg.message || JSON.stringify(msg);
      }
      if (msg === '{}' || msg === '"{}"') {
        msg = "Invalid email or password.";
      }
      setLoginError(String(msg));
    } finally {
      setIsLoading(false);
    }
  };

  // --- STAFF SIGN UP HANDLER ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setSuccessMessage("");
    
    if (!email || !password) {
      setLoginError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);

    try {
      // Check whitelist first
      const { data: whitelistData, error: whitelistError } = await supabase
        .from('whitelisted_emails')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (whitelistError || !whitelistData) {
        throw new Error("Email is not whitelisted. Please contact Jako to get whitelisted.");
      }

      // Proceed with signup
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (error) {
        if (error.code === 'user_already_exists' || error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
          throw new Error("Account already exists.");
        }
        throw error;
      }
      
      // Bypass Supabase email enumeration protection:
      // If a user already exists and tries to sign up again, Supabase returns success but with an empty identities array.
      if (data?.user?.identities && data.user.identities.length === 0) {
        throw new Error("Account already exists. Please log in.");
      }
      
      setSuccessMessage("Sign up successful! Please check your email to confirm your account.");

    } catch (err: any) {
      let msg = err?.message || err?.error_description || err?.msg || "An error occurred during sign up.";
      if (typeof msg === 'object') {
        msg = msg.message || JSON.stringify(msg);
      }
      if (msg === '{}' || msg === '"{}"') {
        if (err?.name === 'AuthRetryableFetchError' || err?.status === 500) {
          msg = "Email sending failed. Please check Supabase SMTP limits or disable email confirmations.";
        } else {
          msg = "An error occurred during sign up.";
        }
      }
      setLoginError(String(msg));
    } finally {
      setIsLoading(false);
    }
  };


  // --- FORGOT PASSWORD HANDLER ---
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setSuccessMessage("");
    
    if (!email) {
      setLoginError("Please enter your email address.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      });

      if (error) throw error;
      
      setSuccessMessage("Password reset link sent! Please check your email.");
    } catch (err: any) {
      setLoginError(err?.message || "Failed to send reset link.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- GOOGLE LOGIN TRIGGER ---
  const handleGoogleLogin = async () => {
    setLoginError("");
    setSuccessMessage("");
    setIsLoading(true);
    
    try {
      localStorage.setItem("nexus_role", "staff");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'https://www.googleapis.com/auth/gmail.readonly',
        },
      });

      if (error) throw error;
    } catch (err: any) {
      let msg = err?.message || err?.error_description || err?.msg || "Google Sign-In failed.";
      if (typeof msg === 'object') {
        msg = msg.message || JSON.stringify(msg);
      }
      if (msg === '{}' || msg === '"{}"') {
        msg = "Google Sign-In failed.";
      }
      setLoginError(String(msg));
      setIsLoading(false);
    }
  };

  // --- GUEST LOGIN HANDLER ---
  const handleGuestLogin = () => {
    localStorage.removeItem("google_access_token"); 
    localStorage.setItem("nexus_role", "guest");
    document.cookie = "nexus_role=guest; path=/; max-age=86400";
    router.push("/dashboard");
  };

  return (
    <main className="h-screen w-screen flex items-center justify-center p-8">
      
      <div className="w-full max-w-5xl h-[600px] rounded-3xl flex overflow-hidden shadow-xl relative bg-white">
        
        <img
          src="/Background Image.png"
          alt="The inside of Dream Tea"
          className="absolute top-0 right-0 bottom-0 w-[calc(100%-300px)] h-full object-cover z-0 hidden md:block"
        />

        <div className="w-full md:max-w-[448px] h-full bg-white md:rounded-3xl shadow-[var(--shadow-panel)] flex flex-col items-center justify-center p-6 sm:p-8 shrink-0 relative z-10">
          
          <div className="flex flex-row items-center w-full justify-center mb-6">
            <img src="/dreamtealogo.svg" alt="Dream Tea Logo" className="object-contain w-8 h-8 mr-2" />
            <h1 className="font-bold text-lg text-text-primary">Dream Tea Nexus</h1>
          </div>

          <div key={isForgotPassword ? 'forgot' : isSignUp ? 'signup' : 'login'} className="w-full flex flex-col items-center transition-all duration-500 ease-in-out opacity-100 starting:opacity-0">
            <h1 className="font-bold text-[36px] text-text-primary">{isForgotPassword ? "Reset Password" : isSignUp ? "Create Account" : "Welcome Back"}</h1>
            <h2 className="font-bold text-[14px] text-text-secondary mt-2 mb-6">{isForgotPassword ? "Enter your email to receive a reset link" : isSignUp ? "Nexus Portal Registration" : "Nexus Portal Login"}</h2>

          <form onSubmit={isForgotPassword ? handleForgotPassword : isSignUp ? handleSignUp : handleStaffLogin} className="w-full flex flex-col items-center gap-4">

            <input
              type="text"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-nexus"
            />

            {!isForgotPassword && (
              <div className="input-nexus-group">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-text-tertiary hover:text-text-secondary focus:outline-none transition-colors"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  )}
                </button>
              </div>
            )}

            <div className={`w-full max-w-[280px] flex items-center mt-2 ${!isForgotPassword ? 'justify-between' : 'justify-center'}`}>
              {!isForgotPassword && (
                <div className="flex items-center cursor-pointer group" onClick={() => setIsRemembered(!isRemembered)}>
                  <button type="button" className="w-4 h-4 rounded-full flex items-center justify-center transition-all focus:outline-none border-[1.5px] border-gray-500 bg-transparent group-hover:border-dreamtea-blue">
                    {isRemembered && <div className="w-2 h-2 rounded-full bg-text-secondary" />}
                  </button>
                  <span className="text-xs ml-2 text-text-secondary select-none font-medium">Remember me</span>
                </div>
              )}
              <button type="submit" disabled={isLoading} className="btn-nexus disabled:opacity-50">
                {isLoading ? "Wait..." : (isForgotPassword ? "Send Link" : isSignUp ? "Sign Up" : "Log In")}
              </button>
            </div>

            {!isForgotPassword && !isSignUp && (
              <div className="w-full max-w-[280px] flex justify-center mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setLoginError("");
                    setSuccessMessage("");
                  }}
                  className="text-xs text-text-secondary font-medium hover:text-dreamtea-blue transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {(loginError || successMessage) && (
              <div className="w-full max-w-[280px] flex items-center justify-center mt-2 transition-all animate-in fade-in duration-300">
                {loginError && <span className="text-red-500 text-xs font-medium text-center">{loginError}</span>}
                {successMessage && <span className="text-emerald-500 text-xs font-medium text-center">{successMessage}</span>}
              </div>
            )}
          </form>

          <div className="w-full flex flex-col items-center mt-4">
            
            {!isSignUp && !isForgotPassword && (
              <>
                <div className="w-full max-w-[280px] flex items-center gap-3 mb-4">
                  <div className="divider-nexus"></div>
                  <span className="text-[11px] text-text-secondary font-bold uppercase tracking-wider">or</span>
                  <div className="divider-nexus"></div>
                </div>

                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full max-w-[280px] h-[48px] bg-white border border-gray-300 text-gray-700 font-medium text-[14px] rounded-full hover:bg-gray-50 hover:shadow-sm transition-all flex items-center justify-center gap-3 mb-3"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Sign in with Google
                </button>

                <button 
                  type="button"
                  onClick={handleGuestLogin}
                  className="w-full max-w-[280px] h-[48px] bg-white border-2 border-gray-200 text-gray-600 font-bold text-[14px] rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-dreamtea-blue">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                  Continue as Guest
                </button>
              </>
            )}

            <div className="text-xs text-text-secondary mt-1 font-medium">
              {isForgotPassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setLoginError("");
                    setSuccessMessage("");
                  }}
                  className="text-dreamtea-blue font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                >
                  Back to Log In
                </button>
              ) : isSignUp ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false);
                      setLoginError("");
                      setSuccessMessage("");
                    }}
                    className="text-dreamtea-blue font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                  >
                    Log In
                  </button>
                </>
              ) : (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(true);
                      setLoginError("");
                      setSuccessMessage("");
                    }}
                    className="text-dreamtea-blue font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>

          </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center p-8 bg-dreamtea-light">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}