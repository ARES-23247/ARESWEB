import { createFileRoute } from '@tanstack/react-router'
import Albums from '../../pages/Albums'

export const Route = createFileRoute('/albums/')({
  component: Albums,
})
