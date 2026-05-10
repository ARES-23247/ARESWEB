import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/locations/')({
  component: () => <Navigate to="/locations/morgantown" />,
})
