// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import CommandCenter from '../../components/CommandCenter'
import { useDashboardSession } from '../../hooks/useDashboardSession'
import { useGetStats } from '../../api/analytics'

export const Route = createFileRoute('/dashboard/command_center')({
  component: RouteComponent,
})

function RouteComponent() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, permissions } = useDashboardSession()
  const { data: statsRes } = useGetStats({ staleTime: 1000 * 60 * 5 })
  const stats = {
    posts: statsRes?.posts || 0,
    events: statsRes?.events || 0,
    docs: statsRes?.docs || 0,
    securityBlocks: statsRes?.securityBlocks || 0,
    integrations: statsRes?.integrations || { zulip: false, github: false, discord: false, bluesky: false, slack: false, gcal: false }
  }
  if (!permissions.isAdmin) return <div className="text-center py-20">Access Denied</div>
  return <CommandCenter stats={stats} />
}

