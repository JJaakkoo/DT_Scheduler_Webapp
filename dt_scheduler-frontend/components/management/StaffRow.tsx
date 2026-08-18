import React, { useState } from "react";

export function StaffRow({ staff, onSave, onViewAvailability }: { staff: any, onSave: () => void, onViewAvailability?: (name: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [name, setName] = useState(staff.name || '');
  const [tempEmail, setTempEmail] = useState(staff.temp_email || '');
  const [sName, setSName] = useState(staff.s_name || '');
  const [role, setRole] = useState(staff.role || '');

  const handleDelete = async () => {
    setIsDeleting(true);
    const { deleteStaffRecord } = await import('@/app/actions/management');
    const { success, error } = await deleteStaffRecord(staff.id);
    
    setIsDeleting(false);
    if (success) {
      setIsDeleteDialogOpen(false);
      onSave(); // Refresh table
    } else {
      alert("Failed to delete: " + error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { updateStaffRecord } = await import('@/app/actions/management');
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

  const handleUnlink = async () => {
    if (!confirm("Are you sure you want to unlink this account? This process cannot be undone.")) return;
    setIsUnlinking(true);
    const { unlinkStaffAccount } = await import('@/app/actions/management');
    const { success, error } = await unlinkStaffAccount(staff.id);
    
    setIsUnlinking(false);
    if (success) {
      setIsEditing(false);
      onSave();
    } else {
      alert("Failed to unlink: " + error);
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
      <td className="px-3 py-3">
        {isEditing ? (
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full max-w-[120px] p-1 border rounded text-[13px] focus:ring-1 focus:ring-black outline-none" />
        ) : (
          <div className="font-medium text-gray-900 max-w-[120px] truncate" title={staff.name}>{staff.name || '-'}</div>
        )}
      </td>
      <td className="px-3 py-3">
        {isEditing ? (
          <input type="text" value={tempEmail} onChange={e => setTempEmail(e.target.value)} className="w-full max-w-[120px] p-1 border rounded text-[13px] focus:ring-1 focus:ring-black outline-none" />
        ) : (
          <div 
            className="text-gray-500 max-w-[120px] truncate cursor-pointer hover:text-sky-500 hover:underline transition-all" 
            title={staff.temp_email ? "Click to copy" : ""}
            onClick={() => staff.temp_email && navigator.clipboard.writeText(staff.temp_email)}
          >
            {staff.temp_email || '-'}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-gray-500">
        <div 
          className="max-w-[120px] truncate cursor-pointer hover:text-sky-500 hover:underline transition-all" 
          title={staff.email ? "Click to copy" : ""}
          onClick={() => staff.email && navigator.clipboard.writeText(staff.email)}
        >
          {staff.email || '-'}
        </div>
      </td>
      <td className="px-3 py-3">
        {isEditing ? (
          <input type="text" value={sName} onChange={e => setSName(e.target.value)} className="w-full max-w-[90px] p-1 border rounded text-[13px] focus:ring-1 focus:ring-black outline-none" />
        ) : (
          <div className="max-w-[90px] truncate" title={staff.s_name}>{staff.s_name || '-'}</div>
        )}
      </td>
      <td className="px-3 py-3">
        {isEditing ? (
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full min-w-[110px] p-1 border rounded text-[13px] focus:ring-1 focus:ring-black outline-none bg-white">
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="assistant supervisor">Assistant Supervisor</option>
            <option value="staff">Staff</option>
            <option value="unclaimed">Unclaimed</option>
          </select>
        ) : (
          <span className="capitalize">{staff.role || '-'}</span>
        )}
      </td>
      <td className="px-3 py-3 text-gray-500 text-xs">
        {formatDate(staff.created_at)}
      </td>
      <td className="px-3 py-3">
        <span 
          onClick={() => { if (staff.isClickable && onViewAvailability) onViewAvailability(staff.name); }}
          className={`text-[13px] font-medium whitespace-nowrap ${staff.statusColor} ${staff.isClickable ? 'cursor-pointer hover:underline' : ''}`}
        >
           {staff.statusText}
        </span>
      </td>
      <td className="px-3 py-3 text-right w-[140px]">
        {isEditing ? (
          <div className="flex items-center justify-end gap-2">
            {staff.staff_id && (
              <button onClick={handleUnlink} disabled={isSaving || isUnlinking} className="text-orange-400 hover:text-orange-500 text-xs font-medium disabled:opacity-50 whitespace-nowrap cursor-pointer disabled:cursor-default">
                {isUnlinking ? 'Unlinking...' : 'Unlink'}
              </button>
            )}
            <button onClick={handleSave} disabled={isSaving || isUnlinking} className="text-teal-500 hover:text-teal-600 text-xs font-medium disabled:opacity-50 whitespace-nowrap cursor-pointer disabled:cursor-default">
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={handleCancel} disabled={isSaving} className="text-gray-400 hover:text-gray-600 text-xs font-medium whitespace-nowrap cursor-pointer disabled:cursor-default">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => setIsEditing(true)} className="text-[#8ab4f8] hover:text-sky-400 text-xs font-medium whitespace-nowrap cursor-pointer">
              Edit
            </button>
            <button onClick={() => setIsDeleteDialogOpen(true)} className="text-rose-400 hover:text-rose-500 text-xs font-medium whitespace-nowrap cursor-pointer">
              Delete
            </button>
          </div>
        )}

        {isDeleteDialogOpen && (
          <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl relative animate-in fade-in zoom-in duration-200 whitespace-normal">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Delete Staff Member?</h2>
              <p className="text-gray-500 mb-6 text-sm">Are you sure you want to delete <span className="font-bold text-gray-700">{staff.name}</span>? This will permanently erase their data, availability, and schedule mappings. This cannot be undone.</p>
              
              <div className="flex gap-3">
                <button onClick={handleDelete} disabled={isDeleting} className="w-1/3 bg-rose-400 text-white font-bold py-3 rounded-xl hover:bg-rose-500 transition-colors disabled:opacity-50">
                  {isDeleting ? "..." : "Delete"}
                </button>
                <button onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
