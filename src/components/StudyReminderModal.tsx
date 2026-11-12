import { useEffect, useState } from 'react';
import { Bell, BellOff, Check, Clock, Smartphone, Vibrate, X } from 'lucide-react';
import {
  configureDailyStudyReminder,
  formatReminderTime,
  loadStudyReminderConfig,
  type StudyReminderConfig,
} from '../services/platform/notificationService';
import {
  isHapticsEnabled,
  setHapticsEnabled,
  triggerSuccess,
} from '../services/platform/hapticsService';

interface StudyReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (summaryMessage: string) => void;
}

export function StudyReminderModal({
  isOpen,
  onClose,
  onSaved,
}: StudyReminderModalProps) {
  const [config, setConfig] = useState<StudyReminderConfig>({
    enabled: false,
    hour: 19,
    minute: 30,
    message:
      'Hora de praticar suas expressões! 5 minutinhos de áudio US & UK mantêm sua fluência afiada.',
    updatedAt: '',
  });
  const [hapticsActive, setHapticsActive] = useState<boolean>(() => isHapticsEnabled());
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorText(null);
    setHapticsActive(isHapticsEnabled());
    void loadStudyReminderConfig().then((loaded) => {
      setConfig(loaded);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const timeValue = formatReminderTime(config.hour, config.minute);

  const handleTimeChange = (raw: string) => {
    const [hStr, mStr] = raw.split(':');
    const hour = Number.parseInt(hStr || '19', 10);
    const minute = Number.parseInt(mStr || '30', 10);
    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      setConfig((prev) => ({
        ...prev,
        hour: Math.max(0, Math.min(23, hour)),
        minute: Math.max(0, Math.min(59, minute)),
      }));
    }
  };

  const handleToggleHaptics = async () => {
    const next = !hapticsActive;
    setHapticsActive(next);
    await setHapticsEnabled(next);
    if (next) {
      void triggerSuccess();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorText(null);
    try {
      const result = await configureDailyStudyReminder({
        enabled: config.enabled,
        hour: config.hour,
        minute: config.minute,
        message: config.message,
      });

      if (!result.ok) {
        setConfig(result.config);
        setErrorText(
          result.errorMessage ||
            'Não foi possível ativar o lembrete. Verifique as permissões de notificação.'
        );
        return;
      }

      setConfig(result.config);
      void triggerSuccess();
      onSaved(
        result.config.enabled
          ? `Lembrete diário agendado para ${formatReminderTime(result.config.hour, result.config.minute)}!`
          : 'Lembrete diário desativado.'
      );
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="study-reminder-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-[#FCFBF8] dark:bg-[#212421] p-6 shadow-xl space-y-5 animate-card-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#68B4A8] flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="study-reminder-title"
                className="font-display text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]"
              >
                Hábito de Estudo &amp; Dispositivo
              </h2>
              <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0]">
                Lembretes diários e resposta tátil (Haptics)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações de lembrete"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#EAE6DD] dark:hover:bg-[#2B302B] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Toggle Reminder */}
          <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#272B27] p-4 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-[#1C1B18] dark:text-[#EBE7DE] block">
                Lembrete diário de prática
              </span>
              <span className="text-xs text-[#6B655C] dark:text-[#AFAAA0] block">
                Solicita permissão apenas quando ativado
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={config.enabled}
              onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                config.enabled
                  ? 'bg-[#28665E] text-white dark:bg-[#2A6D63]'
                  : 'bg-[#EAE6DD] dark:bg-[#343A34] text-[#5C574E] dark:text-[#C5C0B5]'
              }`}
            >
              {config.enabled ? (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span>Ativado</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5" />
                  <span>Desativado</span>
                </>
              )}
            </button>
          </div>

          {/* Time Picker + Custom Message */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#5C574E] dark:text-[#C5C0B5] inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                <span>Horário do lembrete</span>
              </span>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#272B27] font-mono-num text-sm font-semibold text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30"
              />
            </label>

            <div className="rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#272B27] p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-[#1C1B18] dark:text-[#EBE7DE] inline-flex items-center gap-1">
                  <Vibrate className="w-3.5 h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                  <span>Vibração tátil</span>
                </span>
                <span className="text-[11px] text-[#6B655C] dark:text-[#AFAAA0] block">
                  Quiz e flashcards
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleToggleHaptics()}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                  hapticsActive
                    ? 'bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#86CEC2]'
                    : 'bg-[#F0EDE6] dark:bg-[#343A34] text-[#6B655C] dark:text-[#AFAAA0]'
                }`}
              >
                {hapticsActive ? 'Ligada' : 'Desligada'}
              </button>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#5C574E] dark:text-[#C5C0B5] inline-flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
              <span>Mensagem motivacional</span>
            </span>
            <input
              type="text"
              maxLength={160}
              value={config.message}
              onChange={(e) => setConfig((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Hora de praticar suas expressões!"
              className="w-full min-h-[48px] px-3.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#272B27] text-xs sm:text-sm text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30"
            />
          </label>

          {errorText && (
            <div className="rounded-xl border border-[#E5B8B4] dark:border-[#5C2E2B] bg-[#FDF2F2] dark:bg-[#311F1E] px-3.5 py-2.5 text-xs text-[#8F312B] dark:text-[#F4BCB8]">
              {errorText}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#ECE9E1] dark:border-[#2E332E]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-4 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] text-xs font-semibold text-[#5C574E] dark:text-[#C5C0B5] hover:bg-[#F0EDE6] dark:hover:bg-[#2B302B] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="min-h-[48px] inline-flex items-center gap-1.5 px-5 rounded-xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] disabled:opacity-60 text-white dark:text-[#F4F7F6] text-xs font-semibold cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Salvando...' : 'Salvar preferências'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
