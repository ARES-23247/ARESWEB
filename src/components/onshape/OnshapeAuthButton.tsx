/**
 * Phase 78-02: Onshape Authentication Button Component
 *
 * Handles OAuth connection state for Onshape integration.
 * Per ONSHAPE-04: User authentication required for private documents
 */

import { useState, useEffect } from "react";
import { ChevronDown, LogOut, ExternalLink } from "lucide-react";

interface OnshapeAuthStatus {
	connected: boolean;
	email?: string;
}

export function OnshapeAuthButton() {
	const [status, setStatus] = useState<OnshapeAuthStatus>({ connected: false });
	const [loading, setLoading] = useState(true);
	const [showDropdown, setShowDropdown] = useState(false);

	// Check authentication status on mount
	useEffect(() => {
		fetch("/api/onshape/auth/status")
			.then((res) => res.json())
			.then((data) => {
				setStatus(data as OnshapeAuthStatus);
				setLoading(false);
			})
			.catch(() => {
				setStatus({ connected: false });
				setLoading(false);
			});
	}, []);

	const handleConnect = () => {
		// Initiate OAuth flow by redirecting to authorize endpoint
		window.location.href = "/api/onshape/authorize";
	};

	const handleDisconnect = async () => {
		try {
			await fetch("/api/onshape/auth/logout", { method: "POST" });
			setStatus({ connected: false });
			setShowDropdown(false);
		} catch (error) {
			console.error("Failed to disconnect:", error);
		}
	};

	if (loading) {
		return (
			<button
				type="button"
				disabled
				className="px-4 py-2 bg-ares-bronze/20 text-ares-bronze font-bold uppercase tracking-widest ares-cut-sm text-xs"
			>
				Loading...
			</button>
		);
	}

	if (!status.connected) {
		return (
			<button
				type="button"
				onClick={handleConnect}
				className="px-4 py-2 bg-ares-red hover:bg-ares-red/90 text-white font-bold uppercase tracking-widest ares-cut-sm text-xs transition-all shadow-lg"
			>
				Connect Onshape
			</button>
		);
	}

	// Connected state - show dropdown with user info
	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setShowDropdown(!showDropdown)}
				className="flex items-center gap-2 px-4 py-2 bg-obsidian border border-ares-gold/30 text-ares-gold font-bold uppercase tracking-widest ares-cut-sm text-xs hover:bg-obsidian/80 transition-all"
			>
				<span>{status.email}</span>
				<ChevronDown className="h-4 w-4" />
			</button>

			{showDropdown && (
				<>
					{/* Backdrop */}
					<div
						className="fixed inset-0 z-10"
						onClick={() => setShowDropdown(false)}
						onKeyDown={(e) => e.key === "Escape" && setShowDropdown(false)}
						role="presentation"
					/>

					{/* Dropdown */}
					<div className="absolute right-0 mt-2 w-48 bg-obsidian border border-ares-gold/30 rounded-lg shadow-xl z-20">
						<div className="p-2 border-b border-ares-gold/20">
							<p className="text-xs text-marble/60">Connected as</p>
							<p className="text-sm text-white font-medium truncate">{status.email}</p>
						</div>

						<a
							href="https://cad.onshape.com"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 px-3 py-2 text-sm text-marble hover:text-white hover:bg-white/5 transition-colors"
						>
							<ExternalLink className="h-4 w-4" />
							Open Onshape
						</a>

						<button
							type="button"
							onClick={handleDisconnect}
							className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ares-red hover:bg-ares-red/10 transition-colors"
						>
							<LogOut className="h-4 w-4" />
							Disconnect
						</button>
					</div>
				</>
			)}
		</div>
	);
}
