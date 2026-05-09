// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import ScoutingTool from '../../components/tools/ScoutingTool'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/scouting')({
  component: RouteComponent,
})

function RouteComponent() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, permissions } = useDashboardSession()

  return <ScoutingTool  />
}

