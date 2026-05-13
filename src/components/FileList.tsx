/**
 * Phase 77-04: File Manager - File List Component
 *
 * Table component for displaying uploaded files with actions.
 * Per D-17: Name, Type, Size, Uploaded, Actions columns
 */

import { FileText, Table, Presentation, File, Download, Trash2, Copy } from "lucide-react";
import type { UploadedFile } from "../api/files";
import { formatFileSize } from "../utils/fileUtils";

interface FileListProps {
	files: UploadedFile[];
	onDownload: (file: UploadedFile) => void;
	onDelete: (id: string) => void;
	onCopyLink: (url: string) => void;
	isLoading?: boolean;
}

// File type icon mapping
const getFileIcon = (mimeType: string) => {
	switch (mimeType) {
		case "application/pdf":
		case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
			return <FileText size={18} className="text-ares-cyan" />;
		case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
			return <Table size={18} className="text-ares-gold" />;
		case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
			return <Presentation size={18} className="text-orange-400" />;
		case "text/plain":
			return <File size={18} className="text-white/60" />;
		default:
			return <File size={18} className="text-white/60" />;
	}
};

// File type label
const getFileTypeLabel = (mimeType: string): string => {
	switch (mimeType) {
		case "application/pdf":
			return "PDF";
		case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
			return "DOCX";
		case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
			return "XLSX";
		case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
			return "PPTX";
		case "text/plain":
			return "TXT";
		default:
			return "FILE";
	}
};

// Format date for display
const formatDate = (dateString: string): string => {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

export function FileList({ files, onDownload, onDelete, onCopyLink, isLoading }: FileListProps) {
	// Handle keyboard navigation for actions
	const handleKeyDown = (action: () => void) => (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			action();
		}
	};

	if (isLoading) {
		return (
			<div className="w-full h-64 flex items-center justify-center bg-obsidian border border-white/10 ares-cut-sm">
				<div className="w-8 h-8 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin" />
			</div>
		);
	}

	if (files.length === 0) {
		return (
			<div className="w-full h-64 flex flex-col items-center justify-center text-white/20 gap-4 bg-obsidian border border-white/10 ares-cut-sm">
				<FileText size={48} className="opacity-50" aria-hidden="true" />
				<p className="font-mono text-sm">No files uploaded yet</p>
			</div>
		);
	}

	return (
		<div className="bg-obsidian border border-white/10 ares-cut-sm overflow-hidden">
			{/* Table Header */}
			<div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 bg-black/30">
				<div className="col-span-4 text-xs font-bold uppercase tracking-wider text-white/40">Name</div>
				<div className="col-span-2 text-center text-xs font-bold uppercase tracking-wider text-white/40">Type</div>
				<div className="col-span-2 text-right text-xs font-bold uppercase tracking-wider text-white/40">Size</div>
				<div className="col-span-2 text-right text-xs font-bold uppercase tracking-wider text-white/40">Uploaded</div>
				<div className="col-span-2 text-right text-xs font-bold uppercase tracking-wider text-white/40">Actions</div>
			</div>

			{/* Table Body */}
			<div className="divide-y divide-white/5">
				{files.map((file) => (
					<div
						key={file.id}
						className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-white/5 transition-colors group"
					>
						{/* Name with icon */}
						<div className="col-span-4 flex items-center gap-3 min-w-0">
							<div className="shrink-0" aria-hidden="true">
								{getFileIcon(file.mimeType)}
							</div>
							<div className="min-w-0">
								<p className="text-white font-medium text-sm truncate" title={file.filename}>
									{file.title || file.filename}
								</p>
								{file.title && (
									<p className="text-white/40 text-xs truncate" title={file.filename}>
										{file.filename}
									</p>
								)}
							</div>
						</div>

						{/* Type Badge */}
						<div className="col-span-2 flex items-center justify-center">
							<span className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-white/10 text-white/60 border border-white/10">
								{getFileTypeLabel(file.mimeType)}
							</span>
						</div>

						{/* Size */}
						<div className="col-span-2 flex items-center justify-end">
							<span className="text-marble/60 text-xs">{formatFileSize(file.size)}</span>
						</div>

						{/* Uploaded Date */}
						<div className="col-span-2 flex items-center justify-end">
							<span className="text-marble/60 text-xs">{formatDate(file.uploadedAt)}</span>
						</div>

						{/* Actions */}
						<div className="col-span-2 flex items-center justify-end gap-2">
							<button
								onClick={() => onDownload(file)}
								onKeyDown={handleKeyDown(() => onDownload(file))}
								className="p-2 hover:bg-ares-cyan/20 text-ares-cyan transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
								title="Download"
								aria-label={`Download ${file.filename}`}
							>
								<Download size={16} aria-hidden="true" />
							</button>
							<button
								onClick={() => onCopyLink(file.downloadUrl)}
								onKeyDown={handleKeyDown(() => onCopyLink(file.downloadUrl))}
								className="p-2 hover:bg-ares-gold/20 text-ares-gold transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
								title="Copy link"
								aria-label={`Copy link for ${file.filename}`}
							>
								<Copy size={16} aria-hidden="true" />
							</button>
							<button
								onClick={() => onDelete(file.id)}
								onKeyDown={handleKeyDown(() => onDelete(file.id))}
								className="p-2 hover:bg-ares-red/20 text-ares-red transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red"
								title="Delete"
								aria-label={`Delete ${file.filename}`}
							>
								<Trash2 size={16} aria-hidden="true" />
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
