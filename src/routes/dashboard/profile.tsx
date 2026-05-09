import { createFileRoute, useNavigate } from '@tanstack/react-router'
import ProfileEditor from '../../components/ProfileEditor'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/profile')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  return <ProfileEditor  />
}

