import { createFileRoute } from '@tanstack/react-router'
import Outreach from '../pages/Outreach'

export const Route = createFileRoute('/outreach')({
  component: Outreach,
})

