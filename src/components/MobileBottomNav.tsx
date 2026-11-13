import { memo } from 'react';
import { Gamepad2, Layers, Mic } from 'lucide-react';
import type { MainPillar } from '../types/flashcard';
import { triggerTap } from '../services/platform/hapticsService';

interface MobileBottomNavProps {
  activePillar: MainPillar;
  focusMode: boolean;
  onSelectPillar: (pillar: MainPillar) => void;
}

const PILLARS: { id: MainPillar; label: string; icon: typeof Layers }[] = [
  { id: 'study', label: 'Estudo', icon: Layers },
  { id: 'speaking', label: 'Speaking', icon: Mic },
  { id: 'games', label: 'Jogos', icon: Gamepad2 },
];

export const MobileBottomNav = memo(function MobileBottomNav({
  activePillar,
  focusMode,
  onSelectPillar,
}: MobileBottomNavProps) {
  if (focusMode) return null;

  const activeIndex = Math.max(
    0,
    PILLARS.findIndex((p) => p.id === activePillar)
  );

  const handleSelect = (pillar: MainPillar) => {
    if (pillar !== activePillar) {
      void triggerTap();
      onSelectPillar(pillar);
    }
  };

  return (
    <nav
      aria-label="Navegação principal mobile em 3 pilares"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#10D990]/28 dark:border-[#38E5A5]/22 bg-white/95 dark:bg-[#0B1016]/95 backdrop-blur-xl ios-safe-bottom-nav shadow-[0_-6px_24px_-8px_rgba(16,217,144,0.18)] dark:shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.65)]"
    >
      <div className="max-w-md mx-auto px-2.5 py-1.5">
        <div className="relative grid grid-cols-3 items-center">
          {/* Smoothly Sliding Active Indicator (Neon Green Top Bar + Soft Glow Pill) */}
          <div
            aria-hidden="true"
            style={{
              transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
            }}
            className="ewm-nav-slider pointer-events-none absolute inset-y-0 left-0 w-1/3 px-1"
          >
            <div className="w-full h-full rounded-2xl bg-[#10D990]/[0.12] dark:bg-[#38E5A5]/[0.14] border border-[#00C982]/35 dark:border-[#38E5A5]/30 shadow-[0_4px_16px_rgba(16,217,144,0.2)] dark:shadow-[0_0_16px_rgba(56,229,165,0.2)] relative overflow-hidden">
              <span className="absolute top-0 inset-x-4 h-[2.5px] rounded-b-full bg-[#00C982] dark:bg-[#38E5A5] shadow-[0_0_10px_rgba(16,217,144,0.65)] dark:shadow-[0_0_12px_rgba(56,229,165,0.9)]" />
            </div>
          </div>

          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            const isActive = activePillar === pillar.id;
            return (
              <button
                key={pillar.id}
                type="button"
                onClick={() => handleSelect(pillar.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative z-10 min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11.5px] font-bold cursor-pointer select-none ${
                  isActive
                    ? 'text-[#047857] dark:text-[#38E5A5]'
                    : 'text-[#52605B] hover:text-[#121816] dark:text-[#94A9A1] dark:hover:text-[#E6F2EC]'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform duration-150 ${
                    isActive
                      ? 'scale-105 stroke-[2.3] text-[#00C982] dark:text-[#38E5A5] drop-shadow-[0_0_6px_rgba(56,229,165,0.45)]'
                      : 'stroke-[1.9]'
                  }`}
                />
                <span className="leading-none tracking-tight">{pillar.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});
