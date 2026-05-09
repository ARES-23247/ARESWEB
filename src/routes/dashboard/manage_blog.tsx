import { createFileRoute, useNavigate } from '@tanstack/react-router'
import ContentManager from '../../components/ContentManager'
import { useDashboardSession } from '../../hooks/useDashboardSession'
import { useDashboardNotifications } from '../../hooks/useDashboardNotifications'

export const Route = createFileRoute('/dashboard/manage_blog')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()
  const navigate = useNavigate()
  const notifications = useDashboardNotifications(session, permissions)

  return <ContentManager mode="blog" pendingCount={notifications.pendingPostsCount} onEditPost={(slug) => navigate({ to: `/dashboard/blog/${slug}` })} />
}


