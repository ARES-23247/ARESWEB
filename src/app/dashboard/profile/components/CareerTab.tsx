import React from "react";
import { GraduationCap, Briefcase, Plus, Trash2 } from "lucide-react";

export interface College {
  name: string;
  domain: string;
  years: string;
  degree: string;
}

export interface Employer {
  name: string;
  domain: string;
  title: string;
  current: boolean;
  years: string;
}

interface CareerTabProps {
  colleges: College[];
  employers: Employer[];
  removeCollege: (idx: number) => void;
  removeEmployer: (idx: number) => void;
  newColName: string;
  setNewColName: (val: string) => void;
  newColDomain: string;
  setNewColDomain: (val: string) => void;
  newColYears: string;
  setNewColYears: (val: string) => void;
  newColDegree: string;
  setNewColDegree: (val: string) => void;
  addCollege: () => void;
  newEmpName: string;
  setNewEmpName: (val: string) => void;
  newEmpDomain: string;
  setNewEmpDomain: (val: string) => void;
  newEmpTitle: string;
  setNewEmpTitle: (val: string) => void;
  newEmpCurrent: boolean;
  setNewEmpCurrent: (val: boolean) => void;
  newEmpYears: string;
  setNewEmpYears: (val: string) => void;
  addEmployer: () => void;
  isStudent?: boolean;
}

export default function CareerTab({
  colleges,
  employers,
  removeCollege,
  removeEmployer,
  newColName,
  setNewColName,
  newColDomain,
  setNewColDomain,
  newColYears,
  setNewColYears,
  newColDegree,
  setNewColDegree,
  addCollege,
  newEmpName,
  setNewEmpName,
  newEmpDomain,
  setNewEmpDomain,
  newEmpTitle,
  setNewEmpTitle,
  newEmpCurrent,
  setNewEmpCurrent,
  newEmpYears,
  setNewEmpYears,
  addEmployer,
  isStudent = false,
}: CareerTabProps) {
  if (isStudent) {
    return (
      <div className="bg-black/20 border border-white/5 p-6 rounded-xl text-marble/60 text-xs text-center leading-normal">
        🎓 Professional career and higher education history is reserved for mentors, coaches, and alumni.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* College Sub-form */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
          <GraduationCap size={14} /> Higher Education
        </h3>

        {colleges.length > 0 && (
          <div className="space-y-2 mb-4">
            {colleges.map((col, idx) => (
              <div key={idx} className="flex items-center justify-between bg-black/30 border border-white/5 p-3 rounded-lg">
                <div>
                  <p className="text-sm font-bold text-white">{col.name}</p>
                  <p className="text-marble/60 text-xs">
                    {col.degree} &middot; {col.years} &middot; Domain: {col.domain}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeCollege(idx)}
                  className="p-1.5 bg-ares-red/10 border border-ares-red/20 text-ares-red hover:bg-ares-red hover:text-white rounded transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
          <div className="sm:col-span-2">
            <label htmlFor="new-col-name" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">College/University Name</label>
            <input
              id="new-col-name"
              type="text"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              placeholder="e.g. West Virginia University"
            />
          </div>
          <div>
            <label htmlFor="new-col-domain" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Web Domain</label>
            <input
              id="new-col-domain"
              type="text"
              value={newColDomain}
              onChange={(e) => setNewColDomain(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              placeholder="e.g. wvu.edu"
            />
          </div>
          <div>
            <label htmlFor="new-col-degree" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Degree / Major</label>
            <input
              id="new-col-degree"
              type="text"
              value={newColDegree}
              onChange={(e) => setNewColDegree(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              placeholder="e.g. B.S. Computer Science"
            />
          </div>
          <div>
            <label htmlFor="new-col-years" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Years Attended</label>
            <input
              id="new-col-years"
              type="text"
              value={newColYears}
              onChange={(e) => setNewColYears(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              placeholder="e.g. 2021-2025"
            />
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <button
              type="button"
              onClick={addCollege}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold/25 border border-ares-gold/45 text-white rounded text-xs font-bold uppercase hover:bg-ares-gold transition-colors cursor-pointer"
            >
              <Plus size={12} /> Add College
            </button>
          </div>
        </div>
      </div>

      {/* Employer Sub-form */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-ares-gold uppercase tracking-widest border-b border-white/5 pb-2.5 flex items-center gap-2">
          <Briefcase size={14} /> Career & Employment
        </h3>

        {employers.length > 0 && (
          <div className="space-y-2 mb-4">
            {employers.map((emp, idx) => (
              <div key={idx} className="flex items-center justify-between bg-black/30 border border-white/5 p-3 rounded-lg">
                <div>
                  <p className="text-sm font-bold text-white">
                    {emp.name} {emp.current && <span className="text-[10px] text-ares-gold ml-1 font-mono uppercase bg-ares-gold/10 border border-ares-gold/20 px-1 rounded">Current</span>}
                  </p>
                  <p className="text-marble/60 text-xs">
                    {emp.title} &middot; {emp.years} &middot; Domain: {emp.domain}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeEmployer(idx)}
                  className="p-1.5 bg-ares-red/10 border border-ares-red/20 text-ares-red hover:bg-ares-red hover:text-white rounded transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
          <div className="sm:col-span-2">
            <label htmlFor="new-emp-name" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Company / Organization</label>
            <input
              id="new-emp-name"
              type="text"
              value={newEmpName}
              onChange={(e) => setNewEmpName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              placeholder="e.g. NASA Goddard"
            />
          </div>
          <div>
            <label htmlFor="new-emp-domain" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Web Domain</label>
            <input
              id="new-emp-domain"
              type="text"
              value={newEmpDomain}
              onChange={(e) => setNewEmpDomain(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              placeholder="e.g. nasa.gov"
            />
          </div>
          <div>
            <label htmlFor="new-emp-title" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Job Title</label>
            <input
              id="new-emp-title"
              type="text"
              value={newEmpTitle}
              onChange={(e) => setNewEmpTitle(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              placeholder="e.g. Guidance Controls Intern"
            />
          </div>
          <div>
            <label htmlFor="new-emp-years" className="block text-[9px] uppercase font-bold text-marble/60 mb-1">Years Active</label>
            <input
              id="new-emp-years"
              type="text"
              value={newEmpYears}
              onChange={(e) => setNewEmpYears(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              placeholder="e.g. 2024-Present"
            />
          </div>
          <div className="sm:col-span-4 flex items-center justify-between">
            <label htmlFor="new-emp-current" className="flex items-center gap-2 text-xs font-bold text-marble/70 select-none cursor-pointer">
              <input
                id="new-emp-current"
                type="checkbox"
                checked={newEmpCurrent}
                onChange={(e) => setNewEmpCurrent(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-black/40 text-ares-gold focus:ring-ares-gold"
              />
              <span>Current Employer</span>
            </label>
            <button
              type="button"
              onClick={addEmployer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold/25 border border-ares-gold/45 text-white rounded text-xs font-bold uppercase hover:bg-ares-gold transition-colors cursor-pointer"
            >
              <Plus size={12} /> Add Employer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
