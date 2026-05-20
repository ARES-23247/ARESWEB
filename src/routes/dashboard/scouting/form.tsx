import { createFileRoute } from '@tanstack/react-router'
import ScoutingForm from '../../../components/scouting/ScoutingForm'
import { useDashboardSession } from '../../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/scouting/form')({
  component: RouteComponent,
})

function RouteComponent() {
  // Enforce session check 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, permissions } = useDashboardSession()

  return <ScoutingForm />
}
