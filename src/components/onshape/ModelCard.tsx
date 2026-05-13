/**
 * Phase 78-02: Onshape Model Card Component
 *
 * Displays a single Onshape document with thumbnail and metadata.
 * Per ARES brand guidelines: white card, bronze border on hover, League Spartan typography.
 */

import { ExternalLink, Box } from "lucide-react";

export interface OnshapeDocument {
	id: string;
	name: string;
	description: string | null;
	owner: string;
	createdAt: string;
	modifiedAt: string;
	thumbnailUrl?: string;
	isPublic?: boolean;
}

interface ModelCardProps {
	document: OnshapeDocument;
	onClick?: (documentId: string) => void;
	actions?: boolean;
}

export function ModelCard({ document, onClick, actions }: ModelCardProps) {
	const handleCardClick = () => {
		if (onClick) {
			onClick(document.id);
		}
	};

	const formatDate = (dateStr: string) => {
		try {
			return new Date(dateStr).toLocaleDateString();
		} catch {
			return "";
		}
	};

	const getThumbnail = () => {
		if (document.thumbnailUrl) {
			return document.thumbnailUrl;
		}
		// Use a placeholder gradient if no thumbnail
		return "";
	};

	return (
		<div
			onClick={handleCardClick}
			className={`
				group bg-white border border-ares-bronze/20 rounded-lg overflow-hidden
				hover:border-ares-bronze hover:shadow-xl transition-all duration-200
				${onClick ? "cursor-pointer" : ""}
			`}
		>
			{/* Thumbnail */}
			<div className="aspect-square bg-gradient-to-br from-ares-bronze/10 to-ares-bronze/5 relative overflow-hidden">
				{document.thumbnailUrl ? (
					<img
						src={document.thumbnailUrl}
						alt={document.name}
						className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
						loading="lazy"
					/>
				) : (
					<div className="w-full h-full flex items-center justify-center">
						<Box className="h-16 w-16 text-ares-bronze/30" />
					</div>
				)}

				{/* Public badge */}
				{document.isPublic && (
					<div className="absolute top-2 right-2 px-2 py-1 bg-ares-gold/90 text-obsidian text-xs font-bold uppercase tracking-wider rounded">
						Public
					</div>
				)}
			</div>

			{/* Content */}
			<div className="p-4">
				<h3 className="font-bold text-obsidian truncate mb-1" title={document.name}>
					{document.name}
				</h3>

				{document.description && (
					<p className="text-sm text-marble/60 line-clamp-2 mb-2">
						{document.description}
					</p>
				)}

				<div className="flex items-center justify-between text-xs text-marble/40">
					<span>by {document.owner}</span>
					<span>{formatDate(document.modifiedAt)}</span>
				</div>

				{/* Actions */}
				{actions && (
					<div className="mt-4 pt-4 border-t border-ares-bronze/10 flex gap-2">
						<a
							href={`https://cad.onshape.com/documents/${document.id}`}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1 px-3 py-1.5 bg-ares-bronze/10 text-ares-bronze hover:bg-ares-bronze hover:text-white text-xs font-bold uppercase tracking-wider rounded transition-all"
							onClick={(e) => e.stopPropagation()}
						>
							<ExternalLink className="h-3 w-3" />
							View
						</a>
						<button
							className="flex items-center gap-1 px-3 py-1.5 bg-ares-gold/10 text-ares-gold hover:bg-ares-gold hover:text-obsidian text-xs font-bold uppercase tracking-wider rounded transition-all"
							onClick={(e) => {
								e.stopPropagation();
								// Export functionality would go here (Phase 78-03)
							}}
						>
							Export
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
