            </button>
            <button 
              className="px-4 py-2 rounded-lg text-sm transition-all font-bold focus:outline-none focus:ring-2 focus:ring-ares-gold bg-ares-gold/20 text-ares-gold border border-ares-gold/30 hover:bg-ares-gold/30"
              onClick={() => setIsPickerOpen(true)}
            >
              Open Asset Library
            </button>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            <button 
              className="px-4 py-2 rounded-lg text-sm transition-all font-bold focus:outline-none focus:ring-2 focus:ring-ares-red bg-ares-red/20 text-ares-red border border-ares-red/30 hover:bg-ares-red/30"
              onClick={() => setIsSimPickerOpen(true)}
            >
              Inject Simulator
            </button>
            <input 
              id="inline-event-img-upload" type="file" accept="image/*" className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setIsUploadingInline(true);
                try {
                  const url = await uploadFile(file);
                  editor.chain().focus().setImage({ src: url }).run();
                } catch(err) {
                  setErrorMsg(String(err));
                } finally {
                  setIsUploadingInline(false);
                }
              }} 
            />
          </div>
        )}

        <AssetPickerModal 
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(url, altText) => {
            if (editor) editor.chain().focus().setImage({ src: url, alt: altText }).run();
            setIsPickerOpen(false);
          }}
        />

        <SimPickerModal 
          isOpen={isSimPickerOpen}
          onClose={() => setIsSimPickerOpen(false)}
          onSelect={(simId) => {
            if (editor) editor.chain().focus().insertContent(`\n<${simId} />\n`).run();
            setIsSimPickerOpen(false);
          }}
        />

        <div id="event-desc-editor" className="bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-inner focus-within:border-zinc-700 transition-colors">
          <EditorContent editor={editor} />
        </div>
      </div>

      <div>
        <label htmlFor="event-cover" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Cover Asset</label>
        <div className="flex gap-2">
          <input
            id="event-cover" type="text"
            value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder="/gallery_2.png"
          />
          <button 
            className={`px-6 py-3 rounded-lg text-sm font-bold border border-zinc-700 transition-all focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900 ${isUploading ? "bg-zinc-800 animate-pulse text-zinc-300" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"}`}
            onClick={() => document.getElementById('event-img-upload')?.click()}
          >
            UPL
          </button>
          <input 
            id="event-img-upload" type="file" accept="image/*" className="hidden" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setIsUploading(true);
              try {
                const url = await uploadFile(file);
                setForm({ ...form, coverImage: url });
              } catch(err) {
                setErrorMsg(String(err));
              } finally {
                setIsUploading(false);
              }
            }} 
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-800">
        <div className="flex flex-col">
          <span className="text-ares-red text-sm font-medium">{errorMsg}</span>
          <span className="text-emerald-500 text-sm font-medium">{successMsg}</span>
        </div>
        <button
          onClick={handlePublish}
          disabled={isPending}
          className={`px-8 py-3.5 rounded-full font-bold tracking-wide transition-all shadow-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900
            ${isPending ? "bg-zinc-800 text-zinc-300 animate-pulse" : "bg-white text-zinc-950 hover:bg-ares-red hover:text-white hover:-translate-y-0.5"}`}
        >
          {isPending ? "COMMITTING..." : editId ? "UPDATE EVENT" : "PUBLISH EVENT"}
        </button>
      </div>
    </div>
  );
}
