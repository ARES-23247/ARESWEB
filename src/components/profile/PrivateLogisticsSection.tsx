import { Shield } from "lucide-react";
import { ProfileSubComponentProps } from "./types";

export function PrivateLogisticsSection({ profile, setProfile, inputClass, labelClass, sectionClass }: ProfileSubComponentProps) {
  return (
    <div className={sectionClass}>
      <div className="flex items-center gap-2 mb-2 text-sm font-black uppercase tracking-wider text-ares-red">
        <Shield size={16} /> Team Logistics (Private)
      </div>
      <p className="text-xs text-ares-gray mb-4">
        This information is strictly for event organization and travel. It will NEVER be shown publicly.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <label htmlFor="pe-tshirt" className={labelClass}>T-Shirt Size</label>
          <select 
            id="pe-tshirt" 
            className={inputClass} 
            value={profile.tshirt_size} 
            onChange={e => setProfile({...profile, tshirt_size: e.target.value})}
          >
            <option value="" disabled>Select Size...</option>
            <option value="Youth Medium">Youth Medium</option>
            <option value="Youth Large">Youth Large</option>
            <option value="Adult Small">Adult Small</option>
            <option value="Adult Medium">Adult Medium</option>
            <option value="Adult Large">Adult Large</option>
            <option value="Adult XL">Adult XL</option>
            <option value="Adult 2XL">Adult 2XL</option>
            <option value="Adult 3XL">Adult 3XL</option>
          </select>
        </div>
        <div className="md:col-span-1">
          <label htmlFor="pe-ec-name" className={labelClass}>Emergency Contact Name</label>
          <input 
            id="pe-ec-name" 
            className={inputClass} 
            placeholder="Parent/Guardian Name" 
            value={profile.emergency_contact_name} 
            onChange={e => setProfile({...profile, emergency_contact_name: e.target.value})} 
          />
        </div>
        <div className="md:col-span-1">
          <label htmlFor="pe-ec-phone" className={labelClass}>Emergency Contact Phone</label>
          <input 
            id="pe-ec-phone" 
            className={inputClass} 
            placeholder="(304) 555-1234" 
            value={profile.emergency_contact_phone} 
            onChange={e => setProfile({...profile, emergency_contact_phone: e.target.value})} 
          />
        </div>
      </div>
    </div>
  );
}
