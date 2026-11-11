import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
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

export const BOOTSTRAPPED_ADMIN_EMAIL = 'igordesouzaar@gmail.com';

// Suppress benign internal RPC/WebChannel transport reconnection messages in sandboxed iframe environments
setLogLevel('silent');

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Mandatory boot connection check to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export { onAuthStateChanged, type User };

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
}

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

    // Migrate visitor custom cards, decks, and card mastery progress on first sign-in
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

  // Merge any visitor cards created while offline/unauthenticated into existing cloud account
  if (localSeed.customCards && localSeed.customCards.length > 0) {
    for (const cc of localSeed.customCards) {
      if (isValidFirestoreId(cc.id)) {
        void upsertCustomCard(uid, cc).catch(() => {});
      }
    }
  }
  if (localSeed.decks && localSeed.decks.length > 0) {
    for (const deck of localSeed.decks) {
      if (isValidFirestoreId(deck.id)) {
        void upsertUserDeck(uid, deck).catch(() => {});
      }
    }
  }

  return {
    createdNew: false,
    workspace: {
      studyScope: (existingData?.studyScope as StudyScope) || 'selected',
      selectedCardIds: Array.isArray(existingData?.selectedCardIds)
        ? (existingData.selectedCardIds as string[])
        : sanitizedWs.selectedCardIds,
      connectedDeckIds: Array.isArray(existingData?.connectedDeckIds)
        ? (existingData.connectedDeckIds as string[])
        : sanitizedWs.connectedDeckIds,
      activeRound:
        typeof existingData?.activeRound === 'number' ? existingData.activeRound : 1,
      preferredAccent:
        existingData?.preferredAccent === 'uk'
          ? 'uk'
          : existingData?.preferredAccent === 'us'
          ? 'us'
          : undefined,
    },
  };
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
  const clean = sanitizeWorkspaceFieldsForFirestore(settings);
  try {
    await updateDoc(doc(db, 'users', uid), {
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
  const chunkSize = 400; // Well below Firestore's 500 ops per batch limit

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
 * Real-time Listeners
 */
export function subscribeGlobalCards(onCards: (cards: Flashcard[]) => void): Unsubscribe {
  const path = 'globalCards';
  const q = query(collection(db, 'globalCards'), where('published', '==', true));
  return onSnapshot(
    q,
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
          origin: 'global',
          published: Boolean(data.published),
          archived: Boolean(data.archived),
          authorId: String(data.authorId || ''),
          modified: true,
        };
      });
      onCards(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
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
      handleFirestoreError(error, OperationType.LIST, path);
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
  const wsPath = `users/${uid}`;
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
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, wsPath)
  );

  const customPath = `users/${uid}/customCards`;
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
        };
      });
      callbacks.onCustomCards(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, customPath)
  );

  const decksPath = `users/${uid}/decks`;
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
        };
      });
      callbacks.onDecks(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, decksPath)
  );

  const progressPath = `users/${uid}/cardProgress`;
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
        };
      });
      callbacks.onProgressMap(map);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, progressPath)
  );

  return () => {
    unsubWs();
    unsubCustom();
    unsubDecks();
    unsubProgress();
  };
}
