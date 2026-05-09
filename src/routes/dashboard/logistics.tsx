import { createFileRoute, useNavigate } from '@tanstack/react-router'
import DietarySummary from '../../components/DietarySummary'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/logistics')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  if (!permissions.canSeeLogistics) return <div className="text-center py-20">Access Denied</div>
  return <DietarySummary  />
}

