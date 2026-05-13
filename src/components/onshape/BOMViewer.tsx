/**
 * Phase 78-04: Onshape Bill of Materials Viewer Component
 *
 * Displays BOM data for assemblies with sorting and CSV export.
 * Per ONSHAPE-10: View Bill of Materials for assemblies
 * Per ONSHAPE-11: BOM includes part names, quantities, and materials
 * Per ARES brand: League Spartan headings, proper contrast ratios
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export interface BOMPart {
	partId: string;
	partName: string;
	partNumber: string;
	quantity: number;
	material: string;
	mass: number;
	configuration: string;
}

export interface BOMData {
	documentId: string;
	elementId: string;
	elementName: string;
	parts: BOMPart[];
	totalParts: number;
	totalMass: number;
	lastSyncedAt: string;
}

interface BOMViewerProps {
	documentId: string;
	elementId: string;
	elementName: string;
}

type SortField = "partName" | "partNumber" | "quantity" | "material" | "mass";
type SortDirection = "asc" | "desc";

export function BOMViewer({ documentId, elementId, elementName }: BOMViewerProps) {
	const [sortField, setSortField] = useState<SortField>("partName");
	const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

	// Fetch BOM data
	const { data, isLoading, error, refetch } = useQuery<BOMData>({
		queryKey: ["onshape", "bom", documentId, elementId],
		queryFn: async () => {
			const response = await fetch(`/api/onshape/bom/${documentId}/${elementId}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch BOM: ${response.status}`);
			}
			return response.json();
		},
		staleTime: 5 * 60 * 1000, // 5 minutes cache
	});

	// Sort parts
	const sortedParts = useMemo(() => {
		if (!data?.parts) return [];

		const parts = [...data.parts];
		parts.sort((a, b) => {
			const aVal = a[sortField];
			const bVal = b[sortField];

			if (typeof aVal === "string" && typeof bVal === "string") {
				return sortDirection === "asc"
					? aVal.localeCompare(bVal)
					: bVal.localeCompare(aVal);
			}

			if (typeof aVal === "number" && typeof bVal === "number") {
				return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
			}

			return 0;
		});

		return parts;
	}, [data?.parts, sortField, sortDirection]);

	// Handle sort
	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortDirection("asc");
		}
	};

	// Get sort icon
	const getSortIcon = (field: SortField) => {
		if (sortField !== field) {
			return <ArrowUpDown className="h-4 w-4 opacity-30" />;
		}
		return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
	};

	// Export to CSV
	const exportCSV = async () => {
		if (!data) return;

		try {
			const response = await fetch(`/api/onshape/bom/export/${documentId}/${elementId}`);
			if (!response.ok) throw new Error("Export failed");

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${elementName}_BOM_${new Date().toISOString().slice(0, 10)}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("[BOMViewer] Export failed:", err);
		}
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin text-ares-bronze mb-4" />
				<p className="text-sm text-marble/60">Loading Bill of Materials...</p>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<AlertCircle className="h-12 w-12 text-ares-red mb-4" />
				<h3 className="text-lg font-bold text-obsidian mb-2">Failed to load BOM</h3>
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
		);
	}

	// Empty state
	if (!data || data.parts.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<AlertCircle className="h-12 w-12 text-ares-bronze/30 mb-4" />
				<h3 className="text-lg font-bold text-obsidian mb-2">No BOM data available</h3>
				<p className="text-sm text-marble/60">
					This assembly may not have any parts defined.
				</p>
			</div>
		);
	}

	return (
		<div className="w-full">
			{/* Summary header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
				<div>
					<h3 className="text-xl font-bold text-obsidian">{data.elementName}</h3>
					<p className="text-sm text-marble/60">
						Last synced: {new Date(data.lastSyncedAt).toLocaleString()}
					</p>
				</div>
				<div className="flex gap-6">
					<div>
						<div className="text-2xl font-bold text-ares-gold">{data.totalParts}</div>
						<div className="text-xs text-marble/60 uppercase tracking-wider">Total Parts</div>
					</div>
					<div>
						<div className="text-2xl font-bold text-ares-gold">{(data.totalMass / 1000).toFixed(2)} kg</div>
						<div className="text-xs text-marble/60 uppercase tracking-wider">Total Mass</div>
					</div>
				</div>
			</div>

			{/* Export button */}
			<div className="flex justify-end mb-4">
				<button
					onClick={exportCSV}
					className="flex items-center gap-2 px-4 py-2 bg-ares-gold text-obsidian font-bold uppercase tracking-widest ares-cut-sm text-xs hover:bg-ares-gold/80 transition-all"
				>
					<Download className="h-4 w-4" />
					Export CSV
				</button>
			</div>

			{/* BOM Table */}
			<div className="overflow-x-auto rounded-lg border border-ares-bronze/20">
				<table className="w-full text-sm" aria-label="Bill of Materials">
					<thead className="bg-obsidian text-white">
						<tr>
							<th>
								<button
									onClick={() => handleSort("partName")}
									className="flex items-center gap-2 px-4 py-3 font-bold uppercase tracking-wider text-left w-full"
									aria-sort={
										sortField === "partName"
											? sortDirection === "asc"
												? "ascending"
												: "descending"
											: "none"
									}
								>
									Part Name
									{getSortIcon("partName")}
								</button>
							</th>
							<th>
								<button
									onClick={() => handleSort("partNumber")}
									className="flex items-center gap-2 px-4 py-3 font-bold uppercase tracking-wider text-left w-full"
									aria-sort={
										sortField === "partNumber"
											? sortDirection === "asc"
												? "ascending"
												: "descending"
											: "none"
									}
								>
									Part Number
									{getSortIcon("partNumber")}
								</button>
							</th>
							<th>
								<button
									onClick={() => handleSort("quantity")}
									className="flex items-center gap-2 px-4 py-3 font-bold uppercase tracking-wider text-left w-full"
									aria-sort={
										sortField === "quantity"
											? sortDirection === "asc"
												? "ascending"
												: "descending"
											: "none"
									}
								>
									Quantity
									{getSortIcon("quantity")}
								</button>
							</th>
							<th>
								<button
									onClick={() => handleSort("material")}
									className="flex items-center gap-2 px-4 py-3 font-bold uppercase tracking-wider text-left w-full"
									aria-sort={
										sortField === "material"
											? sortDirection === "asc"
												? "ascending"
												: "descending"
											: "none"
									}
								>
									Material
									{getSortIcon("material")}
								</button>
							</th>
							<th>
								<button
									onClick={() => handleSort("mass")}
									className="flex items-center gap-2 px-4 py-3 font-bold uppercase tracking-wider text-left w-full"
									aria-sort={
										sortField === "mass"
											? sortDirection === "asc"
												? "ascending"
												: "descending"
											: "none"
									}
								>
									Mass (g)
									{getSortIcon("mass")}
								</button>
							</th>
							<th className="px-4 py-3 font-bold uppercase tracking-wider text-left">
								Config
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-ares-bronze/10">
						{sortedParts.map((part, index) => (
							<tr
								key={part.partId || index}
								className="hover:bg-ares-gold/10 transition-colors"
							>
								<td className="px-4 py-3 text-obsidian font-medium truncate max-w-[200px]" title={part.partName}>
									{part.partName}
								</td>
								<td className="px-4 py-3 text-marble/80">
									{part.partNumber || "-"}
								</td>
								<td className="px-4 py-3 text-obsidian text-right font-mono">
									{part.quantity}
								</td>
								<td className="px-4 py-3 text-marble/80">
									{part.material}
								</td>
								<td className="px-4 py-3 text-obsidian text-right font-mono">
									{part.mass.toFixed(1)}
								</td>
								<td className="px-4 py-3 text-marble/60 text-xs">
									{part.configuration}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
