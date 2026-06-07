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
      <div className="hero-card bg-white/5 border border-white/10 p-6 text-center transition-all duration-300 group-hover:border-ares-red/30 group-hover:shadow-lg backdrop-blur-sm h-full flex flex-col">
        <div className="w-20 h-20 mx-auto mb-4 ares-cut bg-white/10 border border-white/10 overflow-hidden p-2 group-hover:scale-105 transition-transform shrink-0">
          <img
            src={member.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${member.userId}`}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain"
          />
        </div>
        <h4 className="text-white font-bold text-base mb-0.5 group-hover:text-ares-red transition-colors">
          {member.nickname || (member.memberType === "student" ? "ARES Member" : (member.name || "ARES Member"))}
        </h4>
        {member.pronouns && (
          <p className="text-marble/60 text-xs mb-2">{member.pronouns}</p>
        )}
        
        <div className="mt-auto pt-2 flex flex-col gap-2">
          {subteams.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center">
              {(subteams as string[]).slice(0, 3).map((team: string) => (
                <span key={team} className="px-2 py-0.5 bg-ares-red/20 text-ares-red-light text-[9px] font-bold ares-cut-sm uppercase tracking-wider">
                  {team}
                </span>
              ))}
            </div>
          )}
          {member.memberType === "alumni" && colleges.length > 0 && (
            <div className="flex justify-center gap-1.5">
              {(colleges as { domain: string }[]).slice(0, 3).map((col: { domain: string }, i: number) => (
                <BrandLogo key={i} domain={col.domain} fallbackIcon={GraduationCap} className="w-5 h-5" />
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}


