import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  computeLeaderboard,
  formatStudyHoursMinutes,
  getMonthNamePt,
  type UserStudyStats,
} from '../utils/studyMetrics';

interface TopStudentsCoverPodiumProps {
  stats: UserStudyStats;
  userDisplayName?: string | null;
  onOpenRankingModal: () => void;
}

export function TopStudentsCoverPodium({
  stats,
  userDisplayName,
  onOpenRankingModal,
}: TopStudentsCoverPodiumProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentMonthName = getMonthNamePt();
  const { topThree, currentUserEntry, topStudent } = computeLeaderboard(userDisplayName, stats);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block text-left shrink-0">
      {/* 50% compact ranking button positioned between "Acervo Completo" and "Praticar agora" */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Ver ranking dos 3 melhores alunos em tempo real"
        className={`w-36 sm:w-40 px-2.5 py-1 rounded-xl border text-left transition-all duration-200 cursor-pointer select-none shadow-xs ${
          isOpen
            ? 'border-[#28665E] dark:border-[#68B4A8] bg-[#EAF3F1] dark:bg-[#1E312E] ring-2 ring-[#28665E]/20'
            : 'border-[#E2DDD3] dark:border-[#2E332E] bg-white/95 dark:bg-[#222722]/95 hover:border-[#28665E] dark:hover:border-[#68B4A8]'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          {/* Line 1: Green pulse signal "Ao vivo" + "Ranking" */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-[#1C1B18] dark:text-[#EBE7DE] tracking-tight">
              Ranking
            </span>
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-[#6B655C] dark:text-[#AFAAA0] transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-[#28665E] dark:text-[#68B4A8]' : ''
            }`}
          />
        </div>

        {/* Line 2 (subline): Name of the student with the highest score */}
        <div className="mt-0.5 truncate flex items-center gap-1">
          <span className="text-[10px] font-semibold text-[#28665E] dark:text-[#86CEC2] truncate">
            🥇 {topStudent ? topStudent.shortName : 'Sofia R.'}
          </span>
          {topStudent && (
            <span className="text-[9px] font-mono-num text-[#787368] dark:text-[#9E998F] truncate">
              · {topStudent.score.toLocaleString('pt-BR')} pts
            </span>
          )}
        </div>
      </button>

      {/* Dropdown panel expanding DIAGONALLY (downwards and to the left: origin-top-right) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Top 3 melhores alunos"
          className="absolute right-0 top-full mt-2 w-76 sm:w-84 rounded-2xl border border-[#E2DDD3] dark:border-[#2E332E] bg-white/98 dark:bg-[#1E221E]/98 backdrop-blur-md shadow-2xl p-3.5 z-50 origin-top-right transform transition-all duration-200 ease-out animate-in fade-in zoom-in-95 slide-in-from-top-2 slide-in-from-right-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#ECE7DD] dark:border-[#2C312C]">
            <div className="flex items-center gap-1.5 min-w-0">
              <Trophy className="w-4 h-4 text-[#D97706] shrink-0" />
              <span className="text-xs font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                Top 3 de {currentMonthName}
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                Ao vivo
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Fechar painel"
              className="p-1 rounded-lg text-[#787368] hover:text-[#1C1B18] dark:text-[#9E998F] dark:hover:text-[#EBE7DE] hover:bg-[#F2EFE8] dark:hover:bg-[#2A2F2A] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Subtitle / context */}
          <div className="flex items-center justify-between text-[11px] text-[#787368] dark:text-[#9E998F] mb-2 px-0.5">
            <span>Alunos com maior pontuação</span>
            <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
              <Users className="w-3 h-3" />
              EWM
            </span>
          </div>

          {/* Top 3 List with Scores and 'minutosEstudados' */}
          <div className="space-y-2">
            {topThree.map((student, idx) => {
              const isUser = student.isCurrentUser;
              const medalBg =
                idx === 0
                  ? 'border-[#FDE68A]/80 bg-[#FEF3C7]/60 dark:bg-[#78350F]/25 dark:border-[#B45309]/50'
                  : idx === 1
                  ? 'border-[#E2DDD3] bg-[#F3F4F6]/70 dark:bg-[#2C312C]/60 dark:border-[#3E453E]'
                  : 'border-[#FBD38D]/60 bg-[#FFEDD5]/50 dark:bg-[#7C2D12]/20 dark:border-[#9A3412]/40';

              return (
                <div
                  key={student.id}
                  className={`p-2.5 rounded-xl border text-xs transition-colors ${medalBg} ${
                    isUser ? 'ring-1.5 ring-[#28665E] dark:ring-[#68B4A8]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{student.badgeEmoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-[#1C1B18] dark:text-[#EBE7DE] truncate">
                            {student.shortName}
                          </span>
                          {isUser && (
                            <span className="px-1 py-0.2 rounded-xs text-[9px] font-bold bg-[#28665E] text-white shrink-0">
                              VOCÊ
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#6B655C] dark:text-[#AFAAA0] truncate">
                          {student.statusText}
                        </p>
                      </div>
                    </div>

                    {/* Highlighted Score Badge */}
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/80 dark:bg-[#181A18]/80 border border-[#E2DDD3] dark:border-[#3A403A] font-mono-num font-bold text-xs text-[#B45309] dark:text-[#FBBF24]">
                        {student.score.toLocaleString('pt-BR')}{' '}
                        <span className="font-normal text-[10px] ml-0.5 opacity-80">pts</span>
                      </span>
                    </div>
                  </div>

                  {/* Metadata Row: Cards + minutosEstudados diário + Dias ativos */}
                  <div className="mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-[#5C574E] dark:text-[#C5C0B4] font-mono-num">
                    <span>{student.cardsReviewed} cards</span>
                    <span aria-hidden="true" className="opacity-40">·</span>
                    <span className="text-[#28665E] dark:text-[#86CEC2] font-semibold">
                      {student.minutosEstudados}m hoje
                    </span>
                    <span aria-hidden="true" className="opacity-40">·</span>
                    <span>{student.activeDays}d ativos ({formatStudyHoursMinutes(student.studyTimeMinutes)})</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current user positioning if outside top 3 */}
          {currentUserEntry.rank > 3 && (
            <div className="mt-2.5 pt-2 border-t border-[#ECE7DD] dark:border-[#2C312C] flex items-center justify-between text-[11px] text-[#5C574E] dark:text-[#C5C0B4] px-1">
              <span>Sua posição:</span>
              <span className="font-bold text-[#28665E] dark:text-[#68B4A8]">
                #{currentUserEntry.rank} · {currentUserEntry.score.toLocaleString('pt-BR')} pts ({currentUserEntry.minutosEstudados}m hoje)
              </span>
            </div>
          )}

          {/* Action button to open full metrics & ranking modal */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenRankingModal();
            }}
            className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ver Ranking Completo &amp; Métricas</span>
          </button>
        </div>
      )}
    </div>
  );
}
