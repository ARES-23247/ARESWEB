import { createFileRoute } from '@tanstack/react-router'
import Sponsors from '../../pages/Sponsors'

export const Route = createFileRoute('/sponsors/')({
  component: Sponsors,
})

