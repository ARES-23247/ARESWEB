import { createFileRoute } from '@tanstack/react-router'
import VideoDetail from '../../pages/VideoDetail'

export const Route = createFileRoute('/videos/$id')({
  component: () => {
    const { id } = Route.useParams()
    return <VideoDetail id={id} />
  },
})
