import { createFileRoute } from '@tanstack/react-router'
import JudgesHub from '../../pages/JudgesHub'

export const Route = createFileRoute('/judges/')({
  component: JudgesHub,
})

