/**
 * Phase 78-02: Onshape CAD Browser Page
 *
 * Main page for browsing Onshape CAD models.
 * Per ONSHAPE-04: Browse documents through web portal
 * Per ONSHAPE-05: Public documents visible to all, private require auth
 */

import { createFileRoute } from "@tanstack/react-router";
import { ModelGallery } from "../../components/onshape/ModelGallery";
import { OnshapeAuthButton } from "../../components/onshape/OnshapeAuthButton";

export const Route = createFileRoute("/onshape/")({
	component: OnshapePage,
});

import { logger } from "../../utils/logger";

function OnshapePage() {
	const handleDocumentClick = (documentId: string) => {
		// Navigate to document detail view (future enhancement)
		logger.debug("View document:", documentId);
	};

	return (
			<div className="flex-1 w-full flex flex-col min-h-0">
				{/* Header */}
				<header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div>
						<h2 className="text-2xl font-bold text-white tracking-tighter flex items-center gap-3">
							<span className="inline-block w-8 h-8 bg-ares-gold ares-cut-sm"></span>
							Onshape CAD Models
						</h2>
						<p className="text-marble/60 text-sm mt-1">
							Browse and export CAD models from Onshape
						</p>
					</div>
					<OnshapeAuthButton />
				</header>

				{/* Main content */}
				<div className="flex-1 bg-white rounded-lg border border-ares-bronze/20 p-6 overflow-auto">
					<ModelGallery
						mode="public"
						onDocumentClick={handleDocumentClick}
						showActions={false}
					/>
				</div>
			</div>
	);
}
