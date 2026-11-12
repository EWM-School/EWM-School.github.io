import { memo } from 'react';
import { FolderKanban, Layers, List } from 'lucide-react';
import { triggerTap } from '../services/platform/hapticsService';
import type { StudySubMode } from '../types/flashcard';

interface StudySubNavProps {
  activeSubMode: StudySubMode;
  decksCount: number;
  totalCards: number;
  focusMode: boolean;
  onChangeSubMode: (mode: StudySubMode) => void;
}

export const StudySubNav = memo(function StudySubNav({
  activeSubMode,
  decksCount,
  totalCards,
  focusMode,
  onChangeSubMode,
}: StudySubNavProps) {
  if (focusMode) return null;

  const segments: {
    id: StudySubMode;
    label: string;
    shortBadge?: string;
    icon: typeof Layers;
  }[] = [
    { id: 'study', label: 'Flashcards', icon: Layers },
    {
      id: 'decks',
      label: 'Baralhos',
      shortBadge: decksCount > 0 ? String(decksCount) : undefined,
      icon: FolderKanban,
    },
    {
      id: 'list',
      label: 'Acervo',
      shortBadge: String(totalCards),
      icon: List,
    },
  ];

  const activeIndex = Math.max(
    0,
    segments.findIndex((s) => s.id === activeSubMode)
  );

  const handleSelect = (mode: StudySubMode) => {
    if (mode !== activeSubMode) {
      void triggerTap();
      onChangeSubMode(mode);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Modos da área de Estudo"
      className="relative grid grid-cols-3 p-1 rounded-2xl border border-[#DFDBD0] dark:border-[#2B322C] bg-[#EAE6DD]/85 dark:bg-[#1A1E1B] select-none"
    >
      {/* Smoothly Sliding Active Segment Pill */}
      <div
        aria-hidden="true"
        style={{
          transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
        }}
        className="ewm-nav-slider pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-white dark:bg-[#272D28] border border-[#E2DDD2] dark:border-[#38E5A5]/25 shadow-2xs"
      />

      {segments.map((seg) => {
        const Icon = seg.icon;
        const isActive = activeSubMode === seg.id;
        return (
          <button
            key={seg.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(seg.id)}
            className={`relative z-10 min-h-[38px] sm:min-h-[40px] inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 rounded-xl text-xs sm:text-[13px] font-semibold cursor-pointer ${
              isActive
                ? 'text-[#1C1B18] dark:text-[#F4F7F6]'
                : 'text-[#625D53] dark:text-[#A4ABA5] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE]'
            }`}
          >
            <Icon
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                isActive ? 'text-[#28665E] dark:text-[#38E5A5]' : ''
              }`}
            />
            <span className="truncate">{seg.label}</span>
            {seg.shortBadge && (
              <span
                className={`font-mono-num text-[10.5px] px-1.5 py-0.2 rounded-md ${
                  isActive
                    ? 'bg-[#EAF3F1] dark:bg-[#1C302B] text-[#225851] dark:text-[#68B4A8]'
                    : 'opacity-70'
                }`}
              >
                {seg.shortBadge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});
