import { Briefcase, Plus, Trash2 } from "lucide-react";
import { ProfileSubComponentProps, EmployerEntry } from "./types";
import { BrandLogo } from "../BrandLogo";
import { extractDomain } from "../../utils/logoResolvers";

export function CareerSection({ profile, setProfile, inputClass, sectionClass }: ProfileSubComponentProps) {
  const addEmployer = () => setProfile(prev => ({ 
    ...prev, 
    employers: [...prev.employers, { name: "", domain: "", title: "", current: false, years: "" }] 
  }));

  const removeEmployer = (i: number) => setProfile(prev => ({ 
    ...prev, 
    employers: prev.employers.filter((_, idx) => idx !== i) 
  }));

  const updateEmployer = (i: number, field: keyof EmployerEntry, val: string | boolean) => {
    const updated = [...profile.employers];
    const sanitizedVal = field === "domain" ? extractDomain(val as string) : val;
    updated[i] = { ...updated[i], [field]: sanitizedVal } as EmployerEntry;
    setProfile(prev => ({ ...prev, employers: updated }));
  };

  return (
    <div className={sectionClass}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider text-ares-red flex items-center gap-2">
          <Briefcase size={16} /> Career
        </h3>
        <button 
          onClick={addEmployer} 
          className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm text-xs font-bold text-ares-gold"
        >
          <Plus size={14} /> Add Employer
        </button>
      </div>
      {profile.employers.map((emp, i) => (
        <div key={i} className="flex gap-4 items-start bg-black/30 p-4 ares-cut border border-white/5 group hover:border-ares-gold/30 transition-all mt-4">
          <BrandLogo domain={emp.domain} fallbackIcon={Briefcase} className="w-12 h-12" />
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
               <label htmlFor={`career-name-${i}`} className="text-[10px] text-zinc-500 uppercase font-black ml-1 mb-0.5 block">Company Name</label>
               <input id={`career-name-${i}`} className={inputClass} placeholder="Company name" value={emp.name} onChange={e => updateEmployer(i, "name", e.target.value)} />
            </div>
            <div>
               <label htmlFor={`career-domain-${i}`} className="text-[10px] text-zinc-500 uppercase font-black ml-1 mb-0.5 block">Domain (e.g. spacex.com)</label>
               <input id={`career-domain-${i}`} className={inputClass} placeholder="Domain" value={emp.domain} onChange={e => updateEmployer(i, "domain", e.target.value)} />
            </div>
            <div>
               <label htmlFor={`career-title-${i}`} className="text-[10px] text-zinc-500 uppercase font-black ml-1 mb-0.5 block">Job Title</label>
               <input id={`career-title-${i}`} className={inputClass} placeholder="Title" value={emp.title} onChange={e => updateEmployer(i, "title", e.target.value)} />
            </div>
            <div>
               <label htmlFor={`career-years-${i}`} className="text-[10px] text-zinc-500 uppercase font-black ml-1 mb-0.5 block">Years</label>
               <input id={`career-years-${i}`} className={inputClass} placeholder="Years" value={emp.years} onChange={e => updateEmployer(i, "years", e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 self-center">
            <label htmlFor={`pe-emp-current-${i}`} className="text-[9px] text-zinc-500 font-black uppercase">Current</label>
            <input 
              id={`pe-emp-current-${i}`} 
              type="checkbox" 
              checked={emp.current} 
              onChange={e => updateEmployer(i, "current", e.target.checked)} 
              className="accent-ares-red w-4 h-4 rounded" 
            />
          </div>
          <button onClick={() => removeEmployer(i)} className="text-red-500 hover:text-red-400 p-1 self-center">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
