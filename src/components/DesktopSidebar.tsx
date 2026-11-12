import { memo } from 'react';
import {
  CheckCircle2,
  Cloud,
  Gamepad2,
  Layers,
  Loader2,
  Mic,
  Plus,
  QrCode,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { isNativeMobile } from '../services/platform/platformInfo';
import { triggerTap } from '../services/platform/hapticsService';
import type { MainPillar, SyncStatus } from '../types/flashcard';

interface DesktopSidebarProps {
  activePillar: MainPillar;
  onSelectPillar: (pillar: MainPillar) => void;
  onOpenCover: () => void;
  onOpenDownloadModal: () => void;
  onOpenNewCard: () => void;
  focusMode: boolean;
  totalCards: number;
  decksCount: number;
  syncStatus: SyncStatus;
  syncLabel: string;
  pendingSyncCount: number;
}

export const DesktopSidebar = memo(function DesktopSidebar({
  activePillar,
  onSelectPillar,
  onOpenCover,
  onOpenDownloadModal,
  onOpenNewCard,
  focusMode,
  totalCards,
  decksCount,
  syncStatus,
  syncLabel,
  pendingSyncCount,
}: DesktopSidebarProps) {
  if (focusMode) return null;

  const pillars: {
    id: MainPillar;
    label: string;
    subtitle: string;
    icon: typeof Layers;
  }[] = [
    {
      id: 'study',
      label: 'Estudo',
      subtitle: `${totalCards} cards · ${decksCount} ${decksCount === 1 ? 'baralho' : 'baralhos'}`,
      icon: Layers,
    },
    {
      id: 'speaking',
      label: 'Speaking Lab',
      subtitle: 'Pronúncia ativa US & UK',
      icon: Mic,
    },
    {
      id: 'games',
      label: 'Jogos',
      subtitle: 'Modo Quiz · Ranking & Arena',
      icon: Gamepad2,
    },
  ];

  const activeIndex = Math.max(
    0,
    pillars.findIndex((p) => p.id === activePillar)
  );

  const handleSelect = (pillar: MainPillar) => {
    if (pillar !== activePillar) {
      void triggerTap();
      onSelectPillar(pillar);
    }
  };

  return (
    <aside
      aria-label="Navegação principal desktop"
      className="hidden md:flex md:w-[244px] lg:w-[268px] shrink-0 sticky top-0 h-dvh flex-col justify-between border-r border-[#DFDBD1] dark:border-[#262C27] bg-[#F0EDE6]/90 dark:bg-[#141714]/95 backdrop-blur-md z-30 select-none"
    >
      {/* Top Section: Brand Lockup + 3 Pillars Navigation */}
      <div className="p-4 lg:p-5 space-y-6">
        {/* EWM Brand Lockup */}
        <button
          type="button"
          onClick={() => {
            void triggerTap();
            onOpenCover();
          }}
          title="Voltar para a Capa Inicial & Área do Aluno"
          aria-label="Voltar para a capa inicial"
          className="w-full flex items-center gap-3 p-2 -m-2 rounded-2xl text-left group cursor-pointer hover:bg-white/60 dark:hover:bg-[#1D221E] focus-visible:outline-2 focus-visible:outline-[#28665E]"
        >
          <img
            src={`${import.meta.env.BASE_URL}ewm-logo.jpg`}
            alt="EWM - Keep practicing"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover border border-[#E4E0D8] dark:border-[#2E332E] bg-white shrink-0 shadow-2xs group-hover:border-[#28665E] dark:group-hover:border-[#38E5A5]/60 transition-colors"
          />
          <div className="min-w-0 flex-1">
            <span className="block font-display text-sm lg:text-[15px] font-bold tracking-tight text-[#1C1B18] dark:text-[#EBE7DE] group-hover:text-[#28665E] dark:group-hover:text-[#68B4A8] truncate">
              EWM · Keep practicing
            </span>

            <span
              title={syncLabel}
              className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#6B655C] dark:text-[#9E998F] truncate"
            >
              {syncStatus === 'offline' ? (
                <span className="inline-flex items-center gap-1 text-[#9A5B13] dark:text-[#E6B472] font-semibold truncate">
                  <WifiOff className="w-3 h-3 shrink-0" />
                  <span className="truncate">Modo Offline</span>
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
                  <span className="truncate">Nuvem sincronizada</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 truncate">
                  <Cloud className="w-3 h-3 opacity-75 shrink-0" />
                  <span className="truncate">Salvo no dispositivo</span>
                </span>
              )}
            </span>
          </div>
        </button>

        {/* 3 Core Pillars with Smoothly Sliding Active Indicator */}
        <div className="space-y-2">
          <div className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-[#7D776C] dark:text-[#848A84]">
            Pilares de Prática
          </div>

          <nav aria-label="Pilares do aplicativo" className="relative flex flex-col gap-1.5">
            {/* Sliding Indicator: each button is 56px tall + 6px gap = 62px stride */}
            <div
              aria-hidden="true"
              style={{
                transform: `translate3d(0, ${activeIndex * 62}px, 0)`,
              }}
              className="ewm-nav-slider pointer-events-none absolute top-0 inset-x-0 h-[56px] rounded-2xl bg-white dark:bg-[#1F2622] border border-[#C6DBD7] dark:border-[#38E5A5]/30 shadow-xs"
            >
              <span className="absolute left-0 top-3 bottom-3 w-[3.5px] rounded-r-full bg-[#28665E] dark:bg-[#38E5A5] shadow-[0_0_10px_rgba(56,229,165,0.55)]" />
            </div>

            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              const isActive = activePillar === pillar.id;
              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => handleSelect(pillar.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative z-10 h-[56px] w-full flex items-center gap-3 px-3.5 rounded-2xl text-left cursor-pointer ${
                    isActive
                      ? 'text-[#1C1B18] dark:text-[#F4F7F6]'
                      : 'text-[#5C574E] dark:text-[#A6ABA6] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE]'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? 'bg-[#EAF3F1] dark:bg-[#38E5A5]/15 text-[#28665E] dark:text-[#38E5A5]'
                        : 'bg-[#E5E1D8]/70 dark:bg-[#1D211E] text-[#6B655C] dark:text-[#9AA09A]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block font-display text-[13.5px] font-bold leading-tight truncate">
                      {pillar.label}
                    </span>
                    <span className="block text-[11px] text-[#787267] dark:text-[#8F968F] leading-tight mt-0.5 truncate">
                      {pillar.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Create Personal Flashcard Action */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              void triggerTap();
              onOpenNewCard();
            }}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white dark:text-[#F4F7F6] text-xs font-semibold shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Criar Novo Card</span>
          </button>
        </div>
      </div>

      {/* Sidebar Footer: Discreet Download Mobile / QR Code Trigger */}
      {!isNativeMobile() && (
        <div className="p-4 lg:p-5 border-t border-[#E2DDD3] dark:border-[#222823]">
          <button
            type="button"
            onClick={() => {
              void triggerTap();
              onOpenDownloadModal();
            }}
            title="Baixar aplicativo EWM no celular via QR Code, APK Android ou PWA iPhone"
            className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-2xl border border-[#DAD5C9] dark:border-[#2B332D] bg-[#FAF9F6]/85 hover:bg-white dark:bg-[#191E1A] dark:hover:bg-[#202722] text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#68B4A8] flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] truncate">
                  Download Mobile
                </span>
                <span className="block text-[10.5px] text-[#6B655C] dark:text-[#969C96] truncate">
                  QR Code · APK &amp; iPhone
                </span>
              </div>
            </div>
            <QrCode className="w-4 h-4 text-[#6B655C] dark:text-[#86CEC2] group-hover:text-[#28665E] dark:group-hover:text-[#38E5A5] shrink-0" />
          </button>
        </div>
      )}
    </aside>
  );
});
