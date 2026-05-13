/**
 * Phase 77-04: File Manager - Dashboard File Management Page
 *
 * File manager dashboard with upload, list, search, and Drive import.
 * Per FILES-01, FILES-02, FILES-07: Manual upload, Drive import, file management
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileUp, Search, RefreshCw, FolderOpen } from "lucide-react";
import { useFilesQuery, useUploadMutation, useDeleteMutation, useScanUsageMutation } from "../../hooks/useFiles";
import { FileUploadZone } from "../../components/FileUploadZone";
import { FileList } from "../../components/FileList";
import type { UploadedFile } from "../../api/files";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/files")({
	component: FilesPage,
});

function FilesPage() {
	const [searchQuery, setSearchQuery] = useState("");

	// Fetch files
	const { files, isLoading, refetch } = useFilesQuery();

	// Mutations
	const uploadMutation = useUploadMutation();
	const deleteMutation = useDeleteMutation();
	const scanUsageMutation = useScanUsageMutation();

	// Handle file upload
	const handleUpload = async (file: File, title?: string, description?: string) => {
		const formData = new FormData();
		formData.append("file", file);
		if (title) formData.append("title", title);
		if (description) formData.append("description", description);

		uploadMutation.mutate(
			{ data: formData },
			{
				onSuccess: () => {
					refetch();
				},
			}
		);
	};

	// Handle file download
	const handleDownload = (file: UploadedFile) => {
		// Download requires authentication, so open in new tab with session
		window.open(file.downloadUrl, "_blank");
	};

	// Handle file deletion
	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to delete this file? This action cannot be undone.")) {
			deleteMutation.mutate(id, {
				onSuccess: () => {
					refetch();
				},
			});
		}
	};

	// Handle copy link
	const handleCopyLink = (url: string) => {
		const fullUrl = `${window.location.origin}${url}`;
		navigator.clipboard.writeText(fullUrl).then(() => {
			toast.success("Link copied to clipboard");
		});
	};

	// Handle scan usage
	const handleScanUsage = () => {
		scanUsageMutation.mutate(undefined, {
			onSuccess: () => {
				refetch();
			},
		});
	};

	// Filter files by search query (client-side per D-18)
	const filteredFiles = files.filter((file) => {
		const searchLower = searchQuery.toLowerCase();
		return (
			file.filename.toLowerCase().includes(searchLower) ||
			(file.title?.toLowerCase() ?? "").includes(searchLower)
		);
	});

	// Calculate stats
	const totalFiles = files.length;
	const totalSize = files.reduce((sum, file) => sum + file.size, 0);
	const formatSize = (bytes: number) => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	};

	return (
			<div className="flex-1 w-full flex flex-col min-h-0">
				{/* Header */}
				<div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
					<div>
						<h2 className="text-2xl font-bold text-white tracking-tighter">File Manager</h2>
						<p className="text-marble/60 text-sm mt-1">Upload and manage documents for blog posts.</p>
					</div>
					<div className="flex items-center gap-3">
						<button
							onClick={() => refetch()}
							disabled={isLoading}
							className="px-4 py-2 bg-obsidian hover:bg-obsidian/80 text-white font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
							title="Refresh file list"
						>
							<RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
							Refresh
						</button>
						<button
							onClick={handleScanUsage}
							disabled={scanUsageMutation.isPending}
							className="px-4 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 text-ares-gold font-black uppercase tracking-widest ares-cut-sm transition-all flex items-center gap-2 border border-ares-gold/30 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
							title="Scan blog posts for file references"
						>
							<RefreshCw size={14} className={scanUsageMutation.isPending ? "animate-spin" : ""} />
							Scan Usage
						</button>
					</div>
				</div>

				{/* Two-column layout */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
					{/* Left column: Upload zone and stats */}
					<div className="space-y-6">
						<FileUploadZone
							onUpload={handleUpload}
							isUploading={uploadMutation.isPending}
						/>

						{/* Stats cards */}
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-black/40 border border-white/10 ares-cut-sm p-4">
								<p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1">
									Total Files
								</p>
								<p className="text-2xl font-black text-white">{totalFiles}</p>
							</div>
							<div className="bg-black/40 border border-white/10 ares-cut-sm p-4">
								<p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-1">
									Total Size
								</p>
								<p className="text-2xl font-black text-white">{formatSize(totalSize)}</p>
							</div>
						</div>

						{/* Google Drive import button */}
						<div className="bg-black/40 border border-white/10 ares-cut-sm p-4">
							<a
								href="/dashboard/drive-docs"
								className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 ares-cut-sm transition-all"
							>
								<div className="w-10 h-10 bg-ares-gold/20 flex items-center justify-center ares-cut-sm border border-ares-gold/30">
									<FolderOpen size={20} className="text-ares-gold" aria-hidden="true" />
								</div>
								<div className="flex-1">
									<p className="text-white font-medium text-sm">Import from Drive</p>
									<p className="text-white/40 text-xs">Browse Google Workspace files</p>
								</div>
							</a>
						</div>
					</div>

					{/* Right column: File list */}
					<div className="lg:col-span-2 space-y-4">
						{/* Search bar */}
						<div>
							<div className="relative">
								<Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search files by name..."
									className="w-full bg-obsidian border border-white/10 pl-10 pr-4 py-3 text-white placeholder:text-white/40 focus:border-ares-gold focus:outline-none focus:ring-1 focus:ring-ares-gold transition-all text-sm"
									aria-label="Search files"
								/>
							</div>
						</div>

						{/* File list */}
						<FileList
							files={filteredFiles}
							onDownload={handleDownload}
							onDelete={handleDelete}
							onCopyLink={handleCopyLink}
							isLoading={isLoading}
						/>
					</div>
				</div>
			</div>
	);
}
