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
  speakEnglishText,
  subscribeAudioPlayback,
  type ActiveAudioPlayback,
} from '../utils/speech';
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

  useEffect(() => {
    return subscribeAudioPlayback(setActiveAudio);
  }, []);

  const safeIndex = cards.length > 0 ? Math.min(currentIndex, cards.length - 1) : 0;
  const currentCard = cards[safeIndex] || null;
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
            <div
              onClick={onToggleFlip}
              role="button"
              tabIndex={0}
              aria-label={`Flashcard ${currentCard.term}. Clique ou pressione Espaço para virar.`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onToggleFlip();
                }
              }}
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

                {/* Center Hero Term + Dual US/UK Phonetics + Dual Native Audio Controls */}
                <div className="my-5 text-center space-y-4">
                  <div className="space-y-2.5">
                    <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#1C1B18] dark:text-[#EBE7DE] leading-tight">
                      {currentCard.term}
                    </h2>

                    {/* Clean Unboxed Comparative US & UK Phonetics */}
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-[13px] font-mono-num text-[#225851] dark:text-[#86CEC2]">
                      <span>
                        <span className="font-sans font-semibold mr-1">US</span>
                        {phonetics.us}
                      </span>
                      <span aria-hidden="true" className="text-[#C6C0B4] dark:text-[#4D544D]">
                        ·
                      </span>
                      <span>
                        <span className="font-sans font-semibold mr-1">UK</span>
                        {phonetics.uk}
                      </span>
                    </div>
                  </div>

                  {/* Side-by-Side US & UK Native Voice Buttons (User chooses either one inside each card) */}
                  <div
                    className="flex flex-wrap items-center justify-center gap-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => void speakEnglishText(currentCard.term, 'us')}
                      aria-label={`Ouvir ${currentCard.term} em inglês americano`}
                      title="Ouvir pronúncia nativa em Inglês Americano (Atalho U)"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isPlaying(currentCard.term, 'us')
                          ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                          : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2] border border-[#C6DBD7] dark:border-[#2F4B46]'
                      }`}
                    >
                      <Volume2 className="w-4 h-4 shrink-0" />
                      <span>
                        {isPlaying(currentCard.term, 'us') ? 'Ouvindo US...' : 'Ouvir US'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void speakEnglishText(currentCard.term, 'uk')}
                      aria-label={`Ouvir ${currentCard.term} em inglês britânico`}
                      title="Ouvir pronúncia nativa em Inglês Britânico (Atalho B)"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isPlaying(currentCard.term, 'uk')
                          ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                          : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2] border border-[#C6DBD7] dark:border-[#2F4B46]'
                      }`}
                    >
                      <Volume2 className="w-4 h-4 shrink-0" />
                      <span>
                        {isPlaying(currentCard.term, 'uk') ? 'Ouvindo UK...' : 'Ouvir UK'}
                      </span>
                    </button>
                  </div>
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void speakEnglishText(currentCard.exampleEn, 'us')}
                        aria-label="Ouvir frase 1 em inglês americano"
                        title="Ouvir frase 1 em Inglês Americano (US)"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isPlaying(currentCard.exampleEn, 'us')
                            ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                            : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2]'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>US</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void speakEnglishText(currentCard.exampleEn, 'uk')}
                        aria-label="Ouvir frase 1 em inglês britânico"
                        title="Ouvir frase 1 em Inglês Britânico (UK)"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isPlaying(currentCard.exampleEn, 'uk')
                            ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                            : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2]'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>UK</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3 rounded-2xl bg-[#FAF9F6] dark:bg-[#292D29] px-4 py-3">
                    <div className="text-sm text-[#1C1B18] dark:text-[#E5E1D8] leading-relaxed">
                      <span className="font-mono-num text-[11px] font-semibold text-[#6B655C] dark:text-[#AFAAA0] mr-2">
                        02
                      </span>
                      <span>&ldquo;{secondExample.en}&rdquo;</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void speakEnglishText(secondExample.en, 'us')}
                        aria-label="Ouvir frase 2 em inglês americano"
                        title="Ouvir frase 2 em Inglês Americano (US)"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isPlaying(secondExample.en, 'us')
                            ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                            : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2]'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>US</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void speakEnglishText(secondExample.en, 'uk')}
                        aria-label="Ouvir frase 2 em inglês britânico"
                        title="Ouvir frase 2 em Inglês Britânico (UK)"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isPlaying(secondExample.en, 'uk')
                            ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                            : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2]'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>UK</span>
                      </button>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-center text-[11px] text-[#857F74] dark:text-[#8A857C] flex items-center justify-center gap-1.5">
                  <RotateCw className="w-3 h-3" />
                  <span>Clique no card ou pressione Espaço para ver a tradução real</span>
                </p>
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
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs font-semibold text-[#5C574E] dark:text-[#BEB9AE]">
                        {currentCard.term}
                      </span>
                      <button
                        type="button"
                        onClick={() => void speakEnglishText(currentCard.term, 'us')}
                        title="Ouvir em Inglês Americano (US)"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EAF3F1] dark:bg-[#1E312E] text-[11px] font-semibold text-[#225851] dark:text-[#86CEC2] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>US</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void speakEnglishText(currentCard.term, 'uk')}
                        title="Ouvir em Inglês Britânico (UK)"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EAF3F1] dark:bg-[#1E312E] text-[11px] font-semibold text-[#225851] dark:text-[#86CEC2] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>UK</span>
                      </button>
                    </div>
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
                      <span className="font-mono-num text-[#28665E] dark:text-[#68B4A8]">
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
                        <div className="inline-flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void speakEnglishText(currentCard.exampleEn, 'us')}
                            aria-label="Ouvir frase 1 em inglês americano no verso"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#1E312E] text-[10px] font-semibold text-[#225851] dark:text-[#86CEC2] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>US</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void speakEnglishText(currentCard.exampleEn, 'uk')}
                            aria-label="Ouvir frase 1 em inglês britânico no verso"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#1E312E] text-[10px] font-semibold text-[#225851] dark:text-[#86CEC2] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>UK</span>
                          </button>
                        </div>
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
                        <div className="inline-flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void speakEnglishText(secondExample.en, 'us')}
                            aria-label="Ouvir frase 2 em inglês americano no verso"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#1E312E] text-[10px] font-semibold text-[#225851] dark:text-[#86CEC2] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>US</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void speakEnglishText(secondExample.en, 'uk')}
                            aria-label="Ouvir frase 2 em inglês britânico no verso"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#1E312E] text-[10px] font-semibold text-[#225851] dark:text-[#86CEC2] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>UK</span>
                          </button>
                        </div>
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
                          onClick={() =>
                            void speakEnglishText(phonetics.ukVariantTerm as string, 'uk')
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#28665E] hover:bg-[#1F524B] text-white dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6] text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Ouvir variante UK</span>
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

                <p className="mt-3 text-center text-[11px] text-[#857F74] dark:text-[#8A857C] flex items-center justify-center gap-1.5">
                  <RotateCw className="w-3 h-3" />
                  <span>Clique para voltar à frente</span>
                </p>
              </div>
            </div>
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
