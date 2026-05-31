import Link from "next/link";
import { Cpu, Scale, Code, ChevronRight } from "lucide-react";
import { adminDb } from "@/lib/firebase-admin";

interface RobotItem {
  id: string;
  name: string;
  seasonName: string;
  challengeName: string;
  weightLbs?: number;
  drivetrainType?: string;
  programmingLanguage?: string;
  revealVideoId?: string;
}

export const revalidate = 3600;

const MOCK_ROBOTS: RobotItem[] = [
  {
    id: "minotaur",
    name: "Minotaur",
    seasonName: "2025-2026",
    challengeName: "INTO THE DEEP",
    weightLbs: 14.2,
    drivetrainType: "4-Motor Pinpoint Mecanum (EKF calibrated)",
    programmingLanguage: "Kotlin / ARESLib",
    revealVideoId: "dQw4w9WgXcQ"
  },
  {
    id: "prometheus",
    name: "Prometheus",
    seasonName: "2024-2025",
    challengeName: "CENTERSTAGE",
    weightLbs: 13.8,
    drivetrainType: "6-Wheel Custom Odometry Drop-Center",
    programmingLanguage: "Java / FTC SDK",
    revealVideoId: "dQw4w9WgXcQ"
  }
];

async function getRobotsList(): Promise<RobotItem[]> {
  try {
    const snapshot = await adminDb
      .collection("robots")
      .where("isDeleted", "==", 0)
      .get();

    if (snapshot.empty) {
      return MOCK_ROBOTS;
    }

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "Untitled Robot",
        seasonName: data.seasonName || "Legacy",
        challengeName: data.challengeName || "Unknown Challenge",
        weightLbs: data.weightLbs,
        drivetrainType: data.drivetrainType || "Custom Drive",
        programmingLanguage: data.programmingLanguage || "Java",
        revealVideoId: data.revealVideoId || ""
      };
    });
  } catch (error) {
    console.warn("Firestore empty or not connected during compilation, using mock fleet:", error);
    return MOCK_ROBOTS;
  }
}

export default async function RobotsFeedPage() {
  const robots = await getRobotsList();

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        
        {/* Header */}
        <header className="text-center mb-16">
          <div className="inline-block bg-ares-red/10 text-ares-red px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-6 border border-ares-red/20">
            ARES 23247 Engineering
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase font-heading">
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500">Fleet</span>
          </h1>
          <p className="text-lg text-marble/60 max-w-2xl mx-auto font-medium leading-relaxed">
            Archive of championship-caliber robotics systems engineered for the FIRST® Tech Challenge by team ARES.
          </p>
        </header>

        {/* Fleet Grid */}
        {robots.length === 0 ? (
          <div className="text-center text-marble/35 p-20 glass-card ares-cut border border-white/10">
            <Cpu size={48} className="mx-auto mb-6 opacity-20" />
            <h3 className="text-xl font-bold uppercase tracking-widest text-white">No Fleet Records</h3>
            <p className="text-sm mt-2">The engineering archive is currently empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {robots.map((robot) => (
              <Link
                key={robot.id}
                href={`/robots/${robot.id}`}
                className="group glass-card hero-card overflow-hidden hover:border-ares-red/50 transition-all duration-500 shadow-2xl flex flex-col h-full border border-white/10"
              >
                <div className="aspect-video bg-black/40 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10 opacity-60"></div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-75 group-hover:scale-105 transition-all duration-500">
                    {robot.revealVideoId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://img.youtube.com/vi/${robot.revealVideoId}/hqdefault.jpg`}
                        alt={robot.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Cpu size={64} className="text-white/10" />
                    )}
                  </div>
                </div>

                <div className="p-8 flex-grow flex flex-col justify-between gap-6 relative z-20 -mt-8">
                  <div>
                    <div className="bg-ares-red text-white text-[10px] font-black uppercase tracking-[0.2em] py-1.5 px-4 ares-cut-sm self-start shadow-xl mb-4 inline-block">
                      {robot.seasonName} // {robot.challengeName}
                    </div>
                    
                    <h2 className="text-3xl font-black text-white group-hover:text-ares-red transition-colors tracking-tight uppercase font-heading leading-tight mt-1">
                      {robot.name}
                    </h2>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5 mt-auto">
                    <div className="grid grid-cols-2 gap-3">
                      {robot.weightLbs && (
                        <div className="flex items-center gap-2 bg-white/5 p-2.5 ares-cut-sm border border-white/5">
                          <Scale size={14} className="text-ares-cyan shrink-0" />
                          <span className="text-xs font-bold text-marble/85">{robot.weightLbs} lbs</span>
                        </div>
                      )}
                      {robot.programmingLanguage && (
                        <div className="flex items-center gap-2 bg-white/5 p-2.5 ares-cut-sm border border-white/5">
                          <Code size={14} className="text-ares-gold shrink-0" />
                          <span className="text-xs font-bold text-marble/85 truncate">{robot.programmingLanguage}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 p-2.5 ares-cut-sm border border-white/5">
                      <Cpu size={14} className="text-ares-red shrink-0" />
                      <span className="text-xs font-bold text-marble/85 truncate">{robot.drivetrainType || 'Custom Drive'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
