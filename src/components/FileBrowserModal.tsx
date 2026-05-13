/**
 * Phase 77-04: File Manager - File Browser Modal Component
 *
 * Modal for selecting files to insert into blog editor.
 * Per D-14/D-15: Insert markdown link format [Title](/api/files/download/{id})
 */

import { useState } from "react";
import { X, FileText, Table, Presentation, File, Search } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useFilesQuery } from "../hooks/useFiles";
import type { UploadedFile } from "../api/files";
import { formatFileSize, getMimeTypeIcon } from "../utils/fileUtils";

interface FileBrowserModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (file: UploadedFile) => void;
}

// File type icon component
const FileIcon = ({ mimeType }: { mimeType: string }) => {
	const iconName = getMimeTypeIcon(mimeType);
	const IconComponent = {
		FileText,
		Table,
		Presentation,
		File,
	}[iconName as keyof typeof { FileText: typeof FileText; Table: typeof Table; Presentation: typeof Presentation; File: typeof File }];

	const iconColor = {
		FileText: "text-ares-cyan",
		Table: "text-ares-gold",
		Presentation: "text-orange-400",
		File: "text-white/60",
	}[iconName];

	return <IconComponent size={20} className={iconColor} aria-hidden="true" />;
};

export function FileBrowserModal({ isOpen, onClose, onSelect }: FileBrowserModalProps) {
	const [searchQuery, setSearchQuery] = useState("");

	const { files, isLoading } = useFilesQuery({
		enabled: isOpen,
	});

	// Filter files by search query
	const filteredFiles = files.filter((file) =>
		file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
		(file.title?.toLowerCase() ?? "").includes(searchQuery.toLowerCase())
	);

	// Handle file selection
	const handleSelect = (file: UploadedFile) => {
		onSelect(file);
		onClose();
		setSearchQuery("");
	};

	// Handle keyboard navigation
	const handleKeyDown = (file: UploadedFile) => (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleSelect(file);
		}
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<Dialog.Content
					aria-describedby={undefined}
					className="fixed left-[50%] top-[50%] z-[9999] translate-x-[-50%] translate-y-[-50%] bg-obsidian border border-white/10 shadow-2xl ares-cut-lg w-[calc(100%-2rem)] max-w-3xl max-h-[80vh] flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] focus:outline-none"
				>
					{/* Header */}
					<div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-ares-gold/20 flex items-center justify-center ares-cut-sm border border-ares-gold/30">
								<FileText size={20} className="text-ares-gold" aria-hidden="true" />
							</div>
							<div>
								<Dialog.Title className="text-xl font-black text-white tracking-widest uppercase m-0">
									Select File
								</Dialog.Title>
								<Dialog.Description className="text-xs text-white/60 font-mono m-0">
									Insert file link into blog post
								</Dialog.Description>
							</div>
						</div>
						<Dialog.Close asChild>
							<button
								aria-label="Close modal"
								className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
							>
								<X size={20} aria-hidden="true" />
							</button>
						</Dialog.Close>
					</div>

					{/* Search */}
					<div className="px-6 py-4 border-b border-white/10 bg-white/5">
						<div className="relative">
							<Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search files by name..."
								className="w-full bg-obsidian border border-white/10 pl-10 pr-4 py-2.5 text-white placeholder:text-white/40 focus:border-ares-gold focus:outline-none focus:ring-1 focus:ring-ares-gold transition-all text-sm"
								aria-label="Search files"
							/>
						</div>
					</div>

					{/* Content */}
					<div
						className="flex-1 overflow-y-auto p-6 bg-obsidian"
						aria-live="polite"
					>
						{isLoading ? (
							<div className="w-full h-full flex flex-col items-center justify-center gap-4">
								<div className="w-10 h-10 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin" />
								<p className="text-xs font-bold uppercase tracking-widest text-ares-gold animate-pulse">
									Loading files...
								</p>
							</div>
						) : filteredFiles.length === 0 ? (
							<div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-4">
								<FileText size={48} className="opacity-50" aria-hidden="true" />
								<p className="font-mono text-sm">
									{searchQuery ? `No files match "${searchQuery}"` : "No files available"}
								</p>
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								{filteredFiles.map((file) => (
									<button
										key={file.id}
										onClick={() => handleSelect(file)}
										onKeyDown={handleKeyDown(file)}
										className="flex items-start gap-3 p-4 bg-black/50 border border-white/10 ares-cut-sm hover:border-ares-gold/50 hover:bg-ares-gold/5 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
									>
										<div className="shrink-0 mt-0.5" aria-hidden="true">
											<FileIcon mimeType={file.mimeType} />
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-white font-medium text-sm truncate">
												{file.title || file.filename}
											</p>
											{file.title && (
												<p className="text-white/40 text-xs truncate">
													{file.filename}
												</p>
											)}
											<div className="flex items-center gap-3 mt-2 text-xs text-white/60">
												<span>{formatFileSize(file.size)}</span>
												{file.usageCount > 0 && (
													<span className="px-1.5 py-0.5 bg-ares-gold/20 text-ares-gold rounded text-xs font-bold">
														{file.usageCount} uses
													</span>
												)}
											</div>
										</div>
									</button>
								))}
							</div>
						)}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
