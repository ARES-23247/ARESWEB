import { MessageCircle } from "lucide-react";


export default function ZulipBotCommands() {
  return (
    <div className="bg-obsidian/50 border border-white/5 ares-cut p-6">
      <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
        <MessageCircle size={16} className="text-ares-cyan" />
        Zulip Bot Commands
      </h3>
      <p className="text-marble/50 text-xs mb-4">
        @-mention the ARES Bot in any Zulip stream to use these commands:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { cmd: "!tasks", desc: "List open project items" },
          { cmd: "!task <title>", desc: "Create a draft task" },
          { cmd: "!task # done", desc: "Mark task as done" },
          { cmd: "!stats", desc: "Website quick stats" },
          { cmd: "!inquiries", desc: "Pending inquiry count" },
          { cmd: "!events", desc: "Upcoming events" },
          { cmd: "!broadcast", desc: "Broadcast msg to stream" },
          { cmd: "!help", desc: "Show all commands" },
        ].map(item => (
          <div key={item.cmd} className="p-3 bg-white/5 ares-cut-sm border border-white/5">
            <code className="text-ares-cyan text-xs font-bold">{item.cmd}</code>
            <p className="text-marble/50 text-xs mt-1">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
