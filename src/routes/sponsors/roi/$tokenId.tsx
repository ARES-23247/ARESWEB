import { createFileRoute } from '@tanstack/react-router'
import SponsorROI from '../../../pages/SponsorROI'

export const Route = createFileRoute('/sponsors/roi/$tokenId')({
  component: SponsorROI,
})
