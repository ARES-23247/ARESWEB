import { createFileRoute } from '@tanstack/react-router'
import Galleries from '../../pages/Galleries'

export const Route = createFileRoute('/galleries/')({
  component: Galleries,
})
