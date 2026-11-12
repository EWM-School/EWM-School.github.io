import { useEffect, useState } from 'react';
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
} from '../utils/speech';
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
  onToggleFocusMode: () => void;
  onResetFilters: () => void;
}

export function StudyView({
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
  onToggleFocusMode,
  onResetFilters,
}: StudyViewProps) {
  const [activeAudio, setActiveAudio] = useState<ActiveAudioPlayback | null>(null);
  const [speechSpeed, setSpeechSpeed] = useState<SpeechSpeed>(() => getSpeechSpeed());

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

  return (
    <div className="space-y-4">
      {/* Study Mode Context Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap p-1 rounded-xl bg-[#EAE6DD] dark:bg-[#1D201D] border border-[#E0DBD1] dark:border-[#2E332E]">
            <button
              type="button"
              onClick={() => onChangeScope('selected')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                studyScope === 'selected'
                  ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs'
                  : 'text-[#5C574E] dark:text-[#AFAAA0]'
              }`}
            >
              Estudo Objetivo{' '}
              <span className="font-mono-num opacity-80">({selectedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeScope('decks')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                studyScope === 'decks'
                  ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs'
                  : 'text-[#5C574E] dark:text-[#AFAAA0]'
              }`}
            >
              Conectados{' '}
              <span className="font-mono-num opacity-80">({connectedCardsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeScope('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                studyScope === 'all'
                  ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs'
                  : 'text-[#5C574E] dark:text-[#AFAAA0]'
              }`}
            >
              Todo o Acervo{' '}
              <span className="font-mono-num opacity-80">({totalDeckCount})</span>
            </button>
          </div>

          {studyScope === 'selected' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onQuickRandomSelection(10)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#EAE6DD] dark:hover:bg-[#242824] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Sortear 10 novos cards para estudo"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Sortear 10</span>
              </button>
              <button
                type="button"
                onClick={onGoToList}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#28665E] dark:text-[#68B4A8] hover:bg-[#EAF3F1] dark:hover:bg-[#1E312E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#28665E] dark:text-[#68B4A8] hover:bg-[#EAF3F1] dark:hover:bg-[#1E312E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Configurar baralhos conectados</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {cards.length > 0 && (
            <span className="font-mono-num text-xs font-medium text-[#5C574E] dark:text-[#AFAAA0] whitespace-nowrap">
              {safeIndex + 1} / {cards.length}
            </span>
          )}
          {focusMode && (
            <button
              type="button"
              onClick={onToggleFocusMode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
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
        <div className="rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] p-8 sm:p-12 text-center space-y-4">
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
                className="px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] text-white dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer"
              >
                Ir para Meus Baralhos
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] text-white dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer"
                >
                  Limpar filtros
                </button>
                <button
                  type="button"
                  onClick={() => onQuickRandomSelection(10)}
                  className="px-4 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] cursor-pointer"
                >
                  Sortear 10 cards
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5">
          {/* 3D Animated Flashcard Stage */}
          <div key={currentCard.id} className="flashcard-perspective animate-card-enter">
            <article
              onClick={onToggleFlip}
              aria-label={`Flashcard ${currentCard.term}`}
              className={`flashcard-inner cursor-pointer select-none ${
                isFlipped ? 'is-flipped' : ''
              }`}
            >
              {/* FRONT FACE */}
              <div
                className={`flashcard-face rounded-3xl border border-[#E4E0D8] dark:border-[#2F352F] bg-white dark:bg-[#212421] shadow-[0_10px_30px_-14px_rgba(28,27,24,0.12)] dark:shadow-[0_14px_34px_-14px_rgba(0,0,0,0.45)] p-5 sm:p-8 min-h-[360px] sm:min-h-[430px] flex flex-col justify-between ${
                  isFlipped ? 'pointer-events-none' : ''
                }`}
              >
                {/* Top Metadata + Actions (Zero-Pill Typography) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#6B655C] dark:text-[#AFAAA0]">
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
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onEditCard(currentCard)}
                      aria-label="Editar card"
                      title="Editar card"
                      className="p-2 rounded-xl text-[#787267] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCard(currentCard)}
                      aria-label="Excluir card"
                      title="Excluir card"
                      className="p-2 rounded-xl text-[#787267] dark:text-[#AFAAA0] hover:text-[#B5443C] dark:hover:text-[#E58982] hover:bg-[#FDF2F2] dark:hover:bg-[#322120] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Center Hero Term + Dual US/UK Phonetics + Dual Native Web Speech Audio Controls */}
                <div className="my-5 text-center space-y-3.5">
                  <h2
                    style={{ textWrap: 'balance' }}
                    className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1B18] dark:text-[#EBE7DE] leading-tight"
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
                  className="space-y-2.5 pt-4 border-t border-[#ECE9E1] dark:border-[#2A2F2A]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 rounded-2xl bg-[#FAF9F6] dark:bg-[#292D29] px-4 py-3">
                    <div className="text-sm text-[#1C1B18] dark:text-[#E5E1D8] leading-relaxed">
                      <span className="font-mono-num text-[11px] font-semibold text-[#28665E] dark:text-[#68B4A8] mr-2">
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

                  <div className="flex items-start justify-between gap-3 rounded-2xl bg-[#FAF9F6] dark:bg-[#292D29] px-4 py-3">
                    <div className="text-sm text-[#1C1B18] dark:text-[#E5E1D8] leading-relaxed">
                      <span className="font-mono-num text-[11px] font-semibold text-[#6B655C] dark:text-[#AFAAA0] mr-2">
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
                  className="mt-4 mx-auto text-center text-[11px] text-[#857F74] dark:text-[#8A857C] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Clique no card ou pressione Espaço para ver a tradução real</span>
                </button>
              </div>

              {/* BACK FACE */}
              <div
                className={`flashcard-face flashcard-face-back absolute inset-0 rounded-3xl border border-[#D4DFDC] dark:border-[#314440] bg-[#FCFBF8] dark:bg-[#232723] shadow-[0_10px_30px_-14px_rgba(28,27,24,0.12)] dark:shadow-[0_14px_34px_-14px_rgba(0,0,0,0.45)] p-6 sm:p-8 flex flex-col justify-between overflow-y-auto ${
                  !isFlipped ? 'pointer-events-none' : ''
                }`}
              >
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#28665E] dark:text-[#68B4A8]">
                      Como falamos no dia a dia
                    </span>
                    <BackFaceTermAudioControls
                      term={currentCard.term}
                      activeAudio={activeAudio}
                      speed={speechSpeed}
                    />
                  </div>

                  {/* Primary Colloquial Translation */}
                  <div className="space-y-1.5">
                    <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1B18] dark:text-[#EBE7DE] leading-snug">
                      {currentCard.colloquial[0] || phonetics.meaning}
                    </h3>

                    {currentCard.colloquial.length > 1 && (
                      <p className="text-sm text-[#4A463F] dark:text-[#C5C0B5]">
                        <span className="text-[#857F74] dark:text-[#8A857C] mr-1.5">
                          Também vale:
                        </span>
                        {currentCard.colloquial.slice(1).join(' · ')}
                      </p>
                    )}

                    <div className="text-xs text-[#6B655C] dark:text-[#AFAAA0] flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
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

                  {/* Translated Examples (also with US & UK audio buttons on the back face) */}
                  <div
                    className="space-y-2 pt-2.5 border-t border-[#ECE9E1] dark:border-[#2D332D]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="rounded-xl bg-[#F3F1EC] dark:bg-[#2B302B] px-3.5 py-2.5 text-xs sm:text-sm space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[#6B655C] dark:text-[#B9B4AA]">
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
                    <div className="rounded-xl bg-[#F3F1EC] dark:bg-[#2B302B] px-3.5 py-2.5 text-xs sm:text-sm space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[#6B655C] dark:text-[#B9B4AA]">
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
                      className="rounded-xl border border-[#DCE5E2] dark:border-[#2F4B46] bg-[#F4F8F7] dark:bg-[#1C2C29] px-3.5 py-2.5 text-xs text-[#224F48] dark:text-[#B5DFD8] leading-relaxed flex flex-wrap items-center justify-between gap-2"
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
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#243B53] hover:bg-[#1B2D40] text-white dark:bg-[#2E4C6B] dark:hover:bg-[#375A7F] dark:text-[#F4F7F8] text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isPlaying(phonetics.ukVariantTerm, 'uk') ? (
                            <AudioWaveIcon className="w-3 h-3" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                          <span>
                            {isPlaying(phonetics.ukVariantTerm, 'uk')
                              ? 'Ouvindo variante UK...'
                              : 'Ouvir variante UK'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Teacher Tip */}
                  {currentCard.tip && (
                    <div className="rounded-xl bg-[#EAF3F1]/70 dark:bg-[#1E312E]/80 px-3.5 py-2.5 text-xs text-[#28564F] dark:text-[#B5DFD8] leading-relaxed">
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
                  className="mt-3 mx-auto text-center text-[11px] text-[#857F74] dark:text-[#8A857C] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Clique para voltar à frente</span>
                </button>
              </div>
            </article>
          </div>

          {/* Bottom Decision & Navigation Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <button
              type="button"
              onClick={onPrev}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-xs font-semibold text-[#5C574E] dark:text-[#D8D4CA] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-center">
              <button
                type="button"
                onClick={() => onMarkStatus('review')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] hover:bg-[#FAEBCE] dark:bg-[#2B2318] dark:hover:bg-[#352B1D] text-[#9A5B13] dark:text-[#E6B472] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>Revisar depois</span>
                <span className="hidden md:inline font-mono-num text-[10px] opacity-65 ml-1">
                  [1]
                </span>
              </button>

              <button
                type="button"
                onClick={() => onMarkStatus('mastered')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Já dominei!</span>
                <span className="hidden md:inline font-mono-num text-[10px] opacity-75 ml-1">
                  [2]
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-xs font-semibold text-[#5C574E] dark:text-[#D8D4CA] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Próximo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
