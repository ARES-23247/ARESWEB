import { createFileRoute } from '@tanstack/react-router'
import Academy from '../../pages/Academy'

export const Route = createFileRoute('/academy/$slug')({
  component: Academy,
})
