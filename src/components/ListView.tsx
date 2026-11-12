import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  Edit3,
  LayoutGrid,
  List as ListIcon,
  Mic,
  MicOff,
  Search,
  Shuffle,
  Trash2,
  Volume2,
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
  isSpeechRecognitionSupported,
  startVoiceSearch,
  toggleSpeakEnglishText,
  type SpeechRecognitionController,
} from '../utils/speech';

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
}

export function ListView({
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
}: ListViewProps) {
  const selectedArray = Array.from(selectedStudyIds);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionController | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
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
      onNotify('Pesquisa por voz não é suportada neste navegador. Recomendamos o Google Chrome ou Microsoft Edge.');
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
          onNotify('Permissão do microfone negada. Permita o microfone nas configurações do navegador.');
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

  const handleExportCsv = () => {
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
  };

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
                className="px-2.5 py-1 rounded-lg bg-[#F0EDE6] hover:bg-[#E4E0D8] dark:bg-[#292D29] dark:hover:bg-[#333833] text-xs font-semibold font-mono-num text-[#1C1B18] dark:text-[#EBE7DE] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {qty}
              </button>
            ))}

            {selectedStudyIds.size > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#B5443C] dark:text-[#E58982] hover:bg-[#FDF2F2] dark:hover:bg-[#322120] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Limpar
              </button>
            )}

            {selectedStudyIds.size >= MIN_STUDY_CARDS && (
              <button
                type="button"
                onClick={onGoToStudy}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#28665E] hover:bg-[#1F524B] text-white dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
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
              className={`w-full pl-9 pr-16 py-2 rounded-xl border text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE] placeholder:text-[#857F74] dark:placeholder:text-[#8A857C] focus:outline-none transition-colors ${
                isListening
                  ? 'border-[#28665E] dark:border-[#68B4A8] bg-[#F0F7F6] dark:bg-[#1E312E] ring-2 ring-[#28665E]/20'
                  : 'border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] focus:ring-2 focus:ring-[#28665E]/30'
              }`}
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onChangeSearch('')}
                  aria-label="Limpar busca"
                  className="text-[#857F74] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] cursor-pointer p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleVoiceSearch}
                aria-label={isListening ? 'Parar pesquisa por voz' : 'Pesquisar por voz em inglês'}
                title={isListening ? 'Parar escuta de voz' : 'Pesquisar por voz em inglês (fale o termo)'}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
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

          {/* Dedicated Voice Search Button on Toolbar */}
          <button
            type="button"
            onClick={handleToggleVoiceSearch}
            aria-label="Pesquisa por voz"
            aria-pressed={isListening}
            title={isListening ? 'Parar escuta de voz' : 'Pesquisar cards falando o termo em inglês'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
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
            className="px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs font-medium text-[#1C1B18] dark:text-[#EBE7DE] cursor-pointer"
          >
            <option value="all">Todos ({allCardsCount})</option>
            <option value="selected">Selecionados ({selectedStudyIds.size})</option>
            <option value="unselected">Não selecionados</option>
          </select>

          <div className="inline-flex p-1 rounded-xl bg-[#EAE6DD] dark:bg-[#1B1E1B] border border-transparent dark:border-[#2B302B]">
            <button
              type="button"
              onClick={() => onChangeViewMode('grid')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
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
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs font-medium text-[#5C574E] dark:text-[#D8D4CA] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
        /* COMPACT LIST VIEW */
        <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] divide-y divide-[#ECE9E1] dark:divide-[#2A2F2A] overflow-hidden">
          {cards.map((card) => {
            const isSelected = selectedStudyIds.has(card.id);
            const selOrder = isSelected ? selectedArray.indexOf(card.id) + 1 : null;
            const phonetics = getCardPhonetics(card);

            return (
              <div
                key={card.id}
                className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                  isSelected ? 'bg-[#EAF3F1]/45 dark:bg-[#1E312E]/50' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onToggleCardSelection(card.id)}
                    aria-label={isSelected ? `Remover ${card.term}` : `Selecionar ${card.term}`}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#28665E] border-[#28665E] text-white dark:bg-[#2A6D63] dark:border-[#2A6D63] dark:text-[#F4F7F6]'
                        : 'border-[#CFC9BE] dark:border-[#424942] bg-white dark:bg-[#292D29]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
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

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void toggleSpeakEnglishText(card.term, 'us')}
                    title="Ouvir em Inglês Americano (US)"
                    aria-label={`Ouvir ${card.term} em inglês americano`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[11px] font-semibold text-[#225851] dark:text-[#86CEC2] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>US</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleSpeakEnglishText(card.term, 'uk')}
                    title="Ouvir em Inglês Britânico (UK)"
                    aria-label={`Ouvir ${card.term} em inglês britânico`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[11px] font-semibold text-[#243B53] dark:text-[#9CC3E6] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>UK</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditCard(card)}
                    title="Editar"
                    aria-label={`Editar ${card.term}`}
                    className="p-1.5 rounded-lg text-[#6B655C] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCard(card)}
                    title="Excluir"
                    aria-label={`Excluir ${card.term}`}
                    className="p-1.5 rounded-lg text-[#6B655C] dark:text-[#AFAAA0] hover:text-[#B5443C] dark:hover:text-[#E58982] hover:bg-[#FDF2F2] dark:hover:bg-[#322120] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {cards.map((card) => {
            const isSelected = selectedStudyIds.has(card.id);
            const selOrder = isSelected ? selectedArray.indexOf(card.id) + 1 : null;
            const sec = getCardSecondExample(card);
            const phonetics = getCardPhonetics(card);

            return (
              <article
                key={card.id}
                className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                  isSelected
                    ? 'border-[#28665E] dark:border-[#41786F] bg-[#FCFDFC] dark:bg-[#202826]'
                    : 'border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421]'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Selection Bar */}
                  <button
                    type="button"
                    onClick={() => onToggleCardSelection(card.id)}
                    className={`w-full px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
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
                    <span className="font-mono-num text-[11px]">
                      {selOrder ? `#${selOrder}` : '+'}
                    </span>
                  </button>

                  {/* Category / Subtopic Selectors + Card Actions */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <select
                        aria-label={`Pasta de ${card.term}`}
                        value={card.category}
                        onChange={(e) =>
                          onUpdateCardCategory(card.id, e.target.value as TopicFolder)
                        }
                        className="text-[11px] font-medium px-2 py-1 rounded-lg border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-[#5C574E] dark:text-[#C8C3B8] cursor-pointer"
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
                        onChange={(e) =>
                          onUpdateCardSubtopic(card.id, e.target.value as SubtopicKey)
                        }
                        className="text-[11px] font-medium px-2 py-1 rounded-lg border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-[#5C574E] dark:text-[#C8C3B8] cursor-pointer"
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
                        className="p-1.5 rounded-lg text-[#787267] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCard(card)}
                        title="Excluir card"
                        aria-label={`Excluir ${card.term}`}
                        className="p-1.5 rounded-lg text-[#787267] dark:text-[#AFAAA0] hover:text-[#B5443C] dark:hover:text-[#E58982] cursor-pointer"
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

                      <div className="inline-flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void toggleSpeakEnglishText(card.term, 'us')}
                          title="Ouvir em Inglês Americano (US)"
                          aria-label={`Ouvir ${card.term} em inglês americano`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[11px] font-semibold text-[#225851] dark:text-[#86CEC2] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>US</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleSpeakEnglishText(card.term, 'uk')}
                          title="Ouvir em Inglês Britânico (UK)"
                          aria-label={`Ouvir ${card.term} em inglês britânico`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EDF1F5] hover:bg-[#DFE6EE] dark:bg-[#1E2630] dark:hover:bg-[#26313E] text-[11px] font-semibold text-[#243B53] dark:text-[#9CC3E6] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>UK</span>
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
                      <div className="inline-flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void toggleSpeakEnglishText(card.exampleEn, 'us')}
                          aria-label={`Ouvir frase 1 de ${card.term} em inglês americano`}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#1E312E] text-[10px] font-semibold text-[#225851] dark:text-[#86CEC2] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-2.5 h-2.5" />
                          <span>US</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleSpeakEnglishText(card.exampleEn, 'uk')}
                          aria-label={`Ouvir frase 1 de ${card.term} em inglês britânico`}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#EDF1F5] dark:bg-[#1E2630] text-[10px] font-semibold text-[#243B53] dark:text-[#9CC3E6] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-2.5 h-2.5" />
                          <span>UK</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[#1C1B18] dark:text-[#EBE7DE] font-medium">
                      &rarr; {card.examplePt}
                    </p>
                  </div>
                  <div className="pt-1.5 border-t border-[#E4E0D8] dark:border-[#343A34] space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[#4A463F] dark:text-[#D8D4CA] italic">
                        2. &ldquo;{sec.en}&rdquo;
                      </p>
                      <div className="inline-flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void toggleSpeakEnglishText(sec.en, 'us')}
                          aria-label={`Ouvir frase 2 de ${card.term} em inglês americano`}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#EAF3F1] dark:bg-[#1E312E] text-[10px] font-semibold text-[#225851] dark:text-[#86CEC2] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-2.5 h-2.5" />
                          <span>US</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleSpeakEnglishText(sec.en, 'uk')}
                          aria-label={`Ouvir frase 2 de ${card.term} em inglês britânico`}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#EDF1F5] dark:bg-[#1E2630] text-[10px] font-semibold text-[#243B53] dark:text-[#9CC3E6] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-2.5 h-2.5" />
                          <span>UK</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[#1C1B18] dark:text-[#EBE7DE] font-medium">
                      &rarr; {sec.pt}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
