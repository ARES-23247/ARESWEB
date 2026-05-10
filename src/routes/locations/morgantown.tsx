import { createFileRoute } from '@tanstack/react-router'
import LocationMorgantown from '../../pages/LocationMorgantown'

export const Route = createFileRoute('/locations/morgantown')({
  component: LocationMorgantown,
})
