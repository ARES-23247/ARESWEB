import { createFileRoute, useNavigate } from '@tanstack/react-router'
import SeasonEditor from '../../../components/SeasonEditor'
import { useDashboardSession } from '../../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/seasons/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  return <SeasonEditor  />
}

