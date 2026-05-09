import { createFileRoute, useNavigate } from '@tanstack/react-router'
import PerformanceDashboard from '../../components/dashboard/PerformanceDashboard'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/performance')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  if (!permissions.isAdmin) return <div className="text-center py-20">Access Denied</div>
  return <PerformanceDashboard  />
}

