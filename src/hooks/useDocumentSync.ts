import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  limit as firestoreLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  getDocs,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { useAuth } from "@/context/AuthContext";

export const DOCUMENT_PAGE_SIZE = 75;
export const MAX_DOCUMENTS_LOADED = 300;
export const REVISION_PAGE_SIZE = 50;

export type DocumentConnectionState = "loading" | "connected" | "offline" | "error";

export class DocumentSlugConflictError extends Error {
  constructor(slug: string) {
    super(`A record already exists at slug \"${slug}\". Choose a unique slug.`);
    this.name = "DocumentSlugConflictError";
  }
}

export interface DocRecord {
  slug: string;
  title: string;
  category: string;
  sortOrder: number;
  description: string;
  content: string;
  status: string;
  isDeleted: number;
  displayInAreslib: number;
  displayInMathCorner: number;
  displayInScienceCorner: number;
  isPortfolio: number;
  isExecutiveSummary: number;
  fileUrl?: string;
  createdAt?: string;
  author?: string;
  date?: string;
  thumbnail?: string;
  updatedAt?: string;
  original_authorNickname?: string;
  original_authorAvatar?: string;
  approvalStatus?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface DocRevision {
  id: string;
  title: string;
  category: string;
  sortOrder: number;
  description: string;
  content: string;
  status: string;
  displayInAreslib: number;
  displayInMathCorner: number;
  displayInScienceCorner: number;
  isPortfolio: number;
  isExecutiveSummary: number;
  editedBy: string;
  editedByName: string;
  editedByAvatar: string;
  timestamp: string;
  fileUrl?: string;
  createdAt?: string;
  author?: string;
  date?: string;
  thumbnail?: string;
}

export interface SaveDocumentOptions {
  isCreate?: boolean;
}

function describeFirestoreError(error: unknown, operation: string): string {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "unknown";
  const message = error instanceof Error ? error.message : String(error);
  return `${operation} failed [${code}]: ${message}`;
}

export function mapDocumentSnapshot(docSnap: QueryDocumentSnapshot<DocumentData>): DocRecord {
  const data = docSnap.data();
  return {
    slug: docSnap.id,
    title: typeof data.title === "string" && data.title.trim() ? data.title : "Untitled Record",
    category: typeof data.category === "string" ? data.category : "General",
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
    description: typeof data.description === "string" ? data.description : typeof data.snippet === "string" ? data.snippet : "",
    content: typeof data.content === "string" ? data.content : "",
    status: typeof data.status === "string" ? data.status : "draft",
    isDeleted: data.isDeleted === 1 ? 1 : 0,
    displayInAreslib: data.displayInAreslib === 1 ? 1 : 0,
    displayInMathCorner: data.displayInMathCorner === 1 ? 1 : 0,
    displayInScienceCorner: data.displayInScienceCorner === 1 ? 1 : 0,
    isPortfolio: data.isPortfolio === 1 ? 1 : 0,
    isExecutiveSummary: data.isExecutiveSummary === 1 ? 1 : 0,
    fileUrl: typeof data.fileUrl === "string" ? data.fileUrl : "",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    author: typeof data.author === "string" ? data.author : "",
    date: typeof data.date === "string" ? data.date : "",
    thumbnail: typeof data.thumbnail === "string" ? data.thumbnail : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    original_authorNickname: typeof data.original_authorNickname === "string" ? data.original_authorNickname : "",
    original_authorAvatar: typeof data.original_authorAvatar === "string" ? data.original_authorAvatar : "",
    approvalStatus: typeof data.approvalStatus === "string" ? data.approvalStatus : undefined,
    approvedBy: typeof data.approvedBy === "string" ? data.approvedBy : undefined,
    approvedAt: typeof data.approvedAt === "string" ? data.approvedAt : undefined,
  };
}

async function getDocsWithTimeout(
  queryRef: Query<DocumentData>,
  timeoutMs = 5_000,
): Promise<QuerySnapshot<DocumentData>> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      getDocs(queryRef),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error(`Firestore request timed out after ${timeoutMs} milliseconds.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export const useDocumentSync = (
  collectionName: string,
  filterFn: (doc: DocRecord) => boolean,
) => {
  const { user } = useAuth();
  const [allDocs, setAllDocs] = useState<DocRecord[]>([]);
  const [connectionState, setConnectionState] = useState<DocumentConnectionState>("loading");
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listLimit, setListLimit] = useState(DOCUMENT_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [revisions, setRevisions] = useState<DocRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingList(true);
    setConnectionState("loading");
    setListError(null);

    const docsQuery = query(collection(db, collectionName), firestoreLimit(listLimit));
    const unsubscribe = onSnapshot(
      docsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const list = snapshot.docs.map(mapDocumentSnapshot);
        setAllDocs(list);
        setHasMore(snapshot.size === listLimit && listLimit < MAX_DOCUMENTS_LOADED);
        setConnectionState(snapshot.metadata.fromCache && !navigator.onLine ? "offline" : "connected");
        setListError(null);
        setLoadingList(false);
      },
      (error) => {
        const diagnostic = describeFirestoreError(error, `Loading ${collectionName}`);
        console.error(diagnostic, error);
        setListError(diagnostic);
        setConnectionState(navigator.onLine ? "error" : "offline");
        setLoadingList(false);
      },
    );

    return unsubscribe;
  }, [collectionName, listLimit]);

  const fetchRevisions = useCallback(async (slug: string) => {
    if (!slug) return;
    setLoadingRevisions(true);
    setRevisionError(null);
    try {
      const revisionsQuery = query(
        collection(db, collectionName, slug, "revisions"),
        orderBy("timestamp", "desc"),
        firestoreLimit(REVISION_PAGE_SIZE),
      );
      const snapshot = await getDocsWithTimeout(revisionsQuery);
      const list = snapshot.docs.map((revisionSnapshot) => ({
        id: revisionSnapshot.id,
        ...revisionSnapshot.data(),
      })) as DocRevision[];
      setRevisions(list);
    } catch (error) {
      const diagnostic = describeFirestoreError(error, "Loading revision history");
      console.error(diagnostic, error);
      setRevisionError(diagnostic);
      setRevisions([]);
    } finally {
      setLoadingRevisions(false);
    }
  }, [collectionName]);

  const saveDoc = async (
    slug: string,
    payload: Omit<DocRecord, "slug">,
    userNickname: string,
    userProfileAvatar: string,
    options: SaveDocumentOptions = {},
  ) => {
    const documentRef = doc(db, collectionName, slug);
    const now = new Date().toISOString();
    const revId = `rev_${Date.now()}`;
    const revisionData: DocRevision | null = user ? {
      id: revId,
      title: payload.title,
      description: payload.description,
      content: payload.content,
      category: payload.category || "",
      sortOrder: payload.sortOrder || 0,
      status: payload.status,
      displayInAreslib: payload.displayInAreslib || 0,
      displayInMathCorner: payload.displayInMathCorner || 0,
      displayInScienceCorner: payload.displayInScienceCorner || 0,
      isPortfolio: payload.isPortfolio || 0,
      isExecutiveSummary: payload.isExecutiveSummary || 0,
      fileUrl: payload.fileUrl || "",
      createdAt: payload.createdAt || "",
      author: payload.author || "",
      date: payload.date || "",
      thumbnail: payload.thumbnail || "",
      editedBy: user.uid,
      editedByName: userNickname || user.displayName || "Anonymous Member",
      editedByAvatar: userProfileAvatar || user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`,
      timestamp: now,
    } : null;

