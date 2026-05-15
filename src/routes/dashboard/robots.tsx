import { createFileRoute } from '@tanstack/react-router'
import RobotsManager from '../../components/RobotsManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/robots')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session: _session, permissions: _permissions } = useDashboardSession()
  return <RobotsManager />
}
