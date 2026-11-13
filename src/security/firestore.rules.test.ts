import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();
const rulesText = fs
  .readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf8')
  .replace(/\r\n/g, '\n');
const blueprint = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'firebase-blueprint.json'), 'utf8')
);

const SERVER_NOW = 'SERVER_TIMESTAMP_NOW';
const BOOTSTRAPPED_ADMIN_EMAIL = 'igordesouzaar@gmail.com';
const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

interface SimAuth {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

interface SimDb {
  admins: Record<string, Record<string, unknown>>;
  globalCards: Record<string, Record<string, unknown>>;
  users: Record<string, Record<string, unknown>>;
  cardProgress: Record<string, Record<string, Record<string, unknown>>>;
  customCards: Record<string, Record<string, Record<string, unknown>>>;
  decks: Record<string, Record<string, Record<string, unknown>>>;
}

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

function isVerifiedUser(auth: SimAuth | null): auth is SimAuth {
  return Boolean(auth && auth.uid && auth.email_verified === true);
}

function isBootstrappedAdmin(auth: SimAuth | null): boolean {
  return isVerifiedUser(auth) && auth.email === BOOTSTRAPPED_ADMIN_EMAIL;
}

function isAdmin(auth: SimAuth | null, db: SimDb): boolean {
  return (
    isBootstrappedAdmin(auth) ||
    (isVerifiedUser(auth) && Boolean(db.admins[auth.uid]))
  );
}

function hasParentWorkspace(userId: string, auth: SimAuth | null, db: SimDb): boolean {
  if (!auth) return false;
  const ws = db.users[userId];
  return Boolean(ws && ws.ownerId === auth.uid);
}

function hasExactKeys(data: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(data);
  return actual.length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(data, k));
}

function hasRequiredAndAllowedKeys(
  data: Record<string, unknown>,
  required: string[],
  optional: string[] = []
): boolean {
  const allowedSet = new Set([...required, ...optional]);
  const actual = Object.keys(data);
  return (
    required.every((k) => Object.prototype.hasOwnProperty.call(data, k)) &&
    actual.every((k) => allowedSet.has(k))
  );
}

function hasValidOptionalCardPhonetics(data: Record<string, unknown>): boolean {
  if ('phoneticUs' in data && (typeof data.phoneticUs !== 'string' || data.phoneticUs.length > 160)) {
    return false;
  }
  if ('phoneticUk' in data && (typeof data.phoneticUk !== 'string' || data.phoneticUk.length > 160)) {
    return false;
  }
  if ('ukNote' in data && (typeof data.ukNote !== 'string' || data.ukNote.length > 240)) {
    return false;
  }
  return true;
}

function affectedKeysOnly(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>,
  allowed: string[]
): boolean {
  const allKeys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const k of allKeys) {
    if (JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])) {
      changed.push(k);
    }
  }
  return changed.every((k) => allowed.includes(k));
}

function isBoundedStringArray(
  arr: unknown,
  minItems: number,
  maxItems: number,
  maxItemLen: number
): boolean {
  if (!Array.isArray(arr)) return false;
  if (arr.length < minItems || arr.length > maxItems) return false;
  if (arr.length === 0) return true;
  return typeof arr[0] === 'string' && arr[0].length >= 1 && arr[0].length <= maxItemLen;
}

