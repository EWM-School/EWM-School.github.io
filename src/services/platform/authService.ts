import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Preferences } from '@capacitor/preferences';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  auth,
  canSyncUserWithCloud,
  checkIsUserAdmin,
  createUserWithEmailAndPassword,
  deleteAllUserCloudData,
  deleteUser,
  ensureUserWorkspaceAndMigrate,
  googleProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type CloudWorkspaceSnapshot,
  type User,
  type WorkspaceMigrationSeed,
} from '../firebase';
import type { CardProgressEntry, Flashcard, UserDeck } from '../../types/flashcard';

const AUTH_SESSION_PREF_KEY = 'ewm_v6_auth_session_snapshot';

export interface CachedAuthProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  providerId: string;
  updatedAt: string;
}

export interface AccountDeletionOptions {
  currentPassword?: string;
  onBeforeLocalPurge?: (uid: string) => Promise<void> | void;
}

function getPrimaryProviderId(user: User): string {
  return user.providerData?.[0]?.providerId || 'firebase';
}

export async function persistAuthSessionSnapshot(user: User | null): Promise<void> {
  if (!user) {
    try {
      await Preferences.remove({ key: AUTH_SESSION_PREF_KEY });
    } catch {
      // ignore
    }
    return;
  }

  const snapshot: CachedAuthProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    providerId: getPrimaryProviderId(user),
    updatedAt: new Date().toISOString(),
  };

  try {
    await Preferences.set({
      key: AUTH_SESSION_PREF_KEY,
      value: JSON.stringify(snapshot),
    });
  } catch {
    // ignore
  }
}

export async function loadCachedAuthProfile(): Promise<CachedAuthProfile | null> {
  try {
    const { value } = await Preferences.get({ key: AUTH_SESSION_PREF_KEY });
    if (!value) return null;
    const parsed = JSON.parse(value) as CachedAuthProfile;
    if (parsed && typeof parsed.uid === 'string') return parsed;
  } catch {
    // ignore
  }
  return null;
}

export function formatAuthErrorPtBr(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('popup-closed-by-user') || raw.includes('canceled') || raw.includes('cancelled')) {
    return 'Login cancelado pelo usuário.';
  }
  if (
    raw.includes('auth/invalid-credential') ||
    raw.includes('auth/wrong-password') ||
    raw.includes('auth/user-not-found')
  ) {
    return 'E-mail ou senha incorretos. Verifique os dados informados.';
  }
  if (raw.includes('auth/invalid-email')) {
    return 'Informe um endereço de e-mail válido.';
  }
  if (raw.includes('auth/email-already-in-use')) {
    return 'Este e-mail já está cadastrado. Use a aba "Entrar" ou recupere sua senha.';
  }
  if (raw.includes('auth/weak-password')) {
    return 'Escolha uma senha com pelo menos 6 caracteres.';
  }
  if (raw.includes('auth/too-many-requests')) {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes antes de tentar novamente.';
  }
  if (raw.includes('auth/network-request-failed') || raw.includes('offline')) {
    return 'Sem conexão com a internet no momento. Você pode continuar praticando no modo visitante offline!';
  }
  if (raw.includes('auth/requires-recent-login')) {
    return 'Por segurança, confirme sua credencial novamente para concluir a exclusão da conta.';
  }
  return 'Não foi possível concluir a autenticação agora. Tente novamente.';
}

export function isAuthUserCancelled(error: unknown): boolean {
  const raw = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    raw.includes('popup-closed-by-user') ||
    raw.includes('cancelled-popup-request') ||
    raw.includes('user cancelled') ||
    raw.includes('canceled')
  );
}

/**
 * Hybrid Google OAuth Sign-In:
 * - Native Android/iOS: `@capacitor-firebase/authentication` native sheet -> Firebase JS `signInWithCredential`
 * - Desktop/Mobile Browser: `signInWithPopup` with `signInWithRedirect` fallback if popups are blocked
 */
export async function signInWithGoogleHybrid(): Promise<User> {
  if (Capacitor.isNativePlatform()) {
    const nativeResult = await FirebaseAuthentication.signInWithGoogle({
      useCredentialManager: false,
    });
    const idToken = nativeResult.credential?.idToken;
    const accessToken = nativeResult.credential?.accessToken;

    if (!idToken && !accessToken) {
      throw new Error('Token OAuth nativo do Google não retornado pelo dispositivo.');
    }

    const firebaseCredential = GoogleAuthProvider.credential(idToken ?? null, accessToken);
    const credentialResult = await signInWithCredential(auth, firebaseCredential);
    await persistAuthSessionSnapshot(credentialResult.user);
    return credentialResult.user;
  }

  try {
    const popupResult = await signInWithPopup(auth, googleProvider);
    await persistAuthSessionSnapshot(popupResult.user);
    return popupResult.user;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('auth/popup-blocked')) {
      await signInWithRedirect(auth, googleProvider);
      throw new Error('Redirecionando para login seguro com Google...');
    }
    throw err;
  }
}

