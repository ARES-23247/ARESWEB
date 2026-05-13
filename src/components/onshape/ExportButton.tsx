/**
 * Phase 78-03: Onshape Export Button Component
 *
 * Provides export functionality for STL (3D printing) and STEP (manufacturing).
 * Per ONSHAPE-07: Export parts to STL format
 * Per ONSHAPE-08: Export assemblies to STEP format
 * Per ARES brand: ares-gold for success, proper loading indicators
 */

import { useState, useEffect } from "react";
import { Download, Loader2, CheckCircle, XCircle, ChevronDown } from "lucide-react";

export interface ExportButtonProps {
	documentId: string;
	elementId: string;
	documentName: string;
	elementName: string;
	elementType: "partstudio" | "assembly";
	variant?: "default" | "compact";
}

type ExportStatus = "idle" | "exporting" | "polling" | "success" | "error";

export function ExportButton({
	documentId,
	elementId,
	documentName,
	elementName,
	elementType,
	variant = "default",
}: ExportButtonProps) {
	const [status, setStatus] = useState<ExportStatus>("idle");
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [progress, setProgress] = useState(0);
	const [isOpen, setIsOpen] = useState(false);

	const resetStatus = () => {
		setStatus("idle");
		setErrorMessage("");
		setProgress(0);
	};

	// STL export (direct download)
	const exportSTL = async () => {
		setIsOpen(false);
		setStatus("exporting");

		try {
			const response = await fetch(
				`/api/onshape/export/stl/${documentId}/${elementId}?units=millimeter&mode=binary`
			);

			if (!response.ok) {
				throw new Error(`Export failed: ${response.status}`);
			}

			// Create download link
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${documentName}_${elementName}.stl`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			setStatus("success");
			setTimeout(resetStatus, 3000);
		} catch (error) {
			console.error("[ExportButton] STL export failed:", error);
			setErrorMessage(error instanceof Error ? error.message : "Unknown error");
			setStatus("error");
		}
	};

	// STEP export (async with polling)
	const exportSTEP = async () => {
		setIsOpen(false);
		setStatus("exporting");
		setProgress(0);

		try {
			// Initiate export
			const initResponse = await fetch(
				`/api/onshape/export/step/${documentId}/${elementId}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ format: "step" }),
				}
			);

			if (!initResponse.ok) {
				throw new Error(`Failed to initiate export: ${initResponse.status}`);
			}

			const { exportId } = (await initResponse.json()) as { exportId: string };

			// Poll for completion
			setStatus("polling");
			let attempts = 0;
			const maxAttempts = 150; // 5 minutes with 2-second polling

			const pollInterval = setInterval(async () => {
				attempts++;

				try {
					const statusResponse = await fetch(`/api/onshape/export/status/${exportId}`);
					if (!statusResponse.ok) {
						throw new Error(`Status check failed: ${statusResponse.status}`);
					}

					const data = (await statusResponse.json()) as { status: string; failureReason?: string };

					// Update progress (estimate based on typical times)
					const estimatedProgress = Math.min((attempts / 30) * 100, 90);
					setProgress(estimatedProgress);

					if (data.status === "done") {
						clearInterval(pollInterval);
						setProgress(100);

						// Download file
						const downloadResponse = await fetch(`/api/onshape/export/download/${exportId}`);
						if (!downloadResponse.ok) {
							throw new Error(`Download failed: ${downloadResponse.status}`);
						}

						const blob = await downloadResponse.blob();
						const url = URL.createObjectURL(blob);
						const a = document.createElement("a");
						a.href = url;
						a.download = `${documentName}_${elementName}.step`;
						document.body.appendChild(a);
						a.click();
						document.body.removeChild(a);
						URL.revokeObjectURL(url);

						setStatus("success");
						setTimeout(resetStatus, 3000);
					} else if (data.status === "failed") {
						clearInterval(pollInterval);
						throw new Error(data.failureReason || "Export failed on server");
					}
				} catch (error) {
					clearInterval(pollInterval);
					throw error;
				}

				// Timeout after max attempts
				if (attempts >= maxAttempts) {
					clearInterval(pollInterval);
					throw new Error("Export timed out after 5 minutes");
				}
			}, 2000);
		} catch (error) {
			console.error("[ExportButton] STEP export failed:", error);
			setErrorMessage(error instanceof Error ? error.message : "Unknown error");
			setStatus("error");
		}
	};

	// Close dropdown on click outside
	useEffect(() => {
		const handleClickOutside = () => setIsOpen(false);
		if (isOpen) {
			document.addEventListener("click", handleClickOutside);
			return () => document.removeEventListener("click", handleClickOutside);
		}
	}, [isOpen]);

	const isExporting = status === "exporting" || status === "polling";
	const isSuccess = status === "success";
	const isError = status === "error";

	if (variant === "compact") {
		return (
			<button
				onClick={exportSTL}
				disabled={isExporting || isSuccess}
				className="flex items-center gap-1 px-3 py-1.5 bg-ares-gold/10 text-ares-gold hover:bg-ares-gold hover:text-obsidian disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider rounded transition-all"
				title="Export to STL"
			>
				{isExporting ? (
					<Loader2 className="h-3 w-3 animate-spin" />
				) : isSuccess ? (
					<CheckCircle className="h-3 w-3" />
				) : (
					<Download className="h-3 w-3" />
				)}
			</button>
		);
	}

	return (
		<div className="relative">
			{/* Status indicator */}
			{isSuccess && (
				<div className="absolute -top-8 right-0 flex items-center gap-1 text-ares-gold text-xs font-bold">
					<CheckCircle className="h-3 w-3" />
					Export complete
				</div>
			)}

			{isError && (
				<div className="absolute -top-8 right-0 flex items-center gap-1 text-ares-red text-xs font-bold max-w-[200px]">
					<XCircle className="h-3 w-3 flex-shrink-0" />
					<span className="truncate">{errorMessage}</span>
				</div>
			)}

			{/* Export dropdown button */}
			<button
				onClick={(e) => {
					e.stopPropagation();
					if (isError) {
						resetStatus();
					} else if (!isExporting && !isSuccess) {
						setIsOpen(!isOpen);
					}
				}}
				disabled={isExporting || isSuccess}
				className="flex items-center gap-1 px-3 py-1.5 bg-ares-gold/10 text-ares-gold hover:bg-ares-gold hover:text-obsidian disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-wider rounded transition-all"
			>
				{isExporting ? (
					<>
						<Loader2 className="h-3 w-3 animate-spin" />
						{status === "polling" ? `Exporting ${Math.round(progress)}%` : "Exporting..."}
					</>
				) : isSuccess ? (
					<>
						<CheckCircle className="h-3 w-3" />
						Done
					</>
				) : (
					<>
						<Download className="h-3 w-3" />
						Export
						<ChevronDown className="h-3 w-3" />
					</>
				)}
			</button>

			{/* Dropdown menu */}
			{isOpen && !isExporting && !isSuccess && (
				<div
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
					role="presentation"
					className="absolute top-full right-0 mt-2 bg-white border border-ares-bronze/20 rounded-lg shadow-lg overflow-hidden z-10 min-w-[180px]"
				>
					<button
						onClick={exportSTL}
						className="w-full px-4 py-3 text-left text-sm text-obsidian hover:bg-ares-bronze/10 transition-colors flex items-center justify-between"
					>
						<span>STL (3D Printing)</span>
						<span className="text-xs text-marble/40">.stl</span>
					</button>
					{elementType === "assembly" && (
						<button
							onClick={exportSTEP}
							className="w-full px-4 py-3 text-left text-sm text-obsidian hover:bg-ares-bronze/10 transition-colors flex items-center justify-between border-t border-ares-bronze/10"
						>
							<span>STEP (Manufacturing)</span>
							<span className="text-xs text-marble/40">.step</span>
						</button>
					)}
				</div>
			)}
		</div>
	);
}