function evaluateRule(params: {
  collection: 'admins' | 'globalCards' | 'users' | 'cardProgress' | 'customCards' | 'decks';
  op: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: SimAuth | null;
  db: SimDb;
  userId?: string;
  docId: string;
  incomingData?: Record<string, unknown>;
  existingData?: Record<string, unknown>;
  requestTime?: string;
}): 'ALLOWED' | 'PERMISSION_DENIED' {
  const {
    collection,
    op,
    auth,
    db,
    userId = '',
    docId,
    incomingData = {},
    existingData = {},
    requestTime = SERVER_NOW,
  } = params;

  const allow = (cond: boolean) => (cond ? 'ALLOWED' : 'PERMISSION_DENIED');

  if (collection === 'admins') {
    if (op === 'create') {
      const valid =
        isVerifiedUser(auth) &&
        isValidId(docId) &&
        hasExactKeys(incomingData, ['uid', 'grantedBy', 'label', 'createdAt']) &&
        incomingData.uid === docId &&
        incomingData.grantedBy === auth.uid &&
        typeof incomingData.label === 'string' &&
        incomingData.label.length >= 1 &&
        incomingData.label.length <= 80 &&
        incomingData.createdAt === requestTime &&
        isAdmin(auth, db);
      return allow(valid);
    }
    return 'PERMISSION_DENIED';
  }

  if (collection === 'globalCards') {
    if (op === 'get') {
      return allow(isValidId(docId) && (existingData.published === true || isAdmin(auth, db)));
    }
    if (op === 'list') {
      return allow(
        existingData.published === true ||
          (isBootstrappedAdmin(auth) && typeof existingData.id === 'string')
      );
    }
    if (op === 'create') {
      const valid =
        isVerifiedUser(auth) &&
        isValidId(docId) &&
        hasRequiredAndAllowedKeys(
          incomingData,
          [
            'id', 'authorId', 'term', 'category', 'subtopic', 'literal',
            'colloquial', 'exampleEn', 'examplePt', 'exampleEn2', 'examplePt2',
            'tip', 'published', 'archived', 'createdAt', 'updatedAt',
          ],
          ['phoneticUs', 'phoneticUk', 'ukNote']
        ) &&
        hasValidOptionalCardPhonetics(incomingData) &&
        incomingData.id === docId &&
        incomingData.authorId === auth.uid &&
        incomingData.createdAt === requestTime &&
        incomingData.updatedAt === requestTime &&
        isAdmin(auth, db);
      return allow(valid);
    }
    return 'PERMISSION_DENIED';
  }

  if (collection === 'users') {
    if (op === 'get') {
      return allow(isVerifiedUser(auth) && isValidId(docId) && auth.uid === docId);
    }
    if (op === 'update') {
      const valid =
        isVerifiedUser(auth) &&
        isValidId(docId) &&
        hasRequiredAndAllowedKeys(
          incomingData,
          [
            'ownerId', 'studyScope', 'selectedCardIds', 'connectedDeckIds',
            'activeRound', 'createdAt', 'updatedAt',
          ],
          ['preferredAccent']
        ) &&
        (!('preferredAccent' in incomingData) ||
          incomingData.preferredAccent === 'us' ||
          incomingData.preferredAccent === 'uk') &&
        incomingData.ownerId === docId &&
        incomingData.ownerId === auth.uid &&
        incomingData.ownerId === existingData.ownerId &&
        incomingData.createdAt === existingData.createdAt &&
        incomingData.updatedAt === requestTime &&
        (affectedKeysOnly(incomingData, existingData, [
          'studyScope', 'selectedCardIds', 'connectedDeckIds',
          'activeRound', 'preferredAccent', 'updatedAt',
        ]) ||
          isAdmin(auth, db));
      return allow(valid);
    }
    return 'PERMISSION_DENIED';
  }

  if (collection === 'decks') {
    const validBlueprint =
      isValidId(userId) &&
      isValidId(docId) &&
      Boolean(auth) &&
      hasExactKeys(incomingData, [
        'id', 'ownerId', 'name', 'description', 'colorTag', 'cardIds', 'createdAt', 'updatedAt',
      ]) &&
      incomingData.id === docId &&
      incomingData.ownerId === userId &&
      incomingData.ownerId === auth?.uid &&
      typeof incomingData.name === 'string' &&
      incomingData.name.length >= 1 &&
      incomingData.name.length <= 80 &&
      isBoundedStringArray(incomingData.cardIds, 0, 200, 128);

    if (op === 'create') {
      return allow(
        isVerifiedUser(auth) &&
          validBlueprint &&
          incomingData.createdAt === requestTime &&
          incomingData.updatedAt === requestTime &&
          hasParentWorkspace(userId, auth, db)
      );
    }
    if (op === 'update') {
      return allow(
        isVerifiedUser(auth) &&
          validBlueprint &&
          incomingData.id === existingData.id &&
          incomingData.ownerId === existingData.ownerId &&
          incomingData.createdAt === existingData.createdAt &&
          incomingData.updatedAt === requestTime &&
          (affectedKeysOnly(incomingData, existingData, [
            'name', 'description', 'colorTag', 'cardIds', 'updatedAt',
          ]) ||
            isAdmin(auth, db)) &&
          hasParentWorkspace(userId, auth, db)
      );
    }
  }

  if (collection === 'customCards') {
    const validBlueprint =
      isValidId(userId) &&
      isValidId(docId) &&
      Boolean(auth) &&
      hasRequiredAndAllowedKeys(
        incomingData,
        [
          'id', 'ownerId', 'term', 'category', 'subtopic', 'literal',
          'colloquial', 'exampleEn', 'examplePt', 'exampleEn2', 'examplePt2',
          'tip', 'createdAt', 'updatedAt',
        ],
        ['phoneticUs', 'phoneticUk', 'ukNote']
      ) &&
      hasValidOptionalCardPhonetics(incomingData) &&
      incomingData.id === docId &&
      incomingData.ownerId === userId &&
      incomingData.ownerId === auth?.uid &&
      isBoundedStringArray(incomingData.colloquial, 1, 8, 90);

    if (op === 'create') {
      return allow(
        isVerifiedUser(auth) &&
          validBlueprint &&
          incomingData.createdAt === requestTime &&
          incomingData.updatedAt === requestTime &&
          hasParentWorkspace(userId, auth, db)
      );
    }
    if (op === 'update') {
      return allow(
        isVerifiedUser(auth) &&
          validBlueprint &&
          incomingData.id === existingData.id &&
          incomingData.ownerId === existingData.ownerId &&
          incomingData.createdAt === existingData.createdAt &&
          incomingData.updatedAt === requestTime &&
          affectedKeysOnly(incomingData, existingData, [
            'term', 'category', 'subtopic', 'literal',
            'phoneticUs', 'phoneticUk', 'ukNote', 'colloquial',
            'exampleEn', 'examplePt', 'exampleEn2', 'examplePt2', 'tip', 'updatedAt',
          ]) &&
          hasParentWorkspace(userId, auth, db)
      );
    }
  }

  if (collection === 'cardProgress') {
    if (op === 'create') {
      const valid =
        isVerifiedUser(auth) &&
        isValidId(userId) &&
        isValidId(docId) &&
        hasExactKeys(incomingData, [
          'cardId', 'ownerId', 'masteryLevel', 'roundMarked', 'createdAt', 'updatedAt',
        ]) &&
        incomingData.cardId === docId &&
        incomingData.ownerId === userId &&
        incomingData.ownerId === auth.uid &&
        incomingData.createdAt === requestTime &&
        incomingData.updatedAt === requestTime &&
        hasParentWorkspace(userId, auth, db);
      return allow(valid);
    }
  }

  return 'PERMISSION_DENIED';
}

