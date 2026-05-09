import { createFileRoute, useNavigate } from '@tanstack/react-router'
import OutreachTracker from '../../components/OutreachTracker'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/outreach')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  return <OutreachTracker  />
}

