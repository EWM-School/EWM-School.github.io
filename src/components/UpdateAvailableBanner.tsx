import { Capacitor } from '@capacitor/core';
import { Download, RefreshCw, Sparkles, X } from 'lucide-react';
import type { AppUpdateInfo } from '../services/platform/updateCheckerService';

interface UpdateAvailableBannerProps {
  update: AppUpdateInfo | null;
  onApplyUpdate: (update: AppUpdateInfo) => void;
  onDismiss: (tagName: string) => void;
}

export function UpdateAvailableBanner({
  update,
  onApplyUpdate,
  onDismiss,
}: UpdateAvailableBannerProps) {
  if (!update) return null;

  const isAndroidNative = Capacitor.getPlatform() === 'android';

  return (
    <div
      role="region"
      aria-label="Nova atualização disponível"
      className="fixed left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md bottom-20 lg:bottom-5 z-40 rounded-2xl border border-[#28665E]/40 dark:border-[#68B4A8]/45 bg-[#FAF9F6]/96 dark:bg-[#1E2421]/96 backdrop-blur-md p-3.5 sm:p-4 shadow-xl text-[#1C1B18] dark:text-[#EBE7DE] animate-card-enter"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#EAF3F1] dark:bg-[#223935] text-[#28665E] dark:text-[#68B4A8] flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs sm:text-[13px] font-bold leading-snug">
              Nova versão disponível ({update.tagName})
            </p>
            <p className="text-[11px] text-[#5C574E] dark:text-[#AFAAA0] leading-relaxed">
              {isAndroidNative
                ? 'Baixe e instale a atualização mais recente mantendo todo seu progresso salvo.'
                : 'Atualize com 1 clique para carregar os cards e melhorias mais recentes.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(update.tagName)}
          aria-label="Adiar aviso de atualização"
          title="Lembrar somente na próxima versão"
          className="p-1 rounded-lg text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#ECE8DF] dark:hover:bg-[#2A312D] transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onDismiss(update.tagName)}
          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-[#5C574E] dark:text-[#AFAAA0] hover:bg-[#ECE8DF] dark:hover:bg-[#2A312D] transition-colors cursor-pointer"
        >
          Depois
        </button>
        <button
          type="button"
          onClick={() => onApplyUpdate(update)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          {isAndroidNative ? (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Baixar APK {update.tagName}</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar agora</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