test('firestore.rules structural audit: enforces all 8 Hardened Security Pillars & blueprint parity', () => {
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('match /{document=**} {\n      allow read, write: if false;\n    }'));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));

  // Every path in firebase-blueprint.json must be explicitly covered in firestore.rules
  const blueprintPaths = Object.keys(blueprint.firestore);
  assert.equal(blueprintPaths.length, 6);
  assert.ok(rulesText.includes('match /admins/{adminUid}'));
  assert.ok(rulesText.includes('match /globalCards/{cardId}'));
  assert.ok(rulesText.includes('match /users/{userId}'));
  assert.ok(rulesText.includes('match /cardProgress/{cardId}'));
  assert.ok(rulesText.includes('match /customCards/{cardId}'));
  assert.ok(rulesText.includes('match /decks/{deckId}'));

  // Ensure NO allow list block invokes exists() or get() (O(n) cost-explosion guard)
  const listBlocks = rulesText.match(/allow list:[^;]+;/g) || [];
  assert.ok(listBlocks.length >= 5);
  for (const block of listBlocks) {
    assert.ok(!block.includes('exists('), `Forbidden exists() inside allow list: ${block}`);
    assert.ok(!block.includes('get('), `Forbidden get() inside allow list: ${block}`);
    assert.ok(!block.includes('isAdmin('), `Forbidden DB-backed isAdmin() inside allow list: ${block}`);
    assert.ok(!block.includes('hasParentWorkspace('), `Forbidden get() helper inside allow list: ${block}`);
  }
});

