import { createFileRoute } from '@tanstack/react-router'
import BugReport from '../pages/BugReport'

export const Route = createFileRoute('/bug-report')({
  component: BugReport,
})

