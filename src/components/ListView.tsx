import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  Edit3,
  LayoutGrid,
  List as ListIcon,
  MessageSquareQuote,
  Mic,
  MicOff,
  Search,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import {
  MAX_STUDY_CARDS,
  MIN_STUDY_CARDS,
  VALID_FOLDERS,
  VALID_SUBTOPICS,
} from '../data/seedData';
import type {
  Flashcard,
  ListSelectionFilter,
  ListViewMode,
  SubtopicKey,
  TopicFolder,
} from '../types/flashcard';
import { exportCardsToCsv, getCardSecondExample } from '../utils/deckHelpers';
import { getCardPhonetics } from '../utils/phonetics';
import {
  cleanSpeechSearchQuery,
  getAudioButtonVisualState,
  getSelectedVoiceLocale,
  isSpeechRecognitionSupported,
  startVoiceSearch,
  stopCurrentAudio,
  toggleSpeakEnglishText,
  type ActiveAudioPlayback,
  type SpeechRecognitionController,
} from '../services/platform/speechService';
import { useAudioPlaybackState } from '../hooks/useAudioPlaybackState';
import { triggerTap } from '../services/platform/hapticsService';
import { AudioStatusIcon } from './CardAudioControls';
import {
  CardPronunciationDrawer,
  type CardPronunciationSession,
} from './CardPronunciationDrawer';
import type { PronunciationEvaluationResult } from '../utils/pronunciationEngine';

interface CompactCardRowProps {
  card: Flashcard;
  isSelected: boolean;
  selOrder: number | null;
  activeAudio: ActiveAudioPlayback | null;
  onToggleCardSelection: (cardId: string) => void;
  onEditCard: (card: Flashcard) => void;
  onDeleteCard: (card: Flashcard) => void;
  onOpenPronunciation: (session: CardPronunciationSession) => void;
}

