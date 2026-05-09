// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import TaskBoardPage from '../../../components/TaskBoardPage'
import { useDashboardSession } from '../../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/tasks/')({
  component: RouteComponent,
})

function RouteComponent() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, permissions } = useDashboardSession()

  if (!permissions.canSeeTasks) return <div className="text-center py-20">Access Denied</div>
  return <TaskBoardPage  />
}

