"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../utils/supabase/client";

function UpdatePasswordContent() {
  const supabase = createClient();
  const router = useRouter();
  
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      // Make sure the role is set correctly since they are a staff member
      localStorage.setItem("nexus_role", "staff");
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Failed to update password.");
      setIsLoading(false);
    }
  };

  return (
    <main className="h-screen w-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[var(--shadow-panel)] flex flex-col items-center p-8 relative z-10">
        
        <div className="flex flex-row items-center w-full justify-center mb-6">
          <img src="/dreamtealogo.svg" alt="Dream Tea Logo" className="object-contain w-8 h-8 mr-2" />
          <h1 className="font-bold text-lg text-text-primary">Dream Tea Nexus</h1>
        </div>

        <div className="w-full flex flex-col items-center">
          <h1 className="font-bold text-[28px] text-text-primary text-center">Set New Password</h1>
          <h2 className="font-medium text-sm text-text-secondary mt-2 mb-6 text-center">Enter a new password for your account</h2>

          <form onSubmit={handleUpdatePassword} className="w-full flex flex-col items-center gap-4">
            
            <div className="input-nexus-group">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New Password"
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

            <button 
              type="submit" 
              disabled={isLoading} 
              className="btn-nexus w-full max-w-[280px] disabled:opacity-50 mt-2"
            >
              {isLoading ? "Updating..." : "Update Password"}
            </button>

            {error && (
              <div className="w-full flex items-center justify-center mt-2 transition-all animate-in fade-in duration-300">
                <span className="text-red-500 text-xs font-medium text-center">{error}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

export default function UpdatePassword() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center p-8 bg-dreamtea-light">Loading...</div>}>
      <UpdatePasswordContent />
    </Suspense>
  );
}
