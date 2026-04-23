import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import AssetPickerModal from "./AssetPickerModal";
import { DEFAULT_COVER_IMAGE } from "../utils/constants";
import { useImageUpload } from "../hooks/useImageUpload";
import { useEntityFetch } from "../hooks/useEntityFetch";
import { adminApi } from "../api/adminApi";
import CoverAssetPicker from "./editor/CoverAssetPicker";
import EditorFooter from "./editor/EditorFooter";

interface SeasonData {
  start_year: number;
  end_year: number;
  challenge_name: string;
  robot_name?: string;
  robot_image?: string;
  robot_description?: string;
  robot_cad_url?: string;
  summary?: string;
  album_url?: string;
  album_cover?: string;
  status: "published" | "draft";
}

export default function SeasonEditor() {
  const { editId } = useParams<{ editId?: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const { uploadFile, isUploading: isUploadingCover } = useImageUpload();
  const { uploadFile: uploadAlbumCover, isUploading: isUploadingAlbumCover } = useImageUpload();

  // Local State
  const [isPending, setIsPending] = useState(false);
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear());
  const [endYear, setEndYear] = useState<number>(new Date().getFullYear() + 1);
  const [challengeName, setChallengeName] = useState("");
  const [robotName, setRobotName] = useState("");
  const [robotImageUrl, setRobotImageUrl] = useState(DEFAULT_COVER_IMAGE);
  const [cadUrl, setCadUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [albumUrl, setAlbumUrl] = useState("");
  const [albumCoverUrl, setAlbumCoverUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isAlbumCoverPickerOpen, setIsAlbumCoverPickerOpen] = useState(false);

  const editor = useRichEditor({ placeholder: "<p>Describe the robot's design, mechanisms, and season highlights...</p>" });

  useEntityFetch<{ season?: SeasonData }>(
    editId ? `/api/admin/seasons/${editId}` : null,
    (data) => {
      if (data?.season) {
        setStartYear(data.season.start_year);
        setEndYear(data.season.end_year);
        setChallengeName(data.season.challenge_name);
        setRobotName(data.season.robot_name || "");
        setRobotImageUrl(data.season.robot_image || DEFAULT_COVER_IMAGE);
        setCadUrl(data.season.robot_cad_url || "");
        setSummary(data.season.summary || "");
        setAlbumUrl(data.season.album_url || "");
        setAlbumCoverUrl(data.season.album_cover || "");
        if (editor && data.season.robot_description) {
          try {
            editor.commands.setContent(JSON.parse(data.season.robot_description));
          } catch (e) {
            console.error("Failed to parse existing AST", e);
          }
        }
      }
    }
  );

  const handleSave = async (isDraft: boolean = false) => {
    if (!startYear || !challengeName) {
      setErrorMsg("Start Year and Challenge Name are required.");
      return;
    }

    setIsPending(true);
    setErrorMsg("");

    try {
      const robot_description = editor ? JSON.stringify(editor.getJSON()) : null;
      
      const payload = {
        start_year: Number(startYear),
        end_year: Number(endYear),
        challenge_name: challengeName,
        robot_name: robotName,
        robot_image: robotImageUrl === DEFAULT_COVER_IMAGE ? null : robotImageUrl,
        robot_description,
        robot_cad_url: cadUrl,
        summary,
        album_url: albumUrl,
        album_cover: albumCoverUrl,
        status: isDraft ? "draft" : "published"
      };

      await adminApi.request("/api/admin/seasons", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      toast.success(`Season ${startYear}-${endYear} saved successfully.`);
      queryClient.invalidateQueries({ queryKey: ["admin-seasons"] });
      queryClient.invalidateQueries({ queryKey: ["seasons"] });
      navigate("/dashboard/manage_seasons");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to save season.");
    } finally {
      setIsPending(false);
    }
  };

  if (!editor) return <div className="text-marble animate-pulse font-mono tracking-widest text-sm">Booting Legacy Systems...</div>;

  return (
    <div className="flex flex-col gap-6 w-full relative">
      <div>
        <h2 className="text-3xl font-black text-white tracking-tighter italic mb-2 uppercase">
          {editId ? "Update Legacy" : "Forge New Legacy"}
        </h2>
        <p className="text-marble/40 text-sm font-bold uppercase tracking-widest">
          Documenting the evolution of ARES 23247.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="start-year" className="block text-xs font-black text-ares-gold uppercase tracking-[0.2em] mb-2">Start Year</label>
              <input
                id="start-year"
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value))}
                disabled={!!editId}
                className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:ring-1 focus:ring-ares-gold transition-all"
                placeholder='2025'
              />
            </div>
            <div className="flex-1">
              <label htmlFor="end-year" className="block text-xs font-black text-ares-gold uppercase tracking-[0.2em] mb-2">End Year</label>
              <input
                id="end-year"
                type="number"
                value={endYear}
                onChange={(e) => setEndYear(parseInt(e.target.value))}
                className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:ring-1 focus:ring-ares-gold transition-all"
                placeholder='2026'
              />
            </div>
          </div>
          <div>
            <label htmlFor="challenge-name" className="block text-xs font-black text-ares-gold uppercase tracking-[0.2em] mb-2">Challenge Name</label>
            <input
              id="challenge-name"
              type="text"
              value={challengeName}
              onChange={(e) => setChallengeName(e.target.value)}
              className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:ring-1 focus:ring-ares-gold transition-all"
              placeholder='e.g. CENTERSTAGE'
            />
          </div>
        </div>

        <div>
          <span className="block text-xs font-black text-ares-gold uppercase tracking-[0.2em] mb-2">Robot / Season Cover</span>
          <CoverAssetPicker 
            coverImage={robotImageUrl}
            isUploading={isUploadingCover}
            onLibraryClick={() => setIsImagePickerOpen(true)}
            onUrlChange={setRobotImageUrl}
            onFileChange={async (file) => {
              const { url } = await uploadFile(file);
              setRobotImageUrl(url);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="album-url" className="block text-xs font-black text-marble/40 uppercase tracking-[0.2em] mb-2">Google Photos Album Link</label>
            <input
              id="album-url"
              type="text"
              value={albumUrl}
              onChange={(e) => setAlbumUrl(e.target.value)}
              className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30"
              placeholder='https://photos.app.goo.gl/...'
            />
          </div>
          <div>
            <label htmlFor="robot-name" className="block text-xs font-black text-marble/40 uppercase tracking-[0.2em] mb-2">Robot Name</label>
            <input
              id="robot-name"
              type="text"
              value={robotName}
              onChange={(e) => setRobotName(e.target.value)}
              className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30"
              placeholder='e.g. ARES-1'
            />
          </div>
          <div>
            <label htmlFor="cad-link" className="block text-xs font-black text-marble/40 uppercase tracking-[0.2em] mb-2">CAD Link</label>
            <input
              id="cad-link"
              type="text"
              value={cadUrl}
              onChange={(e) => setCadUrl(e.target.value)}
              className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30"
              placeholder='https://onshape.com/...'
            />
          </div>
        </div>
        <div>
          <span className="block text-xs font-black text-marble/40 uppercase tracking-[0.2em] mb-2">Album Cover / Hero Card</span>
          <CoverAssetPicker 
            coverImage={albumCoverUrl}
            isUploading={isUploadingAlbumCover}
            onLibraryClick={() => setIsAlbumCoverPickerOpen(true)}
            onUrlChange={setAlbumCoverUrl}
            onFileChange={async (file) => {
              const { url } = await uploadAlbumCover(file);
              setAlbumCoverUrl(url);
            }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="summary" className="block text-xs font-black text-marble/40 uppercase tracking-[0.2em] mb-2">Brief Summary</label>
        <textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble h-20"
          placeholder="One sentence summary of the season's legacy..."
        />
      </div>

      <div className="space-y-2">
        <span className="block text-xs font-black text-ares-gold uppercase tracking-[0.2em]">Robot Design & Season Highlights</span>
        <RichEditorToolbar editor={editor} documentTitle={challengeName} />
      </div>

      <AssetPickerModal 
        isOpen={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        onSelect={(url) => {
          setRobotImageUrl(url);
          setIsImagePickerOpen(false);
        }}
      />

      <AssetPickerModal 
        isOpen={isAlbumCoverPickerOpen}
        onClose={() => setIsAlbumCoverPickerOpen(false)}
        onSelect={(url) => {
          setAlbumCoverUrl(url);
          setIsAlbumCoverPickerOpen(false);
        }}
      />

      <EditorFooter 
        errorMsg={errorMsg}
        isPending={isPending}
        isEditing={!!editId}
        onDelete={() => {}} // Handle delete if needed
        onSaveDraft={() => handleSave(true)}
        onPublish={() => handleSave(false)}
        updateText="UPDATE LEGACY"
        publishText="ESTABLISH LEGACY"
        roundedClass="ares-cut"
      />
    </div>
  );
}
