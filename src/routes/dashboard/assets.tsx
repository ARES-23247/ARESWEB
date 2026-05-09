import { createFileRoute, useNavigate } from '@tanstack/react-router'
import AssetManager from '../../components/AssetManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/assets')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  return <AssetManager  />
}

