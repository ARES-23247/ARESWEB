interface EventPotluckVolunteerFlagsProps {

  isPotluck: boolean;
  isVolunteer: boolean;
  onChange: (field: "isPotluck" | "isVolunteer", value: boolean) => void;
}

export default function EventPotluckVolunteerFlags({ isPotluck, isVolunteer, onChange }: EventPotluckVolunteerFlagsProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={isPotluck}
            onChange={(e) => onChange("isPotluck", e.target.checked)}
            className="w-5 h-5 rounded border-zinc-700 bg-zinc-950 text-ares-red focus:ring-ares-red transition-all cursor-pointer"
          />
          <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors uppercase tracking-wider">
            Potluck Event
          </span>
        </label>
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-tighter ml-7">
          Enable food sign-up sheet and dietary tracking.
        </p>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={isVolunteer}
            onChange={(e) => onChange("isVolunteer", e.target.checked)}
            className="w-5 h-5 rounded border-zinc-700 bg-zinc-950 text-ares-red focus:ring-ares-red transition-all cursor-pointer"
          />
          <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors uppercase tracking-wider">
            Volunteer Opportunity
          </span>
        </label>
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-tighter ml-7">
          Automatically tracks prep and check-in hours for outreach.
        </p>
      </div>
    </div>
  );
}
