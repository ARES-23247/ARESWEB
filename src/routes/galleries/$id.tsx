import { createFileRoute } from '@tanstack/react-router'
import GalleryDetail from '../../pages/GalleryDetail'

export const Route = createFileRoute('/galleries/$id')({
  component: () => {
    const { id } = Route.useParams()
    return <GalleryDetail id={id} />
  },
})
