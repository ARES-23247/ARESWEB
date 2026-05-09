import { createFileRoute, useNavigate } from '@tanstack/react-router'
import MemberImpactOverview from '../../components/MemberImpactOverview'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/impact_roster')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  if (!permissions.isAdmin) return <div className="text-center py-20">Access Denied</div>
  return <MemberImpactOverview  />
}

