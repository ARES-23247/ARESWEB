import { createFileRoute, useNavigate } from '@tanstack/react-router'
import LocationsManager from '../../components/LocationsManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/locations')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  return <LocationsManager  />
}

