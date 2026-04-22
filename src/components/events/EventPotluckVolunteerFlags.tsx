interface EventPotluckVolunteerFlagsProps {

  isPotluck: boolean;
  isVolunteer: boolean;
  onChange: (field: "isPotluck" | "isVolunteer", value: boolean) => void;
}

export default function EventPotluckVolunteerFlags({ isPotluck, isVolunteer, onChange }: EventPotluckVolunteerFlagsProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={isPotluck}
            onChange={(e) => onChange('isPotluck', e.target.checked)}
            className="w-5 h-5 rounded border-white/10 bg-obsidian text-ares-red focus:ring-ares-red transition-all cursor-pointer"
          />
          <span className="text-sm font-bold text-white/70 group-hover:text-white transition-colors uppercase tracking-wider">
            Enable Potluck Coordination
          </span>
        </label>
        <p className="text-[10px] text-white/50 font-mono uppercase tracking-tighter ml-7">
          * Allows members to sign up for specific food/drink items.
        </p>
        </div>

        <div className="flex flex-col gap-1">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={isVolunteer}
            onChange={(e) => onChange('isVolunteer', e.target.checked)}
            className="w-5 h-5 rounded border-white/10 bg-obsidian text-ares-red focus:ring-ares-red transition-all cursor-pointer"
          />
          <span className="text-sm font-bold text-white/70 group-hover:text-white transition-colors uppercase tracking-wider">
            Enable Volunteer Roles
          </span>
        </label>
        <p className="text-[10px] text-white/50 font-mono uppercase tracking-tighter ml-7">
          * Allows members to sign up for specific roles (e.g., Setup, Teardown).
        </p>
        </div>
    </div>
  );
}
