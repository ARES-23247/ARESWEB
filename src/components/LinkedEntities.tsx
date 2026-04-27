/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link2, ExternalLink, FileText, CheckCircle, Target, Trophy } from "lucide-react";
import { api } from "../api/client";
import { Link } from "react-router-dom";

interface LinkedEntitiesProps {
  type: 'doc' | 'task' | 'event' | 'post' | 'outreach';
  id: string;
}

const typeIconMap = {
  doc: <FileText size={14} className="text-ares-cyan" />,
  task: <CheckCircle size={14} className="text-ares-red" />,
  event: <Target size={14} className="text-ares-gold" />,
  post: <FileText size={14} className="text-ares-green" />,
  outreach: <Trophy size={14} className="text-ares-gold" />,
};

const typePathMap = {
  doc: '/dashboard/docs/',
  task: '/dashboard/tasks/',
  event: '/events/',
  post: '/blog/',
  outreach: '/dashboard/outreach/',
};

export default function LinkedEntities({ type, id }: LinkedEntitiesProps) {
  const { data: linksRes, isLoading } = api.entities.getLinks.useQuery(["entity-links", type, id], {
    query: { type, id }
  });

  const links = linksRes?.status === 200 ? linksRes.body.links : [];

  if (isLoading) return <div className="h-12 w-full animate-pulse bg-white/5 ares-cut-sm"></div>;
  if (links.length === 0) return null;

  return (
    <div className="mt-6 border-t border-white/5 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={16} className="text-marble/40" />
        <h4 className="text-[10px] font-black uppercase tracking-widest text-marble/60">Knowledge Graph Context</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((link: any) => (
          <Link
            key={link.id}
            to={`${typePathMap[link.target_type as keyof typeof typePathMap]}${link.target_id}`}
            className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/5 hover:border-ares-cyan/30 rounded-full transition-all group"
          >
            {typeIconMap[link.target_type as keyof typeof typeIconMap]}
            <span className="text-[11px] font-bold text-marble/80 group-hover:text-white truncate max-w-[150px]">
              {link.target_title || link.target_id}
            </span>
            <ExternalLink size={10} className="text-marble/20 group-hover:text-ares-cyan transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
