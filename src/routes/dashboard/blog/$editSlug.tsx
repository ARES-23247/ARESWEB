import { createFileRoute, useNavigate } from '@tanstack/react-router'
import BlogEditor from '../../../components/BlogEditor'
import { useDashboardSession } from '../../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/blog/$editSlug')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  return <BlogEditor userRole={session?.user?.role} />
}

