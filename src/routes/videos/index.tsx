import { createFileRoute } from '@tanstack/react-router'
import Videos from '../../pages/Videos'

export const Route = createFileRoute('/videos/')({
  component: Videos,
})
