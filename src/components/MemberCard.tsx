import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

export interface TeamMember {
  userId: string;
  nickname: string;
  name?: string | null;
  avatar: string;
  pronouns?: string | null;
  subteams?: string | string[] | null;
  memberType: string;
  bio?: string | null;
  funFact?: string | null;
  favoriteFirstThing?: string | null;
  colleges?: string | unknown[] | null;
  employers?: string | unknown[] | null;
}

export function MemberCard({ member }: { member: TeamMember }) {
  const subteams = Array.isArray(member.subteams) ? member.subteams : (typeof member.subteams === "string" ? JSON.parse(member.subteams || "[]") : []);
  const colleges = Array.isArray(member.colleges) ? member.colleges : (typeof member.colleges === "string" ? JSON.parse(member.colleges || "[]") : []);

  return (
    <Link to="/profile/$userId" params={{ userId: member.userId }} className="group block h-full">
      <div className="bg-black/40 border border-white/5 p-6 text-center transition-all duration-500 ares-cut-lg hover:border-ares-red/30 hover:shadow-[0_0_30px_rgba(192,0,0,0.1)] backdrop-blur-sm h-full flex flex-col items-center">
        <div className="relative mb-6">
          <div className="absolute -inset-1 bg-gradient-to-tr from-ares-red/20 to-ares-cyan/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="w-24 h-24 mx-auto ares-cut bg-black/60 border border-white/10 overflow-hidden p-2 group-hover:scale-105 transition-transform shrink-0 relative z-10">
            <img
              src={member.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${member.userId}`}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
        
        <h4 className="text-white font-bold text-sm mb-1 group-hover:text-ares-red transition-colors">
          {member.nickname || member.name || "Member"}
        </h4>
        
        {member.pronouns && (
          <p className="text-[10px] font-bold tracking-wider text-marble/60 mb-4 italic">{member.pronouns}</p>
        )}
        
        <div className="mt-auto pt-4 flex flex-col gap-3 w-full">
          {subteams.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {(subteams as string[]).slice(0, 3).map((team: string) => (
                <span key={team} className="px-2 py-0.5 bg-ares-red/10 text-ares-red text-[8px] font-bold ares-cut-sm border border-ares-red/20">
                  {team}
                </span>
              ))}
            </div>
          )}
          {member.memberType === "alumni" && colleges.length > 0 && (
            <div className="flex justify-center gap-2 border-t border-white/5 pt-3">
              {(colleges as { domain: string }[]).slice(0, 3).map((col: { domain: string }, i: number) => (
                <BrandLogo key={i} domain={col.domain} fallbackIcon={GraduationCap} className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}


