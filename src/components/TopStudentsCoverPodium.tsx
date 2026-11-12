import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Flame,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  computeLeaderboard,
  formatStudyHoursMinutes,
  getMonthNamePt,
  type CloudLeaderboardRecord,
  type UserStudyStats,
} from '../utils/studyMetrics';

interface TopStudentsCoverPodiumProps {
  stats: UserStudyStats;
  userDisplayName?: string | null;
  userEmail?: string | null;
  currentUid?: string | null;
  masteredCount?: number;
  reviewCount?: number;
  quizScore?: number;
  cloudLeaderboard?: CloudLeaderboardRecord[];
  onOpenRankingModal: () => void;
  onStartFirstPractice?: () => void;
}

export function TopStudentsCoverPodium({
  stats,
  userDisplayName,
  userEmail,
  currentUid,
  masteredCount = 0,
  reviewCount = 0,
  quizScore = 0,
  cloudLeaderboard,
  onOpenRankingModal,
  onStartFirstPractice,
}: TopStudentsCoverPodiumProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentMonthName = getMonthNamePt();

  const { topThree, allRanked, currentUserEntry, topStudent } = computeLeaderboard(
    userDisplayName,
    stats,
    {
      currentUid,
      currentUserEmail: userEmail,
      masteredCount,
      reviewCount,
      quizScore,
      cloudEntries: cloudLeaderboard,
    }
  );

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
      {/* Compact live ranking button — responsive width so small 360px headers never overflow */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Ver ranking real de alunos em tempo real"
        className={`w-[7.75rem] sm:w-42 px-2 sm:px-2.5 py-1 rounded-xl border text-left transition-all duration-200 cursor-pointer select-none shadow-2xs ${
          isOpen
            ? 'border-[#28665E] dark:border-[#68B4A8] bg-[#EAF3F1] dark:bg-[#1E312E] ring-2 ring-[#28665E]/20'
            : 'border-[#E2DDD3] dark:border-[#2E332E] bg-white/95 dark:bg-[#222722]/95 hover:border-[#28665E] dark:hover:border-[#68B4A8]'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-[#1C1B18] dark:text-[#EBE7DE] tracking-tight truncate">
              Ranking
            </span>
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-[#6B655C] dark:text-[#AFAAA0] transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-[#28665E] dark:text-[#68B4A8]' : ''
            }`}
          />
        </div>

        {/* Subline: Real top student OR clean call-to-action if empty */}
        <div className="mt-0.5 truncate flex items-center gap-1">
          {topStudent ? (
            <>
              <span className="text-[10px] font-semibold text-[#28665E] dark:text-[#86CEC2] truncate">
                🥇 {topStudent.shortName}
              </span>
              <span className="hidden sm:inline text-[9px] font-mono-num text-[#787368] dark:text-[#9E998F] truncate">
                · {topStudent.score.toLocaleString('pt-BR')} pts
              </span>
            </>
          ) : (
            <span className="text-[10px] font-semibold text-[#B45309] dark:text-[#FBBF24] truncate">
              🏆 Seja o 1º aluno!
            </span>
          )}
        </div>
      </button>

      {/* Expandable Panel: Fixed & Viewport-Clamped on Mobile (zero horizontal cutoff!), Anchored Right on Desktop */}
      {isOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 top-16 bg-black/25 backdrop-blur-[1px] sm:hidden z-40"
          />

          <div
            role="dialog"
            aria-label="Ranking em tempo real"
            className="fixed left-3 right-3 top-[4.5rem] mx-auto max-w-[22.5rem] max-h-[calc(100dvh-5.5rem)] overflow-y-auto sm:mx-0 sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:absolute sm:w-84 sm:max-w-[calc(100vw-2rem)] rounded-2xl border border-[#E2DDD3] dark:border-[#2E332E] bg-white/98 dark:bg-[#1E221E]/98 backdrop-blur-md shadow-2xl p-3.5 z-50 origin-top sm:origin-top-right transition-all duration-200 ease-out animate-fade-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#ECE7DD] dark:border-[#2C312C]">
              <div className="flex items-center gap-1.5 min-w-0">
                <Trophy className="w-4 h-4 text-[#D97706] shrink-0" />
                <span className="text-xs font-bold text-[#1C1B18] dark:text-[#EBE7DE] truncate">
                  Ranking de {currentMonthName}
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
                  Real
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar painel"
                className="p-1 rounded-lg text-[#787368] hover:text-[#1C1B18] dark:text-[#9E998F] dark:hover:text-[#EBE7DE] hover:bg-[#F2EFE8] dark:hover:bg-[#2A2F2A] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {allRanked.length === 0 ? (
              /* Elegant Empty State when 0 real scores exist yet */
              <div className="py-4 px-2 text-center space-y-2.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FEF3C7] dark:bg-[#78350F]/35 text-[#D97706] dark:text-[#FBBF24] mx-auto flex items-center justify-center">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-display text-sm font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                    Seja o primeiro aluno no Ranking!
                  </p>
                  <p className="text-[11px] leading-relaxed text-[#6B655C] dark:text-[#AFAAA0]">
                    Pratique seus primeiros flashcards ou acerte questões no Modo Quiz para inaugurar
                    o pódio real de {currentMonthName}.
                  </p>
                </div>
                {onStartFirstPractice && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onStartFirstPractice();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#1E4E47] dark:text-[#86CEC2] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>Começar a pontuar agora</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-[11px] text-[#787368] dark:text-[#9E998F] mb-2 px-0.5">
                  <span>Pontuação legítima de estudo</span>
                  <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                    <Users className="w-3 h-3" />
                    {allRanked.length} {allRanked.length === 1 ? 'aluno' : 'alunos'}
                  </span>
                </div>

                {/* Top 3 Real Students */}
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

                          <div className="text-right shrink-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/85 dark:bg-[#181A18]/85 border border-[#E2DDD3] dark:border-[#3A403A] font-mono-num font-bold text-xs text-[#B45309] dark:text-[#FBBF24]">
                              {student.score.toLocaleString('pt-BR')}{' '}
                              <span className="font-normal text-[10px] ml-0.5 opacity-80">pts</span>
                            </span>
                          </div>
                        </div>

                        <div className="mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-[#5C574E] dark:text-[#C5C0B4] font-mono-num">
                          <span>{student.cardsReviewed} cards</span>
                          <span aria-hidden="true" className="opacity-40">·</span>
                          <span className="text-[#28665E] dark:text-[#86CEC2] font-semibold">
                            {student.minutosEstudados}m hoje
                          </span>
                          <span aria-hidden="true" className="opacity-40">·</span>
                          <span>
                            {student.activeDays}d ({formatStudyHoursMinutes(student.studyTimeMinutes)})
                          </span>
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
                      #{currentUserEntry.rank} · {currentUserEntry.score.toLocaleString('pt-BR')} pts
                    </span>
                  </div>
                )}
              </>
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
        </>
      )}
    </div>
  );
}
