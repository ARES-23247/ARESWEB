"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
  Printer,
  ShieldAlert,
  Shirt,
  Utensils,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

interface TravelReadinessMember {
  id: string;
  nickname: string;
  role: string;
  memberType: string;
  subteams: string[];
  tshirtSize: string;
  dietaryRestrictions: string[];
  hasEmergencyContact: boolean;
  firstConsentVerified: boolean;
  firstConsentUpdatedAt: string;
}

interface RevealedTravelMember {
  id: string;
  nickname: string;
  legalName: string | null;
  role: string;
  memberType: string;
  tshirtSize: string;
  dietaryRestrictions: string[];
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  firstConsentVerified: boolean;
}

export default function TravelReadinessPanel() {
  const [members, setMembers] = useState<TravelReadinessMember[]>([]);
  const [tshirtCounts, setTshirtCounts] = useState<Record<string, number>>({});
  const [dietaryCounts, setDietaryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [revealedPacket, setRevealedPacket] = useState<{
    packetGeneratedAt: string;
    members: RevealedTravelMember[];
  } | null>(null);
  const [revealing, setRevealing] = useState(false);

  const loadReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authenticatedFetch("/api/profiles/admin/travel-readiness");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(`HTTP ${res.status}: ${body.error || res.statusText}`);
      }
      const data = (await res.json()) as {
        members: TravelReadinessMember[];
        tshirtCounts: Record<string, number>;
        dietaryCounts: Record<string, number>;
      };
      setMembers(Array.isArray(data.members) ? data.members : []);
      setTshirtCounts(data.tshirtCounts ?? {});
      setDietaryCounts(data.dietaryCounts ?? {});
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load travel and safety readiness.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  const handleToggleConsent = async (member: TravelReadinessMember) => {
    const nextVal = !member.firstConsentVerified;
    setTogglingId(member.id);
    setError(null);
    try {
      const res = await authenticatedFetch(
        `/api/profiles/admin/users/${encodeURIComponent(member.id)}/consent`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstConsentVerified: nextVal }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(`HTTP ${res.status}: ${body.error || res.statusText}`);
      }
      const payload = (await res.json()) as {
        firstConsentVerified: boolean;
        firstConsentUpdatedAt: string;
      };
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? {
                ...m,
                firstConsentVerified: payload.firstConsentVerified,
                firstConsentUpdatedAt: payload.firstConsentUpdatedAt,
              }
            : m,
        ),
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not update FIRST consent status.",
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleRevealEmergencyBinder = async () => {
    setRevealing(true);
    setError(null);
    try {
      const res = await authenticatedFetch(
        "/api/profiles/admin/travel-readiness/reveal",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Coach tournament travel binder" }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(`HTTP ${res.status}: ${body.error || res.statusText}`);
      }
      const payload = (await res.json()) as {
        packetGeneratedAt: string;
        members: RevealedTravelMember[];
      };
      setRevealedPacket(payload);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reveal emergency travel packet.",
      );
    } finally {
      setRevealing(false);
    }
  };

  const consentCount = members.filter((m) => m.firstConsentVerified).length;
  const emergencyCount = members.filter((m) => m.hasEmergencyContact).length;
  const shirtCount = members.filter((m) => Boolean(m.tshirtSize)).length;

  return (
    <section
      aria-labelledby="travel-readiness-heading"
      className="glass-card ares-cut border border-ares-cyan/30 bg-black/40 p-6 space-y-6 print:border-black print:bg-white print:text-black"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-4 print:border-black/20">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ares-cyan print:text-black">
            Coach &amp; Admin Safety Console
          </p>
          <h2
            id="travel-readiness-heading"
            className="text-xl font-black uppercase tracking-tight text-white font-heading print:text-black"
          >
            Travel, Safety &amp; FIRST® Consent Readiness
          </h2>
          <p className="text-xs text-marble/65 mt-1 print:text-black/75">
            Boolean readiness checks keep emergency contact phone numbers encrypted at rest until a coach explicitly opens the audited Travel Binder.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => void handleRevealEmergencyBinder()}
            disabled={revealing || loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase tracking-wider ares-cut-sm cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <ShieldAlert size={14} aria-hidden="true" />
            {revealing
              ? "Decrypting Binder..."
              : "Reveal & Print Emergency Travel Binder"}
          </button>
          {revealedPacket && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-ares-gold text-black hover:bg-ares-bronze text-xs font-black uppercase tracking-wider ares-cut-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Printer size={14} aria-hidden="true" /> Print Binder
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded border border-ares-red/40 bg-ares-red/15 p-3 text-xs font-mono text-white"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p role="status" className="py-6 text-xs font-mono text-marble/60">
          Checking encrypted safety readiness across active roster...
        </p>
      ) : (
        <>
          {/* KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-ares-gold flex items-center gap-1.5">
                <ClipboardCheck size={13} aria-hidden="true" /> FIRST® Consent &amp; Release
              </span>
              <p className="mt-2 font-heading text-2xl font-black text-white">
                {consentCount} / {members.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-ares-cyan flex items-center gap-1.5">
                <CheckCircle2 size={13} aria-hidden="true" /> Emergency Contact On File
              </span>
              <p className="mt-2 font-heading text-2xl font-black text-white">
                {emergencyCount} / {members.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-marble/70 flex items-center gap-1.5">
                <Shirt size={13} aria-hidden="true" /> Jersey Sizes Recorded
              </span>
              <p className="mt-2 font-heading text-2xl font-black text-white">
                {shirtCount} / {members.length}
              </p>
            </div>
          </div>

          {/* T-Shirt & Dietary Aggregations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-ares-gold mb-2 flex items-center gap-1.5">
                <Shirt size={12} aria-hidden="true" /> Team Jersey Order Tally
              </h3>
              {Object.keys(tshirtCounts).length === 0 ? (
                <p className="text-xs text-marble/55">No jersey sizes submitted yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(tshirtCounts).map(([size, count]) => (
                    <span
                      key={size}
                      className="rounded border border-white/15 bg-black/40 px-2.5 py-1 font-mono text-xs font-bold uppercase text-white"
                    >
                      {size}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-ares-cyan mb-2 flex items-center gap-1.5">
                <Utensils size={12} aria-hidden="true" /> Catering &amp; Allergy Summary
              </h3>
              {Object.keys(dietaryCounts).length === 0 ? (
                <p className="text-xs text-marble/55">No dietary restrictions reported.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dietaryCounts).map(([restriction, count]) => (
                    <span
                      key={restriction}
                      className="rounded border border-ares-cyan/30 bg-ares-cyan/10 px-2.5 py-1 text-xs font-bold text-white"
                    >
                      {restriction} ({count})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Boolean Readiness Matrix (Non-Print Default) */}
          {!revealedPacket && (
            <div className="overflow-x-auto rounded-xl border border-white/10 print:hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-[10px] font-black uppercase tracking-wider text-marble/70">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role / Type</th>
                    <th className="px-4 py-3">Jersey</th>
                    <th className="px-4 py-3">Emergency Contact</th>
                    <th className="px-4 py-3">FIRST® Consent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-bold text-white">
                        {member.nickname}
                      </td>
                      <td className="px-4 py-3 text-marble/70 uppercase text-[10px] font-mono">
                        {member.memberType || member.role}
                      </td>
                      <td className="px-4 py-3 uppercase font-mono text-white">
                        {member.tshirtSize || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {member.hasEmergencyContact ? (
                          <span className="inline-flex items-center gap-1 text-ares-cyan font-bold">
                            <CheckCircle2 size={13} aria-hidden="true" /> On File
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-ares-gold font-bold">
                            <AlertTriangle size={13} aria-hidden="true" /> Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={togglingId === member.id}
                          aria-pressed={member.firstConsentVerified}
                          aria-label={
                            member.firstConsentVerified
                              ? `Mark FIRST consent unverified for ${member.nickname}`
                              : `Verify FIRST consent for ${member.nickname}`
                          }
                          onClick={() => void handleToggleConsent(member)}
                          className={`rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                            member.firstConsentVerified
                              ? "bg-ares-gold text-obsidian"
                              : "border border-white/15 bg-white/5 text-marble/80 hover:text-white"
                          }`}
                        >
                          {member.firstConsentVerified
                            ? "Verified ✓"
                            : "Verify Consent"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Audited Printable Emergency Binder */}
          {revealedPacket && (
            <div className="rounded-xl border-2 border-ares-gold/50 bg-black/80 p-5 space-y-4 print:border-black print:bg-white print:text-black">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 print:border-black/20">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-ares-gold print:text-black">
                    CONFIDENTIAL COACH TRAVEL BINDER • ACCESS LOGGED IN AUDIT TRAIL
                  </p>
                  <p className="text-[11px] font-mono text-marble/70 print:text-black">
                    Generated {new Date(revealedPacket.packetGeneratedAt).toLocaleString()} • ARES #23247
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRevealedPacket(null)}
                  className="rounded border border-white/15 px-3 py-1 text-[10px] font-black uppercase text-marble hover:text-white print:hidden cursor-pointer"
                >
                  Hide Decrypted Binder
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/15 text-[10px] font-black uppercase tracking-wider text-ares-gold print:border-black print:text-black">
                    <tr>
                      <th className="px-3 py-2">Member (Legal Name)</th>
                      <th className="px-3 py-2">Emergency Contact</th>
                      <th className="px-3 py-2">Emergency Phone</th>
                      <th className="px-3 py-2">Dietary / Allergies</th>
                      <th className="px-3 py-2">FIRST® Consent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 print:divide-black/20">
                    {revealedPacket.members.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-bold text-white print:text-black">
                          <div>{item.legalName || item.nickname}</div>
                          <div className="text-[10px] font-mono text-marble/60 print:text-black/70">
                            @{item.nickname} • {item.tshirtSize ? `Size ${item.tshirtSize.toUpperCase()}` : "No size"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-white print:text-black">
                          {item.emergencyContactName || "Not provided"}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-ares-cyan print:text-black">
                          {item.emergencyContactPhone || "Not provided"}
                        </td>
                        <td className="px-3 py-2 text-marble/85 print:text-black">
                          {item.dietaryRestrictions.length > 0
                            ? item.dietaryRestrictions.join(", ")
                            : "None listed"}
                        </td>
                        <td className="px-3 py-2 font-bold text-white print:text-black">
                          {item.firstConsentVerified ? "Verified" : "Pending"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
