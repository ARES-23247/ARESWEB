import { createFileRoute, useNavigate } from '@tanstack/react-router'
import StoreOrders from '../../pages/Dashboard/StoreOrders'
import { useDashboardSession } from '../../hooks/useDashboardSession'

export const Route = createFileRoute('/dashboard/store_orders')({
  component: RouteComponent,
})

function RouteComponent() {
  const { session, permissions } = useDashboardSession()

  if (!permissions.isAdmin) return <div className="text-center py-20">Access Denied</div>
  return <StoreOrders  />
}

