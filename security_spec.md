# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default-Deny Catch-All**: Every path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Authentication Gate**: All writes and private user reads require an authenticated user with `request.auth != null && request.auth.token.email_verified == true`.
3. **Zero PII Storage**: User workspace, progress, custom cards, decks, and admin records store zero PII (`email`, `phone`, `address` are forbidden in schema keys).
4. **Master Gate & Subcollection Ownership**:
   - Subcollection single-document writes and reads (`/users/{userId}/cardProgress/{cardId}`, `/users/{userId}/customCards/{cardId}`, `/users/{userId}/decks/{deckId}`) require `userId == request.auth.uid`, a valid parent `/users/{userId}` document via `exists()`, and `get(/databases/$(database)/documents/users/$(userId)).data.ownerId == request.auth.uid`.
   - Subcollection `list` operations never call `get()` or `exists()` (O(n) cost guard) and strictly enforce `userId == request.auth.uid && resource.data.ownerId == request.auth.uid`.
5. **Admin Privilege Verification**:
   - Only verified bootstrapped admin (`request.auth.token.email == 'igordesouzaar@gmail.com' && request.auth.token.email_verified == true`) or UIDs recorded in `/admins/{uid}` (`exists(/databases/$(database)/documents/admins/$(request.auth.uid))`) can create, update, or delete `/globalCards/{cardId}` or `/admins/{adminUid}`.
6. **Public/Shared Global Catalog Query Enforcer**:
   - Non-admin `get` and `list` on `/globalCards/{cardId}` strictly require `resource.data.published == true`. Unpublished drafts are invisible to non-admins.
7. **Strict Key Allowlists & Immutable Fields**:
   - `create` enforces `hasAll` + `hasOnly` on exact blueprint keys.
   - `update` wraps logic in `isValid[Entity](incoming())`, splits actions with explicit `affectedKeys().hasOnly(...)`, locks immutable fields (`id`, `cardId`, `ownerId`, `authorId`, `uid`, `grantedBy`, `createdAt`), and enforces `updatedAt == request.time`.
8. **Volumetric & Regex Guards**:
   - Every path ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128` chars).
   - Every string has explicit `.size()` bounds matching `firebase-blueprint.json`.
   - Every list has bounded `.size()` (`colloquial <= 8`, `selectedCardIds <= 20`, `connectedDeckIds <= 12`, `cardIds <= 200`).

---

## 2. The "Dirty Dozen" Payloads (Adversarial Test Cases)

1. **Payload 1 — Unverified Admin Email Spoof (`globalCards` create)**:
   `auth: { uid: "attacker1", email: "igordesouzaar@gmail.com", email_verified: false }` attempting to create `/globalCards/global_spoof` -> **PERMISSION_DENIED**.
2. **Payload 2 — Non-Admin Global Card Write (`globalCards` create)**:
   `auth: { uid: "student1", email: "student@example.com", email_verified: true }` attempting to create `/globalCards/global_hack` -> **PERMISSION_DENIED**.
3. **Payload 3 — Unpublished Global Card Scrape (`globalCards` get/list)**:
   Non-admin reading `/globalCards/draft_1` where `resource.data.published == false` -> **PERMISSION_DENIED**.
4. **Payload 4 — Self-Privilege Escalation (`admins` create)**:
   Verified regular user `student1` attempting to write `/admins/student1` with `{ uid: "student1", grantedBy: "student1", label: "Self admin", createdAt: request.time }` -> **PERMISSION_DENIED**.
5. **Payload 5 — Cross-User Workspace Read/Write (`users/{otherUid}`)**:
   `student1` attempting `get` or `update` on `/users/student2` -> **PERMISSION_DENIED**.
6. **Payload 6 — Shadow / Ghost Field Injection (`users/{uid}` update)**:
   `student1` updating `/users/student1` with valid fields plus `{ isAdmin: true }` -> **PERMISSION_DENIED** (`hasOnly` & `affectedKeys` rejection).
7. **Payload 7 — Orphaned Subcollection Write Without Parent Workspace (`users/{uid}/decks/{deckId}` create)**:
   `student1` creating `/users/student1/decks/deck_1` when `/users/student1` does not exist -> **PERMISSION_DENIED** (`exists()` Master Gate rejection).
8. **Payload 8 — Identity Spoofing in Subcollection (`users/{uid}/customCards/{cardId}` create)**:
   `student1` creating `/users/student1/customCards/custom_1` with `ownerId: "student2"` -> **PERMISSION_DENIED**.
9. **Payload 9 — Path ID Poisoning (`users/{uid}/decks/{badId}` create)**:
   `student1` creating a deck with `deckId` containing spaces/slashes or >128 chars -> **PERMISSION_DENIED** (`isValidId` rejection).
10. **Payload 10 — Denial-of-Wallet Oversized Array (`users/{uid}/decks/{deckId}` update)**:
    `student1` updating `cardIds` with 250 elements (exceeds 200 cap) -> **PERMISSION_DENIED**.
11. **Payload 11 — Client-Forged Timestamp (`users/{uid}/cardProgress/{cardId}` create)**:
    `student1` sending `createdAt` or `updatedAt` != `request.time` (e.g., past/future timestamp) -> **PERMISSION_DENIED**.
12. **Payload 12 — Immutable Field Mutation (`users/{uid}/customCards/{cardId}` update)**:
    `student1` attempting to mutate `createdAt` or `ownerId` during an update -> **PERMISSION_DENIED**.
