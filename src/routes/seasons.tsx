import { createFileRoute } from '@tanstack/react-router'
import Seasons from '../pages/Seasons'

export const Route = createFileRoute('/seasons')({
  component: Seasons,
})

