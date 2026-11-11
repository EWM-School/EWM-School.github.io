import { ArrowRight, CheckCircle2, RotateCcw, Volume2, XCircle } from 'lucide-react';
import type { QuizOption, QuizQuestion } from '../types/flashcard';
import { getCardPhonetics } from '../utils/phonetics';
import { speakEnglishText } from '../utils/speech';

interface QuizViewProps {
  question: QuizQuestion | null;
  selectedOptionId: string | null;
  score: number;
  totalAnswered: number;
  onSelectOption: (option: QuizOption) => void;
  onNextQuestion: () => void;
  onResetScore: () => void;
}

export function QuizView({
  question,
  selectedOptionId,
  score,
  totalAnswered,
  onSelectOption,
  onNextQuestion,
  onResetScore,
}: QuizViewProps) {
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

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-card-enter">
      {/* Score & Header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="font-display text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
            Desafio Rápido
          </h2>
          <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0]">
            Escolha a tradução mais natural e compare a pronúncia US &amp; UK
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] font-mono-num whitespace-nowrap shrink-0">
            {score} / {totalAnswered} acertos
          </div>
          {totalAnswered > 0 && (
            <button
              type="button"
              onClick={onResetScore}
              title="Zerar placar do quiz"
              aria-label="Zerar placar do quiz"
              className="p-2 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-[#6B655C] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Question Card */}
      <div className="rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B655C] dark:text-[#AFAAA0]">
            <span>
              {question.card.category} · {question.card.subtopic}
            </span>

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void speakEnglishText(question.card.term, 'us')}
                aria-label={`Ouvir ${question.card.term} em inglês americano`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2] border border-[#C6DBD7] dark:border-[#2F4B46] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Ouvir US</span>
              </button>
              <button
                type="button"
                onClick={() => void speakEnglishText(question.card.term, 'uk')}
                aria-label={`Ouvir ${question.card.term} em inglês britânico`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#225851] dark:text-[#86CEC2] border border-[#C6DBD7] dark:border-[#2F4B46] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Ouvir UK</span>
              </button>
            </div>
          </div>

          <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
            {question.card.term}
          </h3>

          <p className="text-xs text-[#225851] dark:text-[#86CEC2] font-mono-num">
            <span>US {phonetics.us}</span>
            <span className="mx-2 opacity-60" aria-hidden="true">
              ·
            </span>
            <span>UK {phonetics.uk}</span>
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-sm text-[#5C574E] dark:text-[#B9B4AA] italic flex-1 min-w-[200px]">
              &ldquo;{question.card.exampleEn}&rdquo;
            </p>
            <div className="inline-flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void speakEnglishText(question.card.exampleEn, 'us')}
                aria-label="Ouvir frase do exemplo em inglês americano"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[11px] font-semibold text-[#225851] dark:text-[#86CEC2] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3 h-3" />
                <span>US</span>
              </button>
              <button
                type="button"
                onClick={() => void speakEnglishText(question.card.exampleEn, 'uk')}
                aria-label="Ouvir frase do exemplo em inglês britânico"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[11px] font-semibold text-[#225851] dark:text-[#86CEC2] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3 h-3" />
                <span>UK</span>
              </button>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {question.options.map((opt, idx) => {
            let optionStyle =
              'border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-[#1C1B18] dark:text-[#EBE7DE] hover:border-[#28665E]/50 dark:hover:border-[#68B4A8]/55';
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
                className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all flex items-center justify-between gap-3 ${optionStyle} ${
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
          <div className="space-y-4 pt-2">
            <div
              className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed space-y-1.5 ${
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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onNextQuestion}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
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
}
