import { createFileRoute } from '@tanstack/react-router'
import SimRunner from '../pages/SimRunner'

export const Route = createFileRoute('/sim-runner')({
  component: SimRunner,
})

