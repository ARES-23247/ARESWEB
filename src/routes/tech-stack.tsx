import { createFileRoute } from '@tanstack/react-router'
import TechStack from '../pages/TechStack'

export const Route = createFileRoute('/tech-stack')({
  component: TechStack,
})

