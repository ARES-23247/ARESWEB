import { useState, useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import { CopilotMenu } from "./editor/CopilotMenu";
import AssetPickerModal from "./AssetPickerModal";
import { DEFAULT_coverImage } from "../utils/constants";
import { useImageUpload } from "../hooks/useImageUpload";
import CoverAssetPicker from "./editor/CoverAssetPicker";
import EditorFooter from "./editor/EditorFooter";

import { useGetAdminSeasonDetail, useSaveSeason } from "../api";

export default function SeasonEditor() {
  const { editId } = useParams({ strict: false }) as Record<string, string>;
  const navigate = useNavigate();
  
  const { uploadFile, isUploading: isUploadingCover } = useImageUpload();
  const { uploadFile: uploadAlbumCover, isUploading: isUploadingAlbumCover } = useImageUpload();

  // Local State
  const [isPending, setIsPending] = useState(false);
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear());
  const [challengeName, setChallengeName] = useState("");
  const [robotName, setRobotName] = useState("");
  const [robotImageUrl, setRobotImageUrl] = useState(DEFAULT_coverImage);
  const [cadUrl, setCadUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [albumUrl, setAlbumUrl] = useState("");
  const [albumCoverUrl, setAlbumCoverUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isAlbumCoverPickerOpen, setIsAlbumCoverPickerOpen] = useState(false);

  const editor = useRichEditor({ placeholder: "<p>Describe the robot's design, mechanisms, and season highlights...</p>" });

  const { data: detailData } = useGetAdminSeasonDetail(editId || "");

  useEffect(() => {
    let active = true;
    const processSeasonData = async () => {
      await Promise.resolve();
      if (!active) return;
      if (detailData?.season) {
        const s = detailData.season as any;
        setStartYear(s.startYear);
        setChallengeName(s.challengeName);
        setRobotName(s.robotName || "");
        setRobotImageUrl(s.robotImage || DEFAULT_coverImage);
        setCadUrl(s.robotCadUrl || "");
        setSummary(s.summary || "");
        setAlbumUrl(s.albumUrl || "");
        setAlbumCoverUrl(s.albumCover || "");
        if (editor && s.robotDescription) {
          try {
            editor.commands.setContent(JSON.parse(s.robotDescription));
          } catch (e) {
            console.error("Failed to parse existing AST", e);
          }
        }
      }
    };
    void processSeasonData();
    return () => { active = false; };
  }, [detailData, editor]);

  const saveMutation = useSaveSeason({
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Season ${startYear} saved successfully.`);
        navigate({ to: "/dashboard/manage_seasons" });
      } else {
        setErrorMsg("Save failed");
      }
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Failed to save season.");
    },
    onSettled: () => setIsPending(false)
  });

  const handleSave = async (isDraft: boolean = false) => {
    if (!startYear || !challengeName) {
      setErrorMsg("Start Year and Challenge Name are required.");
      return;
    }

    setIsPending(true);
    setErrorMsg("");

    const robot_description = editor ? JSON.stringify(editor.getJSON()) : null;

    const payload = {
      originalYear: editId ? Number(editId) : undefined,
      startYear: Number(startYear),
      endYear: Number(startYear) + 1,
      challengeName: challengeName,
      robotName: robotName,
      robotImage: robotImageUrl === DEFAULT_coverImage ? null : robotImageUrl,
      robotDescription: robot_description,
      robotCadUrl: cadUrl,
      summary,
      albumUrl: albumUrl,
      albumCover: albumCoverUrl,
      status: (isDraft ? "draft" : "published") as "draft" | "published"
    };

    saveMutation.mutate(payload);
  };

  if (!editor) return <div className="text-marble animate-pulse font-mono tracking-widest text-sm">Booting Legacy Systems...</div>;

  return (
    <div className="flex flex-col gap-6 w-full relative">
      <div>
        <h2 className="text-3xl font-black text-white tracking-tighter mb-2 uppercase">
          {editId ? "Update Legacy" : "Forge New Legacy"}
        </h2>
        <p className="text-marble/60 text-sm font-bold uppercase tracking-widest">
          Documenting the evolution of ARES 23247.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="start-year" className="block text-xs font-black text-ares-gold uppercase tracking-[0.2em] mb-2">Season Year</label>
              <input
                id="start-year"
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value))}
                className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:ring-1 focus:ring-ares-gold transition-all"
                placeholder='2025'
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
            <label htmlFor="album-url" className="block text-xs font-black text-marble/60 uppercase tracking-[0.2em] mb-2">Google Photos Album Link</label>
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
            <label htmlFor="robot-name" className="block text-xs font-black text-marble/60 uppercase tracking-[0.2em] mb-2">Robot Name</label>
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
            <label htmlFor="cad-link" className="block text-xs font-black text-marble/60 uppercase tracking-[0.2em] mb-2">CAD Link</label>
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
          <span className="block text-xs font-black text-marble/60 uppercase tracking-[0.2em] mb-2">Album Cover / Hero Card</span>
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
        <label htmlFor="summary" className="block text-xs font-black text-marble/60 uppercase tracking-[0.2em] mb-2">Brief Summary</label>
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
        <div className="flex items-center gap-2">
          <div className="flex-1"><RichEditorToolbar editor={editor} documentTitle={challengeName} /></div>
        </div>
        <CopilotMenu editor={editor} />
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
        onDelete={() => {}} 
        onSaveDraft={() => handleSave(true)}
        onPublish={() => handleSave(false)}
        updateText="UPDATE LEGACY"
        publishText="ESTABLISH LEGACY"
        roundedClass="ares-cut"
      />
    </div>
  );
}



