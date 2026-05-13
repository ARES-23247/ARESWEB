/**
 * Phase 78-02: Onshape Model Gallery Component
 *
 * Displays a grid of Onshape CAD models with search and pagination.
 * Per ONSHAPE-04: Browse documents through web portal
 * Per ONSHAPE-05: Public mode shows cached docs, user mode shows all
 * Per ARES brand: ares-gold accents, obsidian text
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Box, AlertCircle } from "lucide-react";
import { ModelCard, type OnshapeDocument, type OnshapeElement } from "./ModelCard";

interface ModelGalleryProps {
	mode: "public" | "user";
	searchQuery?: string;
	onDocumentClick?: (documentId: string) => void;
	showActions?: boolean;
}

interface DocumentsResponse {
	documents: OnshapeDocument[];
	total?: number;
}

export function ModelGallery({ mode, searchQuery, onDocumentClick, showActions = false }: ModelGalleryProps) {
	const [localSearch, setLocalSearch] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 20;

	// Fetch documents based on mode
	const { data, isLoading, error, refetch } = useQuery<DocumentsResponse>({
		queryKey: ["onshape", "documents", mode, page],
		queryFn: async () => {
			const endpoint = mode === "public" ? "/api/onshape/documents/public" : "/api/onshape/documents";
			const params = new URLSearchParams();
			params.append("limit", String(pageSize));
			if (page > 1) {
				params.append("offset", String((page - 1) * pageSize));
			}

			const res = await fetch(`${endpoint}?${params.toString()}`);
			if (!res.ok) {
				throw new Error(`Failed to fetch documents: ${res.status}`);
			}
			return res.json();
		},
		staleTime: 5 * 60 * 1000, // 5 minutes cache per plan
	});

	const documents = data?.documents || [];
	const total = data?.total ?? documents.length;

	// Filter documents by search query (client-side)
	const filteredDocuments = documents.filter((doc) => {
		const query = (searchQuery || localSearch).toLowerCase();
		if (!query) return true;
		return (
			doc.name.toLowerCase().includes(query) ||
			doc.description?.toLowerCase().includes(query) ||
			doc.owner.toLowerCase().includes(query)
		);
	});

	// Calculate pages
	const totalPages = Math.ceil((searchQuery || localSearch ? filteredDocuments.length : total) / pageSize);

	const handleSearchChange = (value: string) => {
		setLocalSearch(value);
		setPage(1);
	};

	return (
		<div className="w-full">
			{/* Search bar */}
			<div className="mb-6">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ares-bronze" />
					<input
						type="text"
						value={localSearch}
						onChange={(e) => handleSearchChange(e.target.value)}
						placeholder="Search models..."
						className="w-full pl-10 pr-4 py-3 bg-white border border-ares-bronze/20 rounded-lg text-obsidian placeholder:text-ares-bronze/40 focus:border-ares-gold focus:outline-none focus:ring-1 focus:ring-ares-gold transition-all"
						aria-label="Search models"
					/>
				</div>
				{searchQuery || localSearch ? (
					<p className="mt-2 text-sm text-marble/60">
						{filteredDocuments.length} result{filteredDocuments.length !== 1 ? "s" : ""} found
					</p>
				) : null}
			</div>

			{/* Loading state */}
			{isLoading && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
					{[...Array(8)].map((_, i) => (
						<div
							key={i}
							className="aspect-square bg-ares-bronze/10 rounded-lg animate-pulse"
							aria-hidden="true"
						/>
					))}
				</div>
			)}

			{/* Error state */}
			{error && (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<AlertCircle className="h-12 w-12 text-ares-red mb-4" />
					<h3 className="text-lg font-bold text-obsidian mb-2">Failed to load models</h3>
					<p className="text-sm text-marble/60 mb-4">
						{error instanceof Error ? error.message : "Unknown error"}
					</p>
					<button
						onClick={() => refetch()}
						className="px-4 py-2 bg-ares-red text-white font-bold uppercase tracking-widest ares-cut-sm text-xs"
					>
						Retry
					</button>
				</div>
			)}

			{/* Empty state */}
			{!isLoading && !error && filteredDocuments.length === 0 && (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<Box className="h-16 w-16 text-ares-bronze/30 mb-4" />
					<h3 className="text-lg font-bold text-obsidian mb-2">No models found</h3>
					<p className="text-sm text-marble/60">
						{mode === "public"
							? "There are no public models to display yet."
							: "Connect your Onshape account to view your models."}
					</p>
				</div>
			)}

			{/* Document grid */}
			{!isLoading && !error && filteredDocuments.length > 0 && (
				<>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
						{filteredDocuments.map((document) => (
							<ModelCard
								key={document.id}
								document={document}
								onClick={onDocumentClick}
								actions={showActions}
							/>
						))}
					</div>

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="mt-8 flex justify-center items-center gap-4">
							<button
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page === 1}
								className="px-4 py-2 bg-white border border-ares-bronze/20 text-obsidian font-bold uppercase tracking-widest ares-cut-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:border-ares-gold transition-all"
							>
								Previous
							</button>
							<span className="text-sm text-marble/60">
								Page {page} of {totalPages}
							</span>
							<button
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page === totalPages}
								className="px-4 py-2 bg-white border border-ares-bronze/20 text-obsidian font-bold uppercase tracking-widest ares-cut-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:border-ares-gold transition-all"
							>
								Next
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
