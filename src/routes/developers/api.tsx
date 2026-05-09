import { createFileRoute } from '@tanstack/react-router'
import DeveloperApi from '../../pages/DeveloperApi'

export const Route = createFileRoute('/developers/api')({
  component: DeveloperApi,
})
