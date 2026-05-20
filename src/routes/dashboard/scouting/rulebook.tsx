import { createFileRoute } from '@tanstack/react-router'
import RulebookChat from '../../../components/tools/RulebookChat'
import { useDashboardSession } from '../../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/scouting/rulebook')({
  component: RouteComponent,
})

function RouteComponent() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, permissions } = useDashboardSession()

  return (
    <div className="py-8 px-4 flex flex-col items-center gap-6 min-h-[85vh]">
      <div className="w-full max-w-4xl flex items-center gap-4 border-b border-white/5 pb-4">
        <div className="w-10 h-10 ares-cut bg-ares-red/10 border border-ares-red/30 flex items-center justify-center">
          <BookOpen className="text-ares-red" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase text-white tracking-tight">FTC Rulebook Chat</h1>
          <p className="text-[10px] text-marble/50 font-bold uppercase tracking-wider">AI Game Manual Assistant</p>
        </div>
      </div>
      <RulebookChat />
    </div>
  )
}

// Inline standard imports needed
import { BookOpen } from 'lucide-react'
