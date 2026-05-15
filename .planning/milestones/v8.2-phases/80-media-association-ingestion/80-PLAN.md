# Phase 80: Media Association & Ingestion - Implementation Plan

## 1. Drag and Drop UI
- [x] Create `manage_albums.$id.tsx` with `@dnd-kit/sortable` for album media arrangement.
- [x] Add mutation hooks `useReorderAlbumMedia` and `useRemoveAlbumMedia`.

## 2. Ingestion
- [x] Update `GooglePhotoPickerModal` to inject photos into album via R2 key.
- [x] Create backend handlers for inserting media into `album_media`.

## 3. UI Fixes
- [x] Integrate picker directly into Album manager.