const CompactCardRow = memo(function CompactCardRow({
  card,
  isSelected,
  selOrder,
  activeAudio,
  onToggleCardSelection,
  onEditCard,
  onDeleteCard,
  onOpenPronunciation,
}: CompactCardRowProps) {
  const phonetics = getCardPhonetics(card);
  const usSourceId = `list-compact-${card.id}-us`;
  const ukSourceId = `list-compact-${card.id}-uk`;
  const exSourceId = `list-compact-${card.id}-ex`;

  const usState = getAudioButtonVisualState(activeAudio, {
    text: card.term,
    accent: 'us',
    sourceId: usSourceId,
  });
  const ukState = getAudioButtonVisualState(activeAudio, {
    text: card.term,
    accent: 'uk',
    sourceId: ukSourceId,
  });
  const exState = getAudioButtonVisualState(activeAudio, {
    text: card.exampleEn,
    sourceId: exSourceId,
  });

  return (
    <div
      className={`virtualized-compact-row px-4 py-3 flex flex-wrap items-center justify-between gap-3 transition-colors ${
        isSelected ? 'bg-[#EAF3F1]/45 dark:bg-[#1E312E]/50' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={() => {
            void triggerTap();
            onToggleCardSelection(card.id);
          }}
          aria-label={isSelected ? `Remover ${card.term}` : `Selecionar ${card.term}`}
          className="min-w-[44px] min-h-[44px] lg:min-w-[28px] lg:min-h-[28px] flex items-center justify-center shrink-0 cursor-pointer"
        >
          <span
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-[#28665E] border-[#28665E] text-white dark:bg-[#2A6D63] dark:border-[#2A6D63] dark:text-[#F4F7F6]'
                : 'border-[#CFC9BE] dark:border-[#424942] bg-white dark:bg-[#292D29]'
            }`}
          >
            {isSelected && <Check className="w-3.5 h-3.5" />}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-display font-bold text-sm text-[#1C1B18] dark:text-[#EBE7DE]">
              {card.term}
            </span>
            <span className="text-xs text-[#28665E] dark:text-[#68B4A8] font-medium">
              &rarr; {card.colloquial[0] || phonetics.meaning}
            </span>
          </div>
          <p className="text-[11px] text-[#6B655C] dark:text-[#AFAAA0] truncate font-mono-num">
            <span>
              {card.category} · {card.subtopic}
            </span>
            <span className="mx-1.5 opacity-60" aria-hidden="true">
              ·
            </span>
            <span>US {phonetics.us}</span>
            <span className="mx-1.5 opacity-60" aria-hidden="true">
              ·
            </span>
            <span>UK {phonetics.uk}</span>
            {selOrder ? ` · #${selOrder} no Estudo` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 select-none">
        <button
          type="button"
          aria-pressed={usState !== 'idle'}
          aria-busy={usState === 'loading'}
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            void toggleSpeakEnglishText(card.term, 'us', {
              role: 'term',
              sourceId: usSourceId,
            });
          }}
          title="Ouvir expressão em Inglês Americano (US)"
          aria-label={`Ouvir ${card.term} em inglês americano`}
          className={`min-h-[40px] lg:min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            usState === 'loading'
              ? 'ewm-audio-loading'
              : usState === 'playing'
              ? 'ewm-audio-playing'
              : ''
          } ${
            usState !== 'idle'
              ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
              : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2]'
          }`}
        >
          <AudioStatusIcon state={usState} idleClassName="w-3 h-3 shrink-0" activeClassName="w-3 h-2.5" />
          <span>US</span>
        </button>
        <button
          type="button"
          aria-pressed={ukState !== 'idle'}
          aria-busy={ukState === 'loading'}
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            void toggleSpeakEnglishText(card.term, 'uk', {
              role: 'term',
              sourceId: ukSourceId,
            });
          }}
          title="Ouvir expressão em Inglês Britânico (UK)"
          aria-label={`Ouvir ${card.term} em inglês britânico`}
          className={`min-h-[40px] lg:min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            ukState === 'loading'
              ? 'ewm-audio-loading'
              : ukState === 'playing'
              ? 'ewm-audio-playing'
              : ''
          } ${
            ukState !== 'idle'
              ? 'bg-[#243B53] text-white dark:bg-[#2E4C6B] dark:text-[#F4F7F8]'
              : 'bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[#243B53] dark:text-[#9CC3E6]'
          }`}
        >
          <AudioStatusIcon state={ukState} idleClassName="w-3 h-3 shrink-0" activeClassName="w-3 h-2.5" />
          <span>UK</span>
        </button>
        <button
          type="button"
          aria-pressed={exState !== 'idle'}
          aria-busy={exState === 'loading'}
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            void toggleSpeakEnglishText(card.exampleEn, getSelectedVoiceLocale(), {
              role: 'sentence',
              sourceId: exSourceId,
            });
          }}
          title={`Ouvir frase de exemplo completa: "${card.exampleEn}"`}
          aria-label={`Ouvir frase de exemplo de ${card.term}`}
          className={`min-h-[40px] lg:min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            exState === 'loading'
              ? 'ewm-audio-loading'
              : exState === 'playing'
              ? 'ewm-audio-playing'
              : ''
          } ${
            exState !== 'idle'
              ? 'bg-[#1C1B18] text-[#F6F4EF] dark:bg-[#EBE7DE] dark:text-[#181A18]'
              : 'bg-[#F3F1EC] hover:bg-[#E7E3DA] dark:bg-[#282C28] dark:hover:bg-[#313631] text-[#4A463F] dark:text-[#C5C0B5]'
          }`}
        >
          <AudioStatusIcon
            state={exState}
            idleClassName="w-3 h-3 shrink-0"
            activeClassName="w-3 h-2.5"
            idleIcon={<MessageSquareQuote className="w-3 h-3 shrink-0" />}
          />
          <span>Frase</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void triggerTap();
            onOpenPronunciation({ card, initialTarget: 'term' });
          }}
          title="Treinar pronúncia (🎤)"
          aria-label={`Treinar pronúncia de ${card.term}`}
          className="min-h-[40px] lg:min-h-[30px] inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[11px] font-semibold text-[#225851] dark:text-[#86CEC2] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Mic className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditCard(card);
          }}
          title="Editar"
          aria-label={`Editar ${card.term}`}
          className="min-w-[40px] min-h-[40px] lg:min-w-[32px] lg:min-h-[32px] inline-flex items-center justify-center rounded-lg text-[#6B655C] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] cursor-pointer"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteCard(card);
          }}
          title="Excluir"
          aria-label={`Excluir ${card.term}`}
          className="min-w-[40px] min-h-[40px] lg:min-w-[32px] lg:min-h-[32px] inline-flex items-center justify-center rounded-lg text-[#6B655C] dark:text-[#AFAAA0] hover:text-[#B5443C] dark:hover:text-[#E58982] hover:bg-[#FDF2F2] dark:hover:bg-[#322120] cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

