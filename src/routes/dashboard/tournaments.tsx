import { createFileRoute } from '@tanstack/react-router'
import TournamentsManager from '../../components/TournamentsManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/tournaments')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()
  return <TournamentsManager />
}