    await runTransaction(db, async (transaction) => {
      if (options.isCreate) {
        const existing = await transaction.get(documentRef);
        if (existing.exists()) throw new DocumentSlugConflictError(slug);
      }
      transaction.set(documentRef, payload);
      if (revisionData) {
        transaction.set(doc(db, collectionName, slug, "revisions", revId), revisionData);
      }
    });
  };

  const archiveDoc = async (slug: string) => {
    await updateDoc(doc(db, collectionName, slug), {
      isDeleted: 1,
      updatedAt: new Date().toISOString(),
    });
  };

  const restoreDoc = async (slug: string) => {
    await updateDoc(doc(db, collectionName, slug), {
      isDeleted: 0,
      updatedAt: new Date().toISOString(),
    });
  };

  const docs = allDocs.filter(filterFn);
  const archivedDocs = allDocs.filter(
    (record) => record.isDeleted === 1 && filterFn({ ...record, isDeleted: 0 }),
  );

  return {
    docs,
    archivedDocs,
    loadingList,
    isLive: connectionState === "connected",
    connectionState,
    listError,
    loadedCount: allDocs.length,
    hasMore,
    loadMore: () => setListLimit((current) => Math.min(current + DOCUMENT_PAGE_SIZE, MAX_DOCUMENTS_LOADED)),
    revisions,
    loadingRevisions,
    revisionError,
    fetchRevisions,
    saveDoc,
    deleteDoc: archiveDoc,
    restoreDoc,
  };
};
