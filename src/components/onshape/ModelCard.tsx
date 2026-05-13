/**
 * Phase 78-02/78-03/78-04: Onshape Model Card Component
 *
 * Displays a single Onshape document with thumbnail and metadata.
 * Per ARES brand guidelines: white card, bronze border on hover, League Spartan typography.
 * Per 78-03: Includes export functionality for STL/STEP files.
 * Per 78-04: Includes BOM viewer for assemblies.
 */

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, Box, ChevronDown, X, List } from "lucide-react";
import { ExportButton } from "./ExportButton";
import { BOMViewer } from "./BOMViewer";

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

export interface OnshapeElement {
	id: string;
	documentId: string;
	name: string;
	type: "PartStudio" | "Assembly" | "Drawing" | "FeatureList";
}

interface ModelCardProps {
	document: OnshapeDocument;
	onClick?: (documentId: string) => void;
	actions?: boolean;
	// Optional: Pre-loaded elements for export functionality
	elements?: OnshapeElement[];
}

export function ModelCard({ document, onClick, actions, elements }: ModelCardProps) {
	const [bomElement, setBomElement] = useState<OnshapeElement | null>(null);

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

	// Filter elements that support export (PartStudio and Assembly)
	const exportableElements = elements?.filter(
		(el) => el.type === "PartStudio" || el.type === "Assembly"
	);

	// Filter assemblies for BOM
	const assemblies = elements?.filter((el) => el.type === "Assembly");

	return (
		<>
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
						<div className="mt-4 pt-4 border-t border-ares-bronze/10">
							{/* Exportable elements */}
							{exportableElements && exportableElements.length > 0 ? (
								<div className="space-y-2">
									{/* Single element: show export directly */}
									{exportableElements.length === 1 ? (
										<div className="flex items-center gap-2">
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
											{/* Show BOM button for assemblies */}
											{exportableElements[0]!.type === "Assembly" && (
												<button
													onClick={(e) => {
														e.stopPropagation();
														setBomElement(exportableElements[0]!);
													}}
													className="flex items-center gap-1 px-3 py-1.5 bg-ares-gold/10 text-ares-gold hover:bg-ares-gold hover:text-obsidian text-xs font-bold uppercase tracking-wider rounded transition-all"
												>
													<List className="h-3 w-3" />
													BOM
												</button>
											)}
											<ExportButton
												documentId={document.id}
												elementId={exportableElements[0]!.id}
												documentName={document.name}
												elementName={exportableElements[0]!.name}
												elementType={
													exportableElements[0]!.type.toLowerCase() as
														| "partstudio"
														| "assembly"
												}
												variant="compact"
											/>
										</div>
									) : (
										/* Multiple elements: show dropdown */
										<ElementActionDropdown
											documentId={document.id}
											documentName={document.name}
											elements={exportableElements}
											assemblies={assemblies || []}
											onViewBOM={(element) => setBomElement(element)}
										/>
									)}
								</div>
							) : (
								/* No elements: show view button only */
								<div className="flex items-center gap-2">
									<a
										href={`https://cad.onshape.com/documents/${document.id}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 px-3 py-1.5 bg-ares-bronze/10 text-ares-bronze hover:bg-ares-bronze hover:text-white text-xs font-bold uppercase tracking-wider rounded transition-all"
										onClick={(e) => e.stopPropagation()}
									>
										<ExternalLink className="h-3 w-3" />
										View in Onshape
									</a>
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			{/* BOM Dialog */}
			<Dialog.Root open={!!bomElement} onOpenChange={(open) => !open && setBomElement(null)}>
				<Dialog.Portal>
					<Dialog.Overlay className="fixed inset-0 bg-obsidian/50 backdrop-blur-sm z-50" />
					<Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden z-50">
						<Dialog.Header className="flex items-center justify-between p-6 border-b border-ares-bronze/20">
							<Dialog.Title className="text-xl font-bold text-obsidian">
								Bill of Materials: {bomElement?.name}
							</Dialog.Title>
							<Dialog.Close className="p-2 hover:bg-ares-bronze/10 rounded transition-colors">
								<X className="h-5 w-5 text-marble/60" />
							</Dialog.Close>
						</Dialog.Header>
						<div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
							{bomElement && (
								<BOMViewer
									documentId={document.id}
									elementId={bomElement.id}
									elementName={bomElement.name}
								/>
							)}
						</div>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</>
	);
}

/**
 * Dropdown for selecting which element to export/view BOM when multiple are available
 */
function ElementActionDropdown({
	documentId,
	documentName,
	elements,
	assemblies,
	onViewBOM,
}: {
	documentId: string;
	documentName: string;
	elements: OnshapeElement[];
	assemblies: OnshapeElement[];
	onViewBOM: (element: OnshapeElement) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="relative">
			<button
				onClick={(e) => {
					e.stopPropagation();
					setIsOpen(!isOpen);
				}}
				className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-ares-gold/10 text-ares-gold hover:bg-ares-gold hover:text-obsidian text-xs font-bold uppercase tracking-wider rounded transition-all"
			>
				<span>Actions</span>
				<ChevronDown className="h-3 w-3" />
			</button>

			{isOpen && (
				<div
					onClick={(e) => e.stopPropagation()}
					className="absolute top-full right-0 mt-1 bg-white border border-ares-bronze/20 rounded-lg shadow-lg overflow-hidden z-10 min-w-[240px] max-h-[300px] overflow-y-auto"
				>
					{elements.map((element) => (
						<div key={element.id} className="p-3 hover:bg-ares-bronze/10 border-b border-ares-bronze/10 last:border-b-0">
							<div className="flex items-center justify-between mb-2">
								<div>
									<div className="text-xs text-marble/40">{element.type}</div>
									<div className="text-sm font-medium text-obsidian truncate">{element.name}</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<ExportButton
									documentId={documentId}
									elementId={element.id}
									documentName={documentName}
									elementName={element.name}
									elementType={element.type.toLowerCase() as "partstudio" | "assembly"}
									variant="compact"
								/>
								{element.type === "Assembly" && (
									<button
										onClick={() => onViewBOM(element)}
										className="flex items-center gap-1 px-3 py-1.5 bg-ares-gold/10 text-ares-gold hover:bg-ares-gold hover:text-obsidian text-xs font-bold uppercase tracking-wider rounded transition-all"
									>
										<List className="h-3 w-3" />
										BOM
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
