import { memo } from 'react';
import {
  Bell,
  BellRing,
  BookOpen,
  CheckCircle2,
  Cloud,
  FolderKanban,
  HelpCircle,
  Home,
  Layers,
  List,
  Loader2,
  LogIn,
  Moon,
  Plus,
  Shield,
  ShieldCheck,
  Sun,
  UserRound,
  WifiOff,
} from 'lucide-react';
import type { AppTab, SyncStatus, ThemeMode } from '../types/flashcard';

interface HeaderProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  onOpenCover: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onOpenPhoneticGuide: () => void;
  onOpenReminderModal: () => void;
  reminderEnabled: boolean;
  onOpenNewCard: () => void;
  totalCards: number;
  decksCount: number;
  activeScopeSummary: string;
  syncStatus: SyncStatus;
  syncLabel: string;
  pendingSyncCount: number;
  userDisplayName: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  onOpenAuthModal: () => void;
  onOpenAdminPanel: () => void;
}

export const Header = memo(function Header({
  activeTab,
  onChangeTab,
  onOpenCover,
  theme,
  onToggleTheme,
  focusMode,
  onToggleFocusMode,
  onOpenPhoneticGuide,
  onOpenReminderModal,
  reminderEnabled,
  onOpenNewCard,
  totalCards,
  decksCount,
  activeScopeSummary,
  syncStatus,
  syncLabel,
  pendingSyncCount,
  userDisplayName,
  userEmail,
  isAdmin,
  onOpenAuthModal,
  onOpenAdminPanel,
}: HeaderProps) {
  if (focusMode) {
    return null;
  }

  const tabs: { id: AppTab; label: string; icon: typeof Layers }[] = [
    { id: 'study', label: 'Flashcards', icon: Layers },
    {
      id: 'decks',
      label: decksCount > 0 ? `Baralhos (${decksCount})` : 'Baralhos',
      icon: FolderKanban,
    },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle },
    { id: 'list', label: `Acervo (${totalCards})`, icon: List },
  ];

  const isLoggedIn = Boolean(userEmail || userDisplayName);
  const shortUserName = userDisplayName
    ? userDisplayName.split(' ')[0]
    : userEmail
    ? userEmail.split('@')[0]
    : '';

  return (
    <header className="ios-safe-header sticky top-0 z-30 border-b border-[#E4E0D8] dark:border-[#2E332E] bg-[#F6F4EF]/92 dark:bg-[#181A18]/92 backdrop-blur-md transition-colors">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6">
        <div className="min-h-[64px] py-1.5 flex items-center justify-between gap-2 sm:gap-3">
          {/* Brand Lockup + Real-time Offline/Sync Indicator */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
            <button
              type="button"
              onClick={onOpenCover}
              title="Voltar para a Capa e Área do Aluno"
              aria-label="Voltar para a capa inicial"
              className="min-h-[48px] lg:min-h-[42px] flex items-center gap-2 sm:gap-2.5 min-w-0 text-left group cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-[#28665E]"
            >
              <img
                src={`${import.meta.env.BASE_URL}ewm-logo.jpg`}
                alt="EWM - Keep practicing"
                referrerPolicy="no-referrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-[#E4E0D8] dark:border-[#2E332E] bg-white shrink-0 shadow-xs group-hover:border-[#28665E] dark:group-hover:border-[#68B4A8] transition-colors"
              />
              <div className="min-w-0 overflow-hidden">
                <h1 className="font-display text-sm sm:text-base xl:text-lg font-bold tracking-tight text-[#1C1B18] dark:text-[#EBE7DE] group-hover:text-[#28665E] dark:group-hover:text-[#68B4A8] leading-tight truncate transition-colors">
                  <span className="sm:hidden">EWM</span>
                  <span className="hidden sm:inline">EWM · Keep practicing</span>
                </h1>

                <div
                  title={syncLabel}
                  className="flex items-center gap-1.5 text-[11px] text-[#6B655C] dark:text-[#AFAAA0] leading-tight truncate"
                >
                  <span className="hidden sm:inline truncate">{activeScopeSummary}</span>
                  <span className="hidden sm:inline" aria-hidden="true">
                    ·
                  </span>

                  {syncStatus === 'offline' ? (
                    <span className="inline-flex items-center gap-1 text-[#9A5B13] dark:text-[#E6B472] font-semibold truncate">
                      <WifiOff className="w-3 h-3 shrink-0" />
                      <span className="truncate">Modo Offline • Salvo no dispositivo</span>
                    </span>
                  ) : syncStatus === 'syncing' ? (
                    <span className="inline-flex items-center gap-1 text-[#28665E] dark:text-[#68B4A8] font-medium truncate">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      <span className="truncate">
                        Sincronizando{pendingSyncCount > 0 ? ` (${pendingSyncCount})` : '...'}
                      </span>
                    </span>
                  ) : syncStatus === 'synced' ? (
                    <span className="inline-flex items-center gap-1 text-[#28665E] dark:text-[#68B4A8] font-medium truncate">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">Sincronizado</span>
                    </span>
                  ) : syncStatus === 'error' ? (
                    <span className="inline-flex items-center gap-1 text-[#9A5B13] dark:text-[#E6B472] font-medium truncate">
                      <Cloud className="w-3 h-3 shrink-0" />
                      <span className="truncate">Salvo no dispositivo</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Cloud className="w-3 h-3 opacity-70 shrink-0" />
                      <span className="truncate">Salvo no dispositivo</span>
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Center Navigation (Wide Desktop Layout — Mobile uses ergonomic Bottom Navigation) */}
          <nav
            aria-label="Navegação principal desktop"
            className="hidden lg:flex items-center p-1 rounded-xl bg-[#EAE6DD] dark:bg-[#1D201D] border border-[#E0DBD1] dark:border-[#2E332E] shrink-0"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs'
                      : 'text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Utilities, Study Reminder, Cloud Auth & Desktop New Card CTA */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenCover}
              title="Capa Inicial & Área do Aluno"
              aria-label="Abrir capa inicial"
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#EAE6DD] dark:hover:bg-[#242824] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Capa</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdminPanel}
                title="Painel do Administrador — Disparar cards para todos os usuários"
                className="min-h-[48px] lg:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[#C6DBD7] dark:border-[#2F4B46] bg-[#EAF3F1] dark:bg-[#1E312E] text-[#225851] dark:text-[#86CEC2] text-xs font-semibold hover:bg-[#DCECE8] dark:hover:bg-[#253D39] transition-colors cursor-pointer"
              >
                <Shield className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenReminderModal}
              title={
                reminderEnabled
                  ? 'Lembrete diário de estudo ativo (clique para configurar)'
                  : 'Configurar lembrete diário de estudo e vibração tátil'
              }
              aria-label="Configurar lembrete diário de estudo"
              className={`min-w-[48px] min-h-[48px] lg:min-w-[36px] lg:min-h-[36px] inline-flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                reminderEnabled
                  ? 'bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#68B4A8] border border-[#C6DBD7] dark:border-[#2F4B46]'
                  : 'text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#EAE6DD] dark:hover:bg-[#242824]'
              }`}
            >
              {reminderEnabled ? (
                <BellRing className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenPhoneticGuide}
              title="Guia Fonético EWM-US & EWM-UK + Motor Gramatical"
              aria-label="Guia Fonético US e UK e Gramática"
              className="min-w-[48px] min-h-[48px] lg:min-w-[36px] lg:min-h-[36px] inline-flex items-center justify-center rounded-xl text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#EAE6DD] dark:hover:bg-[#242824] transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#28665E] dark:text-[#68B4A8]" />
            </button>

            <button
              type="button"
              onClick={onToggleFocusMode}
              title="Modo Foco (Atalho F)"
              aria-label="Modo Foco"
              className="hidden sm:inline-flex min-w-[48px] min-h-[48px] lg:min-w-[36px] lg:min-h-[36px] items-center justify-center rounded-xl text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#EAE6DD] dark:hover:bg-[#242824] transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro para leitura noturna'}
              className="min-w-[48px] min-h-[48px] lg:min-w-[36px] lg:min-h-[36px] inline-flex items-center justify-center rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-[#5C574E] dark:text-[#D8D4CA] hover:border-[#C9C3B8] dark:hover:border-[#414941] transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {!isLoggedIn ? (
              <button
                type="button"
                onClick={onOpenAuthModal}
                title="Entrar com Google ou E-mail para sincronizar na nuvem"
                aria-label="Entrar na conta"
                className="min-h-[48px] lg:min-h-[36px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-[#1C1B18] dark:text-[#EBE7DE] hover:border-[#28665E] dark:hover:border-[#68B4A8] text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                <span className="hidden sm:inline">Entrar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                title={`Conta conectada: ${userEmail || shortUserName}. Clique para gerenciar ou excluir conta.`}
                aria-label={`Gerenciar conta ${shortUserName}`}
                className="min-h-[48px] lg:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-[#5C574E] dark:text-[#D8D4CA] hover:border-[#28665E] dark:hover:border-[#68B4A8] text-xs font-medium transition-colors cursor-pointer"
              >
                <UserRound className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                <span className="hidden xl:inline max-w-[90px] truncate font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                  {shortUserName}
                </span>
              </button>
            )}

            {/* Desktop Primary CTA (Mobile has ergonomic center `+ Criar` button in Bottom Navigation) */}
            <button
              type="button"
              onClick={onOpenNewCard}
              className="hidden lg:inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Card</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
});