interface GridCardItemProps {
  card: Flashcard;
  isSelected: boolean;
  selOrder: number | null;
  activeAudio: ActiveAudioPlayback | null;
  onToggleCardSelection: (cardId: string) => void;
  onUpdateCardCategory: (cardId: string, category: TopicFolder) => void;
  onUpdateCardSubtopic: (cardId: string, subtopic: SubtopicKey) => void;
  onEditCard: (card: Flashcard) => void;
  onDeleteCard: (card: Flashcard) => void;
  onOpenPronunciation: (session: CardPronunciationSession) => void;
}

const GridCardItem = memo(function GridCardItem({
  card,
  isSelected,
  selOrder,
  activeAudio,
  onToggleCardSelection,
  onUpdateCardCategory,
  onUpdateCardSubtopic,
  onEditCard,
  onDeleteCard,
  onOpenPronunciation,
}: GridCardItemProps) {
  const sec = getCardSecondExample(card);
  const phonetics = getCardPhonetics(card);

  const termUsId = `list-grid-${card.id}-term-us`;
  const termUkId = `list-grid-${card.id}-term-uk`;
  const ex1UsId = `list-grid-${card.id}-ex1-us`;
  const ex1UkId = `list-grid-${card.id}-ex1-uk`;
  const ex2UsId = `list-grid-${card.id}-ex2-us`;
  const ex2UkId = `list-grid-${card.id}-ex2-uk`;

  const termUsState = getAudioButtonVisualState(activeAudio, {
    text: card.term,
    accent: 'us',
    sourceId: termUsId,
  });
  const termUkState = getAudioButtonVisualState(activeAudio, {
    text: card.term,
    accent: 'uk',
    sourceId: termUkId,
  });
  const ex1UsState = getAudioButtonVisualState(activeAudio, {
    text: card.exampleEn,
    accent: 'us',
    sourceId: ex1UsId,
  });
  const ex1UkState = getAudioButtonVisualState(activeAudio, {
    text: card.exampleEn,
    accent: 'uk',
    sourceId: ex1UkId,
  });
  const ex2UsState = getAudioButtonVisualState(activeAudio, {
    text: sec.en,
    accent: 'us',
    sourceId: ex2UsId,
  });
  const ex2UkState = getAudioButtonVisualState(activeAudio, {
    text: sec.en,
    accent: 'uk',
    sourceId: ex2UkId,
  });

  const stateMotionClass = (st: 'idle' | 'loading' | 'playing') =>
    st === 'loading' ? 'ewm-audio-loading' : st === 'playing' ? 'ewm-audio-playing' : '';

  return (
    <article
      className={`virtualized-card-item rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
        isSelected
          ? 'border-[#28665E] dark:border-[#41786F] bg-[#FCFDFC] dark:bg-[#202826]'
          : 'border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421]'
      }`}
    >
      <div className="space-y-2.5">
        {/* Selection Bar — >= 44px mobile touch target */}
        <button
          type="button"
          onClick={() => {
            void triggerTap();
            onToggleCardSelection(card.id);
          }}
          className={`w-full min-h-[44px] lg:min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
            isSelected
              ? 'bg-[#EAF3F1] dark:bg-[#1E312E] text-[#225851] dark:text-[#86CEC2]'
              : 'bg-[#F0EDE6] dark:bg-[#292D29] text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6]'
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className={`w-4 h-4 rounded-sm border flex items-center justify-center ${
                isSelected
                  ? 'bg-[#28665E] border-[#28665E] text-white dark:bg-[#2A6D63] dark:border-[#2A6D63] dark:text-[#F4F7F6]'
                  : 'border-[#BDB6AA] dark:border-[#4A524A]'
              }`}
            >
              {isSelected && <Check className="w-3 h-3" />}
            </span>
            <span>{isSelected ? 'No Estudo Objetivo' : 'Incluir no Estudo'}</span>
          </span>
          <span className="font-mono-num text-[11px]">{selOrder ? `#${selOrder}` : '+'}</span>
        </button>

        {/* Category / Subtopic Selectors + Card Actions */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <select
              aria-label={`Pasta de ${card.term}`}
              value={card.category}
              onChange={(e) => onUpdateCardCategory(card.id, e.target.value as TopicFolder)}
              className="min-h-[36px] lg:min-h-[28px] text-[11px] font-medium px-2 py-1 rounded-lg border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-[#5C574E] dark:text-[#C8C3B8] cursor-pointer"
            >
              {VALID_FOLDERS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <select
              aria-label={`Subtópico de ${card.term}`}
              value={card.subtopic}
              onChange={(e) => onUpdateCardSubtopic(card.id, e.target.value as SubtopicKey)}
              className="min-h-[36px] lg:min-h-[28px] text-[11px] font-medium px-2 py-1 rounded-lg border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-[#5C574E] dark:text-[#C8C3B8] cursor-pointer"
            >
              {VALID_SUBTOPICS.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onEditCard(card)}
              title="Editar card"
              aria-label={`Editar ${card.term}`}
              className="min-w-[38px] min-h-[38px] lg:min-w-[30px] lg:min-h-[30px] inline-flex items-center justify-center rounded-lg text-[#787267] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteCard(card)}
              title="Excluir card"
              aria-label={`Excluir ${card.term}`}
              className="min-w-[38px] min-h-[38px] lg:min-w-[30px] lg:min-h-[30px] inline-flex items-center justify-center rounded-lg text-[#787267] dark:text-[#AFAAA0] hover:text-[#B5443C] dark:hover:text-[#E58982] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Term + US/UK Audio + Translations */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE] leading-snug">
              {card.term}
            </h3>

            <div className="inline-flex items-center gap-1 shrink-0 select-none">
              <button
                type="button"
                aria-pressed={termUsState !== 'idle'}
                aria-busy={termUsState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(card.term, 'us', {
                    role: 'term',
                    sourceId: termUsId,
                  });
                }}
                title="Ouvir expressão em Inglês Americano (US)"
                aria-label={`Ouvir ${card.term} em inglês americano`}
                className={`min-h-[38px] lg:min-h-[28px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${stateMotionClass(
                  termUsState
                )} ${
                  termUsState !== 'idle'
                    ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                    : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2]'
                }`}
              >
                <AudioStatusIcon
                  state={termUsState}
                  idleClassName="w-3 h-3 shrink-0"
                  activeClassName="w-3 h-2.5"
                />
                <span>US</span>
              </button>
              <button
                type="button"
                aria-pressed={termUkState !== 'idle'}
                aria-busy={termUkState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(card.term, 'uk', {
                    role: 'term',
                    sourceId: termUkId,
                  });
                }}
                title="Ouvir expressão em Inglês Britânico (UK)"
                aria-label={`Ouvir ${card.term} em inglês britânico`}
                className={`min-h-[38px] lg:min-h-[28px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${stateMotionClass(
                  termUkState
                )} ${
                  termUkState !== 'idle'
                    ? 'bg-[#243B53] text-white dark:bg-[#2E4C6B] dark:text-[#F4F7F8]'
                    : 'bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[#243B53] dark:text-[#9CC3E6]'
                }`}
              >
                <AudioStatusIcon
                  state={termUkState}
                  idleClassName="w-3 h-3 shrink-0"
                  activeClassName="w-3 h-2.5"
                />
                <span>UK</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  onOpenPronunciation({ card, initialTarget: 'term' });
                }}
                title="Treinar pronúncia (🎤)"
                aria-label={`Treinar pronúncia de ${card.term}`}
                className="min-h-[38px] lg:min-h-[28px] inline-flex items-center justify-center px-2 py-1 rounded-lg bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[11px] font-semibold text-[#225851] dark:text-[#86CEC2] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Mic className="w-3 h-3" />
              </button>
            </div>
          </div>

          <p className="text-xs font-semibold text-[#28665E] dark:text-[#68B4A8]">
            {card.colloquial.slice(0, 3).join(' · ')}
          </p>

          <p className="text-[11px] text-[#6B655C] dark:text-[#AFAAA0] line-clamp-2">
            {phonetics.meaning}
          </p>

          <p className="text-[11px] font-mono-num text-[#4A463F] dark:text-[#C8C3B8] pt-0.5">
            <span>US {phonetics.us}</span>
            <span className="mx-1.5 opacity-60" aria-hidden="true">
              ·
            </span>
            <span>UK {phonetics.uk}</span>
          </p>
        </div>
      </div>

      {/* Compact Examples with US & UK Audio Choice */}
      <div className="rounded-xl bg-[#FAF9F6] dark:bg-[#292D29] p-2.5 text-[11px] space-y-2 border border-[#ECE9E1] dark:border-[#343A34]">
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[#4A463F] dark:text-[#D8D4CA] italic">
              1. &ldquo;{card.exampleEn}&rdquo;
            </p>
            <div className="inline-flex items-center gap-1 shrink-0 select-none">
              <button
                type="button"
                aria-pressed={ex1UsState !== 'idle'}
                aria-busy={ex1UsState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(card.exampleEn, 'us', {
                    role: 'sentence',
                    sourceId: ex1UsId,
                  });
                }}
                aria-label={`Ouvir frase 1 de ${card.term} em inglês americano`}
                title="Ouvir frase completa 1 em Inglês Americano (US)"
                className={`min-h-[30px] lg:min-h-[24px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${stateMotionClass(
                  ex1UsState
                )} ${
                  ex1UsState !== 'idle'
                    ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                    : 'bg-[#EAF3F1] dark:bg-[#1E312E] text-[#225851] dark:text-[#86CEC2] hover:opacity-85'
                }`}
              >
                <AudioStatusIcon
                  state={ex1UsState}
                  idleClassName="w-2.5 h-2.5 shrink-0"
                  activeClassName="w-2.5 h-2.5"
                />
                <span>US</span>
              </button>
              <button
                type="button"
                aria-pressed={ex1UkState !== 'idle'}
                aria-busy={ex1UkState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(card.exampleEn, 'uk', {
                    role: 'sentence',
                    sourceId: ex1UkId,
                  });
                }}
                aria-label={`Ouvir frase 1 de ${card.term} em inglês britânico`}
                title="Ouvir frase completa 1 em Inglês Britânico (UK)"
                className={`min-h-[30px] lg:min-h-[24px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${stateMotionClass(
                  ex1UkState
                )} ${
                  ex1UkState !== 'idle'
                    ? 'bg-[#243B53] text-white dark:bg-[#2E4C6B] dark:text-[#F4F7F8]'
                    : 'bg-[#EDF1F5] dark:bg-[#1E2630] text-[#243B53] dark:text-[#9CC3E6] hover:opacity-85'
                }`}
              >
                <AudioStatusIcon
                  state={ex1UkState}
                  idleClassName="w-2.5 h-2.5 shrink-0"
                  activeClassName="w-2.5 h-2.5"
                />
                <span>UK</span>
              </button>
            </div>
          </div>
          <p className="text-[#1C1B18] dark:text-[#EBE7DE] font-medium">&rarr; {card.examplePt}</p>
        </div>
        <div className="pt-1.5 border-t border-[#E4E0D8] dark:border-[#343A34] space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[#4A463F] dark:text-[#D8D4CA] italic">2. &ldquo;{sec.en}&rdquo;</p>
            <div className="inline-flex items-center gap-1 shrink-0 select-none">
              <button
                type="button"
                aria-pressed={ex2UsState !== 'idle'}
                aria-busy={ex2UsState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(sec.en, 'us', {
                    role: 'sentence',
                    sourceId: ex2UsId,
                  });
                }}
                aria-label={`Ouvir frase 2 de ${card.term} em inglês americano`}
                title="Ouvir frase completa 2 em Inglês Americano (US)"
                className={`min-h-[30px] lg:min-h-[24px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${stateMotionClass(
                  ex2UsState
                )} ${
                  ex2UsState !== 'idle'
                    ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                    : 'bg-[#EAF3F1] dark:bg-[#1E312E] text-[#225851] dark:text-[#86CEC2] hover:opacity-85'
                }`}
              >
                <AudioStatusIcon
                  state={ex2UsState}
                  idleClassName="w-2.5 h-2.5 shrink-0"
                  activeClassName="w-2.5 h-2.5"
                />
                <span>US</span>
              </button>
              <button
                type="button"
                aria-pressed={ex2UkState !== 'idle'}
                aria-busy={ex2UkState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(sec.en, 'uk', {
                    role: 'sentence',
                    sourceId: ex2UkId,
                  });
                }}
                aria-label={`Ouvir frase 2 de ${card.term} em inglês britânico`}
                title="Ouvir frase completa 2 em Inglês Britânico (UK)"
                className={`min-h-[30px] lg:min-h-[24px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${stateMotionClass(
                  ex2UkState
                )} ${
                  ex2UkState !== 'idle'
                    ? 'bg-[#243B53] text-white dark:bg-[#2E4C6B] dark:text-[#F4F7F8]'
                    : 'bg-[#EDF1F5] dark:bg-[#1E2630] text-[#243B53] dark:text-[#9CC3E6] hover:opacity-85'
                }`}
              >
                <AudioStatusIcon
                  state={ex2UkState}
                  idleClassName="w-2.5 h-2.5 shrink-0"
                  activeClassName="w-2.5 h-2.5"
                />
                <span>UK</span>
              </button>
            </div>
          </div>
          <p className="text-[#1C1B18] dark:text-[#EBE7DE] font-medium">&rarr; {sec.pt}</p>
        </div>
      </div>
    </article>
  );
});

