import { createFileRoute, useNavigate } from '@tanstack/react-router'
import ContentManager from '../../components/ContentManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'
import { useDashboardNotifications } from '../../hooks/useDashboardNotifications'

export const Route = createFileRoute('/dashboard/manage_event')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()
  const navigate = useNavigate()
  const notifications = useDashboardNotifications(session, permissions)

  return <ContentManager mode="event" pendingCount={notifications.pendingEventsCount} onEditEvent={(id) => navigate({ to: `/dashboard/event/${id}` })} />
}


