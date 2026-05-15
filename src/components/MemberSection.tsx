import { MemberCard, TeamMember } from "./MemberCard";

export interface SectionConfig {
  type: string;
  title: string;
  icon: string;
  desc: string;
  items: TeamMember[];
}

export function MemberSection({ section }: { section: SectionConfig }) {
  return (
    <section className="py-32 bg-obsidian text-marble border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center text-center mb-20">
          <div className="bg-ares-red/10 text-ares-red px-6 py-2 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-8 border border-ares-red/20 shadow-[0_0_15px_rgba(192,0,0,0.1)]">
             Unit Type // {section.type}
          </div>
          <h2 className="text-5xl md:text-7xl font-black mb-6 uppercase tracking-tight text-white leading-none">
            {section.title}
          </h2>
          <p className="text-lg max-w-2xl mx-auto text-marble/40 font-medium leading-relaxed">
            {section.desc}
          </p>
        </div>
        <div className={`grid gap-10 ${section.items.length <= 2 ? "grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto" : section.items.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"}`}>
          {section.items.map(member => (
            <MemberCard key={member.userId} member={member} />
          ))}
        </div>
      </div>
    </section>
  );
}
