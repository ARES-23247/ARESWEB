"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Heart,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
} from "lucide-react";
import {
  type CartItem,
  type Product,
  formatPrice,
  calculateCartSubtotal,
  PICKUP_OPTIONS,
  buildPreOrderPayload,
  validatePreOrderForm,
} from "@/lib/storeCatalogData";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { logger } from "@/utils/logger";

interface PreOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  catalog: readonly Product[];
  onOrderSuccess: () => void;
}

export default function PreOrderModal({
  isOpen,
  onClose,
  items,
  catalog,
  onOrderSuccess,
}: PreOrderModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pickupLocation, setPickupLocation] = useState<string>(PICKUP_OPTIONS[0].id);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const subtotalCents = calculateCartSubtotal(items, catalog);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validatePreOrderForm({
      name,
      email,
      pickupLocation,
      items,
    });

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }
    setValidationErrors({});
    setStatus("submitting");
    setErrorMessage("");

    try {
      const recaptchaToken = await getRecaptchaToken();
      let appCheckHeaders = (await getAppCheckHeader()) || {};
      if (!appCheckHeaders["X-Firebase-AppCheck"]) {
        appCheckHeaders = (await getAppCheckHeader(true)) || {};
      }

      const preOrderPayload = buildPreOrderPayload(
        { name, email, pickupLocation, notes },
        items,
        catalog,
      );

      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...appCheckHeaders,
        },
        body: JSON.stringify({
          type: "sponsor",
          name: preOrderPayload.name,
          email: preOrderPayload.email,
          metadata: {
            inquiryType: preOrderPayload.inquiryType,
            pickupLocation: preOrderPayload.pickupLocation,
            notes: preOrderPayload.notes,
            items: preOrderPayload.items,
            totalCents: preOrderPayload.totalCents,
            message: `Season booster merchandise pre-order request (${formatPrice(preOrderPayload.totalCents)})`,
          },
          recaptchaToken,
        }),
      });

      const data: unknown = await response.json();
      if (!response.ok) {
        const errorDetail =
          data && typeof data === "object" && "error" in data && typeof (data as Record<string, unknown>).error === "string"
            ? ` — ${String((data as Record<string, unknown>).error)}`
            : "";
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorDetail}`);
      }

      setStatus("success");
      onOrderSuccess();
    } catch (err: unknown) {
      logger.error("Pre-order inquiry submission failed:", err);
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred submitting your booster pre-order. Please try again or email us.",
      );
    }
  };

  const handleResetAndClose = () => {
    setStatus("idle");
    setErrorMessage("");
    setValidationErrors({});
    setName("");
    setEmail("");
    setNotes("");
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleResetAndClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-xl -translate-x-1/2 -translate-y-1/2 ares-cut-lg border border-ares-gold/40 bg-obsidian p-6 md:p-8 text-marble shadow-2xl focus:outline-none max-h-[90vh] overflow-y-auto"
          aria-describedby="preorder-modal-description"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ares-red/10 text-ares-red border border-ares-red/30">
                <Heart className="h-5 w-5 fill-ares-red text-ares-red" aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl md:text-2xl font-black uppercase tracking-tight text-white font-heading">
                  Booster Pre-Order Inquiry
                </Dialog.Title>
                <p id="preorder-modal-description" className="text-xs text-marble/70">
                  Direct team booster pre-order supporting FIRST Tech Challenge travel.
                </p>
              </div>
            </div>
            <Dialog.Close
              aria-label="Close pre-order modal"
              className="rounded-lg p-2 text-marble/60 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {status === "success" ? (
            <div className="py-8 text-center space-y-5" data-testid="preorder-success-view">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ares-gold/20 text-ares-gold border border-ares-gold/40">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-black uppercase text-white font-heading">
                Pre-Order Received!
              </h3>
              <p className="mx-auto max-w-md text-xs leading-relaxed text-marble/85 font-medium">
                Thank you for backing ARES Team 23247! Our booster coordinator will review your merchandise request and email you at <span className="font-bold text-white">{email}</span> with fulfillment timing and tournament pit pickup details.
              </p>

              <div className="rounded-lg border border-ares-gold/20 bg-ares-gold/5 p-4 text-left text-xs text-marble/80 space-y-1 font-mono">
                <div className="flex justify-between font-sans font-bold text-white">
                  <span>Pre-Order Estimated Total:</span>
                  <span className="text-ares-gold font-mono">{formatPrice(subtotalCents)}</span>
                </div>
                <p className="font-sans text-[11px] text-marble/60 pt-1">
                  100% of proceeds fund student travel and competition robot hardware.
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="clipped-button bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase px-8 py-3 transition-all"
                >
                  Return to Store
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5" data-testid="preorder-form">
              {/* Zero Financial PII Protection Banner */}
              <div className="rounded-lg border border-ares-cyan/30 bg-ares-cyan/5 p-4 text-xs">
                <div className="flex items-center gap-2 font-bold text-ares-cyan mb-1.5">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  <span className="uppercase tracking-wider">Zero Financial PII Protection</span>
                </div>
                <p className="text-marble/80 leading-relaxed">
                  We <strong>never</strong> collect, charge, or store credit cards, bank accounts, or financial details on this website. Pre-orders are coordinated directly through team booster volunteers.
                </p>
              </div>

              {/* Error Message */}
              {status === "error" && (
                <div role="alert" aria-live="assertive" className="flex items-center gap-2 rounded-lg border border-ares-danger/40 bg-ares-danger/10 p-3 text-xs text-white">
                  <AlertCircle className="h-4 w-4 shrink-0 text-ares-danger" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Contact Information */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="preorder-name" className="block text-[11px] font-black uppercase tracking-wider text-marble mb-1">
                    Your Full Name *
                  </label>
                  <input
                    id="preorder-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full rounded border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-marble/30 focus:border-ares-red focus:outline-none focus:ring-2 focus:ring-ares-red transition-all"
                  />
                  {validationErrors.name && (
                    <p className="mt-1 text-[10px] font-bold text-ares-danger">{validationErrors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="preorder-email" className="block text-[11px] font-black uppercase tracking-wider text-marble mb-1">
                    Email Address *
                  </label>
                  <input
                    id="preorder-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. alex@example.org"
                    className="w-full rounded border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-marble/30 focus:border-ares-red focus:outline-none focus:ring-2 focus:ring-ares-red transition-all"
                  />
                  {validationErrors.email && (
                    <p className="mt-1 text-[10px] font-bold text-ares-danger">{validationErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="preorder-pickup" className="block text-[11px] font-black uppercase tracking-wider text-marble mb-1">
                    Fulfillment / Pickup Preference *
                  </label>
                  <select
                    id="preorder-pickup"
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-full rounded border border-white/10 bg-obsidian px-4 py-2.5 text-xs text-white focus:border-ares-red focus:outline-none focus:ring-2 focus:ring-ares-red transition-all cursor-pointer [color-scheme:dark]"
                  >
                    {PICKUP_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-obsidian text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="preorder-notes" className="block text-[11px] font-black uppercase tracking-wider text-marble mb-1">
                    Booster Notes / Student Reference (Optional)
                  </label>
                  <textarea
                    id="preorder-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Student name or specific competition date"
                    className="w-full rounded border border-white/10 bg-white/5 px-4 py-2 text-xs text-white placeholder-marble/30 focus:border-ares-red focus:outline-none focus:ring-2 focus:ring-ares-red transition-all resize-none"
                  />
                </div>
              </div>

              {/* Order Recap */}
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-xs space-y-2">
                <div className="flex items-center justify-between text-marble/80">
                  <span>Selected Merchandise Total:</span>
                  <span className="font-mono text-sm font-black text-white">{formatPrice(subtotalCents)}</span>
                </div>
                <div className="text-[10px] text-marble/60">
                  {items.length} {items.length === 1 ? "item type" : "item types"} in pre-order cart
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="rounded px-4 py-2.5 text-xs font-bold text-marble/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  aria-busy={status === "submitting"}
                  className="clipped-button bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase px-6 py-3 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Transmitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      <span>Send Pre-Order Inquiry</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