test('Dirty Dozen Payloads: all 12 adversarial attacks return PERMISSION_DENIED', () => {
  const baseDb: SimDb = {
    admins: {},
    globalCards: {
      draft_1: { id: 'draft_1', published: false },
    },
    users: {
      student1: { ownerId: 'student1' },
      student2: { ownerId: 'student2' },
    },
    cardProgress: {},
    customCards: {},
    decks: {},
  };

  const student1: SimAuth = { uid: 'student1', email: 's1@example.com', email_verified: true };

  // 1. Unverified Admin Email Spoof
  assert.equal(
    evaluateRule({
      collection: 'globalCards',
      op: 'create',
      auth: { uid: 'attacker1', email: BOOTSTRAPPED_ADMIN_EMAIL, email_verified: false },
      db: baseDb,
      docId: 'global_spoof',
      incomingData: {
        id: 'global_spoof', authorId: 'attacker1', term: 'Test', category: 'Frases',
        subtopic: 'Casual', literal: 'Teste', colloquial: ['Teste'],
        exampleEn: 'Let us test this phrase today.', examplePt: 'Vamos testar.',
        exampleEn2: 'Another real sentence for testing.', examplePt2: 'Outra frase.',
        tip: '', published: true, archived: false, createdAt: SERVER_NOW, updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // 2. Non-Admin Global Card Write
  assert.equal(
    evaluateRule({
      collection: 'globalCards',
      op: 'create',
      auth: student1,
      db: baseDb,
      docId: 'global_hack',
      incomingData: {
        id: 'global_hack', authorId: 'student1', term: 'Hack', category: 'Frases',
        subtopic: 'Casual', literal: 'Hack', colloquial: ['Hack'],
        exampleEn: 'Let us test this phrase today.', examplePt: 'Teste.',
        exampleEn2: 'Another real sentence for testing.', examplePt2: 'Teste 2.',
        tip: '', published: true, archived: false, createdAt: SERVER_NOW, updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // 3. Unpublished Global Card Scrape
  assert.equal(
    evaluateRule({
      collection: 'globalCards',
      op: 'get',
      auth: student1,
      db: baseDb,
      docId: 'draft_1',
      existingData: baseDb.globalCards.draft_1,
    }),
    'PERMISSION_DENIED'
  );

  // 4. Self-Privilege Escalation on /admins
  assert.equal(
    evaluateRule({
      collection: 'admins',
      op: 'create',
      auth: student1,
      db: baseDb,
      docId: 'student1',
      incomingData: {
        uid: 'student1', grantedBy: 'student1', label: 'Self Admin', createdAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // 5. Cross-User Workspace Read
  assert.equal(
    evaluateRule({
      collection: 'users',
      op: 'get',
      auth: student1,
      db: baseDb,
      docId: 'student2',
    }),
    'PERMISSION_DENIED'
  );

  // 6. Shadow / Ghost Field Injection on Workspace Update
  assert.equal(
    evaluateRule({
      collection: 'users',
      op: 'update',
      auth: student1,
      db: baseDb,
      docId: 'student1',
      existingData: {
        ownerId: 'student1', studyScope: 'selected', selectedCardIds: ['c1'],
        connectedDeckIds: [], activeRound: 1, createdAt: 'OLD', updatedAt: 'OLD',
      },
      incomingData: {
        ownerId: 'student1', studyScope: 'selected', selectedCardIds: ['c1'],
        connectedDeckIds: [], activeRound: 1, createdAt: 'OLD', updatedAt: SERVER_NOW,
        isAdmin: true,
      },
    }),
    'PERMISSION_DENIED'
  );

  // 7. Orphaned Subcollection Write Without Parent Workspace
  assert.equal(
    evaluateRule({
      collection: 'decks',
      op: 'create',
      auth: { uid: 'ghostUser', email: 'g@example.com', email_verified: true },
      db: baseDb,
      userId: 'ghostUser',
      docId: 'deck_1',
      incomingData: {
        id: 'deck_1', ownerId: 'ghostUser', name: 'My Deck', description: '',
        colorTag: 'sage', cardIds: ['c1'], createdAt: SERVER_NOW, updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // 8. Identity Spoofing in Subcollection
  assert.equal(
    evaluateRule({
      collection: 'customCards',
      op: 'create',
      auth: student1,
      db: baseDb,
      userId: 'student1',
      docId: 'custom_1',
      incomingData: {
        id: 'custom_1', ownerId: 'student2', term: 'Wrap up', category: 'Phrasal Verbs',
        subtopic: 'Trabalho', literal: 'Encerrar', colloquial: ['Encerrar'],
        exampleEn: 'Let us wrap up this meeting.', examplePt: 'Vamos encerrar.',
        exampleEn2: 'We wrapped up early yesterday.', examplePt2: 'Encerramos cedo.',
        tip: '', createdAt: SERVER_NOW, updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // 9. Path ID Poisoning (spaces & illegal chars)
  assert.equal(
    evaluateRule({
      collection: 'decks',
      op: 'create',
      auth: student1,
      db: baseDb,
      userId: 'student1',
      docId: 'bad id/with/slashes',
      incomingData: {
        id: 'bad id/with/slashes', ownerId: 'student1', name: 'Deck', description: '',
        colorTag: 'sage', cardIds: [], createdAt: SERVER_NOW, updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // 10. Denial-of-Wallet Oversized Array (>200 cardIds in deck)
  const hugeIds = Array.from({ length: 205 }, (_, i) => `c_${i}`);
  assert.equal(
    evaluateRule({
      collection: 'decks',
      op: 'update',
      auth: student1,
      db: baseDb,
      userId: 'student1',
      docId: 'deck_1',
      existingData: {
        id: 'deck_1', ownerId: 'student1', name: 'Deck', description: '',
        colorTag: 'sage', cardIds: ['c1'], createdAt: 'OLD', updatedAt: 'OLD',
      },
      incomingData: {
        id: 'deck_1', ownerId: 'student1', name: 'Deck', description: '',
        colorTag: 'sage', cardIds: hugeIds, createdAt: 'OLD', updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // 11. Client-Forged Timestamp
  assert.equal(
    evaluateRule({
      collection: 'cardProgress',
      op: 'create',
      auth: student1,
      db: baseDb,
      userId: 'student1',
      docId: 'c1',
      incomingData: {
        cardId: 'c1', ownerId: 'student1', masteryLevel: 'mastered',
        roundMarked: 1, createdAt: 'FORGED_PAST_TIME', updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // 12. Immutable Field Mutation (mutating createdAt on customCard update)
  assert.equal(
    evaluateRule({
      collection: 'customCards',
      op: 'update',
      auth: student1,
      db: baseDb,
      userId: 'student1',
      docId: 'custom_1',
      existingData: {
        id: 'custom_1', ownerId: 'student1', term: 'Wrap up', category: 'Phrasal Verbs',
        subtopic: 'Trabalho', literal: 'Encerrar', colloquial: ['Encerrar'],
        exampleEn: 'Let us wrap up this meeting.', examplePt: 'Vamos encerrar.',
        exampleEn2: 'We wrapped up early yesterday.', examplePt2: 'Encerramos cedo.',
        tip: '', createdAt: 'ORIGINAL_TIME', updatedAt: 'ORIGINAL_TIME',
      },
      incomingData: {
        id: 'custom_1', ownerId: 'student1', term: 'Wrap up', category: 'Phrasal Verbs',
        subtopic: 'Trabalho', literal: 'Encerrar', colloquial: ['Encerrar'],
        exampleEn: 'Let us wrap up this meeting.', examplePt: 'Vamos encerrar.',
        exampleEn2: 'We wrapped up early yesterday.', examplePt2: 'Encerramos cedo.',
        tip: 'Updated tip', createdAt: 'MUTATED_TIME', updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );
});

test('US & UK Phonetic Package & Preferred Accent rules: allows valid US/UK payloads and blocks value poisoning', () => {
  const baseDb: SimDb = {
    admins: {},
    globalCards: {},
    users: {
      student1: { ownerId: 'student1' },
    },
    cardProgress: {},
    customCards: {},
    decks: {},
  };
  const student1: SimAuth = { uid: 'student1', email: 's1@example.com', email_verified: true };

  assert.ok(rulesText.includes('hasValidOptionalCardPhonetics'));
  assert.ok(rulesText.includes("data.preferredAccent in ['us', 'uk']"));

  // Valid UK preferredAccent update
  assert.equal(
    evaluateRule({
      collection: 'users',
      op: 'update',
      auth: student1,
      db: baseDb,
      docId: 'student1',
      existingData: {
        ownerId: 'student1', studyScope: 'selected', selectedCardIds: ['c1'],
        connectedDeckIds: [], activeRound: 1, createdAt: 'OLD', updatedAt: 'OLD',
      },
      incomingData: {
        ownerId: 'student1', studyScope: 'selected', selectedCardIds: ['c1'],
        connectedDeckIds: [], activeRound: 1, preferredAccent: 'uk',
        createdAt: 'OLD', updatedAt: SERVER_NOW,
      },
    }),
    'ALLOWED'
  );

  // Value Poisoning: Invalid accent enum ('pt-BR') is rejected
  assert.equal(
    evaluateRule({
      collection: 'users',
      op: 'update',
      auth: student1,
      db: baseDb,
      docId: 'student1',
      existingData: {
        ownerId: 'student1', studyScope: 'selected', selectedCardIds: ['c1'],
        connectedDeckIds: [], activeRound: 1, createdAt: 'OLD', updatedAt: 'OLD',
      },
      incomingData: {
        ownerId: 'student1', studyScope: 'selected', selectedCardIds: ['c1'],
        connectedDeckIds: [], activeRound: 1, preferredAccent: 'pt-BR',
        createdAt: 'OLD', updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );

  // Valid custom card with both phoneticUs and phoneticUk
  assert.equal(
    evaluateRule({
      collection: 'customCards',
      op: 'create',
      auth: student1,
      db: baseDb,
      userId: 'student1',
      docId: 'custom_uk_1',
      incomingData: {
        id: 'custom_uk_1', ownerId: 'student1', term: 'Can we reschedule?',
        category: 'Frases', subtopic: 'Trabalho', literal: 'Podemos remarcar?',
        phoneticUs: '/kén uí ri-SKÉ-djul/',
        phoneticUk: '/kén uí ri-XÉ-diul/',
        ukNote: 'Em UK pronuncia-se /ri-XÉ-diul/.',
        colloquial: ['Tem como remarcar?'],
        exampleEn: 'Can we reschedule our call for tomorrow?',
        examplePt: 'Podemos remarcar nossa ligação para amanhã?',
        exampleEn2: 'Let us reschedule if you are busy today.',
        examplePt2: 'Vamos remarcar se você estiver ocupado hoje.',
        tip: '', createdAt: SERVER_NOW, updatedAt: SERVER_NOW,
      },
    }),
    'ALLOWED'
  );

  // Value Poisoning: Oversized phoneticUk (>160 chars) is rejected
  assert.equal(
    evaluateRule({
      collection: 'customCards',
      op: 'create',
      auth: student1,
      db: baseDb,
      userId: 'student1',
      docId: 'custom_poison',
      incomingData: {
        id: 'custom_poison', ownerId: 'student1', term: 'Wrap up',
        category: 'Phrasal Verbs', subtopic: 'Trabalho', literal: 'Encerrar',
        phoneticUs: '/rép ÂP/',
        phoneticUk: 'x'.repeat(200),
        colloquial: ['Encerrar'],
        exampleEn: 'Let us wrap up this meeting now.',
        examplePt: 'Vamos encerrar.',
        exampleEn2: 'We wrapped up early yesterday.',
        examplePt2: 'Encerramos cedo.',
        tip: '', createdAt: SERVER_NOW, updatedAt: SERVER_NOW,
      },
    }),
    'PERMISSION_DENIED'
  );
});
