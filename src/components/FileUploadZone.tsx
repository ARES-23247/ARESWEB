/**
 * Phase 77-04: File Manager - File Upload Zone Component
 *
 * Drag-and-drop file upload zone for documents.
 * Per D-06/D-07: Manual upload with progress indication
 */

import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FileUploadZoneProps {
	onUpload: (file: File, title?: string, description?: string) => void;
	isUploading: boolean;
	acceptedFormats?: string;
}

export function FileUploadZone({
	onUpload,
	isUploading,
	acceptedFormats = "PDF, DOCX, XLSX, PPTX, TXT",
}: FileUploadZoneProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	// Handle file selection via input or drag-drop
	const handleFileSelect = (file: File) => {
		// Validate file size (25MB limit)
		const maxSize = 25 * 1024 * 1024;
		if (file.size > maxSize) {
			toast.error(`File too large. Maximum size is 25MB.`);
			return;
		}

		// Validate file type
		const allowedTypes = [
			"application/pdf",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
			"text/plain",
		];

		if (!allowedTypes.includes(file.type)) {
			toast.error(`Invalid file type. Allowed: ${acceptedFormats}`);
			return;
		}

		onUpload(file);
	};

	// Handle drag events
	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);

		const file = e.dataTransfer.files[0];
		if (file) {
			handleFileSelect(file);
		}
	};

	// Handle file input change
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
	};

	return (
		<div className="bg-black/40 border border-white/10 ares-cut-sm p-6">
			<div
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={`
					relative border-2 border-dashed rounded-lg p-8 text-center transition-all
					${isDragging ? "border-ares-gold bg-ares-gold/5" : "border-white/20 hover:border-ares-gold/50"}
				`}
			>
				<input
					ref={fileInputRef}
					type="file"
					className="hidden"
					accept=".pdf,.docx,.xlsx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
					onChange={handleInputChange}
					aria-label="Upload file"
					disabled={isUploading}
				/>

				{isUploading ? (
					<div className="flex flex-col items-center gap-3">
						<Loader2 size={32} className="text-ares-gold animate-spin" />
						<p className="text-sm font-bold text-white animate-pulse">Uploading...</p>
					</div>
				) : (
					<div className="flex flex-col items-center gap-4">
						<div className="w-16 h-16 bg-ares-gold/20 flex items-center justify-center rounded-full border border-ares-gold/30">
							<UploadCloud size={32} className="text-ares-gold" aria-hidden="true" />
						</div>
						<div>
							<p className="text-white font-medium mb-1">Drop files here or click to upload</p>
							<p className="text-xs text-white/60">
								Max 25MB. {acceptedFormats}
							</p>
						</div>
						<button
							onClick={() => fileInputRef.current?.click()}
							className="px-6 py-2 bg-ares-gold hover:bg-ares-gold/90 text-black font-bold uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2"
							disabled={isUploading}
						>
							<UploadCloud size={16} aria-hidden="true" />
							Select File
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
