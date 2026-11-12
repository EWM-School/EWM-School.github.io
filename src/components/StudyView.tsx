import { memo, useEffect, useRef, useState, type TouchEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Edit3,
  Eye,
  FolderKanban,
  Link2,
  ListChecks,
  Minimize2,
  RotateCw,
  Share2,
  Shuffle,
  Trash2,
  Volume2,
} from 'lucide-react';
import type { EnglishAccent, Flashcard, StudyScope } from '../types/flashcard';
import { getCardSecondExample } from '../utils/deckHelpers';
import { getCardPhonetics } from '../utils/phonetics';
import {
  cleanEnglishForSpeech,
  getSpeechSpeed,
  stopCurrentAudio,
  subscribeAudioPlayback,
  subscribeSpeechSpeed,
  toggleSpeakEnglishText,
  type ActiveAudioPlayback,
  type SpeechSpeed,
} from '../services/platform/speechService';
import { triggerTap } from '../services/platform/hapticsService';
import {
  AudioWaveIcon,
  BackFaceTermAudioControls,
  CardTermAudioControls,
  SentenceAudioButtons,
} from './CardAudioControls';
import { DailyGoalProgressBar } from './DailyGoalProgressBar';
import type { UserStudyStats } from '../utils/studyMetrics';

interface StudyViewProps {
  cards: Flashcard[];
  currentIndex: number;
  isFlipped: boolean;
  studyScope: StudyScope;
  selectedCount: number;
  connectedCardsCount: number;
  totalDeckCount: number;
  focusMode: boolean;
  stats: UserStudyStats;
  onUpdateGoal: (newGoal: number) => void;
  onOpenMonthlyStats: () => void;
  onToggleFlip: () => void;
  onPrev: () => void;
  onNext: () => void;
  onMarkStatus: (status: 'mastered' | 'review') => void;
  onChangeScope: (scope: StudyScope) => void;
  onQuickRandomSelection: (qty: number) => void;
  onGoToList: () => void;
  onGoToDecks: () => void;
  onEditCard: (card: Flashcard) => void;
  onDeleteCard: (card: Flashcard) => void;
  onShareCard?: (card: Flashcard) => void;
  onToggleFocusMode: () => void;
  onResetFilters: () => void;
}

