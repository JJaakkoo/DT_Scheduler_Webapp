"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../utils/supabase/client";

export default function ManagementPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Auth Check
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        router.push("/");
        return;
      }
      setEmail(data.session.user.email || null);
      
      const currentRole = localStorage.getItem("nexus_role");
      if (!currentRole) {
        router.push("/");
        return;
      }
      setRole(currentRole);
    };
    
    checkAuth();
  }, [router, supabase.auth]);

  const handleLogOut = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    localStorage.removeItem("nexus_role");
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("nexus_login_time");
    document.cookie = "nexus_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/");
    router.refresh();
  };

  const [staffData, setStaffData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    const { getStaffTableData } = await import('../actions/management');
    const { staff, error } = await getStaffTableData();
    if (staff) {
      setStaffData(staff);
    } else {
      console.error(error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchData();
    }
  }, [role]);

  if (!role) return null;

  return (
    <main className="min-h-[100dvh] w-screen flex flex-col bg-[#c2e2f5] font-sans overflow-x-hidden overflow-y-auto relative">
      {role !== 'admin' && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">You need administrator privileges to view this page.</p>
            <div className="flex flex-col gap-3">
              <Link href="/dashboard" className="w-full bg-[#8ab4f8] text-white hover:opacity-90 py-3 rounded-xl font-bold transition-all shadow-sm">
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
      
      {/* HEADER */}
      <div className="w-full bg-white/90 backdrop-blur-md shadow-sm z-50 px-4 py-3 sm:px-8 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between flex-row-reverse sm:flex-row sm:justify-start">
          <div className="relative">
            <button onClick={() => setIsNavOpen(!isNavOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-gray-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            {isNavOpen && (
              <div className="absolute top-full right-0 sm:right-auto sm:left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                 <Link href="/dashboard" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
                    Dashboard
                 </Link>
                 <Link href="/availability" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>
                    My Availability
                 </Link>
                 <Link href="/privacy-policy" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                    Privacy Policy
                 </Link>
                 <Link href="/terms-of-service" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-50 mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                    Terms of Service
                 </Link>
                 <button onClick={handleLogOut} disabled={isLoggingOut} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
                    {isLoggingOut ? "Logging out..." : "Log Out"}
                 </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
             {role === 'guest' ? (
               <div className="text-gray-700 font-medium text-sm flex items-center gap-2 sm:gap-3">
                 <span className="truncate max-w-[180px] sm:max-w-[250px] lg:max-w-none">Guest Log In</span>
               </div>
             ) : email ? (
               <div className="text-gray-700 font-medium text-sm flex items-center gap-2 sm:gap-3">
                 <span className="truncate max-w-[180px] sm:max-w-[250px] lg:max-w-none">{email}</span>
                 {role === 'admin' && (
                   <div className="font-medium text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1 sm:gap-2 bg-purple-100/80 text-purple-700">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                     </svg>
                     Admin
                   </div>
                 )}
               </div>
             ) : null}
             <div className="text-gray-600 font-medium text-sm bg-gray-100/80 px-3 py-1.5 rounded-full hidden sm:flex items-center gap-2">
               Management
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col items-center py-6 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 flex flex-col relative overflow-hidden transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
          </div>
          
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-gray-600 border-collapse">
              <thead className="bg-gray-50 text-gray-700 text-xs uppercase border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Temp Email</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">S Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Created At</th>
                  <th className="px-4 py-3 font-medium">Availability</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffData.map(staff => (
                  <StaffRow key={staff.id} staff={staff} onSave={fetchData} />
                ))}
                {staffData.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No staff records found.
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Loading staff data...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function StaffRow({ staff, onSave }: { staff: any, onSave: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState(staff.name || '');
  const [tempEmail, setTempEmail] = useState(staff.temp_email || '');
  const [sName, setSName] = useState(staff.s_name || '');
  const [role, setRole] = useState(staff.role || '');

  const handleSave = async () => {
    setIsSaving(true);
    const { updateStaffRecord } = await import('../actions/management');
    const { success, error } = await updateStaffRecord(staff.id, {
      name,
      temp_email: tempEmail,
      s_name: sName,
      role
    });
    
    setIsSaving(false);
    if (success) {
      setIsEditing(false);
      onSave();
    } else {
      alert("Failed to save: " + error);
    }
  };

  const handleCancel = () => {
    setName(staff.name || '');
    setTempEmail(staff.temp_email || '');
    setSName(staff.s_name || '');
    setRole(staff.role || '');
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        {isEditing ? (
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-1 border rounded text-sm focus:ring-1 focus:ring-black outline-none" />
        ) : (
          <span className="font-medium text-gray-900">{staff.name || '-'}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <input type="text" value={tempEmail} onChange={e => setTempEmail(e.target.value)} className="w-full p-1 border rounded text-sm focus:ring-1 focus:ring-black outline-none" />
        ) : (
          <span className="text-gray-500">{staff.temp_email || '-'}</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500">
        {staff.email || '-'}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <input type="text" value={sName} onChange={e => setSName(e.target.value)} className="w-full p-1 border rounded text-sm focus:ring-1 focus:ring-black outline-none" />
        ) : (
          <span>{staff.s_name || '-'}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-1 border rounded text-sm focus:ring-1 focus:ring-black outline-none bg-white">
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="assistant supervisor">Assistant Supervisor</option>
            <option value="staff">Staff</option>
            <option value="guest">Guest</option>
            <option value="unclaimed">Unclaimed</option>
          </select>
        ) : (
          <span className="capitalize">{staff.role || '-'}</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {formatDate(staff.created_at)}
      </td>
      <td className="px-4 py-3">
        {(!staff.availabilityRaw || staff.availabilityRaw.length === 0) ? (
           <span className="text-red-500 text-xs font-medium bg-red-50 px-2 py-1 rounded">Availability not Submitted</span>
        ) : staff.hasCurrentAvailability ? (
           <span className="text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded cursor-pointer hover:bg-green-100 transition-colors">check availability</span>
        ) : (
           <span className="text-orange-500 text-xs font-medium bg-orange-50 px-2 py-1 rounded">Past Availability Only</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {isEditing ? (
          <div className="flex items-center justify-end gap-2">
            <button onClick={handleSave} disabled={isSaving} className="text-green-600 hover:text-green-800 text-xs font-medium disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleCancel} disabled={isSaving} className="text-gray-500 hover:text-gray-700 text-xs font-medium">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setIsEditing(true)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}
