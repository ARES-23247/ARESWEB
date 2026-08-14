import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/api";
import { apiFailure, type ManagedAlbum, type ManagedPhoto } from "@/lib/media";

interface PhotoPage {
  photos: ManagedPhoto[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface AlbumPage {
  albums: ManagedAlbum[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface UsePhotoCollectionDataOptions {
  albumFilter: string;
  showArchivedPhotos: boolean;
  showArchivedAlbums: boolean;
}

export function usePhotoCollectionData({
  albumFilter,
  showArchivedPhotos,
  showArchivedAlbums,
}: UsePhotoCollectionDataOptions) {
  const [photos, setPhotos] = useState<ManagedPhoto[]>([]);
  const [albums, setAlbums] = useState<ManagedAlbum[]>([]);
  const [photoCursor, setPhotoCursor] = useState<string | null>(null);
  const [albumCursor, setAlbumCursor] = useState<string | null>(null);
  const [morePhotos, setMorePhotos] = useState(false);
  const [moreAlbums, setMoreAlbums] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);
  const [loadingMoreAlbums, setLoadingMoreAlbums] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const photoRequestSequence = useRef(0);
  const albumRequestSequence = useRef(0);

  const loadPhotos = useCallback(
    async (append = false, cursor: string | null = null) => {
      const requestSequence = ++photoRequestSequence.current;
      if (append) setLoadingMorePhotos(true);
      else setLoadingPhotos(true);
      setPhotoError(null);
      try {
        const params = new URLSearchParams({
          limit: "30",
          includeArchived: String(showArchivedPhotos),
        });
        if (albumFilter) params.set("albumId", albumFilter);
        if (append && cursor) params.set("cursor", cursor);
        const response = await authenticatedFetch(
          `/api/photos?${params.toString()}`,
        );
        if (!response.ok)
          throw await apiFailure(response, "Photo library could not load.");
        const page = (await response.json()) as PhotoPage;
        if (requestSequence !== photoRequestSequence.current) return;
        setPhotos((current) =>
          append
            ? [
                ...new Map(
                  [...current, ...page.photos].map((photo) => [
                    photo.id,
                    photo,
                  ]),
                ).values(),
              ]
            : page.photos,
        );
        setPhotoCursor(page.nextCursor);
        setMorePhotos(page.hasMore);
      } catch (cause) {
        if (requestSequence !== photoRequestSequence.current) return;
        setPhotoError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (requestSequence === photoRequestSequence.current) {
          setLoadingPhotos(false);
          setLoadingMorePhotos(false);
        }
      }
    },
    [albumFilter, showArchivedPhotos],
  );

  const loadAlbums = useCallback(
    async (append = false, cursor: string | null = null) => {
      const requestSequence = ++albumRequestSequence.current;
      if (append) setLoadingMoreAlbums(true);
      else setLoadingAlbums(true);
      setAlbumError(null);
      try {
        const params = new URLSearchParams({
          limit: "30",
          includeArchived: String(showArchivedAlbums),
        });
        if (append && cursor) params.set("cursor", cursor);
        const response = await authenticatedFetch(
          `/api/photos/albums?${params.toString()}`,
        );
        if (!response.ok)
          throw await apiFailure(response, "Albums could not load.");
        const page = (await response.json()) as AlbumPage;
        if (requestSequence !== albumRequestSequence.current) return;
        setAlbums((current) =>
          append
            ? [
                ...new Map(
                  [...current, ...page.albums].map((album) => [
                    album.id,
                    album,
                  ]),
                ).values(),
              ]
            : page.albums,
        );
        setAlbumCursor(page.nextCursor);
        setMoreAlbums(page.hasMore);
      } catch (cause) {
        if (requestSequence !== albumRequestSequence.current) return;
        setAlbumError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (requestSequence === albumRequestSequence.current) {
          setLoadingAlbums(false);
          setLoadingMoreAlbums(false);
        }
      }
    },
    [showArchivedAlbums],
  );

  useEffect(() => {
    void loadPhotos(false);
  }, [loadPhotos]);

  useEffect(() => {
    void loadAlbums(false);
  }, [loadAlbums]);

  return {
    photos,
    setPhotos,
    albums,
    setAlbums,
    photoCursor,
    albumCursor,
    morePhotos,
    moreAlbums,
    loadingPhotos,
    loadingAlbums,
    loadingMorePhotos,
    loadingMoreAlbums,
    photoError,
    albumError,
    loadPhotos,
    loadAlbums,
  };
}
