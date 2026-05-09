import { createFileRoute } from '@tanstack/react-router'
import PrintPortfolio from '../../pages/PrintPortfolio'

export const Route = createFileRoute('/judges/print')({
  component: PrintPortfolio,
})
