import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

export interface TeamMember {
  user_id: string;
  nickname: string;
  avatar: string;
  pronouns?: string;
  subteams?: string;
  member_type: string;
  bio?: string;
  fun_fact?: string;
  favorite_first_thing?: string;
  colleges?: string;
  employers?: string;
}

export function MemberCard({ member }: { member: TeamMember }) {
  const subteams = typeof member.subteams === "string" ? JSON.parse(member.subteams || "[]") : (member.subteams || []);
  const colleges = typeof member.colleges === "string" ? JSON.parse(member.colleges || "[]") : [];

  return (
    <Link to={`/profile/${member.user_id}`} className="group block">
      <div className="hero-card bg-white border border-ares-bronze/10 p-6 text-center transition-all duration-300 group-hover:border-ares-red/30 group-hover:shadow-lg">
        <div className="w-20 h-20 mx-auto mb-4 ares-cut bg-marble border border-ares-bronze/20 overflow-hidden p-2 group-hover:scale-105 transition-transform">
          <img
            src={member.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${member.user_id}`}
            alt=""
            className="w-full h-full object-contain"
          />
        </div>
        <h4 className="text-obsidian font-bold text-base mb-0.5 group-hover:text-ares-red transition-colors">
          {member.nickname || "ARES Member"}
        </h4>
        {member.pronouns && (
          <p className="text-obsidian/40 text-xs mb-2">{member.pronouns}</p>
        )}
        {subteams.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mb-2">
            {(subteams as string[]).slice(0, 3).map((team: string) => (
              <span key={team} className="px-2 py-0.5 bg-ares-red/5 text-ares-red/70 text-[9px] font-bold rounded-full uppercase tracking-wider">
                {team}
              </span>
            ))}
          </div>
        )}
        {member.member_type === "alumni" && colleges.length > 0 && (
          <div className="flex justify-center gap-1.5 mt-2">
            {(colleges as { domain: string }[]).slice(0, 3).map((col: { domain: string }, i: number) => (
              <BrandLogo key={i} domain={col.domain} fallbackIcon={GraduationCap} className="w-5 h-5" />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
