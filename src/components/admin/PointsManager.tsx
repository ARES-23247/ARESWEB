import { useState, FormEvent } from 'react';
import { Zap, X, RefreshCw } from 'lucide-react';

interface PointsManagerProps {
  isOpen: boolean;
  userId: string | null;
  isPending: boolean;
  onSubmit: (userId: string, delta: number, reason: string) => void;
  onClose: () => void;
}

export function PointsManager({ isOpen, userId, isPending, onSubmit, onClose }: PointsManagerProps) {
  const [pointsDelta, setPointsDelta] = useState('');
  const [pointsReason, setPointsReason] = useState('');

  if (!isOpen || !userId) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!userId || !pointsDelta || !pointsReason) return;
    const delta = parseInt(pointsDelta, 10);
    if (isNaN(delta)) return;
    onSubmit(userId, delta, pointsReason);
    setPointsDelta('');
    setPointsReason('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-obsidian border border-white/10 ares-cut w-full max-w-md shadow-2xl relative p-6">
        <div className="flex justify-between items-start mb-4 pb-4 border-b border-white/10">
          <div>
            <h3 className="text-xl font-black text-ares-cyan flex items-center gap-2">
              <Zap size={20} />
              Manage Points
            </h3>
            <p className="text-white/60 text-sm mt-1">Award or deduct ARES points for this member.</p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-2 bg-obsidian border border-white/10 ares-cut-sm text-white/60 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pointsDeltaInput" className="text-xs font-bold text-marble/90 uppercase tracking-wider mb-1.5 block">Points Delta (+ / -)</label>
            <input
              type="number"
              value={pointsDelta}
              onChange={(e) => setPointsDelta(e.target.value)}
              placeholder="e.g. 50 or -10"
              className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-sm text-white placeholder-marble/40 focus:outline-none focus:border-ares-cyan transition-colors"
              required
            />
          </div>
          <div>
            <label htmlFor="pointsReasonInput" className="text-xs font-bold text-marble/90 uppercase tracking-wider mb-1.5 block">Reason</label>
            <input
              type="text"
              value={pointsReason}
              onChange={(e) => setPointsReason(e.target.value)}
              placeholder="e.g. Outreach Event Attendance"
              className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-sm text-white placeholder-marble/40 focus:outline-none focus:border-ares-cyan transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 font-bold bg-ares-cyan hover:bg-ares-cyan/80 text-obsidian ares-cut-sm transition-all disabled:opacity-50"
          >
            {isPending ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
            {isPending ? 'Processing...' : 'Submit Transaction'}
          </button>
        </form>
      </div>
    </div>
  );
}
