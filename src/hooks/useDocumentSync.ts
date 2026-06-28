import { useState, useEffect } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

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

export const useDocumentSync = (
  collectionName: string,
  filterFn: (doc: DocRecord) => boolean
) => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [revisions, setRevisions] = useState<DocRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // Firestore timeout wrapper helpers
  const getDocsWithTimeout = async (queryRef: any, timeoutMs = 1500): Promise<any> => {
    return Promise.race([
      getDocs(queryRef),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firestore getDocs timeout")), timeoutMs)
      )
    ]);
  };

  useEffect(() => {
    try {
      const docsRef = collection(db, collectionName);
      const unsubscribe = onSnapshot(
        docsRef,
        (snapshot) => {
          if (snapshot.empty) {
            setDocs([]);
            setIsLive(false);
            setLoadingList(false);
            return;
          }
          const list = snapshot.docs
            .map((docSnap) => {
              const data = docSnap.data();
              return {
                slug: docSnap.id,
                title: data.title || "Untitled Record",
                category: data.category || "General",
                sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
                description: data.description || data.snippet || "",
                content: data.content || "",
                status: data.status || "draft",
                isDeleted: typeof data.isDeleted === "number" ? data.isDeleted : 0,
                displayInAreslib: typeof data.displayInAreslib === "number" ? data.displayInAreslib : 0,
                displayInMathCorner: typeof data.displayInMathCorner === "number" ? data.displayInMathCorner : 0,
                displayInScienceCorner: typeof data.displayInScienceCorner === "number" ? data.displayInScienceCorner : 0,
                isPortfolio: typeof data.isPortfolio === "number" ? data.isPortfolio : 0,
                isExecutiveSummary: typeof data.isExecutiveSummary === "number" ? data.isExecutiveSummary : 0,
                fileUrl: data.fileUrl || "",
                createdAt: data.createdAt || "",
                author: data.author || "",
                date: data.date || "",
                thumbnail: data.thumbnail || "",
                updatedAt: data.updatedAt || new Date().toISOString(),
                original_authorNickname: data.original_authorNickname || "",
                original_authorAvatar: data.original_authorAvatar || ""
              } as DocRecord;
            })
            .filter(filterFn);

          setDocs(list);
          setIsLive(true);
          setLoadingList(false);
        },
        (err) => {
          console.warn(`Firestore access error on ${collectionName}, standard fallback loaded.`, err.message);
          setDocs([]);
          setIsLive(false);
          setLoadingList(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn(`Local offline sandbox mode loaded for ${collectionName}.`, e);
      setDocs([]);
      setIsLive(false);
      setLoadingList(false);
    }
  }, [collectionName]);

  const fetchRevisions = async (slug: string) => {
    if (!slug) return;
    setLoadingRevisions(true);
    try {
      const q = query(
        collection(db, collectionName, slug, "revisions"),
        orderBy("timestamp", "desc")
      );
      const snap = await getDocsWithTimeout(q);
      const list = snap.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as DocRevision[];
      setRevisions(list);
    } catch (err) {
      console.warn("Could not load revision logs:", err);
    } finally {
      setLoadingRevisions(false);
    }
  };

  const saveDoc = async (
    slug: string,
    payload: Omit<DocRecord, "slug">,
    userNickname: string,
    userProfileAvatar: string
  ) => {
    // Attempt save
    await setDoc(doc(db, collectionName, slug), payload);

    // Save revision if user is authenticated
    if (user) {
      const revId = `rev_${Date.now()}`;
      const revisionData: DocRevision = {
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
        timestamp: new Date().toISOString()
      };
      await setDoc(doc(db, collectionName, slug, "revisions", revId), revisionData);
    }
  };

  const deleteDocEntry = async (slug: string) => {
    if (collectionName === "documents") {
      await deleteDoc(doc(db, collectionName, slug));
    } else {
      await updateDoc(doc(db, collectionName, slug), {
        isDeleted: 1,
        updatedAt: new Date().toISOString()
      });
    }
  };

  return {
    docs,
    loadingList,
    isLive,
    revisions,
    loadingRevisions,
    fetchRevisions,
    saveDoc,
    deleteDoc: deleteDocEntry
  };
};
