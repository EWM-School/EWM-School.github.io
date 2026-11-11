import {
  Archive,
  ArchiveRestore,
  Edit3,
  Globe,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { INITIAL_CARDS } from '../data/seedData';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../services/firebase';
import type { AdminRecord, Flashcard } from '../types/flashcard';
import { hydrateCard, normalizeSearchText } from '../utils/deckHelpers';

interface AdminModalProps {
  isOpen: boolean;
  currentUserUid: string;
  currentUserEmail: string | null;
  globalCards: Flashcard[];
  grantedAdmins: AdminRecord[];
  onClose: () => void;
  onOpenNewGlobalCard: () => void;
  onEditGlobalCard: (card: Flashcard) => void;
  onToggleArchiveGlobalCard: (card: Flashcard, archived: boolean) => Promise<void>;
  onDeleteGlobalOverride: (cardId: string) => Promise<void>;
  onGrantAdmin: (targetUid: string, label: string) => Promise<void>;
  onRevokeAdmin: (targetUid: string) => Promise<void>;
}

export function AdminModal({
  isOpen,
  currentUserUid,
  currentUserEmail,
  globalCards,
  grantedAdmins,
  onClose,
  onOpenNewGlobalCard,
  onEditGlobalCard,
  onToggleArchiveGlobalCard,
  onDeleteGlobalOverride,
  onGrantAdmin,
  onRevokeAdmin,
}: AdminModalProps) {
  const [tab, setTab] = useState<'catalog' | 'admins'>('catalog');
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'broadcast' | 'archived'>('all');

  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminLabel, setNewAdminLabel] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isBootstrapped =
    currentUserEmail?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  // Combine globalCards + INITIAL_CARDS so Admin can manage both newly broadcasted cards AND override/hide built-in seed cards
  const adminCatalog = useMemo(() => {
    const globalById = new Map(globalCards.map((c) => [c.id, c]));
    const seedIds = new Set(INITIAL_CARDS.map((c) => c.id));
    const list: (Flashcard & { isBroadcastNew: boolean; hasCloudOverride: boolean })[] = [];

    for (const gc of globalCards) {
      if (!seedIds.has(gc.id)) {
        list.push({
          ...hydrateCard(gc),
          archived: Boolean(gc.archived),
          isBroadcastNew: true,
          hasCloudOverride: true,
        });
      }
    }

    for (const sc of INITIAL_CARDS) {
      const override = globalById.get(sc.id);
      if (override) {
        list.push({
          ...hydrateCard({ ...sc, ...override }),
          archived: Boolean(override.archived),
          isBroadcastNew: false,
          hasCloudOverride: true,
        });
      } else {
        list.push({
          ...hydrateCard(sc),
          archived: false,
          isBroadcastNew: false,
          hasCloudOverride: false,
        });
      }
    }
    return list;
  }, [globalCards]);

  const filteredCatalog = useMemo(() => {
    const q = normalizeSearchText(search);
    return adminCatalog.filter((item) => {
      if (filterMode === 'broadcast' && !item.hasCloudOverride) return false;
      if (filterMode === 'archived' && !item.archived) return false;
      if (!q) return true;
      const hay = normalizeSearchText(
        `${item.term} ${item.literal} ${(item.colloquial || []).join(' ')} ${item.category} ${item.subtopic}`
      );
      return hay.includes(q);
    });
  }, [adminCatalog, search, filterMode]);

  if (!isOpen) return null;

  const broadcastCount = adminCatalog.filter((c) => c.isBroadcastNew && !c.archived).length;
  const archivedCount = adminCatalog.filter((c) => c.archived).length;

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    if (!newAdminUid.trim() || !newAdminLabel.trim()) {
      setAdminError('Preencha o UID do usuário e o nome/identificador.');
      return;
    }
    setBusyId('grant_admin');
    try {
      await onGrantAdmin(newAdminUid.trim(), newAdminLabel.trim());
      setNewAdminUid('');
      setNewAdminLabel('');
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Falha ao conceder permissão.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className="w-full max-w-4xl rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#ECE9E1] dark:border-[#2A2F2A] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#86CEC2] flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="admin-modal-title"
                className="font-display text-base sm:text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]"
              >
                Painel do Administrador · Acervo Global
              </h2>
              <p className="text-xs text-[#6B655C] dark:text-[#9A958B]">
                Cards disparados ou editados aqui atualizam em tempo real para todos os alunos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 rounded-xl bg-[#EAE6DD] dark:bg-[#1B1E1B]">
              <button
                type="button"
                onClick={() => setTab('catalog')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  tab === 'catalog'
                    ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs'
                    : 'text-[#5C574E] dark:text-[#9A958B]'
                }`}
              >
                Cards Globais
              </button>
              <button
                type="button"
                onClick={() => setTab('admins')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  tab === 'admins'
                    ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs'
                    : 'text-[#5C574E] dark:text-[#9A958B]'
                }`}
              >
                Permissões
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar Painel do Administrador"
              className="p-2 rounded-xl text-[#6B655C] dark:text-[#9A958B] hover:bg-[#F0EDE6] dark:hover:bg-[#2C312C] cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {tab === 'catalog' ? (
          <>
            {/* Action & Filter Strip */}
            <div className="px-6 py-3.5 bg-[#FAF9F6] dark:bg-[#1B1E1B] border-b border-[#ECE9E1] dark:border-[#2A2F2A] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[#5C574E] dark:text-[#AFAAA0] flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    <strong className="font-mono-num text-[#1C1B18] dark:text-[#EBE7DE]">
                      {INITIAL_CARDS.length}
                    </strong>{' '}
                    nativos
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="font-mono-num text-[#28665E] dark:text-[#86CEC2]">
                      +{broadcastCount}
                    </strong>{' '}
                    disparados na nuvem
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="font-mono-num">{archivedCount}</strong> ocultos
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onOpenNewGlobalCard}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Disparar Novo Card para Todos</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#857F74] dark:text-[#8A857C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar card global para editar ou ocultar para todos os alunos..."
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#292D29] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE] placeholder:text-[#8F897D] dark:placeholder:text-[#7E7A72]"
                  />
                </div>

                <div className="inline-flex p-1 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#292D29] shrink-0">
                  {(
                    [
                      { id: 'all', label: 'Todos' },
                      { id: 'broadcast', label: 'Disparados / Editados' },
                      { id: 'archived', label: `Ocultos (${archivedCount})` },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterMode(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        filterMode === f.id
                          ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                          : 'text-[#5C574E] dark:text-[#AFAAA0]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Global Cards List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#ECE9E1] dark:divide-[#2A2F2A] px-6">
              {filteredCatalog.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#6B655C] dark:text-[#9A958B]">
                  Nenhum card global encontrado neste filtro.
                </div>
              ) : (
                filteredCatalog.map((card) => (
                  <div
                    key={card.id}
                    className={`py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 ${
                      card.archived ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-display text-sm font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                          {card.term}
                        </span>
                        <span className="text-[11px] font-semibold text-[#28665E] dark:text-[#86CEC2] flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {card.isBroadcastNew
                            ? 'Disparo Novo (Nuvem)'
                            : card.hasCloudOverride
                            ? 'Base Editada na Nuvem'
                            : 'Base Nativa'}
                        </span>
                        {card.archived && (
                          <span className="text-[11px] font-semibold text-[#B5443C] dark:text-[#E58982]">
                            · Oculto para alunos
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5C574E] dark:text-[#AFAAA0] truncate mt-0.5">
                        {card.category} · {card.subtopic} —{' '}
                        {(card.colloquial || []).slice(0, 2).join(' · ') || card.literal}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditGlobalCard(card)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] dark:hover:bg-[#313631] text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        disabled={busyId === card.id}
                        onClick={async () => {
                          setBusyId(card.id);
                          try {
                            await onToggleArchiveGlobalCard(card, !card.archived);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        title={
                          card.archived
                            ? 'Restaurar card para todos os alunos'
                            : 'Ocultar card do acervo de todos os alunos'
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#262A26] text-xs font-medium text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] cursor-pointer transition-colors"
                      >
                        {card.archived ? (
                          <>
                            <ArchiveRestore className="w-3.5 h-3.5 text-[#28665E] dark:text-[#86CEC2]" />
                            <span>Restaurar</span>
                          </>
                        ) : (
                          <>
                            <Archive className="w-3.5 h-3.5" />
                            <span>Ocultar</span>
                          </>
                        )}
                      </button>

                      {card.hasCloudOverride && (
                        <button
                          type="button"
                          disabled={busyId === card.id}
                          onClick={async () => {
                            setBusyId(card.id);
                            try {
                              await onDeleteGlobalOverride(card.id);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          title={
                            card.isBroadcastNew
                              ? 'Excluir disparo permanentemente'
                              : 'Reverter para versão original de fábrica'
                          }
                          aria-label={
                            card.isBroadcastNew
                              ? `Excluir card global ${card.term}`
                              : `Reverter alterações de ${card.term}`
                          }
                          className="p-1.5 rounded-xl text-[#8F312B] dark:text-[#E58982] hover:bg-[#FDF2F2] dark:hover:bg-[#311F1E] cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="rounded-2xl border border-[#DCE5E2] dark:border-[#2F4B46] bg-[#F4F8F7] dark:bg-[#1B2926] p-4 space-y-1.5">
              <p className="text-xs font-bold text-[#225851] dark:text-[#86CEC2]">
                Sua Credencial Administrativa Ativa
              </p>
              <p className="text-xs text-[#5C574E] dark:text-[#AFAAA0]">
                Conta verificada: <strong className="text-[#1C1B18] dark:text-[#EBE7DE]">{currentUserEmail || 'Admin'}</strong> · UID:{' '}
                <code className="font-mono-num px-1.5 py-0.5 rounded bg-white dark:bg-[#253632]">
                  {currentUserUid}
                </code>
              </p>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-3">
              <h3 className="font-display text-sm font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                Adicionar Co-Administrador (Professor / Equipe)
              </h3>
              <p className="text-xs text-[#6B655C] dark:text-[#9A958B]">
                Para conceder acesso ao painel de disparo global sem expor e-mails no banco, informe o Firebase UID do professor.
              </p>

              {adminError && (
                <p className="text-xs font-medium text-[#8F312B] dark:text-[#F4BCB8]">
                  {adminError}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={newAdminUid}
                  onChange={(e) => setNewAdminUid(e.target.value)}
                  placeholder="Firebase UID do colaborador"
                  className="px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE] placeholder:text-[#8F897D] dark:placeholder:text-[#7E7A72]"
                />
                <input
                  type="text"
                  value={newAdminLabel}
                  onChange={(e) => setNewAdminLabel(e.target.value)}
                  placeholder="Identificador (ex: Teacher Mari)"
                  className="px-3.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE] placeholder:text-[#8F897D] dark:placeholder:text-[#7E7A72]"
                />
                <button
                  type="submit"
                  disabled={busyId === 'grant_admin'}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Conceder Permissão</span>
                </button>
              </div>
            </form>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B655C] dark:text-[#9A958B]">
                Co-Administradores Cadastrados por Você ({grantedAdmins.length})
              </h4>
              {grantedAdmins.length === 0 ? (
                <p className="text-xs text-[#6B655C] dark:text-[#9A958B]">
                  Nenhum co-administrador adicional cadastrado no momento.
                </p>
              ) : (
                <div className="divide-y divide-[#ECE9E1] dark:divide-[#2A2F2A] rounded-2xl border border-[#E4E0D8] dark:border-[#343A34]">
                  {grantedAdmins.map((adm) => (
                    <div
                      key={adm.uid}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                          {adm.label}
                        </p>
                        <p className="font-mono-num text-[11px] text-[#6B655C] dark:text-[#9A958B]">
                          UID: {adm.uid}
                        </p>
                      </div>
                      {isBootstrapped && (
                        <button
                          type="button"
                          onClick={() => onRevokeAdmin(adm.uid)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#8F312B] dark:text-[#E58982] hover:bg-[#FDF2F2] dark:hover:bg-[#311F1E] cursor-pointer transition-colors"
                        >
                          Revogar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
