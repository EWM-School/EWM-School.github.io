import {
  BookMarked,
  Check,
  Edit3,
  FolderPlus,
  Layers,
  Link2,
  Link2Off,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { VALID_FOLDERS } from '../data/seedData';
import type { DeckColorTag, Flashcard, TopicFolder, UserDeck } from '../types/flashcard';
import {
  normalizeSearchText,
  VIRTUAL_DECK_CUSTOM_ID,
  VIRTUAL_DECK_OFFICIAL_ID,
} from '../utils/deckHelpers';

interface DecksViewProps {
  allCards: Flashcard[];
  userDecks: UserDeck[];
  connectedDeckIds: string[];
  connectedCardsCount: number;
  onToggleConnectDeck: (deckId: string) => void;
  onStudySingleDeck: (deckId: string) => void;
  onStartConnectedStudy: () => void;
  onStartConnectedQuiz: () => void;
  onCreateOrUpdateDeckMeta: (
    meta: { name: string; description: string; colorTag: DeckColorTag },
    existingDeck?: UserDeck
  ) => string;
  onDeleteDeck: (deck: UserDeck) => void;
  onToggleCardInDeck: (deckId: string, cardId: string) => void;
  onOpenCreateCustomCard: (targetDeckId?: string) => void;
}

const COLOR_STYLES: Record<
  DeckColorTag,
  { dot: string; label: string; borderActive: string; subtleBg: string }
> = {
  sage: {
    dot: 'bg-[#28665E] dark:bg-[#68B4A8]',
    label: 'Verde Sálvia',
    borderActive: 'border-[#28665E] dark:border-[#41786F]',
    subtleBg: 'bg-[#EAF3F1]/70 dark:bg-[#1E2E2B]/90',
  },
  ochre: {
    dot: 'bg-[#A66A24] dark:bg-[#DFA55B]',
    label: 'Âmbar Suave',
    borderActive: 'border-[#A66A24] dark:border-[#8C6434]',
    subtleBg: 'bg-[#FBF3E6]/70 dark:bg-[#2B241A]/90',
  },
  slate: {
    dot: 'bg-[#3D5A73] dark:bg-[#789EBF]',
    label: 'Azul Ardósia',
    borderActive: 'border-[#3D5A73] dark:border-[#4A6882]',
    subtleBg: 'bg-[#EDF3F8]/70 dark:bg-[#1E2730]/90',
  },
  terracotta: {
    dot: 'bg-[#9E4B3B] dark:bg-[#D98473]',
    label: 'Terracota',
    borderActive: 'border-[#9E4B3B] dark:border-[#8A4D41]',
    subtleBg: 'bg-[#FBF0ED]/70 dark:bg-[#2E211E]/90',
  },
};

type MixerSourceFilter = 'all' | 'custom' | 'official' | 'in_deck';

export function DecksView({
  allCards,
  userDecks,
  connectedDeckIds,
  connectedCardsCount,
  onToggleConnectDeck,
  onStudySingleDeck,
  onStartConnectedStudy,
  onStartConnectedQuiz,
  onCreateOrUpdateDeckMeta,
  onDeleteDeck,
  onToggleCardInDeck,
  onOpenCreateCustomCard,
}: DecksViewProps) {
  const [deckFormOpen, setDeckFormOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<UserDeck | null>(null);
  const [deckName, setDeckName] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [deckColor, setDeckColor] = useState<DeckColorTag>('sage');
  const [openMixerAfterCreate, setOpenMixerAfterCreate] = useState(true);

  // Mixer drawer/modal state
  const [mixingDeckId, setMixingDeckId] = useState<string | null>(null);
  const [mixerSearch, setMixerSearch] = useState('');
  const [mixerSource, setMixerSource] = useState<MixerSourceFilter>('all');
  const [mixerTopic, setMixerTopic] = useState<'all' | TopicFolder>('all');

  const connectedSet = useMemo(() => new Set(connectedDeckIds), [connectedDeckIds]);
  const cardById = useMemo(() => new Map(allCards.map((c) => [c.id, c])), [allCards]);

  const customCards = useMemo(
    () => allCards.filter((c) => c.origin === 'custom'),
    [allCards]
  );
  const officialCards = useMemo(
    () => allCards.filter((c) => c.origin !== 'custom'),
    [allCards]
  );

  const activeMixingDeck = useMemo(
    () => userDecks.find((d) => d.id === mixingDeckId) || null,
    [userDecks, mixingDeckId]
  );

  const connectedDeckNames = useMemo(() => {
    const names: string[] = [];
    for (const id of connectedDeckIds) {
      if (id === VIRTUAL_DECK_CUSTOM_ID) names.push('Minhas Criações');
      else if (id === VIRTUAL_DECK_OFFICIAL_ID) names.push('Acervo Oficial EWM');
      else {
        const found = userDecks.find((d) => d.id === id);
        if (found) names.push(found.name);
      }
    }
    return names;
  }, [connectedDeckIds, userDecks]);

  const mixerFilteredCards = useMemo(() => {
    if (!activeMixingDeck) return [];
    const inDeckSet = new Set(activeMixingDeck.cardIds);
    const q = normalizeSearchText(mixerSearch);

    return allCards.filter((c) => {
      if (mixerSource === 'custom' && c.origin !== 'custom') return false;
      if (mixerSource === 'official' && c.origin === 'custom') return false;
      if (mixerSource === 'in_deck' && !inDeckSet.has(c.id)) return false;
      if (mixerTopic !== 'all' && c.category !== mixerTopic) return false;
      if (!q) return true;

      const hay = normalizeSearchText(
        `${c.term} ${c.literal} ${(c.colloquial || []).join(' ')} ${c.category} ${c.subtopic}`
      );
      return hay.includes(q);
    });
  }, [activeMixingDeck, allCards, mixerSearch, mixerSource, mixerTopic]);

  const handleOpenCreateDeck = () => {
    setEditingDeck(null);
    setDeckName('');
    setDeckDescription('');
    setDeckColor('sage');
    setOpenMixerAfterCreate(true);
    setDeckFormOpen(true);
  };

  const handleOpenEditDeck = (deck: UserDeck) => {
    setEditingDeck(deck);
    setDeckName(deck.name);
    setDeckDescription(deck.description);
    setDeckColor(deck.colorTag);
    setOpenMixerAfterCreate(false);
    setDeckFormOpen(true);
  };

  const handleSubmitDeckForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deckName.trim()) return;
    const savedId = onCreateOrUpdateDeckMeta(
      {
        name: deckName.trim(),
        description: deckDescription.trim(),
        colorTag: deckColor,
      },
      editingDeck || undefined
    );
    setDeckFormOpen(false);
    if (!editingDeck && openMixerAfterCreate && savedId) {
      setMixingDeckId(savedId);
      setMixerSource('all');
      setMixerSearch('');
      setMixerTopic('all');
    }
    setEditingDeck(null);
  };

  return (
    <div className="space-y-6">
      {/* Connected Decks Bridge Banner */}
      <section
        aria-label="Sessão de baralhos conectados"
        className="rounded-3xl border border-[#D4DFDC] dark:border-[#324642] bg-white dark:bg-[#212421] p-5 sm:p-6 shadow-xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#28665E] dark:text-[#68B4A8]">
              <Link2 className="w-4 h-4" />
              <span>Conexão de Baralhos Ativa</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
              {connectedDeckNames.length === 0 ? (
                'Conecte um ou mais baralhos para estudar tudo junto'
              ) : (
                <>
                  <span className="font-mono-num">{connectedDeckNames.length}</span>{' '}
                  {connectedDeckNames.length === 1 ? 'baralho conectado' : 'baralhos conectados'} ·{' '}
                  <span className="font-mono-num text-[#28665E] dark:text-[#68B4A8]">
                    {connectedCardsCount}
                  </span>{' '}
                  {connectedCardsCount === 1 ? 'carta combinada' : 'cartas combinadas'}
                </>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-[#5C574E] dark:text-[#AFAAA0] max-w-2xl leading-relaxed">
              {connectedDeckNames.length > 0 ? (
                <>
                  Misturando agora: <strong className="text-[#1C1B18] dark:text-[#EBE7DE]">{connectedDeckNames.join(' + ')}</strong>. Cartas repetidas entre baralhos são unificadas automaticamente.
                </>
              ) : (
                'Crie baralhos próprios, misture suas palavras novas com cartas do acervo oficial do app e conecte quantos baralhos quiser para estudar de uma só vez.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateDeck}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] hover:bg-[#F0EDE6] dark:bg-[#292D29] dark:hover:bg-[#323732] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] transition-colors cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-[#28665E] dark:text-[#68B4A8]" />
              <span>Novo Baralho</span>
            </button>

            <button
              type="button"
              onClick={onStartConnectedQuiz}
              disabled={connectedCardsCount < 4}
              title={
                connectedCardsCount < 4
                  ? 'Conecte pelo menos 4 cartas para jogar o Quiz'
                  : 'Treinar baralhos conectados no Quiz'
              }
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#262A26] text-xs font-semibold text-[#5C574E] dark:text-[#D8D4CA] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] disabled:opacity-45 transition-colors cursor-pointer"
            >
              <span>Quiz Conectado</span>
            </button>

            <button
              type="button"
              onClick={onStartConnectedStudy}
              disabled={connectedCardsCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold shadow-xs disabled:opacity-45 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Estudar Conectados</span>
            </button>
          </div>
        </div>
      </section>

      {/* Personal Custom Decks Section */}
      <section className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
              Meus Baralhos Personalizados
            </h3>
            <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0]">
              Monte baralhos por objetivo misturando palavras criadas por você e expressões do acervo oficial
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateDeck}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar Baralho</span>
          </button>
        </div>

        {userDecks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#D6D1C7] dark:border-[#373E37] bg-[#FAF9F6] dark:bg-[#1D201D] p-7 sm:p-9 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#68B4A8] mx-auto flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="font-display text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                Você ainda não criou um baralho personalizado
              </h4>
              <p className="text-xs sm:text-sm text-[#5C574E] dark:text-[#AFAAA0]">
                Crie seu primeiro baralho (ex: &ldquo;Entrevista + Minhas Palavras&rdquo;), adicione suas próprias expressões e misture com qualquer card do acervo do app.
              </p>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleOpenCreateDeck}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Criar meu primeiro baralho</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userDecks.map((deck) => {
              const isConnected = connectedSet.has(deck.id);
              const style = COLOR_STYLES[deck.colorTag] || COLOR_STYLES.sage;
              const resolvedCards = deck.cardIds
                .map((id) => cardById.get(id))
                .filter((c): c is Flashcard => Boolean(c));
              const customCount = resolvedCards.filter((c) => c.origin === 'custom').length;
              const officialCount = resolvedCards.length - customCount;

              return (
                <article
                  key={deck.id}
                  className={`rounded-3xl border transition-all p-5 flex flex-col justify-between gap-4 ${
                    isConnected
                      ? `${style.borderActive} ${style.subtleBg} shadow-xs`
                      : 'border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                          <h4 className="font-display text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE] truncate">
                            {deck.name}
                          </h4>
                        </div>
                        {deck.description && (
                          <p className="text-xs text-[#5C574E] dark:text-[#AFAAA0] mt-1 line-clamp-2">
                            {deck.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDeck(deck)}
                          aria-label={`Editar nome do baralho ${deck.name}`}
                          title="Editar detalhes do baralho"
                          className="p-1.5 rounded-lg text-[#787267] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#EAE6DD] dark:hover:bg-[#292D29] cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDeck(deck)}
                          aria-label={`Excluir baralho ${deck.name}`}
                          title="Excluir baralho"
                          className="p-1.5 rounded-lg text-[#787267] dark:text-[#AFAAA0] hover:text-[#B5443C] dark:hover:text-[#E58982] hover:bg-[#FDF2F2] dark:hover:bg-[#322120] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Zero-pill typographic composition metrics */}
                    <div className="text-xs text-[#5C574E] dark:text-[#AFAAA0] flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                        <span className="font-mono-num">{resolvedCards.length}</span>{' '}
                        {resolvedCards.length === 1 ? 'carta' : 'cartas'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        <span className="font-mono-num">{customCount}</span>{' '}
                        {customCount === 1 ? 'própria' : 'próprias'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        <span className="font-mono-num">{officialCount}</span> do acervo oficial
                      </span>
                    </div>

                    {resolvedCards.length > 0 && (
                      <p className="text-xs text-[#6B655C] dark:text-[#9E998F] truncate">
                        Ex: {resolvedCards.slice(0, 4).map((c) => c.term).join(' · ')}
                        {resolvedCards.length > 4 ? ' …' : ''}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#ECE9E1] dark:border-[#2A2F2A] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setMixingDeckId(deck.id);
                          setMixerSource('all');
                          setMixerSearch('');
                          setMixerTopic('all');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] hover:bg-[#F0EDE6] dark:bg-[#292D29] dark:hover:bg-[#323732] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] transition-colors cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                        <span>Misturar Cartas</span>
                      </button>

                      {resolvedCards.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onStudySingleDeck(deck.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] hover:bg-[#EAE6DD]/60 dark:hover:bg-[#292D29] transition-colors cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Estudar só este</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleConnectDeck(deck.id)}
                      aria-pressed={isConnected}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        isConnected
                          ? 'bg-[#28665E] hover:bg-[#1F524B] text-white dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6]'
                          : 'border border-[#D4DFDC] dark:border-[#2F4B46] bg-white dark:bg-[#212421] text-[#28665E] dark:text-[#86CEC2] hover:bg-[#EAF3F1] dark:hover:bg-[#1E312E]'
                      }`}
                    >
                      {isConnected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Conectado</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Conectar</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Built-in Connectable Shelves (Minhas Criações + Acervo Oficial) */}
      <section className="space-y-3">
        <div>
          <h3 className="font-display text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
            Estantes Base para Conexão Rápida
          </h3>
          <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0]">
            Você também pode conectar todas as suas palavras próprias ou o acervo completo diretamente à sua sessão
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shelf 1: Minhas Criações */}
          {(() => {
            const isConnected = connectedSet.has(VIRTUAL_DECK_CUSTOM_ID);
            return (
              <div
                className={`rounded-3xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                  isConnected
                    ? 'border-[#28665E] dark:border-[#41786F] bg-[#EAF3F1]/60 dark:bg-[#1E2E2B]/90'
                    : 'border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#28665E] dark:text-[#68B4A8] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Estante Pessoal Automática</span>
                    </span>
                    <span className="font-mono-num text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]">
                      {customCards.length} {customCards.length === 1 ? 'card' : 'cards'}
                    </span>
                  </div>
                  <h4 className="font-display text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                    Minhas Criações
                  </h4>
                  <p className="text-xs text-[#5C574E] dark:text-[#AFAAA0] leading-relaxed">
                    Reúne automaticamente todas as palavras e expressões adicionadas por você.
                  </p>
                </div>

                <div className="pt-3 border-t border-[#ECE9E1] dark:border-[#2A2F2A] flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenCreateCustomCard()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                    <span>Nova palavra própria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleConnectDeck(VIRTUAL_DECK_CUSTOM_ID)}
                    aria-pressed={isConnected}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      isConnected
                        ? 'bg-[#28665E] hover:bg-[#1F524B] text-white dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6]'
                        : 'border border-[#D4DFDC] dark:border-[#2F4B46] bg-white dark:bg-[#212421] text-[#28665E] dark:text-[#86CEC2] hover:bg-[#EAF3F1] dark:hover:bg-[#1E312E]'
                    }`}
                  >
                    {isConnected ? (
                      <>
                        <Link2Off className="w-3.5 h-3.5" />
                        <span>Conectado</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Conectar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Shelf 2: Acervo Oficial EWM */}
          {(() => {
            const isConnected = connectedSet.has(VIRTUAL_DECK_OFFICIAL_ID);
            return (
              <div
                className={`rounded-3xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                  isConnected
                    ? 'border-[#28665E] dark:border-[#41786F] bg-[#EAF3F1]/60 dark:bg-[#1E2E2B]/90'
                    : 'border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0] flex items-center gap-1.5">
                      <BookMarked className="w-3.5 h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                      <span>Catálogo Geral do App</span>
                    </span>
                    <span className="font-mono-num text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]">
                      {officialCards.length} cards
                    </span>
                  </div>
                  <h4 className="font-display text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                    Acervo Oficial EWM
                  </h4>
                  <p className="text-xs text-[#5C574E] dark:text-[#AFAAA0] leading-relaxed">
                    Todas as expressões nativas do app + novos cards disparados pela equipe EWM.
                  </p>
                </div>

                <div className="pt-3 border-t border-[#ECE9E1] dark:border-[#2A2F2A] flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onToggleConnectDeck(VIRTUAL_DECK_OFFICIAL_ID)}
                    aria-pressed={isConnected}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      isConnected
                        ? 'bg-[#28665E] hover:bg-[#1F524B] text-white dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6]'
                        : 'border border-[#D4DFDC] dark:border-[#2F4B46] bg-white dark:bg-[#212421] text-[#28665E] dark:text-[#86CEC2] hover:bg-[#EAF3F1] dark:hover:bg-[#1E312E]'
                    }`}
                  >
                    {isConnected ? (
                      <>
                        <Link2Off className="w-3.5 h-3.5" />
                        <span>Conectado</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Conectar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Modal 1: Create / Edit Deck Metadata */}
      {deckFormOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deck-form-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3
                id="deck-form-title"
                className="font-display text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]"
              >
                {editingDeck ? 'Editar Baralho' : 'Novo Baralho Personalizado'}
              </h3>
              <button
                type="button"
                onClick={() => setDeckFormOpen(false)}
                aria-label="Fechar janela de baralho"
                className="p-2 rounded-xl text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDeckForm} className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="deck-name-input"
                  className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
                >
                  Nome do baralho *
                </label>
                <input
                  id="deck-name-input"
                  type="text"
                  required
                  maxLength={80}
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="Ex: Imersão Viagem + Minhas Palavras"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-sm text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="deck-desc-input"
                  className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]"
                >
                  Objetivo ou observação (opcional)
                </label>
                <input
                  id="deck-desc-input"
                  type="text"
                  maxLength={240}
                  value={deckDescription}
                  onChange={(e) => setDeckDescription(e.target.value)}
                  placeholder="Ex: Palavras que anotei nas aulas + phrasal verbs do acervo"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-sm text-[#1C1B18] dark:text-[#EBE7DE]"
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0]">
                  Cor de identificação
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(COLOR_STYLES) as DeckColorTag[]).map((tag) => {
                    const item = COLOR_STYLES[tag];
                    const selected = deckColor === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setDeckColor(tag)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#28665E] dark:border-[#41786F] bg-[#EAF3F1]/70 dark:bg-[#1E312E] text-[#1C1B18] dark:text-[#EBE7DE]'
                            : 'border-[#E4E0D8] dark:border-[#343A34] text-[#5C574E] dark:text-[#AFAAA0]'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${item.dot}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ECE9E1] dark:border-[#2A2F2A]">
                <button
                  type="button"
                  onClick={() => setDeckFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer"
                >
                  {editingDeck ? 'Salvar Baralho' : 'Criar e Escolher Cartas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Deck Card Mixer (Mix Student Custom Words + Official Catalog Cards) */}
      {activeMixingDeck && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deck-mixer-title"
        >
          <div className="w-full max-w-3xl rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Mixer Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-[#ECE9E1] dark:border-[#2A2F2A] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3
                  id="deck-mixer-title"
                  className="font-display text-base sm:text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]"
                >
                  Misturar Cartas · {activeMixingDeck.name}
                </h3>
                <p className="text-xs text-[#5C574E] dark:text-[#AFAAA0]">
                  <span className="font-mono-num font-semibold text-[#28665E] dark:text-[#68B4A8]">
                    {activeMixingDeck.cardIds.length}
                  </span>
                  /200 selecionadas · Combine palavras criadas por você com cartas do acervo oficial
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenCreateCustomCard(activeMixingDeck.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Criar palavra neste baralho</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMixingDeckId(null)}
                  aria-label="Concluir mistura de cartas"
                  className="p-2 rounded-xl text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#F0EDE6] dark:hover:bg-[#292D29] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Source & Search Filters */}
            <div className="px-5 sm:px-6 py-3.5 bg-[#FAF9F6] dark:bg-[#1B1E1B] border-b border-[#ECE9E1] dark:border-[#2A2F2A] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: `Tudo (${allCards.length})` },
                      { id: 'custom', label: `Minhas Criações (${customCards.length})` },
                      { id: 'official', label: `Acervo Oficial (${officialCards.length})` },
                      { id: 'in_deck', label: `Neste Baralho (${activeMixingDeck.cardIds.length})` },
                    ] as { id: MixerSourceFilter; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMixerSource(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        mixerSource === tab.id
                          ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                          : 'bg-white dark:bg-[#262A26] border border-[#E4E0D8] dark:border-[#343A34] text-[#5C574E] dark:text-[#AFAAA0]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Filtrar por tópico"
                  value={mixerTopic}
                  onChange={(e) => setMixerTopic(e.target.value as 'all' | TopicFolder)}
                  className="px-3 py-1.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#262A26] text-xs font-medium text-[#1C1B18] dark:text-[#EBE7DE]"
                >
                  <option value="all">Todos os tópicos</option>
                  {VALID_FOLDERS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-[#857F74] dark:text-[#8A857C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={mixerSearch}
                  onChange={(e) => setMixerSearch(e.target.value)}
                  placeholder="Buscar expressão em inglês ou tradução em português para adicionar..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#262A26] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30"
                />
              </div>
            </div>

            {/* Card Picker List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#ECE9E1] dark:divide-[#2A2F2A] px-5 sm:px-6">
              {mixerFilteredCards.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                    Nenhuma carta encontrada neste filtro
                  </p>
                  <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0]">
                    Experimente buscar outro termo ou clique em &ldquo;Criar palavra neste baralho&rdquo; acima.
                  </p>
                </div>
              ) : (
                mixerFilteredCards.map((card) => {
                  const inDeck = activeMixingDeck.cardIds.includes(card.id);
                  return (
                    <div
                      key={card.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-display text-sm font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                            {card.term}
                          </span>
                          <span className="text-[11px] text-[#28665E] dark:text-[#68B4A8] font-medium">
                            {card.origin === 'custom' ? 'Minha criação' : 'Acervo oficial'}
                          </span>
                          <span className="text-[11px] text-[#857F74] dark:text-[#8A857C]">
                            · {card.category} · {card.subtopic}
                          </span>
                        </div>
                        <p className="text-xs text-[#5C574E] dark:text-[#AFAAA0] truncate mt-0.5">
                          {(card.colloquial || []).slice(0, 2).join(' · ') || card.literal}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleCardInDeck(activeMixingDeck.id, card.id)}
                        aria-label={
                          inDeck
                            ? `Remover ${card.term} do baralho`
                            : `Adicionar ${card.term} ao baralho`
                        }
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          inDeck
                            ? 'bg-[#EAF3F1] dark:bg-[#1E312E] text-[#225851] dark:text-[#86CEC2] border border-[#B8D4CE] dark:border-[#2F4B46]'
                            : 'border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] hover:bg-[#F0EDE6] dark:bg-[#292D29] dark:hover:bg-[#323732] text-[#1C1B18] dark:text-[#EBE7DE]'
                        }`}
                      >
                        {inDeck ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>No baralho</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-[#ECE9E1] dark:border-[#2A2F2A] bg-[#FAF9F6] dark:bg-[#1B1E1B] flex items-center justify-between gap-3">
              <span className="text-xs text-[#5C574E] dark:text-[#AFAAA0]">
                Alterações salvas automaticamente
              </span>
              <div className="flex items-center gap-2">
                {activeMixingDeck.cardIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = activeMixingDeck.id;
                      setMixingDeckId(null);
                      onStudySingleDeck(targetId);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D4DFDC] dark:border-[#2F4B46] bg-white dark:bg-[#262A26] text-xs font-semibold text-[#28665E] dark:text-[#86CEC2] cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Estudar agora</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMixingDeckId(null)}
                  className="px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
