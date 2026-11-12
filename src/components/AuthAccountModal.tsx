import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { User } from '../services/firebase';
import {
  deleteAccountHybrid,
  formatAuthErrorPtBr,
  isAuthUserCancelled,
  registerWithEmailHybrid,
  reloadAuthUserHybrid,
  resendVerificationEmailHybrid,
  sendPasswordResetHybrid,
  signInWithEmailHybrid,
  signInWithGoogleHybrid,
  signOutHybrid,
} from '../services/platform/authService';

interface AuthAccountModalProps {
  isOpen: boolean;
  currentUser: User | null;
  syncLabel: string;
  onClose: () => void;
  onAuthSuccess: (user: User, message: string) => void;
  onSignedOut: () => void;
  onAccountDeleted: (uid: string) => Promise<void> | void;
  onNotify: (message: string) => void;
}

type AuthTab = 'signin' | 'register';

export function AuthAccountModal({
  isOpen,
  currentUser,
  syncLabel,
  onClose,
  onAuthSuccess,
  onSignedOut,
  onAccountDeleted,
  onNotify,
}: AuthAccountModalProps) {
  const [tab, setTab] = useState<AuthTab>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Apple App Store Account Deletion confirmation state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  if (!isOpen) return null;

  const isPasswordProvider = Boolean(
    currentUser?.providerData?.some((p) => p.providerId === 'password')
  );

  const handleGoogleLogin = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const user = await signInWithGoogleHybrid();
      onAuthSuccess(
        user,
        `Bem-vindo(a), ${user.displayName?.split(' ')[0] || 'aluno'}! Progresso sincronizado na nuvem.`
      );
      onClose();
    } catch (err) {
      if (!isAuthUserCancelled(err)) {
        setErrorMsg(formatAuthErrorPtBr(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Preencha seu e-mail e sua senha.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    try {
      if (tab === 'signin') {
        const user = await signInWithEmailHybrid(email, password);
        onAuthSuccess(
          user,
          `Bem-vindo(a) de volta, ${user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'aluno'}!`
        );
        onClose();
      } else {
        const { user, verificationSent } = await registerWithEmailHybrid({
          displayName,
          email,
          password,
        });
        onAuthSuccess(
          user,
          verificationSent
            ? 'Conta criada! Enviamos um link de confirmação para seu e-mail.'
            : 'Conta criada com sucesso! Seu progresso local foi preservado.'
        );
        onClose();
      }
    } catch (err) {
      setErrorMsg(formatAuthErrorPtBr(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setErrorMsg('Digite seu e-mail no campo acima para receber o link de redefinição.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      await sendPasswordResetHybrid(email);
      onNotify('Link de redefinição de senha enviado para seu e-mail!');
    } catch (err) {
      setErrorMsg(formatAuthErrorPtBr(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await resendVerificationEmailHybrid();
      onNotify('E-mail de confirmação reenviado! Verifique sua caixa de entrada.');
    } catch (err) {
      setErrorMsg(formatAuthErrorPtBr(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshVerification = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const refreshed = await reloadAuthUserHybrid();
      if (refreshed?.emailVerified) {
        onAuthSuccess(refreshed, 'E-mail confirmado! Sincronização em nuvem ativada.');
      } else {
        onNotify('Seu e-mail ainda aguarda confirmação no link enviado.');
      }
    } catch (err) {
      setErrorMsg(formatAuthErrorPtBr(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await signOutHybrid();
      onSignedOut();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handlePermanentDeleteAccount = async () => {
    if (!currentUser) return;
    if (isPasswordProvider && !deletePassword) {
      setErrorMsg('Confirme sua senha atual para excluir permanentemente sua conta.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    const deletingUid = currentUser.uid;
    try {
      await deleteAccountHybrid({
        currentPassword: deletePassword || undefined,
        onBeforeLocalPurge: async (uid) => {
          await onAccountDeleted(uid);
        },
      });
      setConfirmDeleteOpen(false);
      onClose();
      onNotify('Sua conta e seus dados na nuvem foram excluídos permanentemente.');
    } catch (err) {
      setErrorMsg(formatAuthErrorPtBr(err));
      // Ensure we stay safe if partial error occurred
      void deletingUid;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-account-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[#E4E0D8] dark:border-[#2E332E] bg-[#FCFBF8] dark:bg-[#212421] p-6 shadow-xl space-y-5 animate-card-enter my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="auth-account-modal-title"
              className="font-display text-lg font-bold text-[#1C1B18] dark:text-[#EBE7DE]"
            >
              {currentUser ? 'Minha Conta EWM' : 'Entrar ou Criar Conta'}
            </h2>
            <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0]">
              {currentUser
                ? syncLabel
                : 'Sincronize seu progresso em todos os dispositivos sem perder seus cards locais'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de conta"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#EAE6DD] dark:hover:bg-[#2B302B] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!currentUser ? (
          <div className="space-y-4">
            {/* Google OAuth Button (Web Popup + Native Android/iOS Sheet) */}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGoogleLogin()}
              className="w-full min-h-[48px] flex items-center justify-center gap-3 px-4 py-3 rounded-2xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] disabled:opacity-60 text-white dark:text-[#F4F7F6] text-sm font-semibold transition-colors cursor-pointer"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5"
                >
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.98 3.09c.95-2.85 3.6-4.94 6.73-4.94z"
                  />
                </svg>
              )}
              <span>Continuar com Google</span>
            </button>

            <div className="flex items-center gap-3 text-[11px] text-[#857F74] dark:text-[#8A857C]">
              <span className="h-px flex-1 bg-[#E4E0D8] dark:bg-[#2E332E]" />
              <span>ou acesse com e-mail</span>
              <span className="h-px flex-1 bg-[#E4E0D8] dark:bg-[#2E332E]" />
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[#EAE6DD] dark:bg-[#1B1E1B] border border-[#E0DBD1] dark:border-[#2E332E]">
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setErrorMsg(null);
                }}
                className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  tab === 'signin'
                    ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs'
                    : 'text-[#6B655C] dark:text-[#AFAAA0]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg(null);
                }}
                className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  tab === 'register'
                    ? 'bg-white dark:bg-[#2C312C] text-[#1C1B18] dark:text-[#EBE7DE] shadow-xs'
                    : 'text-[#6B655C] dark:text-[#AFAAA0]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Criar conta</span>
              </button>
            </div>

            <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3">
              {tab === 'register' && (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome (ex: Ana Clara)"
                  autoComplete="name"
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#272B27] text-sm text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30"
                />
              )}

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu e-mail"
                autoComplete="email"
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#272B27] text-sm text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30"
              />

              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha (mín. 6 caracteres)"
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#272B27] text-sm text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30"
              />

              {errorMsg && (
                <div className="rounded-xl border border-[#E5B8B4] dark:border-[#5C2E2B] bg-[#FDF2F2] dark:bg-[#311F1E] px-3.5 py-2.5 text-xs text-[#8F312B] dark:text-[#F4BCB8]">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#28665E] dark:border-[#68B4A8] bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#253D39] text-[#1E4E47] dark:text-[#86CEC2] text-sm font-semibold transition-colors cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>{tab === 'signin' ? 'Entrar com e-mail' : 'Criar conta e mesclar progresso'}</span>
              </button>

              {tab === 'signin' && (
                <div className="text-center">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handlePasswordReset()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#6B655C] dark:text-[#AFAAA0] hover:text-[#28665E] dark:hover:text-[#68B4A8] cursor-pointer"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Esqueci minha senha</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Signed-in Account Summary */}
            <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#272B27] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold text-sm text-[#1C1B18] dark:text-[#EBE7DE] truncate">
                  {currentUser.displayName || 'Aluno EWM'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#28665E] dark:text-[#68B4A8]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{currentUser.emailVerified ? 'Verificada' : 'Verificação pendente'}</span>
                </span>
              </div>
              <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0] truncate">
                {currentUser.email}
              </p>
              <p className="text-[11px] font-mono-num text-[#857F74] dark:text-[#8A857C] truncate">
                UID: {currentUser.uid}
              </p>
            </div>

            {!currentUser.emailVerified && (
              <div className="rounded-2xl border border-[#E5C9A3] dark:border-[#574328] bg-[#FDF5E8] dark:bg-[#2C2418] p-3.5 space-y-2.5 text-xs text-[#7A470D] dark:text-[#EAC693]">
                <p>
                  Seu progresso já está salvo localmente no dispositivo. Confirme o link enviado ao
                  seu e-mail para liberar a sincronização automática na nuvem.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRefreshVerification()}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-lg bg-[#28665E] text-white font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Já confirmei</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleResendVerification()}
                    className="min-h-[38px] px-3 rounded-lg border border-current/30 font-semibold cursor-pointer"
                  >
                    Reenviar e-mail
                  </button>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-[#E5B8B4] dark:border-[#5C2E2B] bg-[#FDF2F2] dark:bg-[#311F1E] px-3.5 py-2.5 text-xs text-[#8F312B] dark:text-[#F4BCB8]">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleLogout()}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#E4E0D8] dark:border-[#343A34] bg-white dark:bg-[#272B27] hover:bg-[#F0EDE6] dark:hover:bg-[#2E332E] text-xs sm:text-sm font-semibold text-[#1C1B18] dark:text-[#EBE7DE] cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da conta (voltar ao modo visitante)</span>
            </button>

            {/* Mandatory Apple App Store Account Deletion Section */}
            <div className="pt-3 border-t border-[#ECE9E1] dark:border-[#2E332E]">
              {!confirmDeleteOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteOpen(true);
                    setErrorMsg(null);
                  }}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-[#B5443C] dark:text-[#E58982] hover:bg-[#FDF2F2] dark:hover:bg-[#311F1E] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir minha conta e dados na nuvem</span>
                </button>
              ) : (
                <div className="rounded-2xl border border-[#E5B8B4] dark:border-[#5C2E2B] bg-[#FDF2F2] dark:bg-[#311F1E] p-4 space-y-3">
                  <div className="flex items-start gap-2 text-xs text-[#8F312B] dark:text-[#F4BCB8]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      <strong>Ação irreversível:</strong> sua conta de login, progresso na nuvem,
                      baralhos e cartas pessoais serão apagados permanentemente.
                    </p>
                  </div>

                  {isPasswordProvider && (
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Confirme sua senha atual"
                      className="w-full min-h-[44px] px-3 rounded-xl border border-[#E5B8B4] dark:border-[#5C2E2B] bg-white dark:bg-[#212421] text-xs text-[#1C1B18] dark:text-[#EBE7DE]"
                    />
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setConfirmDeleteOpen(false);
                        setDeletePassword('');
                      }}
                      className="min-h-[40px] px-3 rounded-lg border border-[#E4E0D8] dark:border-[#424942] bg-white dark:bg-[#272B27] text-xs font-semibold text-[#5C574E] dark:text-[#C5C0B5] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePermanentDeleteAccount()}
                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-[#B5443C] hover:bg-[#99362F] text-white text-xs font-semibold cursor-pointer"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>Confirmar exclusão</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
