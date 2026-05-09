// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import IntegrationsManager from '../../components/IntegrationsManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/integrations')({
  component: RouteComponent,
})

function RouteComponent() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, permissions } = useDashboardSession()

  if (!permissions.isAdmin) return <div className="text-center py-20">Access Denied</div>
  return <IntegrationsManager  />
}