export const StudyView = memo(function StudyView({
  cards,
  currentIndex,
  isFlipped,
  studyScope,
  selectedCount,
  connectedCardsCount,
  totalDeckCount,
  focusMode,
  stats,
  onUpdateGoal,
  onOpenMonthlyStats,
  onToggleFlip,
  onPrev,
  onNext,
  onMarkStatus,
  onChangeScope,
  onQuickRandomSelection,
  onGoToList,
  onGoToDecks,
  onEditCard,
  onDeleteCard,
  onShareCard,
  onToggleFocusMode,
  onResetFilters,
}: StudyViewProps) {
  const [activeAudio, setActiveAudio] = useState<ActiveAudioPlayback | null>(null);
  const [speechSpeed, setSpeechSpeed] = useState<SpeechSpeed>(() => getSpeechSpeed());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeConsumedRef = useRef(false);

  useEffect(() => {
    const unsubAudio = subscribeAudioPlayback(setActiveAudio);
    const unsubSpeed = subscribeSpeechSpeed(setSpeechSpeed);
    return () => {
      unsubAudio();
      unsubSpeed();
      stopCurrentAudio();
    };
  }, []);

  const safeIndex = cards.length > 0 ? Math.min(currentIndex, cards.length - 1) : 0;
  const currentCard = cards[safeIndex] || null;
  const currentCardId = currentCard?.id ?? null;

  useEffect(() => {
    stopCurrentAudio();
  }, [currentCardId]);

  const secondExample = currentCard ? getCardSecondExample(currentCard) : { en: '', pt: '' };
  const phonetics = currentCard
    ? getCardPhonetics(currentCard)
    : { meaning: '', us: '', uk: '', ukNote: null, ukVariantTerm: null };

  const progressPct = cards.length > 0 ? ((safeIndex + 1) / cards.length) * 100 : 0;

  const isPlaying = (rawText: string, targetAccent: EnglishAccent) => {
    if (!activeAudio) return false;
    return (
      activeAudio.accent === targetAccent &&
      activeAudio.text === cleanEnglishForSpeech(rawText)
    );
  };

  const handleTouchStart = (e: TouchEvent<HTMLElement>) => {
    const t = e.touches[0];
    if (!t) return;
    swipeConsumedRef.current = false;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (Math.abs(dx) >= 58 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swipeConsumedRef.current = true;
      void triggerTap();
      if (dx < 0) {
        onNext();
      } else {
        onPrev();
      }
    }
  };

  const handleCardClick = () => {
    if (swipeConsumedRef.current) {
      swipeConsumedRef.current = false;
      return;
    }
    onToggleFlip();
  };

  return (
    <div className="space-y-2.5 sm:space-y-4">
      {/* Study Mode Context Strip — Streamlined on Mobile */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="inline-flex flex-wrap p-0.5 sm:p-1 rounded-xl bg-[#EAE6DD] dark:bg-[#1D201D] border border-[#DFDBD0] dark:border-[#2E332E]">
            <button
              type="button"
              onClick={() => onChangeScope('selected')}
              className={`min-h-[34px] lg:min-h-[30px] px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                studyScope === 'selected'
                  ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-2xs'
                  : 'text-[#5C574E] dark:text-[#AFAAA0]'
              }`}
            >
              Objetivo{' '}
              <span className="font-mono-num opacity-80">({selectedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeScope('decks')}
              className={`min-h-[34px] lg:min-h-[30px] px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                studyScope === 'decks'
                  ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-2xs'
                  : 'text-[#5C574E] dark:text-[#AFAAA0]'
              }`}
            >
              Conectados{' '}
              <span className="font-mono-num opacity-80">({connectedCardsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeScope('all')}
              className={`min-h-[34px] lg:min-h-[30px] px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                studyScope === 'all'
                  ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-2xs'
                  : 'text-[#5C574E] dark:text-[#AFAAA0]'
              }`}
            >
              Acervo{' '}
              <span className="font-mono-num opacity-80">({totalDeckCount})</span>
            </button>
          </div>

          {studyScope === 'selected' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onQuickRandomSelection(10)}
                className="min-h-[34px] lg:min-h-[32px] inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#EAE6DD] dark:hover:bg-[#242824] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Sortear 10 novos cards para estudo"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Sortear 10</span>
              </button>
              <button
                type="button"
                onClick={onGoToList}
                className="hidden sm:inline-flex min-h-[34px] lg:min-h-[32px] items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#28665E] dark:text-[#68B4A8] hover:bg-[#EAF3F1] dark:hover:bg-[#1E312E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>Personalizar seleção</span>
              </button>
            </div>
          )}

          {studyScope === 'decks' && (
            <button
              type="button"
              onClick={onGoToDecks}
              className="min-h-[34px] lg:min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium text-[#28665E] dark:text-[#68B4A8] hover:bg-[#EAF3F1] dark:hover:bg-[#1E312E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Configurar baralhos</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {cards.length > 0 && (
            <span className="font-mono-num text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-lg bg-[#EAE6DD]/70 dark:bg-[#252A25] text-[#5C574E] dark:text-[#C5C0B4] whitespace-nowrap">
              {safeIndex + 1} / {cards.length}
            </span>
          )}
          {focusMode && (
            <button
              type="button"
              onClick={onToggleFocusMode}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Sair do Foco</span>
            </button>
          )}
        </div>
      </div>

      {/* Daily Goal & Study Progress Component */}
      {!focusMode && (
        <DailyGoalProgressBar
          stats={stats}
          onUpdateGoal={onUpdateGoal}
          onOpenMonthlyStats={onOpenMonthlyStats}
        />
      )}

      {/* Subtle Progress Line */}
      {cards.length > 0 && (
        <div className="w-full h-1 rounded-full bg-[#E4E0D8] dark:bg-[#292D29] overflow-hidden">
          <div
            className="h-full bg-[#28665E] dark:bg-[#357F74] transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Empty State when filters or connected decks yield 0 cards */}
      {!currentCard ? (
        <div className="rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] p-7 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F0EDE6] dark:bg-[#292D29] mx-auto flex items-center justify-center text-[#28665E] dark:text-[#68B4A8]">
            {studyScope === 'decks' ? (
              <FolderKanban className="w-6 h-6" />
            ) : (
              <Eye className="w-6 h-6" />
            )}
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="font-display text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
              {studyScope === 'decks' && connectedCardsCount === 0
                ? 'Nenhum baralho conectado no momento'
                : 'Nenhum flashcard encontrado com este recorte'}
            </h2>
            <p className="text-sm text-[#5C574E] dark:text-[#AFAAA0]">
              {studyScope === 'decks' && connectedCardsCount === 0
                ? 'Abra a aba Baralhos para criar seu próprio baralho, misturar com cartas do acervo oficial e conectar à sua sessão.'
                : 'Ajuste os filtros acima, alterne para Todo o Acervo ou sorteie uma nova seleção de estudo.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {studyScope === 'decks' && connectedCardsCount === 0 ? (
              <button
                type="button"
                onClick={onGoToDecks}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] text-white dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer"
              >
                Ir para Meus Baralhos
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] text-white dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer"
                >
                  Limpar filtros
                </button>
                <button
                  type="button"
                  onClick={() => onQuickRandomSelection(10)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] cursor-pointer"
                >
                  Sortear 10 cards
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-2.5 sm:space-y-4">
          {/* 3D Animated Flashcard Stage — 20% Proportional Mobile Reduction for Single-Screen Ergonomics */}
          <div key={currentCard.id} className="flashcard-perspective animate-card-enter">
            <article
              onClick={handleCardClick}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              aria-label={`Flashcard ${currentCard.term}`}
              className={`flashcard-inner cursor-pointer select-none ${
                isFlipped ? 'is-flipped' : ''
              }`}
            >
              {/* FRONT FACE */}
              <div
                className={`flashcard-face rounded-2xl sm:rounded-3xl border border-[#DFDAD0] dark:border-[#313831] ring-1 ring-black/[0.02] dark:ring-white/[0.04] bg-white dark:bg-[#202420] shadow-[0_8px_26px_-12px_rgba(28,27,24,0.14)] dark:shadow-[0_14px_32px_-12px_rgba(0,0,0,0.5)] p-4 sm:p-8 min-h-[288px] sm:min-h-[415px] flex flex-col justify-between ${
                  isFlipped ? 'pointer-events-none' : ''
                }`}
              >
                {/* Top Metadata + Share/Edit/Delete Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 text-[11px] sm:text-xs font-medium text-[#6B655C] dark:text-[#AFAAA0]">
                    <span className="text-[#28665E] dark:text-[#68B4A8] font-semibold">
                      {currentCard.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{currentCard.subtopic}</span>
                    {currentCard.origin === 'custom' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#28665E] dark:text-[#86CEC2] font-medium">
                          Minha criação
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        currentCard.status === 'mastered'
                          ? 'text-[#2C6B4F] dark:text-[#78C9A2] font-semibold'
                          : currentCard.status === 'review'
                          ? 'text-[#9A5B13] dark:text-[#E6B472] font-semibold'
                          : ''
                      }
                    >
                      {currentCard.status === 'mastered'
                        ? 'Dominado'
                        : currentCard.status === 'review'
                        ? 'Para revisar'
                        : 'Novo'}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-0.5 shrink-0 -mt-1 -mr-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onShareCard && (
                      <button
                        type="button"
                        onClick={() => onShareCard(currentCard)}
                        aria-label="Compartilhar card no WhatsApp ou Stories"
                        title="Compartilhar card nos Stories / WhatsApp"
                        className="min-w-[38px] min-h-[38px] lg:min-w-[36px] lg:min-h-[36px] inline-flex items-center justify-center rounded-xl text-[#28665E] dark:text-[#68B4A8] hover:bg-[#EAF3F1] dark:hover:bg-[#1E312E] transition-colors cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditCard(currentCard)}
                      aria-label="Editar card"
                      title="Editar card"
                      className="min-w-[38px] min-h-[38px] lg:min-w-[36px] lg:min-h-[36px] inline-flex items-center justify-center rounded-xl text-[#787267] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCard(currentCard)}
                      aria-label="Excluir card"
                      title="Excluir card"
                      className="min-w-[38px] min-h-[38px] lg:min-w-[36px] lg:min-h-[36px] inline-flex items-center justify-center rounded-xl text-[#787267] dark:text-[#AFAAA0] hover:text-[#B5443C] dark:hover:text-[#E58982] hover:bg-[#FDF2F2] dark:hover:bg-[#322120] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>

                {/* Center Hero Term + Dual US/UK Phonetics + Dual Hybrid Speech Audio Controls */}
                <div className="my-2.5 sm:my-5 text-center space-y-2 sm:space-y-3.5">
                  <h2
                    style={{ textWrap: 'balance' }}
                    className="font-display text-[1.6rem] sm:text-4xl font-bold tracking-tight text-[#1C1B18] dark:text-[#EBE7DE] leading-[1.14]"
                  >
                    {currentCard.term}
                  </h2>

                  <CardTermAudioControls
                    term={currentCard.term}
                    phoneticUs={phonetics.us}
                    phoneticUk={phonetics.uk}
                    activeAudio={activeAudio}
                    speed={speechSpeed}
                  />
                </div>

                {/* Two Real-Life English Sentences with US & UK Audio Choice Each */}
                <div
                  className="space-y-1.5 sm:space-y-2.5 pt-2.5 sm:pt-4 border-t border-[#ECE9E1] dark:border-[#2B312B]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-[#FAF9F6] dark:bg-[#282D28] border border-[#EFECE4] dark:border-[#323832] px-3 py-2 sm:px-4 sm:py-3">
                    <div className="text-[12.5px] sm:text-sm text-[#1C1B18] dark:text-[#E8E4DB] leading-snug sm:leading-relaxed">
                      <span className="font-mono-num text-[10px] sm:text-[11px] font-semibold text-[#28665E] dark:text-[#68B4A8] mr-1.5 sm:mr-2">
                        01
                      </span>
                      <span>&ldquo;{currentCard.exampleEn}&rdquo;</span>
                    </div>
                    <SentenceAudioButtons
                      sentence={currentCard.exampleEn}
                      indexLabel="1"
                      activeAudio={activeAudio}
                      speed={speechSpeed}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-[#FAF9F6] dark:bg-[#282D28] border border-[#EFECE4] dark:border-[#323832] px-3 py-2 sm:px-4 sm:py-3">
                    <div className="text-[12.5px] sm:text-sm text-[#1C1B18] dark:text-[#E8E4DB] leading-snug sm:leading-relaxed">
                      <span className="font-mono-num text-[10px] sm:text-[11px] font-semibold text-[#6B655C] dark:text-[#AFAAA0] mr-1.5 sm:mr-2">
                        02
                      </span>
                      <span>&ldquo;{secondExample.en}&rdquo;</span>
                    </div>
                    <SentenceAudioButtons
                      sentence={secondExample.en}
                      indexLabel="2"
                      activeAudio={activeAudio}
                      speed={speechSpeed}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlip();
                  }}
                  className="mt-2 sm:mt-4 mx-auto min-h-[28px] sm:min-h-[36px] text-center text-[10.5px] sm:text-[11px] text-[#7D776C] dark:text-[#989388] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span className="sm:hidden">
                    Toque para virar · Deslize para trocar
                  </span>
                  <span className="hidden sm:inline">
                    Clique no card ou pressione Espaço para ver a tradução real
                  </span>
                </button>
              </div>

              {/* BACK FACE */}
              <div
                className={`flashcard-face flashcard-face-back absolute inset-0 rounded-2xl sm:rounded-3xl border border-[#C9DBD7] dark:border-[#334A45] ring-1 ring-black/[0.02] dark:ring-white/[0.04] bg-[#FCFBF8] dark:bg-[#222723] shadow-[0_8px_26px_-12px_rgba(28,27,24,0.14)] dark:shadow-[0_14px_32px_-12px_rgba(0,0,0,0.5)] p-4 sm:p-8 flex flex-col justify-between overflow-y-auto ${
                  !isFlipped ? 'pointer-events-none' : ''
                }`}
              >
                <div className="space-y-2.5 sm:space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] sm:text-xs font-semibold text-[#28665E] dark:text-[#68B4A8]">
                      Como falamos no dia a dia
                    </span>
                    <BackFaceTermAudioControls
                      term={currentCard.term}
                      activeAudio={activeAudio}
                      speed={speechSpeed}
                    />
                  </div>

                  {/* Primary Colloquial Translation */}
                  <div className="space-y-1">
                    <h3 className="font-display text-xl sm:text-3xl font-bold text-[#1C1B18] dark:text-[#EBE7DE] leading-snug">
                      {currentCard.colloquial[0] || phonetics.meaning}
                    </h3>

                    {currentCard.colloquial.length > 1 && (
                      <p className="text-xs sm:text-sm text-[#4A463F] dark:text-[#C5C0B5]">
                        <span className="text-[#857F74] dark:text-[#8A857C] mr-1.5">
                          Também vale:
                        </span>
                        {currentCard.colloquial.slice(1).join(' · ')}
                      </p>
                    )}

                    <div className="text-[11px] sm:text-xs text-[#6B655C] dark:text-[#AFAAA0] flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5">
                      <span>
                        Sentido literal:{' '}
                        <span className="font-medium text-[#1C1B18] dark:text-[#DCD8CE]">
                          {phonetics.meaning}
                        </span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num text-[#28665E] dark:text-[#68B4A8]">
                        US {phonetics.us}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num text-[#243B53] dark:text-[#9CC3E6]">
                        UK {phonetics.uk}
                      </span>
                    </div>
                  </div>

                  {/* Translated Examples */}
                  <div
                    className="space-y-1.5 sm:space-y-2 pt-2 sm:pt-2.5 border-t border-[#ECE9E1] dark:border-[#2D332D]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="rounded-xl bg-[#F3F1EC] dark:bg-[#2B302B] px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm space-y-0.5 sm:space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[#6B655C] dark:text-[#B9B4AA] leading-snug">
                          01 · &ldquo;{currentCard.exampleEn}&rdquo;
                        </p>
                        <SentenceAudioButtons
                          sentence={currentCard.exampleEn}
                          indexLabel="1"
                          faceLabel="verso"
                          compact
                          activeAudio={activeAudio}
                          speed={speechSpeed}
                        />
                      </div>
                      <p className="font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                        &rarr; {currentCard.examplePt}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#F3F1EC] dark:bg-[#2B302B] px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm space-y-0.5 sm:space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[#6B655C] dark:text-[#B9B4AA] leading-snug">
                          02 · &ldquo;{secondExample.en}&rdquo;
                        </p>
                        <SentenceAudioButtons
                          sentence={secondExample.en}
                          indexLabel="2"
                          faceLabel="verso"
                          compact
                          activeAudio={activeAudio}
                          speed={speechSpeed}
                        />
                      </div>
                      <p className="font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                        &rarr; {secondExample.pt}
                      </p>
                    </div>
                  </div>

                  {/* Regional US <-> UK Contrast Note + Optional UK Variant Audio */}
                  {phonetics.ukNote && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-xl border border-[#DCE5E2] dark:border-[#2F4B46] bg-[#F4F8F7] dark:bg-[#1C2C29] px-3 py-2 sm:px-3.5 sm:py-2.5 text-[11px] sm:text-xs text-[#224F48] dark:text-[#B5DFD8] leading-snug sm:leading-relaxed flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold mr-1">Contraste US &amp; UK:</span>
                        <span>{phonetics.ukNote}</span>
                      </div>
                      {phonetics.ukVariantTerm && (
                        <button
                          type="button"
                          aria-pressed={isPlaying(phonetics.ukVariantTerm, 'uk')}
                          onClick={() =>
                            void toggleSpeakEnglishText(phonetics.ukVariantTerm as string, 'uk', {
                              speed: speechSpeed,
                            })
                          }
                          className="min-h-[34px] lg:min-h-[30px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-[#243B53] hover:bg-[#1B2D40] text-white dark:bg-[#2E4C6B] dark:hover:bg-[#375A7F] dark:text-[#F4F7F8] text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isPlaying(phonetics.ukVariantTerm, 'uk') ? (
                            <AudioWaveIcon className="w-3 h-3" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                          <span>
                            {isPlaying(phonetics.ukVariantTerm, 'uk')
                              ? 'Ouvindo UK...'
                              : 'Ouvir variante UK'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Teacher Tip */}
                  {currentCard.tip && (
                    <div className="rounded-xl bg-[#EAF3F1]/70 dark:bg-[#1E312E]/80 px-3 py-2 sm:px-3.5 sm:py-2.5 text-[11px] sm:text-xs text-[#28564F] dark:text-[#B5DFD8] leading-snug sm:leading-relaxed">
                      <span className="font-semibold mr-1">Dica de uso:</span>
                      {currentCard.tip}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlip();
                  }}
                  className="mt-2 sm:mt-3 mx-auto min-h-[28px] sm:min-h-[36px] text-center text-[10.5px] sm:text-[11px] text-[#7D776C] dark:text-[#989388] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Toque para voltar à frente</span>
                </button>
              </div>
            </article>
          </div>

          {/* Bottom Decision & Navigation Controls — Balanced Single-Viewport Mobile Scale */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-between gap-2 sm:gap-2.5 pt-0.5 sm:pt-1 select-none">
            <button
              type="button"
              onClick={() => {
                void triggerTap();
                onPrev();
              }}
              className="order-3 sm:order-1 min-h-[44px] sm:min-h-[48px] inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[#DFDAD0] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-xs font-semibold text-[#5C574E] dark:text-[#D8D4CA] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <div className="order-1 sm:order-2 col-span-2 grid grid-cols-2 sm:flex items-center gap-2 sm:flex-initial justify-center">
              <button
                type="button"
                onClick={() => onMarkStatus('review')}
                className="min-h-[44px] sm:min-h-[48px] inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] hover:bg-[#FAEBCE] dark:bg-[#2B2318] dark:hover:bg-[#352B1D] text-[#9A5B13] dark:text-[#E6B472] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>Revisar depois</span>
                <span className="hidden md:inline font-mono-num text-[10px] opacity-65 ml-1">
                  [1]
                </span>
              </button>

              <button
                type="button"
                onClick={() => onMarkStatus('mastered')}
                className="min-h-[44px] sm:min-h-[48px] inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>Já dominei!</span>
                <span className="hidden md:inline font-mono-num text-[10px] opacity-75 ml-1">
                  [2]
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                void triggerTap();
                onNext();
              }}
              className="order-4 sm:order-3 min-h-[44px] sm:min-h-[48px] inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-[#DFDAD0] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-xs font-semibold text-[#5C574E] dark:text-[#D8D4CA] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
            >
              <span>Próximo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
