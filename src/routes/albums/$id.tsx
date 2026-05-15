import { createFileRoute } from '@tanstack/react-router'
import AlbumDetail from '../../pages/AlbumDetail'

export const Route = createFileRoute('/albums/$id')({
  component: AlbumRouteComponent,
})

function AlbumRouteComponent() {
  const { id } = Route.useParams()
  return <AlbumDetail id={id} />
}
