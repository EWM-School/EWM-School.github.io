import { memo } from 'react';
import {
  Bell,
  BellRing,
  BookOpen,
  CheckCircle2,
  Cloud,
  Download,
  Home,
  Loader2,
  LogIn,
  Moon,
  Plus,
  Search,
  Shield,
  Sparkles,
  Sun,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { isNativeMobile } from '../services/platform/platformInfo';
import type { MainPillar, SyncStatus, ThemeMode } from '../types/flashcard';

interface HeaderProps {
  activePillar: MainPillar;
  onOpenCover: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onOpenUnifiedLookup: () => void;
  onOpenReminderModal: () => void;
  onOpenDownloadModal: () => void;
  reminderEnabled: boolean;
  onOpenNewCard: () => void;
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
  activePillar,
  onOpenCover,
  theme,
  onToggleTheme,
  focusMode,
  onToggleFocusMode,
  onOpenUnifiedLookup,
  onOpenReminderModal,
  onOpenDownloadModal,
  reminderEnabled,
  onOpenNewCard,
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

  const isLoggedIn = Boolean(userEmail || userDisplayName);
  const shortUserName = userDisplayName
    ? userDisplayName.split(' ')[0]
    : userEmail
    ? userEmail.split('@')[0]
    : '';

  return (
    <header className="ios-safe-header sticky top-0 z-20 border-b border-[#10D990]/22 dark:border-[#38E5A5]/18 bg-[#F4F9F7]/92 dark:bg-[#0A0F14]/90 backdrop-blur-xl transition-colors">
      <div className="max-w-5xl mx-auto px-3.5 sm:px-6">
        <div className="min-h-[60px] py-1.5 flex items-center justify-between gap-2 sm:gap-3">
          {/* Mobile Brand Lockup (< 768px only; Desktop >= 768px displays Brand Lockup in Sidebar) */}
          <button
            type="button"
            onClick={onOpenCover}
            title={syncLabel}
            aria-label="Voltar para a capa inicial"
            className="md:hidden min-h-[44px] flex items-center gap-2 shrink-0 text-left rounded-xl cursor-pointer focus-visible:outline-2 focus-visible:outline-[#00C982]"
          >
            <div className="relative">
              <img
                src={`${import.meta.env.BASE_URL}ewm-logo.jpg`}
                alt="EWM"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-xl object-cover border border-[#10D990]/35 dark:border-[#38E5A5]/30 bg-white shrink-0 shadow-2xs"
              />
              <span
                aria-hidden="true"
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#F4F9F7] dark:border-[#0A0F14] flex items-center justify-center ${
                  syncStatus === 'offline'
                    ? 'bg-[#D97706]'
                    : syncStatus === 'syncing'
                    ? 'bg-[#38E5A5]'
                    : syncStatus === 'synced'
                    ? 'bg-[#00C982] dark:bg-[#38E5A5]'
                    : 'bg-[#8A9A94]'
                }`}
              />
            </div>

            <div className="leading-none">
              <span className="block font-display text-[15px] font-extrabold tracking-tight ewm-neon-logo">
                EWM
              </span>
              <span className="hidden min-[390px]:block text-[9.5px] font-medium text-[#52605B] dark:text-[#8CA29A]">
                Keep Practicing
              </span>
            </div>
          </button>

          {/* Unified Smart Lookup & Phrase Check Trigger Bar (replaces isolated ShieldCheck) */}
          <button
            type="button"
            onClick={onOpenUnifiedLookup}
            title="Consultar expressão, tradução contextual ou verificar frase (Atalho Ctrl+K)"
            aria-label="Consultar expressão ou verificar frase"
            className="flex-1 max-w-xl min-h-[42px] flex items-center justify-between gap-2.5 px-3 sm:px-3.5 py-2 rounded-2xl border border-[#10D990]/28 dark:border-[#38E5A5]/22 bg-white hover:bg-[#F9FEFC] dark:bg-[#131A22] dark:hover:bg-[#18222C] hover:border-[#00C982] dark:hover:border-[#38E5A5]/55 text-left shadow-[0_4px_18px_rgba(16,217,144,0.08)] dark:shadow-none group cursor-pointer min-w-0"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Search className="w-4 h-4 text-[#00C982] dark:text-[#38E5A5] shrink-0" />
              <span className="text-xs sm:text-[13px] font-medium text-[#475550] dark:text-[#B5C4BE] group-hover:text-[#121816] dark:group-hover:text-[#F1F5F9] truncate">
                Consultar expressão ou verificar frase...
              </span>
            </span>

            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#ECFDF5] dark:bg-[#142B23] border border-[#00C982]/25 dark:border-[#38E5A5]/25 text-[#059669] dark:text-[#38E5A5] text-[10.5px] font-bold shrink-0">
              <Sparkles className="w-3 h-3" />
              <span className="hidden lg:inline font-mono-num">Ctrl K</span>
              <span className="lg:hidden">IA</span>
            </span>
          </button>

          {/* Right Utilities: Cover, Mobile Download, Admin, Reminder, Focus, Theme & Account */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Mobile Sync Badge Pill when syncing/offline */}
            {syncStatus === 'offline' && (
              <span
                title="Modo Offline • Salvo no dispositivo"
                className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#FEF3C7] dark:bg-[#332614] text-[#9A5B13] dark:text-[#E6B472]"
              >
                <WifiOff className="w-3.5 h-3.5" />
              </span>
            )}
            {syncStatus === 'syncing' && (
              <span
                title="Sincronizando alterações..."
                className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#68B4A8]"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </span>
            )}
            {syncStatus === 'synced' && (
              <span className="sr-only">
                <CheckCircle2 className="w-3 h-3" />
              </span>
            )}
            {syncStatus === 'visitor' && (
              <span className="sr-only">
                <Cloud className="w-3 h-3" />
              </span>
            )}

            <button
              type="button"
              onClick={onOpenCover}
              title="Capa Inicial & Área do Aluno"
              aria-label="Abrir capa inicial"
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#EAE6DD] dark:hover:bg-[#242824] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Capa</span>
            </button>

            {/* Mobile-only Download shortcut (Desktop >= 768px has dedicated Sidebar footer button) */}
            {!isNativeMobile() && (
              <button
                type="button"
                onClick={onOpenDownloadModal}
                title="Baixar aplicativo EWM no celular"
                aria-label="Baixar aplicativo EWM no celular"
                className="md:hidden min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl border border-[#C6DBD7] dark:border-[#2F4B46] bg-[#EAF3F1] dark:bg-[#1E312E] text-[#225851] dark:text-[#86CEC2] cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdminPanel}
                title="Painel do Administrador — Disparar cards para todos os usuários"
                className="min-h-[40px] md:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[#C6DBD7] dark:border-[#2F4B46] bg-[#EAF3F1] dark:bg-[#1E312E] text-[#225851] dark:text-[#86CEC2] text-xs font-semibold hover:bg-[#DCECE8] dark:hover:bg-[#253D39] cursor-pointer"
              >
                <Shield className="w-4 h-4 md:w-3.5 md:h-3.5" />
                <span className="hidden xl:inline">Admin</span>
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
              className={`min-w-[40px] min-h-[40px] md:min-w-[36px] md:min-h-[36px] inline-flex items-center justify-center rounded-xl cursor-pointer ${
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

            {activePillar === 'study' && (
              <button
                type="button"
                onClick={onToggleFocusMode}
                title="Modo Foco sem distrações (Atalho F)"
                aria-label="Modo Foco"
                className="hidden sm:inline-flex min-w-[40px] min-h-[40px] md:min-w-[36px] md:min-h-[36px] items-center justify-center rounded-xl text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] hover:bg-[#EAE6DD] dark:hover:bg-[#242824] cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro para leitura noturna'}
              className="min-w-[40px] min-h-[40px] md:min-w-[36px] md:min-h-[36px] inline-flex items-center justify-center rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-[#5C574E] dark:text-[#D8D4CA] hover:border-[#C9C3B8] dark:hover:border-[#414941] cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {!isLoggedIn ? (
              <button
                type="button"
                onClick={onOpenAuthModal}
                title="Entrar com Google ou E-mail para sincronizar na nuvem"
                aria-label="Entrar na conta"
                className="min-h-[40px] md:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-[#1C1B18] dark:text-[#EBE7DE] hover:border-[#28665E] dark:hover:border-[#68B4A8] text-xs font-semibold cursor-pointer"
              >
                <LogIn className="w-4 h-4 md:w-3.5 md:h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                <span className="hidden sm:inline">Entrar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                title={`Conta conectada: ${userEmail || shortUserName}. Clique para gerenciar.`}
                aria-label={`Gerenciar conta ${shortUserName}`}
                className="min-h-[40px] md:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] text-[#5C574E] dark:text-[#D8D4CA] hover:border-[#28665E] dark:hover:border-[#68B4A8] text-xs font-medium cursor-pointer"
              >
                <UserRound className="w-4 h-4 md:w-3.5 md:h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                <span className="hidden lg:inline max-w-[96px] truncate font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                  {shortUserName}
                </span>
              </button>
            )}

            {/* Mobile Quick Create Card Button (Desktop Sidebar already has primary + Criar Novo Card) */}
            <button
              type="button"
              onClick={onOpenNewCard}
              title="Criar novo flashcard pessoal"
              aria-label="Criar novo flashcard pessoal"
              className="md:hidden min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] text-white cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
});
