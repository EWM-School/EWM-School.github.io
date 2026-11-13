import { memo, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, RotateCcw, Share2, XCircle } from 'lucide-react';
import type { Flashcard, QuizOption, QuizQuestion } from '../types/flashcard';
import { getCardPhonetics } from '../utils/phonetics';
import {
  getAudioButtonVisualState,
  stopCurrentAudio,
  subscribeAudioPlayback,
  toggleSpeakEnglishText,
  type ActiveAudioPlayback,
} from '../services/platform/speechService';
import { triggerTap } from '../services/platform/hapticsService';
import { AudioStatusIcon } from './CardAudioControls';

interface QuizViewProps {
  question: QuizQuestion | null;
  selectedOptionId: string | null;
  score: number;
  totalAnswered: number;
  onSelectOption: (option: QuizOption) => void;
  onNextQuestion: () => void;
  onResetScore: () => void;
  onShareQuizAchievement?: (featuredCard: Flashcard | null) => void;
}

export const QuizView = memo(function QuizView({
  question,
  selectedOptionId,
  score,
  totalAnswered,
  onSelectOption,
  onNextQuestion,
  onResetScore,
  onShareQuizAchievement,
}: QuizViewProps) {
  const [activeAudio, setActiveAudio] = useState<ActiveAudioPlayback | null>(null);
  const questionCardId = question?.card.id ?? null;

  useEffect(() => {
    const unsub = subscribeAudioPlayback(setActiveAudio);
    return () => {
      unsub();
      stopCurrentAudio();
    };
  }, []);

  useEffect(() => {
    stopCurrentAudio();
  }, [questionCardId]);

  if (!question) {
    return (
      <div className="rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] p-8 text-center text-sm text-[#5C574E] dark:text-[#AFAAA0]">
        São necessários pelo menos 4 cards para gerar o Quiz.
      </div>
    );
  }

  const isAnswered = selectedOptionId !== null;
  const chosenOption = question.options.find((o) => o.id === selectedOptionId) || null;
  const isCorrectChoice = Boolean(chosenOption?.isCorrect);
  const phonetics = getCardPhonetics(question.card);

  const termUsState = getAudioButtonVisualState(activeAudio, {
    text: question.card.term,
    accent: 'us',
    sourceId: 'quiz-term-us',
  });
  const termUkState = getAudioButtonVisualState(activeAudio, {
    text: question.card.term,
    accent: 'uk',
    sourceId: 'quiz-term-uk',
  });
  const exUsState = getAudioButtonVisualState(activeAudio, {
    text: question.card.exampleEn,
    accent: 'us',
    sourceId: 'quiz-ex-us',
  });
  const exUkState = getAudioButtonVisualState(activeAudio, {
    text: question.card.exampleEn,
    accent: 'uk',
    sourceId: 'quiz-ex-uk',
  });
  const stateClass = (st: 'idle' | 'loading' | 'playing') =>
    st === 'loading' ? 'ewm-audio-loading' : st === 'playing' ? 'ewm-audio-playing' : '';

  return (
    <div className="max-w-2xl mx-auto space-y-3.5 sm:space-y-5 animate-card-enter select-none">
      {/* Score & Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-0.5">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
            Desafio Rápido
          </h2>
          <p className="text-[11px] sm:text-xs text-[#6B655C] dark:text-[#AFAAA0]">
            Escolha a tradução mais natural e compare a pronúncia US &amp; UK
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="min-h-[38px] sm:min-h-[42px] inline-flex items-center px-2.5 sm:px-3 py-1 rounded-xl border border-[#DFDAD0] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] font-mono-num whitespace-nowrap shrink-0">
            {score} / {totalAnswered} acertos
          </div>

          {totalAnswered > 0 && onShareQuizAchievement && (
            <button
              type="button"
              onClick={() => {
                void triggerTap();
                onShareQuizAchievement(question.card);
              }}
              title="Compartilhar conquista do Quiz no WhatsApp ou Stories"
              aria-label="Compartilhar conquista do Quiz"
              className="min-h-[38px] sm:min-h-[42px] inline-flex items-center gap-1 px-2.5 sm:px-3 rounded-xl border border-[#28665E]/40 dark:border-[#68B4A8]/45 bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#26403C] text-[#1E4E47] dark:text-[#86CEC2] text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>
          )}

          {totalAnswered > 0 && (
            <button
              type="button"
              onClick={() => {
                void triggerTap();
                onResetScore();
              }}
              title="Zerar placar do quiz"
              aria-label="Zerar placar do quiz"
              className="min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] inline-flex items-center justify-center rounded-xl border border-[#DFDAD0] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-[#6B655C] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Question Card */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#DFDAD0] dark:border-[#313831] bg-white dark:bg-[#202420] p-4 sm:p-8 shadow-xs space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-[#6B655C] dark:text-[#AFAAA0]">
            <span>
              {question.card.category} · {question.card.subtopic}
            </span>

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                aria-pressed={termUsState !== 'idle'}
                aria-busy={termUsState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(question.card.term, 'us', {
                    role: 'term',
                    sourceId: 'quiz-term-us',
                  });
                }}
                aria-label={`Ouvir ${question.card.term} em inglês americano`}
                className={`min-h-[38px] sm:min-h-[42px] lg:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl lg:rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${stateClass(
                  termUsState
                )} ${
                  termUsState !== 'idle'
                    ? 'bg-[#28665E] border-[#28665E] text-white dark:bg-[#2A6D63] dark:border-[#3E8E82] dark:text-[#F4F7F6]'
                    : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2] border-[#C6DBD7] dark:border-[#2F4B46]'
                }`}
              >
                <AudioStatusIcon
                  state={termUsState}
                  idleClassName="w-3.5 h-3.5 shrink-0"
                  activeClassName="w-3.5 h-3"
                />
                <span>{termUsState === 'loading' ? 'US...' : 'Ouvir US'}</span>
              </button>
              <button
                type="button"
                aria-pressed={termUkState !== 'idle'}
                aria-busy={termUkState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(question.card.term, 'uk', {
                    role: 'term',
                    sourceId: 'quiz-term-uk',
                  });
                }}
                aria-label={`Ouvir ${question.card.term} em inglês britânico`}
                className={`min-h-[38px] sm:min-h-[42px] lg:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl lg:rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${stateClass(
                  termUkState
                )} ${
                  termUkState !== 'idle'
                    ? 'bg-[#243B53] border-[#243B53] text-white dark:bg-[#2E4C6B] dark:border-[#496F96] dark:text-[#F4F7F8]'
                    : 'bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[#243B53] dark:text-[#9CC3E6] border-[#C9D5E2] dark:border-[#334354]'
                }`}
              >
                <AudioStatusIcon
                  state={termUkState}
                  idleClassName="w-3.5 h-3.5 shrink-0"
                  activeClassName="w-3.5 h-3"
                />
                <span>{termUkState === 'loading' ? 'UK...' : 'Ouvir UK'}</span>
              </button>
            </div>
          </div>

          <h3 className="font-display text-xl sm:text-3xl font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
            {question.card.term}
          </h3>

          <p className="text-[11px] sm:text-xs text-[#225851] dark:text-[#86CEC2] font-mono-num">
            <span>US {phonetics.us}</span>
            <span className="mx-2 opacity-60" aria-hidden="true">
              ·
            </span>
            <span>UK {phonetics.uk}</span>
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <p className="text-[13px] sm:text-sm text-[#5C574E] dark:text-[#B9B4AA] italic flex-1 min-w-[180px]">
              &ldquo;{question.card.exampleEn}&rdquo;
            </p>
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-pressed={exUsState !== 'idle'}
                aria-busy={exUsState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(question.card.exampleEn, 'us', {
                    role: 'sentence',
                    sourceId: 'quiz-ex-us',
                  });
                }}
                aria-label="Ouvir frase do exemplo em inglês americano"
                className={`min-h-[34px] sm:min-h-[38px] lg:min-h-[30px] inline-flex items-center gap-1 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10.5px] sm:text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${stateClass(
                  exUsState
                )} ${
                  exUsState !== 'idle'
                    ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                    : 'bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2]'
                }`}
              >
                <AudioStatusIcon
                  state={exUsState}
                  idleClassName="w-3 h-3 shrink-0"
                  activeClassName="w-3 h-2.5"
                />
                <span>US</span>
              </button>
              <button
                type="button"
                aria-pressed={exUkState !== 'idle'}
                aria-busy={exUkState === 'loading'}
                onClick={(e) => {
                  e.stopPropagation();
                  void triggerTap();
                  void toggleSpeakEnglishText(question.card.exampleEn, 'uk', {
                    role: 'sentence',
                    sourceId: 'quiz-ex-uk',
                  });
                }}
                aria-label="Ouvir frase do exemplo em inglês britânico"
                className={`min-h-[34px] sm:min-h-[38px] lg:min-h-[30px] inline-flex items-center gap-1 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10.5px] sm:text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${stateClass(
                  exUkState
                )} ${
                  exUkState !== 'idle'
                    ? 'bg-[#243B53] text-white dark:bg-[#2E4C6B] dark:text-[#F4F7F8]'
                    : 'bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[#243B53] dark:text-[#9CC3E6]'
                }`}
              >
                <AudioStatusIcon
                  state={exUkState}
                  idleClassName="w-3 h-3 shrink-0"
                  activeClassName="w-3 h-2.5"
                />
                <span>UK</span>
              </button>
            </div>
          </div>
        </div>

        {/* Options — Balanced Mobile Scale */}
        <div className="space-y-2 sm:space-y-2.5">
          {question.options.map((opt, idx) => {
            let optionStyle =
              'border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#282D28] text-[#1C1B18] dark:text-[#EBE7DE] hover:border-[#28665E]/50 dark:hover:border-[#68B4A8]/55 active:scale-[0.99]';
            if (isAnswered) {
              if (opt.isCorrect) {
                optionStyle =
                  'border-[#2C6B4F] dark:border-[#56A883] bg-[#EDF6F1] dark:bg-[#1D3028] text-[#1F4F39] dark:text-[#C5ECDA]';
              } else if (opt.id === selectedOptionId) {
                optionStyle =
                  'border-[#B5443C] dark:border-[#D4746D] bg-[#FDF2F2] dark:bg-[#311F1E] text-[#8F312B] dark:text-[#F4BCB8]';
              } else {
                optionStyle =
                  'border-[#ECE9E1] dark:border-[#2A2F2A] bg-[#FAF9F6]/60 dark:bg-[#212421] text-[#857F74] dark:text-[#7D786F] opacity-65';
              }
            }

            return (
              <button
                key={opt.id}
                type="button"
                disabled={isAnswered}
                onClick={() => onSelectOption(opt)}
                className={`w-full min-h-[45px] sm:min-h-[52px] text-left px-3.5 sm:px-4 py-2.5 sm:py-3.5 rounded-2xl border text-[13px] sm:text-sm font-medium transition-all flex items-center justify-between gap-3 ${optionStyle} ${
                  isAnswered ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="font-mono-num text-xs text-[#857F74] dark:text-[#8A857C]">
                    {idx + 1}.
                  </span>
                  <span>{opt.text}</span>
                </span>
                {isAnswered && opt.isCorrect && (
                  <CheckCircle2 className="w-4 h-4 text-[#2C6B4F] dark:text-[#78C9A2] shrink-0" />
                )}
                {isAnswered && !opt.isCorrect && opt.id === selectedOptionId && (
                  <XCircle className="w-4 h-4 text-[#B5443C] dark:text-[#E58982] shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanatory Feedback */}
        {isAnswered && (
          <div className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
            <div
              className={`rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed space-y-1.5 ${
                isCorrectChoice
                  ? 'bg-[#EDF6F1] dark:bg-[#1D3028] text-[#1F4F39] dark:text-[#C5ECDA]'
                  : 'bg-[#FDF5E8] dark:bg-[#2C2418] text-[#7A470D] dark:text-[#EAC693]'
              }`}
            >
              <strong className="block">
                {isCorrectChoice ? 'Mandou bem!' : 'Quase lá!'}
              </strong>
              <p>
                Para <strong>{question.card.term}</strong>, usamos{' '}
                <strong>{question.card.colloquial.join(', ')}</strong>. Exemplo:{' '}
                <em>&ldquo;{question.card.examplePt}&rdquo;</em>
              </p>
              {phonetics.ukNote && (
                <p className="text-xs opacity-90 pt-1 border-t border-current/15">
                  <strong>Nota US &amp; UK:</strong> {phonetics.ukNote}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              {onShareQuizAchievement && (
                <button
                  type="button"
                  onClick={() => {
                    void triggerTap();
                    onShareQuizAchievement(question.card);
                  }}
                  className="min-h-[44px] sm:min-h-[48px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#28665E]/40 dark:border-[#68B4A8]/45 bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] text-[#1E4E47] dark:text-[#86CEC2] text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Stories / WhatsApp</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  void triggerTap();
                  onNextQuestion();
                }}
                className="min-h-[44px] sm:min-h-[48px] inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs sm:text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <span>Próxima pergunta</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
