import { createFileRoute, useNavigate } from '@tanstack/react-router'
import SimulationPlayground from '../../components/SimulationPlayground'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/simulations')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  if (!permissions.canSeeSimulations) return <div className="text-center py-20">Access Denied</div>
  return <SimulationPlayground  />
}

