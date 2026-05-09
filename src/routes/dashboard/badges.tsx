import { createFileRoute, useNavigate } from '@tanstack/react-router'
import ContentManager from '../../components/ContentManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/badges')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  if (!permissions.isAdmin) return <div className="text-center py-20">Access Denied</div>
  return <ContentManager mode="badges" />
}