/**
 * Hybrid Email + Password Sign-In (works identically in Browser and Native WebView).
 */
export async function signInWithEmailHybrid(email: string, password: string): Promise<User> {
  const cleanEmail = email.trim();
  const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
  await persistAuthSessionSnapshot(result.user);
  return result.user;
}

/**
 * Hybrid Email + Password Registration with student display name and verification email dispatch.
 */
export async function registerWithEmailHybrid(params: {
  displayName: string;
  email: string;
  password: string;
}): Promise<{ user: User; verificationSent: boolean }> {
  const cleanName = params.displayName.trim().slice(0, 60);
  const cleanEmail = params.email.trim();
  const result = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);

  if (cleanName) {
    await updateProfile(result.user, { displayName: cleanName }).catch(() => {});
  }

  let verificationSent = false;
  try {
    await sendEmailVerification(result.user);
    verificationSent = true;
  } catch {
    // non-fatal
  }

  await persistAuthSessionSnapshot(result.user);
  return { user: result.user, verificationSent };
}

export async function sendPasswordResetHybrid(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmailHybrid(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || user.emailVerified) return false;
  await sendEmailVerification(user);
  return true;
}

export async function reloadAuthUserHybrid(): Promise<User | null> {
  const user = auth.currentUser;
  if (!user) return null;
  await user.reload();
  await persistAuthSessionSnapshot(auth.currentUser);
  return auth.currentUser;
}

/**
 * Unified Hybrid Sign-Out (clears both Firebase Web Auth and Native Plugin session).
 */
export async function signOutHybrid(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await FirebaseAuthentication.signOut().catch(() => {});
  }
  await signOut(auth);
  await persistAuthSessionSnapshot(null);
}

/**
 * Apple App Store Mandatory Account Deletion (Guideline 5.1.1(v)):
 * 1. Re-authenticates if required by Firebase (`auth/requires-recent-login`).
 * 2. Purges all Firestore user subcollections (`cardProgress`, `customCards`, `decks`) and `/users/{uid}`.
 * 3. Runs local cleanup callback (purging offline sync queue for that UID).
 * 4. Permanently deletes the Firebase Auth account & clears native/local session tokens.
 */
export async function deleteAccountHybrid(options: AccountDeletionOptions = {}): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Nenhuma conta autenticada para excluir.');
  }

  const uid = user.uid;
  const providerId = getPrimaryProviderId(user);

  const attemptReauthentication = async () => {
    if (providerId === 'password' && user.email && options.currentPassword) {
      const cred = EmailAuthProvider.credential(user.email, options.currentPassword);
      await reauthenticateWithCredential(user, cred);
      return;
    }

    if (providerId === 'google.com') {
      if (Capacitor.isNativePlatform()) {
        const nativeRes = await FirebaseAuthentication.signInWithGoogle({
          useCredentialManager: false,
        });
        const idToken = nativeRes.credential?.idToken;
        const accessToken = nativeRes.credential?.accessToken;
        if (idToken || accessToken) {
          const cred = GoogleAuthProvider.credential(idToken ?? null, accessToken);
          await signInWithCredential(auth, cred);
          return;
        }
      } else {
        await reauthenticateWithPopup(user, googleProvider);
        return;
      }
    }
  };

  // Pre-authenticate proactively if password was supplied by user in confirmation modal
  if (providerId === 'password' && options.currentPassword) {
    await attemptReauthentication();
  }

  // 1. Delete Cloud Firestore data while user token is still valid
  if (canSyncUserWithCloud(user)) {
    await deleteAllUserCloudData(uid);
  }

  // 2. Delete Firebase Auth User (retrying once after re-auth if token is too old)
  try {
    await deleteUser(auth.currentUser ?? user);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('auth/requires-recent-login')) {
      await attemptReauthentication();
      if (!auth.currentUser) {
        throw err;
      }
      await deleteUser(auth.currentUser);
    } else {
      throw err;
    }
  }

  // 3. Clean up native plugin state & local session
  if (Capacitor.isNativePlatform()) {
    await FirebaseAuthentication.deleteUser().catch(() => {});
    await FirebaseAuthentication.signOut().catch(() => {});
  }
  await persistAuthSessionSnapshot(null);
  await options.onBeforeLocalPurge?.(uid);
}

