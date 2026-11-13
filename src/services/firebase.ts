import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
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
  type Auth,
  type User,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  AdminRecord,
  CardProgressEntry,
  CardStatus,
  EnglishAccent,
  Flashcard,
  StudyScope,
  UserDeck,
} from '../types/flashcard';
import {
  isValidFirestoreId,
  sanitizeCardFieldsForFirestore,
  sanitizeDeckFieldsForFirestore,
  sanitizeWorkspaceFieldsForFirestore,
} from '../utils/deckHelpers';
import {
  enforceDeterministicGrammarVerdict,
  toCanonicalExpressionKey,
  type LinguisticEngineResult,
} from '../utils/linguisticNormalizer';
import type { CloudLeaderboardRecord } from '../utils/studyMetrics';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'igordesouzaar@gmail.com';

// Suppress benign internal RPC/WebChannel transport reconnection messages when offline or in WebView
setLogLevel('silent');

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

function createHybridFirebaseAuth(): Auth {
  try {
    if (Capacitor.isNativePlatform()) {
      // Avoid WKWebView IndexedDB auth persistence deadlocks on iOS/Android Capacitor containers
      return initializeAuth(app, {
        persistence: browserLocalPersistence,
      });
    }
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = createHybridFirebaseAuth();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isLikelyNetworkOfflineError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('network-request-failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  if (!isLikelyNetworkOfflineError(error)) {
    console.warn('Firestore Sync Warning:', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

export {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
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
  type User,
};

/**
 * Firestore security rules require `email_verified == true` for `/users/{uid}` reads/writes.
 * Google OAuth accounts satisfy this immediately; email/password accounts sync to Firestore
 * once verified while keeping 100% offline-first functionality locally in the meantime.
 */
export function canSyncUserWithCloud(user: User | null): boolean {
  return Boolean(user && user.emailVerified);
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function checkIsUserAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  const adminPath = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch (error) {
    if (isLikelyNetworkOfflineError(error)) return false;
    handleFirestoreError(error, OperationType.GET, adminPath);
  }
}

export interface WorkspaceMigrationSeed {
  studyScope: StudyScope;
  selectedCardIds: string[];
  connectedDeckIds: string[];
  activeRound: number;
  preferredAccent?: EnglishAccent;
  customCards: Flashcard[];
  decks: UserDeck[];
  progressEntries: CardProgressEntry[];
}

export interface CloudWorkspaceSnapshot {
  studyScope: StudyScope;
  selectedCardIds: string[];
  connectedDeckIds: string[];
  activeRound: number;
  preferredAccent?: EnglishAccent;
  survivalBestStreak?: number;
  updatedAt?: string;
}

function extractTimestampIso(val: unknown): string | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    try {
      return (val as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    return new Date(val).toISOString();
  }
  if (typeof val === 'string') return val;
  return undefined;
}

function extractTimestampMs(val: unknown): number | undefined {
  const iso = extractTimestampIso(val);
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Ensures the student's cloud workspace exists and performs a lossless merge of any
 * visitor/offline progress, custom cards, and decks so zero studied cards are ever lost.
 */
export async function ensureUserWorkspaceAndMigrate(
  uid: string,
  localSeed: WorkspaceMigrationSeed
): Promise<{ createdNew: boolean; workspace: CloudWorkspaceSnapshot }> {
  const wsPath = `users/${uid}`;
  const wsRef = doc(db, 'users', uid);

  let exists = false;
  let existingData: Record<string, unknown> | null = null;

  try {
    const snap = await getDoc(wsRef);
    exists = snap.exists();
    if (exists) {
      existingData = snap.data() as Record<string, unknown>;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, wsPath);
  }

  const sanitizedWs = sanitizeWorkspaceFieldsForFirestore({
    studyScope: localSeed.studyScope,
    selectedCardIds: localSeed.selectedCardIds,
    connectedDeckIds: localSeed.connectedDeckIds,
    activeRound: localSeed.activeRound,
    preferredAccent: localSeed.preferredAccent,
  });

  if (!exists) {
    try {
      await setDoc(wsRef, {
        ownerId: uid,
        ...sanitizedWs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, wsPath);
    }

    for (const cc of localSeed.customCards) {
      if (isValidFirestoreId(cc.id)) {
        await upsertCustomCard(uid, cc);
      }
    }
    for (const deck of localSeed.decks) {
      if (isValidFirestoreId(deck.id)) {
        await upsertUserDeck(uid, deck);
      }
    }
    for (const prog of localSeed.progressEntries) {
      if (isValidFirestoreId(prog.cardId) && prog.masteryLevel !== 'unseen') {
        await saveCardMastery(uid, prog.cardId, prog.masteryLevel, prog.roundMarked);
      }
    }

    return { createdNew: true, workspace: sanitizedWs };
  }

  // Existing cloud account: losslessly merge visitor custom cards, decks, AND studied progress!
  if (localSeed.customCards && localSeed.customCards.length > 0) {
    for (const cc of localSeed.customCards) {
      if (isValidFirestoreId(cc.id)) {
        await upsertCustomCard(uid, cc).catch(() => {});
      }
    }
  }

  if (localSeed.decks && localSeed.decks.length > 0) {
    for (const deck of localSeed.decks) {
      if (isValidFirestoreId(deck.id)) {
        await upsertUserDeck(uid, deck).catch(() => {});
      }
    }
  }

  const meaningfulLocalProgress = (localSeed.progressEntries || []).filter(
    (p) => isValidFirestoreId(p.cardId) && p.masteryLevel !== 'unseen'
  );

  if (meaningfulLocalProgress.length > 0) {
    try {
      const cloudProgSnap = await getDocs(
        query(collection(db, 'users', uid, 'cardProgress'), where('ownerId', '==', uid))
      );
      const cloudProgMap = new Map<string, { masteryLevel: CardStatus; updatedAtMs: number }>();
      cloudProgSnap.docs.forEach((d) => {
        const data = d.data();
        const cid = String(data.cardId || d.id);
        cloudProgMap.set(cid, {
          masteryLevel: (data.masteryLevel as CardStatus) || 'unseen',
          updatedAtMs: extractTimestampMs(data.updatedAt) ?? 0,
        });
      });

      for (const localProg of meaningfulLocalProgress) {
        const cloudExisting = cloudProgMap.get(localProg.cardId);
        const localMs = localProg.updatedAt ? Date.parse(localProg.updatedAt) : 0;
        const shouldWriteToCloud =
          !cloudExisting ||
          cloudExisting.masteryLevel === 'unseen' ||
          (localMs > 0 && localMs > cloudExisting.updatedAtMs) ||
          (localProg.masteryLevel === 'mastered' && cloudExisting.masteryLevel === 'review' && cloudExisting.updatedAtMs === 0);

        if (shouldWriteToCloud) {
          await saveCardMastery(
            uid,
            localProg.cardId,
            localProg.masteryLevel,
            localProg.roundMarked
          ).catch(() => {});
        }
      }
    } catch {
      // Non-fatal: sync queue will retry if offline
    }
  }

  const cloudSelected = Array.isArray(existingData?.selectedCardIds)
    ? (existingData.selectedCardIds as string[])
    : [];
  const mergedSelectedIds =
    cloudSelected.length > 0
      ? Array.from(new Set([...cloudSelected, ...sanitizedWs.selectedCardIds])).slice(0, 20)
      : sanitizedWs.selectedCardIds;

  const cloudConnected = Array.isArray(existingData?.connectedDeckIds)
    ? (existingData.connectedDeckIds as string[])
    : [];
  const mergedConnectedIds = Array.from(
    new Set([...cloudConnected, ...sanitizedWs.connectedDeckIds])
  ).slice(0, 12);

  return {
    createdNew: false,
    workspace: {
      studyScope: (existingData?.studyScope as StudyScope) || 'selected',
      selectedCardIds: mergedSelectedIds,
      connectedDeckIds: mergedConnectedIds,
      activeRound:
        typeof existingData?.activeRound === 'number' ? existingData.activeRound : 1,
      preferredAccent:
        existingData?.preferredAccent === 'uk'
          ? 'uk'
          : existingData?.preferredAccent === 'us'
          ? 'us'
          : undefined,
      survivalBestStreak:
        typeof existingData?.survivalBestStreak === 'number'
          ? Math.max(0, Math.floor(existingData.survivalBestStreak))
          : undefined,
      updatedAt: extractTimestampIso(existingData?.updatedAt),
    },
  };
}

export async function syncSurvivalBestStreakInCloud(
  uid: string,
  bestStreak: number
): Promise<void> {
  const cleanStreak = Math.max(0, Math.min(100000, Math.floor(bestStreak || 0)));
  if (!isValidFirestoreId(uid) || cleanStreak <= 0) return;
  const wsPath = `users/${uid}`;
  const wsRef = doc(db, 'users', uid);

  try {
    const snap = await getDoc(wsRef);
    if (!snap.exists()) return;
    const prev =
      typeof snap.data()?.survivalBestStreak === 'number'
        ? Math.max(0, Math.floor(snap.data().survivalBestStreak))
        : 0;
    if (cleanStreak <= prev) return;
    await updateDoc(wsRef, {
      survivalBestStreak: cleanStreak,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (isPermissionDeniedError(error) || isLikelyNetworkOfflineError(error)) {
      return;
    }
    handleFirestoreError(error, OperationType.UPDATE, wsPath);
  }
}

export async function updateUserWorkspaceSettings(
  uid: string,
  settings: {
    studyScope: StudyScope;
    selectedCardIds: string[];
    connectedDeckIds: string[];
    activeRound: number;
    preferredAccent?: EnglishAccent;
  }
): Promise<void> {
  const wsPath = `users/${uid}`;
  const wsRef = doc(db, 'users', uid);
  const clean = sanitizeWorkspaceFieldsForFirestore(settings);

  let exists = true;
  try {
    const snap = await getDoc(wsRef);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, wsPath);
  }

  if (!exists) {
    try {
      await setDoc(wsRef, {
        ownerId: uid,
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, wsPath);
    }
    return;
  }

  try {
    await updateDoc(wsRef, {
      ...clean,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, wsPath);
  }
}

export async function saveCardMastery(
  uid: string,
  cardId: string,
  masteryLevel: CardStatus,
  roundMarked: number
): Promise<void> {
  if (!isValidFirestoreId(cardId)) return;
  const path = `users/${uid}/cardProgress/${cardId}`;
  const ref = doc(db, 'users', uid, 'cardProgress', cardId);
  const cleanRound = Math.max(1, Math.min(10000, Math.floor(roundMarked || 1)));

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
        cardId,
        ownerId: uid,
        masteryLevel,
        roundMarked: cleanRound,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        masteryLevel,
        roundMarked: cleanRound,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function resetAllCardMasteryInCloud(
  uid: string,
  cardIdsWithProgress: string[],
  newRound: number
): Promise<void> {
  const validIds = cardIdsWithProgress.filter(isValidFirestoreId);
  if (validIds.length === 0) return;

  const cleanRound = Math.max(1, Math.min(10000, Math.floor(newRound || 1)));
  const chunkSize = 400;

  for (let i = 0; i < validIds.length; i += chunkSize) {
    const chunk = validIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const cid of chunk) {
      const ref = doc(db, 'users', uid, 'cardProgress', cid);
      batch.update(ref, {
        masteryLevel: 'unseen',
        roundMarked: cleanRound,
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/cardProgress`);
    }
  }
}

export async function upsertCustomCard(uid: string, card: Flashcard): Promise<void> {
  if (!isValidFirestoreId(card.id)) return;
  const path = `users/${uid}/customCards/${card.id}`;
  const ref = doc(db, 'users', uid, 'customCards', card.id);
  const fields = sanitizeCardFieldsForFirestore(card);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
        id: card.id,
        ownerId: uid,
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function deleteCustomCardFromCloud(uid: string, cardId: string): Promise<void> {
  if (!isValidFirestoreId(cardId)) return;
  const path = `users/${uid}/customCards/${cardId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'customCards', cardId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertUserDeck(uid: string, deck: UserDeck): Promise<void> {
  if (!isValidFirestoreId(deck.id)) return;
  const path = `users/${uid}/decks/${deck.id}`;
  const ref = doc(db, 'users', uid, 'decks', deck.id);
  const fields = sanitizeDeckFieldsForFirestore(deck);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
        id: deck.id,
        ownerId: uid,
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function deleteUserDeckFromCloud(uid: string, deckId: string): Promise<void> {
  if (!isValidFirestoreId(deckId)) return;
  const path = `users/${uid}/decks/${deckId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'decks', deckId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Deletes all Firestore subcollections and the root workspace document for a user.
 * Subcollections are deleted BEFORE `/users/{uid}` to satisfy `hasParentWorkspace(uid)` security rules.
 */
export async function deleteAllUserCloudData(uid: string): Promise<void> {
  if (!isValidFirestoreId(uid)) return;

  const subcollections = ['cardProgress', 'customCards', 'decks'] as const;

  for (const sub of subcollections) {
    try {
      const snap = await getDocs(
        query(collection(db, 'users', uid, sub), where('ownerId', '==', uid))
      );
      const docs = snap.docs;
      const chunkSize = 400;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        for (const d of docs.slice(i, i + chunkSize)) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }
    } catch {
      // Ignore if workspace never existed in cloud
    }
  }

  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch {
    // Ignore if root doc was not created or rules not yet redeployed
  }

  try {
    await deleteDoc(doc(db, 'leaderboard', uid));
  } catch {
    // Ignore if leaderboard entry was not created or rules not yet redeployed
  }
}

export interface UpsertLeaderboardPayload {
  name: string;
  shortName: string;
  initials: string;
  avatarUrl?: string;
  monthKey: string;
  score: number;
  cardsReviewed: number;
  masteredCount: number;
  reviewCount: number;
  quizScore: number;
  activeDays: number;
  studyTimeMinutes: number;
  minutosEstudados: number;
  statusText: string;
}

function isPermissionDeniedError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '').toLowerCase();
  const msg = String((err as { message?: string })?.message || '').toLowerCase();
  return code.includes('permission-denied') || msg.includes('missing or insufficient permissions');
}

export async function upsertLeaderboardEntryInCloud(
  uid: string,
  payload: UpsertLeaderboardPayload
): Promise<void> {
  if (!isValidFirestoreId(uid) || payload.score <= 0) return;
  const ref = doc(db, 'leaderboard', uid);

  const sanitizedBase = {
    uid,
    name: String(payload.name || 'Aluno EWM').trim().slice(0, 80) || 'Aluno EWM',
    shortName: String(payload.shortName || 'Aluno').trim().slice(0, 40) || 'Aluno',
    initials: String(payload.initials || 'EW').trim().slice(0, 4) || 'EW',
    ...(payload.avatarUrl ? { avatarUrl: String(payload.avatarUrl).slice(0, 500) } : {}),
    monthKey: String(payload.monthKey).slice(0, 7),
    score: Math.max(0, Math.min(2000000, Math.floor(payload.score || 0))),
    cardsReviewed: Math.max(0, Math.min(100000, Math.floor(payload.cardsReviewed || 0))),
    masteredCount: Math.max(0, Math.min(100000, Math.floor(payload.masteredCount || 0))),
    reviewCount: Math.max(0, Math.min(100000, Math.floor(payload.reviewCount || 0))),
    quizScore: Math.max(0, Math.min(100000, Math.floor(payload.quizScore || 0))),
    activeDays: Math.max(0, Math.min(31, Math.floor(payload.activeDays || 0))),
    studyTimeMinutes: Math.max(0, Math.min(45000, Math.floor(payload.studyTimeMinutes || 0))),
    minutosEstudados: Math.max(0, Math.min(1440, Math.floor(payload.minutosEstudados || 0))),
    statusText: String(payload.statusText || 'Estudando no EWM').trim().slice(0, 80) || 'Estudando no EWM',
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...sanitizedBase,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, sanitizedBase);
    }
  } catch (error) {
    // If live Firebase Console rules haven't deployed `/leaderboard` yet, gracefully skip without clogging SyncQueue
    if (isPermissionDeniedError(error)) {
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, `leaderboard/${uid}`);
  }
}

export function subscribeGlobalLeaderboard(
  monthKey: string,
  onEntries: (entries: CloudLeaderboardRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'leaderboard'), where('monthKey', '==', monthKey));
  return onSnapshot(
    q,
    (snap) => {
      const records: CloudLeaderboardRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid || d.id),
            name: String(data.name || 'Aluno EWM'),
            shortName: String(data.shortName || 'Aluno'),
            initials: String(data.initials || 'EW'),
            avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
            monthKey: String(data.monthKey || monthKey),
            score: typeof data.score === 'number' ? Math.max(0, Math.floor(data.score)) : 0,
            cardsReviewed: typeof data.cardsReviewed === 'number' ? Math.max(0, Math.floor(data.cardsReviewed)) : 0,
            masteredCount: typeof data.masteredCount === 'number' ? Math.max(0, Math.floor(data.masteredCount)) : 0,
            reviewCount: typeof data.reviewCount === 'number' ? Math.max(0, Math.floor(data.reviewCount)) : 0,
            quizScore: typeof data.quizScore === 'number' ? Math.max(0, Math.floor(data.quizScore)) : 0,
            activeDays: typeof data.activeDays === 'number' ? Math.max(0, Math.floor(data.activeDays)) : 0,
            studyTimeMinutes: typeof data.studyTimeMinutes === 'number' ? Math.max(0, Math.floor(data.studyTimeMinutes)) : 0,
            minutosEstudados: typeof data.minutosEstudados === 'number' ? Math.max(0, Math.floor(data.minutosEstudados)) : 0,
            statusText: String(data.statusText || 'Estudando no EWM'),
            updatedAtMs: extractTimestampMs(data.updatedAt) ?? Date.now(),
          };
        })
        .filter((r) => r.score > 0);
      onEntries(records);
    },
    (error) => {
      if (!isLikelyNetworkOfflineError(error) && !isPermissionDeniedError(error)) {
        console.warn('Leaderboard listener warning:', error);
      }
    }
  );
}

/**
 * Admin Operations (/globalCards & /admins)
 */
export async function upsertGlobalCardAsAdmin(
  adminUid: string,
  card: Partial<Flashcard> & { id: string },
  archived = false
): Promise<void> {
  if (!isValidFirestoreId(card.id)) return;
  const path = `globalCards/${card.id}`;
  const ref = doc(db, 'globalCards', card.id);
  const fields = sanitizeCardFieldsForFirestore(card);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
        id: card.id,
        authorId: adminUid,
        ...fields,
        published: true,
        archived: Boolean(archived),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        ...fields,
        published: true,
        archived: Boolean(archived),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function deleteGlobalCardFromCloud(cardId: string): Promise<void> {
  if (!isValidFirestoreId(cardId)) return;
  const path = `globalCards/${cardId}`;
  try {
    await deleteDoc(doc(db, 'globalCards', cardId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function grantCoAdminByUid(
  currentAdminUid: string,
  targetUid: string,
  label: string
): Promise<void> {
  const cleanUid = targetUid.trim();
  const cleanLabel = label.trim().slice(0, 80);
  if (!isValidFirestoreId(cleanUid) || !cleanLabel) {
    throw new Error('Informe um UID válido e um identificador curto.');
  }
  const path = `admins/${cleanUid}`;
  try {
    await setDoc(doc(db, 'admins', cleanUid), {
      uid: cleanUid,
      grantedBy: currentAdminUid,
      label: cleanLabel,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeCoAdminByUid(targetUid: string): Promise<void> {
  const cleanUid = targetUid.trim();
  if (!isValidFirestoreId(cleanUid)) return;
  const path = `admins/${cleanUid}`;
  try {
    await deleteDoc(doc(db, 'admins', cleanUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Collective Linguistic Cache (/linguisticCache/{cacheId}) & Curated Global Catalog (/globalCatalog/{cardId})
 */
export async function fetchCollectiveLinguisticCacheFromCloud(
  cacheId: string
): Promise<LinguisticEngineResult | null> {
  if (!isValidFirestoreId(cacheId)) return null;
  try {
    const snap = await getDoc(doc(db, 'linguisticCache', cacheId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (typeof data.payloadJson !== 'string' || data.payloadJson.length < 20) {
      return null;
    }
    const parsed = JSON.parse(data.payloadJson) as LinguisticEngineResult;
    if (!parsed || typeof parsed !== 'object') return null;

    if (parsed.mode === 'GRAMMAR_CHECK') {
      return {
        ...parsed,
        verdict: enforceDeterministicGrammarVerdict({
          detectedErrors: parsed.detectedErrors,
          isStiltedOrTruncated: parsed.isStiltedOrTruncated,
          rawVerdict: parsed.verdict,
        }),
        cacheLayer: 'L2_FIRESTORE',
      };
    }

    if (parsed.mode === 'CONSULT_TRANSLATE') {
      return {
        ...parsed,
        cacheLayer: 'L2_FIRESTORE',
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function upsertCollectiveLinguisticCacheInCloud(
  uid: string,
  params: {
    cacheId: string;
    mode: 'CONSULT_TRANSLATE' | 'GRAMMAR_CHECK';
    canonicalKey: string;
    payloadJson: string;
  }
): Promise<void> {
  if (
    !isValidFirestoreId(uid) ||
    !isValidFirestoreId(params.cacheId) ||
    params.payloadJson.length < 20 ||
    params.payloadJson.length > 25000
  ) {
    return;
  }

  const ref = doc(db, 'linguisticCache', params.cacheId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return;

    await setDoc(ref, {
      cacheId: params.cacheId,
      mode: params.mode,
      canonicalKey: String(params.canonicalKey || '').slice(0, 180) || 'query',
      payloadJson: params.payloadJson,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (isPermissionDeniedError(error) || isLikelyNetworkOfflineError(error)) {
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, `linguisticCache/${params.cacheId}`);
  }
}

export async function publishCuratedSchoolCardInCloud(
  uid: string,
  card: Flashcard
): Promise<void> {
  if (!isValidFirestoreId(uid) || !isValidFirestoreId(card.id)) return;
  const canonicalKey = toCanonicalExpressionKey(card.term);
  if (!canonicalKey || canonicalKey.length < 2 || canonicalKey.length > 100) return;

  const ref = doc(db, 'globalCatalog', card.id);
  const fields = sanitizeCardFieldsForFirestore(card);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return;

    await setDoc(ref, {
      id: card.id,
      canonicalKey,
      discoveredBy: uid,
      ...fields,
      published: true,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (isPermissionDeniedError(error) || isLikelyNetworkOfflineError(error)) {
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, `globalCatalog/${card.id}`);
  }
}

/**
 * Real-time Listeners
 */
export function subscribeGlobalCards(onCards: (cards: Flashcard[]) => void): Unsubscribe {
  const path = 'globalCards';
  let adminCards: Flashcard[] = [];
  let catalogCards: Flashcard[] = [];

  const emitMerged = () => {
    const merged: Flashcard[] = [];
    const seenIds = new Set<string>();
    const seenCanonical = new Set<string>();

    for (const ac of adminCards) {
      if (!ac.id || seenIds.has(ac.id)) continue;
      seenIds.add(ac.id);
      const ck = toCanonicalExpressionKey(ac.term);
      if (ck) seenCanonical.add(ck);
      merged.push(ac);
    }

    for (const cc of catalogCards) {
      if (!cc.id || seenIds.has(cc.id)) continue;
      const ck = toCanonicalExpressionKey(cc.term);
      if (ck && seenCanonical.has(ck)) continue;
      seenIds.add(cc.id);
      if (ck) seenCanonical.add(ck);
      merged.push(cc);
    }

    onCards(merged);
  };

  const mapDocToGlobalCard = (d: { id: string; data: () => Record<string, unknown> }): Flashcard => {
    const data = d.data();
    return {
      id: String(data.id || d.id),
      term: String(data.term || ''),
      category: data.category as Flashcard['category'],
      subtopic: data.subtopic as Flashcard['subtopic'],
      literal: String(data.literal || ''),
      phoneticUs: typeof data.phoneticUs === 'string' ? data.phoneticUs : undefined,
      phoneticUk: typeof data.phoneticUk === 'string' ? data.phoneticUk : undefined,
      ukNote: typeof data.ukNote === 'string' ? data.ukNote : undefined,
      colloquial: Array.isArray(data.colloquial) ? (data.colloquial as string[]) : [],
      exampleEn: String(data.exampleEn || ''),
      examplePt: String(data.examplePt || ''),
      exampleEn2: String(data.exampleEn2 || ''),
      examplePt2: String(data.examplePt2 || ''),
      tip: String(data.tip || ''),
      status: 'unseen',
      origin: 'global',
      published: Boolean(data.published),
      archived: Boolean(data.archived),
      authorId: String(data.authorId || data.discoveredBy || ''),
      modified: true,
      updatedAt: extractTimestampMs(data.updatedAt),
    };
  };

  const qAdmin = query(collection(db, 'globalCards'), where('published', '==', true));
  const unsubAdmin = onSnapshot(
    qAdmin,
    (snap) => {
      adminCards = snap.docs.map(mapDocToGlobalCard);
      emitMerged();
    },
    (error) => {
      if (!isLikelyNetworkOfflineError(error)) {
        console.warn(`Global cards listener error (${path}):`, error);
      }
    }
  );

  const qCatalog = query(collection(db, 'globalCatalog'), where('published', '==', true));
  const unsubCatalog = onSnapshot(
    qCatalog,
    (snap) => {
      catalogCards = snap.docs.map(mapDocToGlobalCard);
      emitMerged();
    },
    (error) => {
      if (!isLikelyNetworkOfflineError(error) && !isPermissionDeniedError(error)) {
        console.warn('Global catalog listener warning:', error);
      }
    }
  );

  return () => {
    unsubAdmin();
    unsubCatalog();
  };
}

export function subscribeGrantedAdmins(
  currentAdminUid: string,
  onAdmins: (admins: AdminRecord[]) => void
): Unsubscribe {
  const path = 'admins';
  const q = query(collection(db, 'admins'), where('grantedBy', '==', currentAdminUid));
  return onSnapshot(
    q,
    (snap) => {
      const records: AdminRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid || d.id),
          grantedBy: String(data.grantedBy || ''),
          label: String(data.label || ''),
        };
      });
      onAdmins(records);
    },
    (error) => {
      if (!isLikelyNetworkOfflineError(error)) {
        console.warn(`Admins listener error (${path}):`, error);
      }
    }
  );
}

export function subscribeUserCloudData(
  uid: string,
  callbacks: {
    onWorkspace: (ws: CloudWorkspaceSnapshot) => void;
    onCustomCards: (cards: Flashcard[]) => void;
    onDecks: (decks: UserDeck[]) => void;
    onProgressMap: (map: Record<string, CardProgressEntry>) => void;
  }
): Unsubscribe {
  const unsubWs = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      callbacks.onWorkspace({
        studyScope: (data.studyScope as StudyScope) || 'selected',
        selectedCardIds: Array.isArray(data.selectedCardIds) ? data.selectedCardIds : [],
        connectedDeckIds: Array.isArray(data.connectedDeckIds) ? data.connectedDeckIds : [],
        activeRound: typeof data.activeRound === 'number' ? data.activeRound : 1,
        preferredAccent:
          data.preferredAccent === 'uk'
            ? 'uk'
            : data.preferredAccent === 'us'
            ? 'us'
            : undefined,
        survivalBestStreak:
          typeof data.survivalBestStreak === 'number'
            ? Math.max(0, Math.floor(data.survivalBestStreak))
            : undefined,
        updatedAt: extractTimestampIso(data.updatedAt),
      });
    },
    () => {}
  );

  const unsubCustom = onSnapshot(
    query(collection(db, 'users', uid, 'customCards'), where('ownerId', '==', uid)),
    (snap) => {
      const items: Flashcard[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          term: String(data.term || ''),
          category: data.category,
          subtopic: data.subtopic,
          literal: String(data.literal || ''),
          phoneticUs: typeof data.phoneticUs === 'string' ? data.phoneticUs : undefined,
          phoneticUk: typeof data.phoneticUk === 'string' ? data.phoneticUk : undefined,
          ukNote: typeof data.ukNote === 'string' ? data.ukNote : undefined,
          colloquial: Array.isArray(data.colloquial) ? data.colloquial : [],
          exampleEn: String(data.exampleEn || ''),
          examplePt: String(data.examplePt || ''),
          exampleEn2: String(data.exampleEn2 || ''),
          examplePt2: String(data.examplePt2 || ''),
          tip: String(data.tip || ''),
          status: 'unseen',
          origin: 'custom',
          modified: true,
          updatedAt: extractTimestampMs(data.updatedAt),
        };
      });
      callbacks.onCustomCards(items);
    },
    () => {}
  );

  const unsubDecks = onSnapshot(
    query(collection(db, 'users', uid, 'decks'), where('ownerId', '==', uid)),
    (snap) => {
      const items: UserDeck[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          ownerId: String(data.ownerId || uid),
          name: String(data.name || 'Meu Baralho'),
          description: String(data.description || ''),
          colorTag: data.colorTag || 'sage',
          cardIds: Array.isArray(data.cardIds) ? data.cardIds : [],
          updatedAt: extractTimestampMs(data.updatedAt),
        };
      });
      callbacks.onDecks(items);
    },
    () => {}
  );

  const unsubProgress = onSnapshot(
    query(collection(db, 'users', uid, 'cardProgress'), where('ownerId', '==', uid)),
    (snap) => {
      const map: Record<string, CardProgressEntry> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const cid = String(data.cardId || d.id);
        map[cid] = {
          cardId: cid,
          masteryLevel: (data.masteryLevel as CardStatus) || 'unseen',
          roundMarked: typeof data.roundMarked === 'number' ? data.roundMarked : 1,
          updatedAt: extractTimestampIso(data.updatedAt),
        };
      });
      callbacks.onProgressMap(map);
    },
    () => {}
  );

  return () => {
    unsubWs();
    unsubCustom();
    unsubDecks();
    unsubProgress();
  };
}
