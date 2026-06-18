import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Season {
  startYear: number;
  endYear: number | null;
  challengeName: string;
  isDeleted: number;
}

interface SeasonPickerProps {
  value?: string | number;
  onChange: (value: string) => void;
  label?: string;
}

export default function SeasonPicker({ value, onChange, label = "Linked Season" }: SeasonPickerProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);

  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const q = query(collection(db, "seasons"), where("isDeleted", "==", 0));
        const snap = await getDocs(q);
        const list = snap.docs.map((doc) => doc.data() as Season);
        list.sort((a, b) => b.startYear - a.startYear);
        setSeasons(list);
      } catch (err) {
        console.error("Error fetching seasons in picker:", err);
      }
    };
    fetchSeasons();
  }, []);

  return (
    <div className="w-full">
      <label className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">
        {label}
      </label>
      <select
        title={label}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all shadow-inner"
      >
        <option value="">-- No Season Link --</option>
        {seasons.map((s) => (
          <option key={s.startYear} value={s.startYear.toString()}>
            {s.challengeName} {s.startYear}-{s.endYear}
          </option>
        ))}
      </select>
    </div>
  );
}
