import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function AddStaffModal({ isOpen, onClose, onSuccess }: AddStaffModalProps) {
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addSName, setAddSName] = useState('');
  const [addMainLocation, setAddMainLocation] = useState('Strathcona');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const router = useRouter();

  if (!isOpen) return null;

  const handleAddStaff = async () => {
    if (!addName || !addEmail || !addSName) return alert("Please fill out all fields.");
    setIsAddingStaff(true);
    
    const { addStaffRecord } = await import('@/app/actions/management');
    const { success, error } = await addStaffRecord({
      name: addName,
      temp_email: addEmail,
      s_name: addSName,
      role: 'unclaimed',
      main_location: addMainLocation || null
    });
    
    if (error) {
      console.error(error);
      alert("Error adding staff: " + error);
    } else {
      setAddName('');
      setAddEmail('');
      setAddSName('');
      setAddMainLocation('Strathcona');
      onSuccess("Successfully Added!");
      router.refresh();
    }
    setIsAddingStaff(false);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Add New Staff</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
         </div>
         <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
              <input type="text" placeholder="John Doe" value={addName} onChange={e => setAddName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#8ab4f8]/30 focus:border-[#8ab4f8] transition-all placeholder:text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Temp Email</label>
              <input type="email" placeholder="john.doe@dreamtea.local" value={addEmail} onChange={e => setAddEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#8ab4f8]/30 focus:border-[#8ab4f8] transition-all placeholder:text-gray-400" />
              <p className="text-[11px] text-gray-400 mt-1 ml-1">They will use this to claim their account</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">S Name (Schedule Match)</label>
              <input type="text" placeholder="John" value={addSName} onChange={e => setAddSName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#8ab4f8]/30 focus:border-[#8ab4f8] transition-all placeholder:text-gray-400" />
              <p className="text-[11px] text-gray-400 mt-1 ml-1">Exact name as it appears in the raw schedule</p>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Main Location</label>
                <select value={addMainLocation} onChange={e => setAddMainLocation(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#8ab4f8]/30 focus:border-[#8ab4f8] transition-all">
                  <option value="">None</option>
                  <option value="Strathcona">Strathcona</option>
                  <option value="Downtown">Downtown</option>
                  <option value="Heritage">Heritage</option>
                </select>
              </div>
            </div>
            <button onClick={handleAddStaff} disabled={isAddingStaff} className="w-full bg-[#8ab4f8] text-white font-bold py-3.5 rounded-xl shadow-sm hover:opacity-90 hover:shadow transition-all disabled:opacity-50 mt-2">
              {isAddingStaff ? "Adding..." : "Add Staff"}
            </button>
         </div>
      </div>
    </div>
  );
}
