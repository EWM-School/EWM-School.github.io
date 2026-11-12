import {
  Award,
  Calendar,
  Clock,
  Flame,
  Settings,
  Share2,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { ShareCardPayload } from '../utils/shareCardGenerator';
import {
  computeLeaderboard,
  formatStudyHoursMinutes,
  getMonthNamePt,
  type CloudLeaderboardRecord,
  type UserStudyStats,
} from '../utils/studyMetrics';

interface MonthlyRankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStudyStats;
  userDisplayName?: string | null;
  userEmail?: string | null;
  currentUid?: string | null;
  masteredCount?: number;
  reviewCount?: number;
  quizScore?: number;
  cloudLeaderboard?: CloudLeaderboardRecord[];
  onUpdateGoal: (newGoal: number) => void;
  onShareAchievement?: (payload: ShareCardPayload) => void;
}

const PRESET_GOALS = [5, 10, 15, 20, 25, 30, 40];

export function MonthlyRankingModal({
  isOpen,
  onClose,
  stats,
  userDisplayName,
  userEmail,
  currentUid,
  masteredCount = 0,
  reviewCount = 0,
  quizScore = 0,
  cloudLeaderboard,
  onUpdateGoal,
  onShareAchievement,
}: MonthlyRankingModalProps) {
  if (!isOpen) return null;

  const currentMonthName = getMonthNamePt();
  const { topThree, allRanked, currentUserEntry } = computeLeaderboard(
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

  const todayCount = stats.todayReviewedCardIds.length;
  const goal = stats.dailyGoal || 15;
  const goalPercent = Math.min(100, Math.round((todayCount / goal) * 100));
  const activeDaysCount = currentUserEntry.activeDays;
  const formattedHours = formatStudyHoursMinutes(stats.monthlyStudyMinutes);

  const handleShareMyRanking = () => {
    if (!onShareAchievement) return;
    onShareAchievement({
      kind: 'ranking',
      studentName: currentUserEntry.name,
      rank: currentUserEntry.rank,
      score: currentUserEntry.score,
      cardsReviewed: currentUserEntry.cardsReviewed,
      activeDays: activeDaysCount,
      studyTimeFormatted: formattedHours,
      monthName: currentMonthName,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ranking-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-3xl border border-[#E2DDD3] dark:border-[#2E332E] bg-[#FAF9F6] dark:bg-[#1C201C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#ECE7DD] dark:border-[#2C312C] bg-white dark:bg-[#222722] gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FEF3C7] dark:bg-[#78350F]/40 text-[#D97706] dark:text-[#FBBF24] flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="ranking-modal-title"
                className="font-display text-base sm:text-lg font-bold leading-tight truncate"
              >
                Ranking Mensal &amp; Suas Métricas
              </h2>
              <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0] truncate">
                Mês de {currentMonthName} · 100% Alunos Reais
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onShareAchievement && (
              <button
                type="button"
                onClick={handleShareMyRanking}
                title="Compartilhar evolução nos Stories ou WhatsApp"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#28665E]/40 dark:border-[#68B4A8]/45 bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#26403C] text-[#1E4E47] dark:text-[#86CEC2] text-xs font-semibold transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Stories / WhatsApp</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar ranking"
              className="p-2 rounded-xl text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#EAE6DD] dark:hover:bg-[#2C312C] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Section 1: User's Personal Monthly Metrics Grid */}
          <section aria-labelledby="personal-metrics-title">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3
                id="personal-metrics-title"
                className="text-xs font-bold uppercase tracking-wider text-[#787368] dark:text-[#9E998F] flex items-center gap-2"
              >
                <Award className="w-4 h-4 text-[#28665E] dark:text-[#68B4A8]" />
                Suas Métricas em {currentMonthName}
              </h3>

              <span className="font-mono-num text-xs font-bold text-[#B45309] dark:text-[#FBBF24]">
                Sua pontuação: {currentUserEntry.score.toLocaleString('pt-BR')} pts
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {/* Metric 1: Active Days this month */}
              <div className="p-3 sm:p-3.5 rounded-2xl border border-[#ECE7DD] dark:border-[#2E332E] bg-white dark:bg-[#222722] space-y-1">
                <div className="flex items-center justify-between text-xs text-[#6B655C] dark:text-[#AFAAA0]">
                  <span>Dias Estudados</span>
                  <Calendar className="w-4 h-4 text-[#28665E] dark:text-[#68B4A8]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono-num text-[#1C1B18] dark:text-[#EBE7DE]">
                  {activeDaysCount}{' '}
                  <span className="text-xs font-normal text-[#6B655C] dark:text-[#AFAAA0]">
                    {activeDaysCount === 1 ? 'dia ativo' : 'dias ativos'}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B655C] dark:text-[#AFAAA0]">
                  {activeDaysCount >= 15
                    ? '🔥 Ritmo impressionante!'
                    : activeDaysCount >= 5
                    ? '👍 Boa frequência mensal'
                    : 'Pratique um pouco todo dia'}
                </p>
              </div>

              {/* Metric 2: Hours studied this month */}
              <div className="p-3 sm:p-3.5 rounded-2xl border border-[#ECE7DD] dark:border-[#2E332E] bg-white dark:bg-[#222722] space-y-1">
                <div className="flex items-center justify-between text-xs text-[#6B655C] dark:text-[#AFAAA0]">
                  <span>Tempo de Dedicação</span>
                  <Clock className="w-4 h-4 text-[#28665E] dark:text-[#68B4A8]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono-num text-[#1C1B18] dark:text-[#EBE7DE]">
                  {formattedHours}
                </div>
                <p className="text-[11px] text-[#6B655C] dark:text-[#AFAAA0]">
                  {masteredCount} dominados · {quizScore} acertos no Quiz
                </p>
              </div>

              {/* Metric 3: Today's Goal Progress */}
              <div className="p-3 sm:p-3.5 rounded-2xl border border-[#ECE7DD] dark:border-[#2E332E] bg-white dark:bg-[#222722] space-y-1">
                <div className="flex items-center justify-between text-xs text-[#6B655C] dark:text-[#AFAAA0]">
                  <span>Meta de Hoje</span>
                  <Flame className="w-4 h-4 text-[#D97706]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono-num text-[#1C1B18] dark:text-[#EBE7DE]">
                  {todayCount} / {goal}{' '}
                  <span className="text-xs font-normal text-[#28665E] dark:text-[#68B4A8]">
                    ({goalPercent}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#EAE6DD] dark:bg-[#2E332E] overflow-hidden mt-1">
                  <div
                    className="h-full bg-[#28665E] dark:bg-[#68B4A8] rounded-full transition-all"
                    style={{ width: `${goalPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Goal Adjuster */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-white dark:bg-[#222722] border border-[#ECE7DD] dark:border-[#2E332E] text-xs">
              <span className="text-[#6B655C] dark:text-[#AFAAA0] flex items-center gap-1.5 font-medium">
                <Settings className="w-3.5 h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                Ajustar sua meta diária de cards:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {PRESET_GOALS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onUpdateGoal(preset)}
                    className={`px-2 py-1 rounded-lg font-mono-num font-semibold text-xs transition-colors cursor-pointer ${
                      preset === goal
                        ? 'bg-[#28665E] text-white dark:bg-[#2A6D63]'
                        : 'bg-[#F2EFE8] dark:bg-[#2C312C] text-[#5C574E] dark:text-[#D4CFC5] hover:bg-[#E5E0D5] dark:hover:bg-[#383E38]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Section 2 & 3: Real Podium + Full Ranked List (or Elegant Empty State) */}
          {allRanked.length === 0 ? (
            <section
              aria-label="Ranking vazio"
              className="rounded-3xl border border-[#E2DDD3] dark:border-[#2E332E] bg-white dark:bg-[#222722] p-6 sm:p-8 text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#FEF3C7] dark:bg-[#78350F]/40 text-[#D97706] dark:text-[#FBBF24] mx-auto flex items-center justify-center">
                <Trophy className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="font-display text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                  Seja o primeiro aluno no Ranking!
                </h3>
                <p className="text-xs sm:text-sm text-[#6B655C] dark:text-[#AFAAA0] leading-relaxed">
                  O Ranking do EWM exibe apenas pontuações 100% reais dos alunos. Marque seus
                  primeiros cards como revisados ou dominados, ou responda ao Modo Quiz para estrear
                  no 1º lugar de {currentMonthName}!
                </p>
              </div>
            </section>
          ) : (
            <>
              <section aria-labelledby="podium-title" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    id="podium-title"
                    className="text-xs font-bold uppercase tracking-wider text-[#787368] dark:text-[#9E998F] flex items-center gap-2"
                  >
                    <Trophy className="w-4 h-4 text-[#D97706]" />
                    Pódio Real de {currentMonthName}
                  </h3>
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    Sincronizado
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end pt-4">
                  {/* 2nd Place Pedestal */}
                  <div>
                    {topThree[1] && (
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#E5E7EB] dark:bg-[#374151] border-2 border-[#D1D5DB] dark:border-[#4B5563] flex items-center justify-center text-lg sm:text-xl shadow-xs">
                          🥈
                        </div>
                        <div className="text-center mt-2 w-full px-1">
                          <p className="font-bold text-xs sm:text-sm truncate">
                            {topThree[1].shortName}
                          </p>
                          <p className="font-mono-num text-[11px] font-semibold text-[#28665E] dark:text-[#68B4A8]">
                            {topThree[1].score.toLocaleString('pt-BR')} pts
                          </p>
                          <p className="text-[10px] text-[#6B655C] dark:text-[#AFAAA0]">
                            {topThree[1].cardsReviewed} cards · {topThree[1].activeDays}d
                          </p>
                        </div>
                        <div className="w-full mt-2 h-20 rounded-t-2xl bg-gradient-to-t from-[#E5E7EB] to-[#F3F4F6] dark:from-[#262B26] dark:to-[#323932] border-t-2 border-[#9CA3AF] flex items-center justify-center font-display font-black text-lg text-[#6B7280]">
                          2º
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 1st Place Pedestal (Always rendered when allRanked.length >= 1) */}
                  <div>
                    {topThree[0] && (
                      <div className="flex flex-col items-center -mt-4">
                        <div className="relative">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#FEF3C7] dark:bg-[#78350F]/50 border-2 border-[#F59E0B] flex items-center justify-center text-xl sm:text-2xl shadow-md">
                            🥇
                          </div>
                          <span className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-[#F59E0B] text-white">
                            <Sparkles className="w-3 h-3" />
                          </span>
                        </div>
                        <div className="text-center mt-2 w-full px-1">
                          <p className="font-bold text-xs sm:text-sm truncate text-[#92400E] dark:text-[#FBBF24]">
                            {topThree[0].shortName}
                          </p>
                          <p className="font-mono-num text-[11px] font-bold text-[#D97706] dark:text-[#FBBF24]">
                            {topThree[0].score.toLocaleString('pt-BR')} pts
                          </p>
                          <p className="text-[10px] text-[#6B655C] dark:text-[#AFAAA0]">
                            {topThree[0].cardsReviewed} cards · {topThree[0].activeDays}d
                          </p>
                        </div>
                        <div className="w-full mt-2 h-28 rounded-t-2xl bg-gradient-to-t from-[#FEF3C7] to-[#FFFBEB] dark:from-[#352512] dark:to-[#4D3516] border-t-2 border-[#F59E0B] flex flex-col items-center justify-center text-[#92400E] dark:text-[#FBBF24]">
                          <span className="font-display font-black text-2xl">1º</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            Líder do Mês
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3rd Place Pedestal */}
                  <div>
                    {topThree[2] && (
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#FFEDD5] dark:bg-[#7C2D12]/40 border-2 border-[#FB923C] flex items-center justify-center text-lg sm:text-xl shadow-xs">
                          🥉
                        </div>
                        <div className="text-center mt-2 w-full px-1">
                          <p className="font-bold text-xs sm:text-sm truncate">
                            {topThree[2].shortName}
                          </p>
                          <p className="font-mono-num text-[11px] font-semibold text-[#28665E] dark:text-[#68B4A8]">
                            {topThree[2].score.toLocaleString('pt-BR')} pts
                          </p>
                          <p className="text-[10px] text-[#6B655C] dark:text-[#AFAAA0]">
                            {topThree[2].cardsReviewed} cards · {topThree[2].activeDays}d
                          </p>
                        </div>
                        <div className="w-full mt-2 h-16 rounded-t-2xl bg-gradient-to-t from-[#FFEDD5] to-[#FFF7ED] dark:from-[#2C231F] dark:to-[#382D26] border-t-2 border-[#FB923C] flex items-center justify-center font-display font-black text-lg text-[#C2410C]">
                          3º
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section aria-labelledby="all-ranking-title" className="space-y-3">
                <h3
                  id="all-ranking-title"
                  className="text-xs font-bold uppercase tracking-wider text-[#787368] dark:text-[#9E998F] flex items-center gap-2"
                >
                  <Users className="w-4 h-4 text-[#28665E] dark:text-[#68B4A8]" />
                  Classificação Completa ({allRanked.length}{' '}
                  {allRanked.length === 1 ? 'aluno' : 'alunos'})
                </h3>

                <div className="rounded-2xl border border-[#ECE7DD] dark:border-[#2E332E] bg-white dark:bg-[#222722] overflow-hidden divide-y divide-[#ECE7DD] dark:divide-[#2E332E]">
                  {allRanked.map((student) => {
                    const isUser = student.isCurrentUser;
                    return (
                      <div
                        key={student.id}
                        className={`flex items-center justify-between p-3 text-xs transition-colors ${
                          isUser
                            ? 'bg-[#EAF3F1] dark:bg-[#1E312E] font-semibold'
                            : 'hover:bg-[#FAF9F6] dark:hover:bg-[#252A25]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono-num font-bold text-sm w-7 text-center shrink-0">
                            {student.badgeEmoji}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#1C1B18] dark:text-[#EBE7DE] truncate">
                                {student.name}
                              </span>
                              {isUser && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#28665E] text-white shrink-0">
                                  Você
                                </span>
                              )}
                              {student.isOnline && (
                                <span
                                  title="Ativo recentemente"
                                  className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0"
                                />
                              )}
                            </div>
                            <p className="text-[11px] text-[#6B655C] dark:text-[#AFAAA0] truncate">
                              {student.statusText}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4 text-right shrink-0">
                          <div>
                            <span className="font-mono-num font-bold text-xs text-[#B45309] dark:text-[#FBBF24] block">
                              {student.score.toLocaleString('pt-BR')} pts
                            </span>
                            <span className="font-mono-num text-[10px] text-[#28665E] dark:text-[#68B4A8]">
                              {student.minutosEstudados}m hoje · {student.activeDays}d
                            </span>
                          </div>
                          <div className="hidden sm:block text-right">
                            <span className="font-mono-num font-bold text-[#1C1B18] dark:text-[#EBE7DE] block">
                              {student.cardsReviewed}{' '}
                              <span className="font-normal text-[#787368] dark:text-[#AFAAA0]">
                                cards
                              </span>
                            </span>
                            <span className="font-mono-num text-[10px] text-[#787368] dark:text-[#AFAAA0]">
                              {formatStudyHoursMinutes(student.studyTimeMinutes)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* Teacher Mariana Motivational Quote */}
          <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-[#FAF8F5] dark:bg-[#1E221E] p-3.5 text-xs text-[#5C574E] dark:text-[#C5C0B4] flex items-start gap-3">
            <span className="text-xl">👩‍🏫</span>
            <div>
              <p className="font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                Dica da Teacher Mariana:
              </p>
              <p className="mt-0.5 leading-relaxed">
                “O ranking é uma celebração da sua regularidade! O segredo da fluência não é estudar
                5 horas em um único dia, e sim manter a consistência todos os dias. Cada card
                revisado ou dominado conta pontos reais para você evoluir!”
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[#ECE7DD] dark:border-[#2C312C] bg-white dark:bg-[#222722] flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-[#6B655C] dark:text-[#AFAAA0]">
            Dominado (+20) · Praticado (+10) · Quiz (+15) · Dia (+50)
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] text-white text-xs font-semibold transition-colors cursor-pointer ml-auto"
          >
            Continuar Estudando
          </button>
        </div>
      </div>
    </div>
  );
}
