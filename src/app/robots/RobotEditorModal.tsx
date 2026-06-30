import React, { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { RobotItem, RobotVersion } from "./types"; // We will create types.ts or import from elsewhere

interface RobotEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRobot: RobotItem | null;
  onSubmit: (id: string, data: Omit<RobotItem, "id">) => void;
  isPending: boolean;
}

export default function RobotEditorModal({
  isOpen,
  onClose,
  editingRobot,
  onSubmit,
  isPending
}: RobotEditorModalProps) {
  const [formName, setFormName] = useState("");
  const [formId, setFormId] = useState("");
  const [formSeasonName, setFormSeasonName] = useState("");
  const [formChallengeName, setFormChallengeName] = useState("");
  const [formWeightLbs, setFormWeightLbs] = useState<number | "">("");
  const [formDrivetrainType, setFormDrivetrainType] = useState("");
  const [formProgrammingLanguage, setFormProgrammingLanguage] = useState("");
  const [formRevealVideoId, setFormRevealVideoId] = useState("");
  const [formOnshapeUrl, setFormOnshapeUrl] = useState("");
  const [formCadViewerUrl, setFormCadViewerUrl] = useState("");
  const [formPrimaryMechanism, setFormPrimaryMechanism] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formVersions, setFormVersions] = useState<RobotVersion[]>([]);

  useEffect(() => {
    if (editingRobot) {
      setFormId(editingRobot.id);
      setFormName(editingRobot.name);
      setFormSeasonName(editingRobot.seasonName);
      setFormChallengeName(editingRobot.challengeName);
      setFormWeightLbs(editingRobot.weightLbs ?? "");
      setFormDrivetrainType(editingRobot.drivetrainType ?? "");
      setFormProgrammingLanguage(editingRobot.programmingLanguage ?? "");
      setFormRevealVideoId(editingRobot.revealVideoId ?? "");
      setFormOnshapeUrl(editingRobot.onshapeUrl ?? "");
      setFormCadViewerUrl(editingRobot.cadViewerUrl ?? "");
      setFormPrimaryMechanism(editingRobot.primaryMechanism ?? "");
      setFormContent(editingRobot.content ?? "");
      setFormVersions(editingRobot.versions ?? []);
    } else {
      setFormId("");
      setFormName("");
      setFormSeasonName("");
      setFormChallengeName("");
      setFormWeightLbs("");
      setFormDrivetrainType("");
      setFormProgrammingLanguage("");
      setFormRevealVideoId("");
      setFormOnshapeUrl("");
      setFormCadViewerUrl("");
      setFormPrimaryMechanism("");
      setFormContent("");
      setFormVersions([]);
    }
  }, [editingRobot, isOpen]);

  const updateVersionField = (index: number, field: keyof RobotVersion, value: any) => {
    const updated = [...formVersions];
    updated[index] = { ...updated[index], [field]: value };
    setFormVersions(updated);
  };

  const addVersion = () => {
    setFormVersions([
      ...formVersions,
      {
        name: "V" + (formVersions.length + 1) + " - Version Name",
        content: "",
        weightLbs: undefined,
        drivetrainType: "",
        cadViewerUrl: "",
        primaryMechanism: ""
      }
    ]);
  };

  const removeVersion = (index: number) => {
    setFormVersions(formVersions.filter((_, idx) => idx !== index));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    onSubmit(formId, {
      name: formName,
      seasonName: formSeasonName,
      challengeName: formChallengeName,
      weightLbs: formWeightLbs === "" ? undefined : Number(formWeightLbs),
      drivetrainType: formDrivetrainType,
      programmingLanguage: formProgrammingLanguage,
      revealVideoId: formRevealVideoId,
      onshapeUrl: formOnshapeUrl,
      cadViewerUrl: formCadViewerUrl,
      primaryMechanism: formPrimaryMechanism,
      content: formContent,
      versions: formVersions
    });
  };

  if (!isOpen) return null;

  const inputClass =
    "w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-2.5 text-white placeholder-white/30 focus:border-ares-cyan focus:outline-none focus:ring-1 focus:ring-ares-cyan transition-all text-sm";
  const labelClass = "block text-[10px] font-black uppercase tracking-wider text-marble/55 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-obsidian border border-white/10 ares-cut-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-marble/60 hover:text-white p-1 hover:bg-white/5 ares-cut-sm transition-all"
        >
          <X size={20} />
        </button>

        <div className="text-left">
          <h2 className="text-2xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-ares-gold font-heading">
            {editingRobot ? "Edit Fleet Record" : "Deploy New Robot"}
          </h2>
          <p className="text-xs text-marble/55 mt-1 font-semibold uppercase tracking-wider">
            Specify telemetry calibrations, physical constants, and system schematics.
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-left">
              <label htmlFor="robot-name" className={labelClass}>Robot Name</label>
              <input
                id="robot-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Minotaur"
                className={inputClass}
                required
              />
            </div>
            <div className="text-left">
              <label htmlFor="robot-id" className={labelClass}>Robot ID / Slug</label>
              <input
                id="robot-id"
                type="text"
                value={formId}
                onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                placeholder="e.g. minotaur"
                className={inputClass}
                disabled={!!editingRobot}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-left">
              <label htmlFor="robot-season" className={labelClass}>Season Name</label>
              <input
                id="robot-season"
                type="text"
                value={formSeasonName}
                onChange={(e) => setFormSeasonName(e.target.value)}
                placeholder="e.g. 2025-2026"
                className={inputClass}
              />
            </div>
            <div className="text-left">
              <label htmlFor="robot-challenge" className={labelClass}>Challenge Name</label>
              <input
                id="robot-challenge"
                type="text"
                value={formChallengeName}
                onChange={(e) => setFormChallengeName(e.target.value)}
                placeholder="e.g. INTO THE DEEP"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-left">
              <label htmlFor="robot-weight" className={labelClass}>Weight (lbs)</label>
              <input
                id="robot-weight"
                type="number"
                step="0.1"
                value={formWeightLbs}
                onChange={(e) => setFormWeightLbs(e.target.value === "" ? "" : parseFloat(e.target.value))}
                placeholder="e.g. 14.2"
                className={inputClass}
              />
            </div>
            <div className="text-left">
              <label htmlFor="robot-drivetrain" className={labelClass}>Drivetrain Type</label>
              <input
                id="robot-drivetrain"
                type="text"
                value={formDrivetrainType}
                onChange={(e) => setFormDrivetrainType(e.target.value)}
                placeholder="e.g. Mecanum"
                className={inputClass}
              />
            </div>
            <div className="text-left">
              <label htmlFor="robot-mechanism" className={labelClass}>Primary Mechanism</label>
              <input
                id="robot-mechanism"
                type="text"
                value={formPrimaryMechanism}
                onChange={(e) => setFormPrimaryMechanism(e.target.value)}
                placeholder="e.g. Dual-joint Arm"
                className={inputClass}
              />
            </div>
            <div className="text-left">
              <label htmlFor="robot-language" className={labelClass}>Programming Language</label>
              <input
                id="robot-language"
                type="text"
                value={formProgrammingLanguage}
                onChange={(e) => setFormProgrammingLanguage(e.target.value)}
                placeholder="e.g. Kotlin / ARESLib"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-left">
              <label htmlFor="robot-video" className={labelClass}>Reveal Video ID (YouTube)</label>
              <input
                id="robot-video"
                type="text"
                value={formRevealVideoId}
                onChange={(e) => setFormRevealVideoId(e.target.value)}
                placeholder="e.g. dQw4w9WgXcQ"
                className={inputClass}
              />
            </div>
            <div className="text-left">
              <label htmlFor="robot-onshape" className={labelClass}>Onshape URL</label>
              <input
                id="robot-onshape"
                type="text"
                value={formOnshapeUrl}
                onChange={(e) => setFormOnshapeUrl(e.target.value)}
                placeholder="Onshape Workspace URL"
                className={inputClass}
              />
            </div>
            <div className="text-left">
              <label htmlFor="robot-cad-viewer" className={labelClass}>CAD Embed URL</label>
              <input
                id="robot-cad-viewer"
                type="text"
                value={formCadViewerUrl}
                onChange={(e) => setFormCadViewerUrl(e.target.value)}
                placeholder="Embeddable CAD Viewer URL"
                className={inputClass}
              />
            </div>
          </div>

          <div className="text-left">
            <label htmlFor="robot-content" className={labelClass}>System Description (Markdown)</label>
            <textarea
              id="robot-content"
              rows={5}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Describe the robot specs, cycle optimization, programming details..."
              className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-2.5 text-white placeholder-white/30 focus:border-ares-cyan focus:outline-none focus:ring-1 focus:ring-ares-cyan transition-all text-sm resize-none"
            />
          </div>

          {/* Versions Sub-Form */}
          <div className="border-t border-white/5 pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Build Versions / Prototype Logs
              </h3>
              <button
                type="button"
                onClick={addVersion}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-cyan/10 hover:bg-ares-cyan/20 border border-ares-cyan/30 text-ares-cyan text-[10px] font-black uppercase tracking-wider ares-cut-sm transition-all"
              >
                <Plus size={12} /> Add Version
              </button>
            </div>

            {formVersions.length === 0 ? (
              <p className="text-xs text-marble/35 italic text-left">No prototype iterations or historical versions logged.</p>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {formVersions.map((ver, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/5 p-4 ares-cut-sm relative space-y-3">
                    <button
                      type="button"
                      onClick={() => removeVersion(idx)}
                      className="absolute top-2 right-2 text-marble/40 hover:text-ares-red transition-all p-1"
                    >
                      <X size={14} />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="text-left">
                        <label className={labelClass}>Version Name</label>
                        <input
                          type="text"
                          value={ver.name}
                          onChange={(e) => updateVersionField(idx, "name", e.target.value)}
                          placeholder="e.g. V1 - Intake Prototype"
                          className={inputClass}
                        />
                      </div>
                      <div className="text-left">
                        <label className={labelClass}>Weight (lbs)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={ver.weightLbs ?? ""}
                          onChange={(e) =>
                            updateVersionField(
                              idx,
                              "weightLbs",
                              e.target.value === "" ? undefined : parseFloat(e.target.value)
                            )
                          }
                          placeholder="e.g. 13.5"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="text-left">
                        <label className={labelClass}>Drivetrain</label>
                        <input
                          type="text"
                          value={ver.drivetrainType ?? ""}
                          onChange={(e) => updateVersionField(idx, "drivetrainType", e.target.value)}
                          placeholder="e.g. 4-Motor Mecanum"
                          className={inputClass}
                        />
                      </div>
                      <div className="text-left">
                        <label className={labelClass}>Primary Mechanism</label>
                        <input
                          type="text"
                          value={ver.primaryMechanism ?? ""}
                          onChange={(e) => updateVersionField(idx, "primaryMechanism", e.target.value)}
                          placeholder="e.g. Single-joint arm"
                          className={inputClass}
                        />
                      </div>
                      <div className="text-left">
                        <label className={labelClass}>CAD Embed URL</label>
                        <input
                          type="text"
                          value={ver.cadViewerUrl ?? ""}
                          onChange={(e) => updateVersionField(idx, "cadViewerUrl", e.target.value)}
                          placeholder="Viewer Embed URL"
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="text-left">
                      <label className={labelClass}>Version Description</label>
                      <textarea
                        rows={2}
                        value={ver.content}
                        onChange={(e) => updateVersionField(idx, "content", e.target.value)}
                        placeholder="Describe prototype performance constraints and dynamic test findings..."
                        className="w-full bg-black/40 border border-white/10 ares-cut-sm px-3 py-2 text-white placeholder-white/30 focus:border-ares-cyan focus:outline-none focus:ring-1 focus:ring-ares-cyan transition-all text-xs resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-white/10 hover:bg-white/5 text-xs font-black uppercase tracking-wider text-marble ares-cut-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-ares-cyan text-black hover:bg-ares-cyan/80 text-xs font-black uppercase tracking-wider ares-cut-sm transition-all shadow-xl disabled:opacity-50"
            >
              {isPending ? "Syncing..." : editingRobot ? "Save Changes" : "Deploy Robot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