/**
 * Subscribes to Firebase Auth state changes and keeps Capacitor Preferences session snapshot updated.
 */
export function subscribeHybridAuthState(onChange: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    void persistAuthSessionSnapshot(user);
    onChange(user);
  });
}

/**
 * Lossless Visitor -> Cloud Merge Helper:
 * Merges visitor studied cards (`mastered` / `review`), custom cards, and personal decks
 * into the authenticated cloud workspace without losing a single studied card.
 */
export async function syncAndMergeVisitorIntoCloud(
  user: User,
  visitorSeed: WorkspaceMigrationSeed
): Promise<{
  canSyncCloud: boolean;
  isAdmin: boolean;
  createdNew?: boolean;
  workspace?: CloudWorkspaceSnapshot;
}> {
  if (!canSyncUserWithCloud(user)) {
    return {
      canSyncCloud: false,
      isAdmin: false,
    };
  }

  const isAdmin = await checkIsUserAdmin(user);
  const { createdNew, workspace } = await ensureUserWorkspaceAndMigrate(user.uid, visitorSeed);

  return {
    canSyncCloud: true,
    isAdmin,
    createdNew,
    workspace,
  };
}

/**
 * Pure lossless merge for local vs cloud CardProgress maps using Last-Write-Wins (`updatedAt`)
 * and mastery preservation so visitor studied cards never disappear during initial snapshot sync.
 */
export function mergeProgressMapsLossless(
  localMap: Record<string, CardProgressEntry>,
  cloudMap: Record<string, CardProgressEntry>,
  pendingCardIds: Set<string> = new Set()
): Record<string, CardProgressEntry> {
  const merged: Record<string, CardProgressEntry> = { ...localMap };

  for (const [cardId, cloudEntry] of Object.entries(cloudMap)) {
    // Never overwrite a card that still has an unsynced local mutation in SyncQueue
    if (pendingCardIds.has(cardId) && merged[cardId]) {
      continue;
    }

    const localEntry = merged[cardId];
    if (!localEntry) {
      merged[cardId] = cloudEntry;
      continue;
    }

    const localMs = localEntry.updatedAt ? Date.parse(localEntry.updatedAt) : 0;
    const cloudMs = cloudEntry.updatedAt ? Date.parse(cloudEntry.updatedAt) : 0;

    if (localMs > 0 && cloudMs > 0) {
      merged[cardId] = cloudMs >= localMs ? cloudEntry : localEntry;
    } else if (cloudEntry.masteryLevel !== 'unseen' || localEntry.masteryLevel === 'unseen') {
      merged[cardId] = cloudEntry;
    }
  }

  return merged;
}

export function mergeCustomCardsLww(
  localCards: Flashcard[],
  cloudCards: Flashcard[],
  pendingCardIds: Set<string> = new Set(),
  pendingDeletedIds: Set<string> = new Set()
): Flashcard[] {
  const byId = new Map<string, Flashcard>();

  for (const lc of localCards) {
    if (!pendingDeletedIds.has(lc.id)) {
      byId.set(lc.id, lc);
    }
  }

  for (const cc of cloudCards) {
    if (pendingDeletedIds.has(cc.id)) continue;
    if (pendingCardIds.has(cc.id) && byId.has(cc.id)) continue;

    const existing = byId.get(cc.id);
    if (!existing) {
      byId.set(cc.id, cc);
      continue;
    }

    const localMs = existing.updatedAt ?? 0;
    const cloudMs = cc.updatedAt ?? 0;
    if (cloudMs >= localMs || localMs === 0) {
      byId.set(cc.id, cc);
    }
  }

  return Array.from(byId.values());
}

export function mergeUserDecksLww(
  localDecks: UserDeck[],
  cloudDecks: UserDeck[],
  pendingDeckIds: Set<string> = new Set(),
  pendingDeletedDeckIds: Set<string> = new Set()
): UserDeck[] {
  const byId = new Map<string, UserDeck>();

  for (const ld of localDecks) {
    if (!pendingDeletedDeckIds.has(ld.id)) {
      byId.set(ld.id, ld);
    }
  }

  for (const cd of cloudDecks) {
    if (pendingDeletedDeckIds.has(cd.id)) continue;
    if (pendingDeckIds.has(cd.id) && byId.has(cd.id)) continue;

    const existing = byId.get(cd.id);
    if (!existing) {
      byId.set(cd.id, cd);
      continue;
    }

    const localMs = existing.updatedAt ?? 0;
    const cloudMs = cd.updatedAt ?? 0;
    if (cloudMs >= localMs || localMs === 0) {
      byId.set(cd.id, cd);
    }
  }

  return Array.from(byId.values());
}
