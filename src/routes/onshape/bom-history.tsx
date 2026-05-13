/**
 * Phase 78-04: Onshape BOM Sync History Page
 *
 * Displays sync history for Bill of Materials.
 * Per ONSHAPE-12: BOM sync history is tracked in database
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/onshape/bom-history")({
	component: BOMHistoryPage,
});

interface BOMHistoryEntry {
	id: number;
	documentId: string;
	elementId: string;
	partCount: number;
	syncedBy: string;
	syncedAt: string;
}

function BOMHistoryPage() {
	// Fetch BOM sync history
	const { data, isLoading, error, refetch } = useQuery<{ history: BOMHistoryEntry[] }>({
		queryKey: ["onshape", "bom-history"],
		queryFn: async () => {
			const response = await fetch("/api/onshape/bom/history/all");
			if (!response.ok) {
				throw new Error(`Failed to fetch BOM history: ${response.status}`);
			}
			return response.json();
		},
		staleTime: 2 * 60 * 1000, // 2 minutes cache
	});

	const history = data?.history || [];

	const formatDate = (dateStr: string) => {
		try {
			return new Date(dateStr).toLocaleString();
		} catch {
			return "";
		}
	};

	return (
			<div className="flex-1 w-full flex flex-col min-h-0">
				{/* Header */}
				<header className="mb-6">
					<h2 className="text-2xl font-bold text-white tracking-tighter flex items-center gap-3">
						<span className="inline-block w-8 h-8 bg-ares-gold ares-cut-sm"></span>
						BOM Sync History
					</h2>
					<p className="text-marble/60 text-sm mt-1">
						Track Bill of Materials synchronization activity
					</p>
				</header>

				{/* Main content */}
				<div className="flex-1 bg-white rounded-lg border border-ares-bronze/20 p-6 overflow-auto">
					{/* Loading state */}
					{isLoading && (
						<div className="flex flex-col items-center justify-center py-12">
							<Clock className="h-8 w-8 animate-spin text-ares-bronze mb-4" />
							<p className="text-sm text-marble/60">Loading sync history...</p>
						</div>
					)}

					{/* Error state */}
					{error && (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<AlertCircle className="h-12 w-12 text-ares-red mb-4" />
							<h3 className="text-lg font-bold text-obsidian mb-2">Failed to load history</h3>
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
					{!isLoading && !error && history.length === 0 && (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<Clock className="h-16 w-16 text-ares-bronze/30 mb-4" />
							<h3 className="text-lg font-bold text-obsidian mb-2">No sync history yet</h3>
							<p className="text-sm text-marble/60">
								BOM sync history will appear here after you view BOMs for assemblies.
							</p>
						</div>
					)}

					{/* History table */}
					{!isLoading && !error && history.length > 0 && (
						<div className="overflow-x-auto">
							<table className="w-full text-sm" aria-label="BOM Sync History">
								<thead className="bg-obsidian text-white">
									<tr>
										<th className="px-4 py-3 font-bold uppercase tracking-wider text-left">
											Document ID
										</th>
										<th className="px-4 py-3 font-bold uppercase tracking-wider text-left">
											Element ID
										</th>
										<th className="px-4 py-3 font-bold uppercase tracking-wider text-left">
											Part Count
										</th>
										<th className="px-4 py-3 font-bold uppercase tracking-wider text-left">
											Synced By
										</th>
										<th className="px-4 py-3 font-bold uppercase tracking-wider text-left">
											Synced At
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-ares-bronze/10">
									{history.map((entry) => (
										<tr key={entry.id} className="hover:bg-ares-gold/10 transition-colors">
											<td className="px-4 py-3 text-obsidian font-mono text-xs">
												{entry.documentId.slice(0, 8)}...
											</td>
											<td className="px-4 py-3 text-obsidian font-mono text-xs">
												{entry.elementId.slice(0, 8)}...
											</td>
											<td className="px-4 py-3 text-obsidian text-right font-mono">
												{entry.partCount}
											</td>
											<td className="px-4 py-3 text-marble/80">
												{entry.syncedBy}
											</td>
											<td className="px-4 py-3 text-marble/60">
												{formatDate(entry.syncedAt)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
	);
}
