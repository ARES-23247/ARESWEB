import { ProfileSubComponentProps } from "./types";

const DIETARY_OPTIONS = ["Gluten-Free", "Kosher", "Halal", "Vegetarian", "Vegan", "Nut-free", "No-pork", "No-Beef"];

export function FunFirstSection({ profile, setProfile, inputClass, labelClass, sectionClass }: ProfileSubComponentProps) {
  const toggleDietary = (item: string) => {
    setProfile(prev => ({
      ...prev,
      dietary_restrictions: prev.dietary_restrictions.includes(item)
        ? prev.dietary_restrictions.filter(t => t !== item)
        : [...prev.dietary_restrictions, item],
    }));
  };

  const getOtherDietary = () => {
    const other = profile.dietary_restrictions.find(t => t.startsWith("Other:"));
    return other ? other.replace("Other:", "").trim() : "";
  };

  const setOtherDietary = (val: string) => {
    setProfile(prev => {
      const filtered = prev.dietary_restrictions.filter(t => !t.startsWith("Other:"));
      if (!val) return { ...prev, dietary_restrictions: filtered };
      return { ...prev, dietary_restrictions: [...filtered, `Other: ${val}`] };
    });
  };

  return (
    <div className={sectionClass}>
      <h3 className="text-sm font-black uppercase tracking-wider text-ares-red">FIRST & Fun</h3>
      <div>
        <label htmlFor="pe-fav-first" className={labelClass}>Favorite thing about FIRST / ARES</label>
        <input 
          id="pe-fav-first" 
          className={inputClass} 
          placeholder="Building robots with friends!" 
          value={profile.favorite_first_thing} 
          onChange={e => setProfile({...profile, favorite_first_thing: e.target.value})} 
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pe-fav-mech" className={labelClass}>Favorite Robot Mechanism</label>
          <input 
            id="pe-fav-mech" 
            className={inputClass} 
            placeholder="e.g. 2022 Turret" 
            value={profile.favorite_robot_mechanism} 
            onChange={e => setProfile({...profile, favorite_robot_mechanism: e.target.value})} 
          />
        </div>
        <div>
          <label htmlFor="pe-superstition" className={labelClass}>Pre-Match Superstition</label>
          <input 
            id="pe-superstition" 
            className={inputClass} 
            placeholder="e.g. Taping the battery 3 times" 
            value={profile.pre_match_superstition} 
            onChange={e => setProfile({...profile, pre_match_superstition: e.target.value})} 
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pe-food" className={labelClass}>Favorite Food</label>
          <input 
            id="pe-food" 
            className={inputClass} 
            placeholder="Pizza, tacos..." 
            value={profile.favorite_food} 
            onChange={e => setProfile({...profile, favorite_food: e.target.value})} 
          />
        </div>
        <div>
          <span className={labelClass}>Dietary Restrictions</span>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {DIETARY_OPTIONS.map(opt => (
              <label key={opt} className="flex items-center gap-2 text-sm text-marble">
                <input 
                  type="checkbox" 
                  checked={profile.dietary_restrictions.includes(opt)} 
                  onChange={() => toggleDietary(opt)} 
                  className="accent-ares-red rounded w-4 h-4" 
                />
                {opt}
              </label>
            ))}
            <div className="col-span-2 mt-1">
              <label className="flex items-center gap-2 text-sm text-marble mb-1">
                <input 
                  type="checkbox" 
                  checked={profile.dietary_restrictions.some(t => t.startsWith("Other:"))} 
                  onChange={(e) => { 
                    if (!e.target.checked) setOtherDietary(""); 
                    else setOtherDietary("Optional Details"); 
                  }} 
                  className="accent-ares-red rounded w-4 h-4" 
                />
                Other
              </label>
              {profile.dietary_restrictions.some(t => t.startsWith("Other:")) && (
                <input 
                  className={`${inputClass} !py-2`} 
                  placeholder="Please specify..." 
                  value={getOtherDietary()} 
                  onChange={e => setOtherDietary(e.target.value)} 
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