interface ListViewProps {
  cards: Flashcard[];
  allCardsCount: number;
  selectedStudyIds: Set<string>;
  searchQuery: string;
  onChangeSearch: (q: string) => void;
  listSelectionFilter: ListSelectionFilter;
  onChangeSelectionFilter: (f: ListSelectionFilter) => void;
  listViewMode: ListViewMode;
  onChangeViewMode: (m: ListViewMode) => void;
  onToggleCardSelection: (cardId: string) => void;
  onSelectRandom: (qty: number) => void;
  onClearSelection: () => void;
  onUpdateCardCategory: (cardId: string, category: TopicFolder) => void;
  onUpdateCardSubtopic: (cardId: string, subtopic: SubtopicKey) => void;
  onEditCard: (card: Flashcard) => void;
  onDeleteCard: (card: Flashcard) => void;
  onGoToStudy: () => void;
  onNotify: (msg: string) => void;
  onPronunciationEvaluated?: (
    result: PronunciationEvaluationResult,
    targetText: string
  ) => { awardedXp: number; alreadyRewardedToday: boolean } | void;
}

export const ListView = memo(function ListView({
  cards,
  allCardsCount,
  selectedStudyIds,
  searchQuery,
  onChangeSearch,
  listSelectionFilter,
  onChangeSelectionFilter,
  listViewMode,
  onChangeViewMode,
  onToggleCardSelection,
  onSelectRandom,
  onClearSelection,
  onUpdateCardCategory,
  onUpdateCardSubtopic,
  onEditCard,
  onDeleteCard,
  onGoToStudy,
  onNotify,
  onPronunciationEvaluated,
}: ListViewProps) {
  // O(1) lookup map for selection order instead of O(N) indexOf inside every card row
  const selectionOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 1;
    selectedStudyIds.forEach((id) => {
      map.set(id, idx++);
    });
    return map;
  }, [selectedStudyIds]);

  const { activeAudio } = useAudioPlaybackState();
  const [isListening, setIsListening] = useState(false);
  const [pronunciationSession, setPronunciationSession] =
    useState<CardPronunciationSession | null>(null);
  const recognitionRef = useRef<SpeechRecognitionController | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      stopCurrentAudio();
    };
  }, []);

  const handleStopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const handleToggleVoiceSearch = useCallback(() => {
    if (isListening) {
      handleStopListening();
      onNotify('Pesquisa por voz encerrada.');
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      onNotify(
        'Pesquisa por voz não é suportada neste ambiente. Recomendamos digitar o termo acima.'
      );
      return;
    }

    onNotify('Ouvindo em inglês... Fale a palavra ou expressão.');
    setIsListening(true);

    const controller = startVoiceSearch({
      lang: 'en-US',
      onStart: () => {
        setIsListening(true);
      },
      onResult: (transcript, isFinal) => {
        const clean = cleanSpeechSearchQuery(transcript);
        if (clean) {
          onChangeSearch(clean);
          if (isFinal) {
            onNotify(`Pesquisando por: "${clean}"`);
            setIsListening(false);
            recognitionRef.current = null;
          }
        }
      },
      onError: (err) => {
        setIsListening(false);
        recognitionRef.current = null;
        if (err === 'not-allowed' || err === 'permission-denied') {
          onNotify(
            'Permissão do microfone negada. Permita o microfone nas configurações do dispositivo.'
          );
        } else if (err === 'no-speech') {
          onNotify('Nenhuma fala em inglês detectada. Tente falar novamente.');
        } else if (err !== 'aborted') {
          onNotify('Não foi possível reconhecer a voz. Tente falar novamente.');
        }
      },
      onEnd: () => {
        setIsListening(false);
        recognitionRef.current = null;
      },
    });

    recognitionRef.current = controller;
  }, [isListening, handleStopListening, onChangeSearch, onNotify]);

  const handleExportCsv = useCallback(() => {
    const csv = exportCardsToCsv(cards.length > 0 ? cards : []);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ewm-flashcards-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify('Backup CSV exportado com sucesso.');
  }, [cards, onNotify]);

  return (
    <div className="space-y-4">
      {/* Estudo Objetivo Selection + Search Strip */}
      <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
              Estudo Objetivo ({MIN_STUDY_CARDS} a {MAX_STUDY_CARDS} cards)
            </h2>
            <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0]">
              <span className="font-mono-num font-semibold text-[#28665E] dark:text-[#68B4A8]">
                {selectedStudyIds.size}/{MAX_STUDY_CARDS}
              </span>{' '}
              selecionados para sua sessão focada de flashcards
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#857F74] dark:text-[#8A857C] mr-1">Sortear:</span>
            {[5, 8, 10, 15, 20].map((qty) => (
              <button
                key={qty}
                type="button"
                onClick={() => onSelectRandom(qty)}
                className="min-h-[40px] lg:min-h-[28px] px-3 py-1 rounded-lg bg-[#F0EDE6] hover:bg-[#E4E0D8] dark:bg-[#292D29] dark:hover:bg-[#333833] text-xs font-semibold font-mono-num text-[#1C1B18] dark:text-[#EBE7DE] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {qty}
              </button>
            ))}

            {selectedStudyIds.size > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="min-h-[40px] lg:min-h-[28px] px-2.5 py-1 rounded-lg text-xs font-medium text-[#B5443C] dark:text-[#E58982] hover:bg-[#FDF2F2] dark:hover:bg-[#322120] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Limpar
              </button>
            )}

            {selectedStudyIds.size >= MIN_STUDY_CARDS && (
              <button
                type="button"
                onClick={onGoToStudy}
                className="min-h-[40px] lg:min-h-[28px] inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#28665E] hover:bg-[#1F524B] text-white dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Shuffle className="w-3 h-3" />
                <span>Estudar agora</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & View Mode Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#ECE9E1] dark:border-[#2A2F2A]">
          <div className="relative flex-1 min-w-[210px]">
            <Search className="w-4 h-4 text-[#857F74] dark:text-[#8A857C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onChangeSearch(e.target.value)}
              placeholder={
                isListening
                  ? 'Ouvindo... Fale a expressão em inglês'
                  : 'Buscar termo, tradução, pronúncia US/UK ou dica...'
              }
              className={`w-full min-h-[48px] lg:min-h-[38px] pl-9 pr-16 py-2 rounded-xl border text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE] placeholder:text-[#857F74] dark:placeholder:text-[#8A857C] focus:outline-none transition-colors ${
                isListening
                  ? 'border-[#28665E] dark:border-[#68B4A8] bg-[#F0F7F6] dark:bg-[#1E312E] ring-2 ring-[#28665E]/20'
                  : 'border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] focus:ring-2 focus:ring-[#28665E]/30'
              }`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onChangeSearch('')}
                  aria-label="Limpar busca"
                  className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-[#857F74] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleVoiceSearch}
                aria-label={isListening ? 'Parar pesquisa por voz' : 'Pesquisar por voz em inglês'}
                title={
                  isListening
                    ? 'Parar escuta de voz'
                    : 'Pesquisar por voz em inglês (fale o termo)'
                }
                className={`min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  isListening
                    ? 'text-[#B5443C] dark:text-[#E58982] bg-[#FDF2F2] dark:bg-[#322120] animate-pulse'
                    : 'text-[#857F74] dark:text-[#8A857C] hover:text-[#28665E] dark:hover:text-[#68B4A8]'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleVoiceSearch}
            aria-label="Pesquisa por voz"
            aria-pressed={isListening}
            title={isListening ? 'Parar escuta de voz' : 'Pesquisar cards falando o termo em inglês'}
            className={`min-h-[48px] lg:min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              isListening
                ? 'border-[#B5443C] bg-[#FDF2F2] dark:bg-[#322120] text-[#B5443C] dark:text-[#E58982] shadow-xs animate-pulse ring-2 ring-[#B5443C]/20'
                : 'border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-[#28665E] dark:text-[#86CEC2] hover:bg-[#F0EDE6] dark:hover:bg-[#313631] hover:border-[#28665E]/40 dark:hover:border-[#68B4A8]/50'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5 text-[#B5443C] dark:text-[#E58982]" />
                <span>Ouvindo em inglês...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-[#28665E] dark:text-[#86CEC2]" />
                <span>Pesquisa por voz</span>
              </>
            )}
          </button>

          <select
            aria-label="Filtrar cards selecionados"
            value={listSelectionFilter}
            onChange={(e) => onChangeSelectionFilter(e.target.value as ListSelectionFilter)}
            className="min-h-[48px] lg:min-h-[38px] px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs font-medium text-[#1C1B18] dark:text-[#EBE7DE] cursor-pointer"
          >
            <option value="all">Todos ({allCardsCount})</option>
            <option value="selected">Selecionados ({selectedStudyIds.size})</option>
            <option value="unselected">Não selecionados</option>
          </select>

          <div className="inline-flex p-1 rounded-xl bg-[#EAE6DD] dark:bg-[#1B1E1B] border border-transparent dark:border-[#2B302B]">
            <button
              type="button"
              onClick={() => onChangeViewMode('grid')}
              className={`min-h-[40px] lg:min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                listViewMode === 'grid'
                  ? 'bg-white dark:bg-[#2B302B] text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs'
                  : 'text-[#6B655C] dark:text-[#AFAAA0]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grade</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('compact')}
              className={`min-h-[40px] lg:min-h-[30px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                listViewMode === 'compact'
                  ? 'bg-white dark:bg-[#2B302B] text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs'
                  : 'text-[#6B655C] dark:text-[#AFAAA0]'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              <span>Compacto</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            title="Exportar cards visíveis para CSV"
            className="min-h-[48px] lg:min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs font-medium text-[#5C574E] dark:text-[#D8D4CA] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between px-1 text-xs text-[#6B655C] dark:text-[#AFAAA0]">
        <span className="font-mono-num">
          Mostrando {cards.length} {cards.length === 1 ? 'expressão' : 'expressões'}
        </span>
      </div>

      {/* Empty Search Result */}
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] p-10 text-center text-sm text-[#6B655C] dark:text-[#AFAAA0]">
          Nenhuma expressão encontrada para essa busca ou filtro.
        </div>
      ) : listViewMode === 'compact' ? (
        <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] divide-y divide-[#ECE9E1] dark:divide-[#2A2F2A] overflow-hidden">
          {cards.map((card) => (
            <CompactCardRow
              key={card.id}
              card={card}
              isSelected={selectedStudyIds.has(card.id)}
              selOrder={selectionOrderMap.get(card.id) ?? null}
              activeAudio={activeAudio}
              onToggleCardSelection={onToggleCardSelection}
              onEditCard={onEditCard}
              onDeleteCard={onDeleteCard}
              onOpenPronunciation={setPronunciationSession}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {cards.map((card) => (
            <GridCardItem
              key={card.id}
              card={card}
              isSelected={selectedStudyIds.has(card.id)}
              selOrder={selectionOrderMap.get(card.id) ?? null}
              activeAudio={activeAudio}
              onToggleCardSelection={onToggleCardSelection}
              onUpdateCardCategory={onUpdateCardCategory}
              onUpdateCardSubtopic={onUpdateCardSubtopic}
              onEditCard={onEditCard}
              onDeleteCard={onDeleteCard}
              onOpenPronunciation={setPronunciationSession}
            />
          ))}
        </div>
      )}

      {pronunciationSession && (
        <CardPronunciationDrawer
          session={pronunciationSession}
          variant="sheet"
          onClose={() => setPronunciationSession(null)}
          onPronunciationEvaluated={onPronunciationEvaluated}
        />
      )}
    </div>
  );
});
