import { createFileRoute, useNavigate } from '@tanstack/react-router'
import DocsEditor from '../../../components/DocsEditor'
import { useDashboardSession } from '../../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/docs/$editSlug')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  return <DocsEditor userRole={session?.user?.role} />
}

