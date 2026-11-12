import { memo } from 'react';
import { FolderKanban, HelpCircle, Layers, List, Plus } from 'lucide-react';
import type { AppTab } from '../types/flashcard';
import { triggerTap } from '../services/platform/hapticsService';

interface MobileBottomNavProps {
  activeTab: AppTab;
  decksCount: number;
  totalCards: number;
  focusMode: boolean;
  onChangeTab: (tab: AppTab) => void;
  onOpenNewCard: () => void;
}

export const MobileBottomNav = memo(function MobileBottomNav({
  activeTab,
  decksCount,
  totalCards,
  focusMode,
  onChangeTab,
  onOpenNewCard,
}: MobileBottomNavProps) {
  if (focusMode) return null;

  const handleSelectTab = (tab: AppTab) => {
    if (tab !== activeTab) {
      void triggerTap();
      onChangeTab(tab);
    }
  };

  return (
    <nav
      aria-label="Navegação inferior mobile"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#E4E0D8] dark:border-[#2E332E] bg-[#F6F4EF]/95 dark:bg-[#181A18]/95 backdrop-blur-md ios-safe-bottom-nav shadow-[0_-6px_24px_-12px_rgba(28,27,24,0.16)]"
    >
      <div className="max-w-lg mx-auto px-2 py-1 grid grid-cols-5 items-center gap-1">
        <button
          type="button"
          onClick={() => handleSelectTab('study')}
          aria-current={activeTab === 'study' ? 'page' : undefined}
          className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-semibold transition-colors cursor-pointer select-none ${
            activeTab === 'study'
              ? 'text-[#28665E] dark:text-[#68B4A8] bg-[#EAF3F1]/80 dark:bg-[#1E312E]/80'
              : 'text-[#6B655C] dark:text-[#AFAAA0] active:bg-[#EAE6DD]/60 dark:active:bg-[#242824]'
          }`}
        >
          <Layers className="w-5 h-5 shrink-0" />
          <span className="truncate">Cards</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('decks')}
          aria-current={activeTab === 'decks' ? 'page' : undefined}
          className={`min-h-[52px] relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-semibold transition-colors cursor-pointer select-none ${
            activeTab === 'decks'
              ? 'text-[#28665E] dark:text-[#68B4A8] bg-[#EAF3F1]/80 dark:bg-[#1E312E]/80'
              : 'text-[#6B655C] dark:text-[#AFAAA0] active:bg-[#EAE6DD]/60 dark:active:bg-[#242824]'
          }`}
        >
          <FolderKanban className="w-5 h-5 shrink-0" />
          <span className="truncate">
            Baralhos{decksCount > 0 ? ` (${decksCount})` : ''}
          </span>
        </button>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              void triggerTap();
              onOpenNewCard();
            }}
            aria-label="Criar novo flashcard pessoal"
            title="Criar novo flashcard"
            className="min-w-[52px] min-h-[48px] px-3 rounded-2xl bg-[#28665E] active:bg-[#1F524B] dark:bg-[#2A6D63] dark:active:bg-[#327D72] text-white dark:text-[#F4F7F6] flex flex-col items-center justify-center gap-0.5 shadow-sm transition-transform active:scale-95 cursor-pointer select-none"
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-bold leading-none">Criar</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleSelectTab('quiz')}
          aria-current={activeTab === 'quiz' ? 'page' : undefined}
          className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-semibold transition-colors cursor-pointer select-none ${
            activeTab === 'quiz'
              ? 'text-[#28665E] dark:text-[#68B4A8] bg-[#EAF3F1]/80 dark:bg-[#1E312E]/80'
              : 'text-[#6B655C] dark:text-[#AFAAA0] active:bg-[#EAE6DD]/60 dark:active:bg-[#242824]'
          }`}
        >
          <HelpCircle className="w-5 h-5 shrink-0" />
          <span className="truncate">Quiz</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('list')}
          aria-current={activeTab === 'list' ? 'page' : undefined}
          className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-semibold transition-colors cursor-pointer select-none ${
            activeTab === 'list'
              ? 'text-[#28665E] dark:text-[#68B4A8] bg-[#EAF3F1]/80 dark:bg-[#1E312E]/80'
              : 'text-[#6B655C] dark:text-[#AFAAA0] active:bg-[#EAE6DD]/60 dark:active:bg-[#242824]'
          }`}
        >
          <List className="w-5 h-5 shrink-0" />
          <span className="truncate">Acervo ({totalCards})</span>
        </button>
      </div>
    </nav>
  );
});
