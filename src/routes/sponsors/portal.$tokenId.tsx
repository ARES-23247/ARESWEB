import { createFileRoute } from '@tanstack/react-router'
import SponsorROI from '../../pages/SponsorROI'

export const Route = createFileRoute('/sponsors/portal/$tokenId')({
  component: SponsorROI,
})
