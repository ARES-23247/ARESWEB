import { createFileRoute, useNavigate } from '@tanstack/react-router'
import SponsorTokensManager from '../../components/SponsorTokensManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/sponsor_tokens')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  if (!permissions.isAdmin) return <div className="text-center py-20">Access Denied</div>
  return <SponsorTokensManager  />
}

