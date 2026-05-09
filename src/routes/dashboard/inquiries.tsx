// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import AdminInquiries from '../../components/AdminInquiries'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/inquiries')({
  component: RouteComponent,
})

function RouteComponent() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, permissions } = useDashboardSession()

  if (!permissions.canSeeInquiries) return <div className="text-center py-20">Access Denied</div>
  return <AdminInquiries  />
}

