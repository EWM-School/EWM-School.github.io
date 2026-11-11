import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { Flashcard, StudyRound } from '../types/flashcard';

interface RoundHistoryBarProps {
  cards: Flashcard[];
  studyRounds: StudyRound[];
  onResetProgress: () => void;
  onJumpToCard: (cardId: string) => void;
}

export function RoundHistoryBar({
  cards,
  studyRounds,
  onResetProgress,
  onJumpToCard,
}: RoundHistoryBarProps) {
  const [drawerMode, setDrawerMode] = useState<'mastered' | 'review' | null>(null);

  const masteredCount = cards.filter((c) => c.status === 'mastered').length;
  const reviewCount = cards.filter((c) => c.status === 'review').length;
  const currentRound = studyRounds[studyRounds.length - 1];

  const cardById = new Map(cards.map((c) => [c.id, c]));

  const toggleMode = (mode: 'mastered' | 'review') => {
    setDrawerMode((prev) => (prev === mode ? null : mode));
  };

  return (
    <section className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white/80 dark:bg-[#212421]/95 px-3.5 sm:px-4 py-2.5 sm:py-3 space-y-3 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2 sm:gap-5 text-xs">
          <div className="shrink-0">
            <span className="text-[#857F74] dark:text-[#8A857C] mr-1">Acervo</span>
            <span className="font-mono-num font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
              {cards.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => toggleMode('mastered')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
              drawerMode === 'mastered'
                ? 'bg-[#EDF6F1] dark:bg-[#1E312B] text-[#2C6B4F] dark:text-[#78C9A2]'
                : 'hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] text-[#2C6B4F] dark:text-[#78C9A2]'
            }`}
          >
            <span className="font-semibold">Dominados</span>
            <span className="font-mono-num font-bold">{masteredCount}</span>
            {drawerMode === 'mastered' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => toggleMode('review')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              drawerMode === 'review'
                ? 'bg-[#FDF5E8] dark:bg-[#2C2418] text-[#9A5B13] dark:text-[#E6B472]'
                : 'hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] text-[#9A5B13] dark:text-[#E6B472]'
            }`}
          >
            <span className="font-semibold">Para revisar</span>
            <span className="font-mono-num font-bold">{reviewCount}</span>
            {drawerMode === 'review' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {currentRound && (
            <div className="hidden sm:block text-[#6B655C] dark:text-[#AFAAA0]">
              Rodada <span className="font-mono-num font-semibold">{currentRound.round}</span>
            </div>
          )}
        </div>

        {(masteredCount > 0 || reviewCount > 0) && (
          <button
            type="button"
            onClick={onResetProgress}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#6B655C] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Nova rodada / Zerar</span>
          </button>
        )}
      </div>

      {drawerMode && (
        <div className="pt-3 border-t border-[#ECE9E1] dark:border-[#2A2F2A] space-y-2.5 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B655C] dark:text-[#AFAAA0]">
              {drawerMode === 'mastered'
                ? 'Histórico de Dominados por Rodada'
                : 'Histórico Para Revisar por Rodada'}
            </h3>
            <button
              type="button"
              onClick={() => setDrawerMode(null)}
              className="text-xs text-[#6B655C] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] cursor-pointer"
            >
              Fechar
            </button>
          </div>

          <div className="space-y-2">
            {[...studyRounds].reverse().map((roundObj) => {
              const ids =
                drawerMode === 'mastered' ? roundObj.masteredIds : roundObj.reviewIds;
              const items = ids
                .map((id) => cardById.get(id))
                .filter((c): c is Flashcard => Boolean(c));
              if (items.length === 0) return null;

              return (
                <div
                  key={roundObj.round}
                  className="rounded-xl bg-[#FAF9F6] dark:bg-[#1B1E1B] border border-transparent dark:border-[#2B302B] p-2.5 space-y-1.5"
                >
                  <p className="text-[11px] font-semibold text-[#6B655C] dark:text-[#AFAAA0]">
                    Rodada {roundObj.round} · {items.length}{' '}
                    {items.length === 1 ? 'card' : 'cards'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onJumpToCard(c.id)}
                        className="px-2.5 py-1 rounded-lg border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#262A26] text-xs font-medium text-[#1C1B18] dark:text-[#EBE7DE] hover:border-[#28665E] dark:hover:border-[#68B4A8] transition-colors cursor-pointer"
                      >
                        {c.term}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {studyRounds.every(
              (r) => (drawerMode === 'mastered' ? r.masteredIds : r.reviewIds).length === 0
            ) && (
              <p className="text-xs text-[#857F74] dark:text-[#8A857C] py-2">
                Nenhum card marcado nesta categoria ainda nesta rodada.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
