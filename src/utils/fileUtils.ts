/**
 * File utility functions for frontend display
 */

/**
 * Format file size for display
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get icon component name for a MIME type
 *
 * @param mimeType - MIME type string
 * @returns Icon name (lucide-react icon)
 */
export function getMimeTypeIcon(mimeType: string): string {
	switch (mimeType) {
		case "application/pdf":
			return "FileText";
		case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
			return "FileText";
		case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
			return "Table";
		case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
			return "Presentation";
		case "text/plain":
			return "File";
		default:
			return "File";
	}
}
