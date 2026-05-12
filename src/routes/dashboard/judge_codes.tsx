
import { createFileRoute } from '@tanstack/react-router'
import JudgeCodeManager from '../../components/JudgeCodeManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/judge_codes')({
  component: RouteComponent,
})

function RouteComponent() {
  const { permissions } = useDashboardSession()

  if (!permissions.isAdmin) return <div className="text-center py-20">Access Denied</div>
  return <JudgeCodeManager />
}
