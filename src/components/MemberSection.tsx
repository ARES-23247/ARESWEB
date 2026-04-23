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
    <section className={`py-24 ${section.type === "coach" || section.type === "student" ? "bg-white" : section.type === "alumni" ? "bg-obsidian text-marble" : "bg-marble"}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-4xl mb-4 block">{section.icon}</span>
          <h2 className={`text-4xl md:text-5xl font-bold mb-4 font-heading uppercase ${section.type === "alumni" ? "text-white" : "text-obsidian"}`}>
            {section.title}
          </h2>
          <p className={`text-lg max-w-2xl mx-auto ${section.type === "alumni" ? "text-marble/80" : "text-obsidian/70"}`}>
            {section.desc}
          </p>
          <div className="w-24 h-1 bg-ares-red mx-auto mt-6"></div>
        </div>
        <div className={`grid gap-6 ${section.items.length <= 2 ? "grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto" : section.items.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"}`}>
          {section.items.map(member => (
            <MemberCard key={member.user_id} member={member} />
          ))}
        </div>
      </div>
    </section>
  );
}
