interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 dark:bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-sm rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#212421] p-6 shadow-2xl space-y-4">
        <div className="space-y-1.5">
          <h3
            id="confirm-modal-title"
            className="font-display text-base font-bold text-[#1C1B18] dark:text-[#EBE7DE]"
          >
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-[#5C574E] dark:text-[#AFAAA0] leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs font-semibold text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-colors ${
              tone === 'danger'
                ? 'bg-[#B5443C] hover:bg-[#9C3831] dark:bg-[#A63D36] dark:hover:bg-[#B8473F] dark:text-[#FBF5F4]'
                : 'bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] dark:text-[#F4F7F6]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
