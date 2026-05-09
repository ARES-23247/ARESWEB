import { createFileRoute, useNavigate } from '@tanstack/react-router'
import MassEmailComposer from '../../components/MassEmailComposer'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/mass_email')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  if (!permissions.isAdmin) return <div className="text-center py-20">Access Denied</div>
  return <MassEmailComposer  />
}

