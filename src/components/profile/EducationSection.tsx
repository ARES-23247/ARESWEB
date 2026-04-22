import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { ProfileSubComponentProps, CollegeEntry } from "./types";
import { BrandLogo } from "../BrandLogo";
import { extractDomain } from "../../utils/logoResolvers";

export function EducationSection({ profile, setProfile, inputClass, sectionClass }: ProfileSubComponentProps) {
  const addCollege = () => setProfile(prev => ({ 
    ...prev, 
    colleges: [...prev.colleges, { name: "", domain: "", years: "", degree: "" }] 
  }));

  const removeCollege = (i: number) => setProfile(prev => ({ 
    ...prev, 
    colleges: prev.colleges.filter((_, idx) => idx !== i) 
  }));

  const updateCollege = (i: number, field: keyof CollegeEntry, val: string) => {
    const updated = [...profile.colleges];
    const sanitizedVal = field === "domain" ? extractDomain(val as string) : val;
    updated[i] = { ...updated[i], [field]: sanitizedVal };
    
    // Auto-complete domain for common university names
    if (field === "name" && (val as string).length > 2 && !updated[i].domain) {
      const domain = (val as string).toLowerCase().replace(/\s+/g, "").replace(/university|college|of|the/gi, "");
      updated[i].domain = `${domain}.edu`;
    }
    setProfile(prev => ({ ...prev, colleges: updated }));
  };

  return (
    <div className={sectionClass}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider text-ares-red flex items-center gap-2">
          <GraduationCap size={16} /> Education
        </h3>
        <button 
          onClick={addCollege} 
          className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm text-xs font-bold text-ares-gold"
        >
          <Plus size={14} /> Add College
        </button>
      </div>
      {profile.colleges.map((col, i) => (
        <div key={i} className="flex gap-4 items-start bg-black/30 p-4 ares-cut border border-white/5 group hover:border-ares-gold/30 transition-all mt-4">
          <BrandLogo domain={col.domain} fallbackIcon={GraduationCap} className="w-12 h-12" />
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
               <label htmlFor={`edu-name-${i}`} className="text-[10px] text-marble/50 uppercase font-black ml-1 mb-0.5 block">University / Institution</label>
               <input id={`edu-name-${i}`} className={inputClass} placeholder="University name" value={col.name} onChange={e => updateCollege(i, "name", e.target.value)} />
            </div>
            <div>
               <label htmlFor={`edu-domain-${i}`} className="text-[10px] text-marble/50 uppercase font-black ml-1 mb-0.5 block">Domain (e.g. rice.edu)</label>
               <input id={`edu-domain-${i}`} className={inputClass} placeholder="Domain" value={col.domain} onChange={e => updateCollege(i, "domain", e.target.value)} />
            </div>
            <div>
               <label htmlFor={`edu-degree-${i}`} className="text-[10px] text-marble/50 uppercase font-black ml-1 mb-0.5 block">Degree / Major</label>
               <input id={`edu-degree-${i}`} className={inputClass} placeholder="Degree (BS ME)" value={col.degree} onChange={e => updateCollege(i, "degree", e.target.value)} />
            </div>
            <div>
               <label htmlFor={`edu-years-${i}`} className="text-[10px] text-marble/50 uppercase font-black ml-1 mb-0.5 block">Years attended</label>
               <input id={`edu-years-${i}`} className={inputClass} placeholder="Years (2020-2024)" value={col.years} onChange={e => updateCollege(i, "years", e.target.value)} />
            </div>
          </div>

          <button onClick={() => removeCollege(i)} className="text-ares-red hover:text-white transition-colors p-1 self-center">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
