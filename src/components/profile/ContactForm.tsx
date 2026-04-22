import { ProfileSubComponentProps } from "./types";

export function ContactForm({ profile, setProfile, isMinor, inputClass, labelClass, sectionClass }: ProfileSubComponentProps) {
  if (isMinor) return null;

  return (
    <div className={sectionClass}>
      <h3 className="text-sm font-black uppercase tracking-wider text-ares-red">Contact (Optional)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pe-phone" className={labelClass}>Phone</label>
          <input id="pe-phone" className={inputClass} placeholder="(304) 555-1234" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
          <label className="flex items-center gap-2 mt-2 text-xs text-ares-gray">
            <input type="checkbox" checked={profile.show_phone} onChange={e => setProfile({...profile, show_phone: e.target.checked})} className="accent-ares-red" />
            Show on public profile
          </label>
        </div>
        <div>
          <label htmlFor="pe-contact-email" className={labelClass}>Contact Email</label>
          <input id="pe-contact-email" className={inputClass} placeholder="Optional. Replaces login email." value={profile.contact_email} onChange={e => setProfile({...profile, contact_email: e.target.value})} />
          <label className="flex items-center gap-2 mt-2 text-xs text-ares-gray">
            <input type="checkbox" checked={profile.show_email} onChange={e => setProfile({...profile, show_email: e.target.checked})} className="accent-ares-red" />
            Show email on public profile
          </label>
        </div>
      </div>
    </div>
  );
}
