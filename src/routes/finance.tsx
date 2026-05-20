import { createFileRoute } from '@tanstack/react-router'
import FinanceLedger from '../pages/FinanceLedger'

export const Route = createFileRoute('/finance')({
  component: FinanceLedger,
})
