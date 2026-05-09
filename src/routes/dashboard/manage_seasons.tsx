import { createFileRoute, useNavigate } from '@tanstack/react-router'
import ContentManager from '../../components/ContentManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/manage_seasons')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()
  const navigate = useNavigate()

  return <ContentManager mode="seasons" onEditSeason={(id) => navigate({ to: `/dashboard/seasons/${id}` })} />
}


