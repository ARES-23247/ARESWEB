import { createFileRoute, useNavigate } from '@tanstack/react-router'
import SponsorEditor from '../../components/SponsorEditor'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/sponsors')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  return <SponsorEditor  />
}

