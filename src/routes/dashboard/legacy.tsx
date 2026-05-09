import { createFileRoute, useNavigate } from '@tanstack/react-router'
import AwardEditor from '../../components/AwardEditor'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/legacy')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  return <AwardEditor  />
}

