import { createFileRoute, useNavigate } from '@tanstack/react-router'
import EventEditor from '../../../components/EventEditor'
import { useDashboardSession } from '../../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/event/$editId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  return <EventEditor userRole={session?.user?.role} />
}

