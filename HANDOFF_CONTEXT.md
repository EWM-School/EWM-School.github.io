# EWM · Keep practicing — Handoff & Contexto Completo de Arquitetura

> Documento oficial de continuidade entre computadores (Trabalho ↔ Casa) e sessões do **Google Antigravity**.  
> Basta clonar este repositório no novo computador e abrir a pasta no Antigravity para continuar de onde parou com 100% do contexto preservado.

---

## 1. Endereços Oficiais & Identidade Institucional

| Recurso | Endereço Oficial |
| :--- | :--- |
| **Organização GitHub** | `https://github.com/EWM-School` |
| **Repositório Oficial (`main`)** | `https://github.com/EWM-School/EWM-School.github.io` |
| **Aplicação Web / PWA (Raiz Limpa)** | `https://ewm-school.github.io/` |
| **Política de Privacidade (LGPD)** | `https://ewm-school.github.io/privacy.html` (e `/privacidade/`) |
| **Android App Links (`assetlinks.json`)** | `https://ewm-school.github.io/.well-known/assetlinks.json` |
| **Download Direto APK (Android)** | `https://github.com/EWM-School/EWM-School.github.io/releases/latest/download/EWM-Keep-Practicing.apk` |
| **Download Direto AAB (Google Play)** | `https://github.com/EWM-School/EWM-School.github.io/releases/latest/download/EWM-Keep-Practicing.aab` |
| **Application ID (Android / iOS)** | `com.ewm.keeppracticing` |

---

## 2. Ponte Automática Casa ⇄ Trabalho & Quick Start (`feat/ewm-v2`)

A arquitetura de branches separa estritamente **desenvolvimento contínuo diário** de **produção pública**:
- **`feat/ewm-v2` (Branch Ativa de Desenvolvimento Casa ⇄ Trabalho):** Todas as entregas diárias, evoluções da v2 (Camadas 1, 2, 3+) e testes são sincronizados automaticamente aqui sem disparar deploy acidental em produção.
- **`main` (Branch Protegida de Produção):** Recebe apenas merges validados para publicação imediata no GitHub Pages + geração de APK/AAB via GitHub Actions.

### Setup Inicial em um Novo Computador
No novo computador (com **Git**, **Node.js LTS** e **GitHub CLI `gh`** autenticados), execute:

```bash
gh auth status || gh auth login --web -p https
gh auth setup-git
git clone -b feat/ewm-v2 https://github.com/EWM-School/EWM-School.github.io.git
cd EWM-School.github.io
npm install --legacy-peer-deps
```
*(Copie apenas o seu arquivo local `.env` contendo `GEMINI_API_KEY` para a raiz do projeto — o `.env` permanece 100% ignorado pelo `.gitignore` e nunca sobe para o GitHub).*

### Sincronização Diária Automática (Zero Atrito)
1. **Auto-Pull Inteligente ao Iniciar (`npm run dev`):**
   O hook `predev` executa automaticamente `node scripts/auto-sync-pull.mjs` antes de subir o servidor (`tsx server.ts`):
   - Checa conectividade com o GitHub (timeout rápido de 3.5s);
   - Protege qualquer alteração local não salva com `--autostash` e executa `git pull --rebase --autostash origin feat/ewm-v2`;
   - Se estiver sem internet (modo offline), exibe apenas um aviso discreto no terminal e inicia o servidor local normalmente sem travar.
2. **Auto-Push Obrigatório Pós-Entrega (Regra Permanente do Agente):**
   Ao concluir e validar qualquer tarefa ou camada (`npm run lint` + `npm run build` limpos), o agente **DEVE obrigatoriamente** criar um commit semântico e executar `git push origin feat/ewm-v2` (mantendo `.env` sempre fora do Git), deixando tudo imediatamente disponível para o outro computador.

### Comandos Principais do Projeto
- **Rodar servidor local de desenvolvimento (com Auto-Pull integrado):**
  ```bash
  npm run dev
  ```
- **Validar tipagem estrita TypeScript (`tsc --noEmit`):**
  ```bash
  npm run lint
  ```
- **Gerar bundle Web/PWA otimizado (`dist/`):**
  ```bash
  npm run build
  ```
- **Sincronizar bundle Web + plugins nativos com Android e iOS (`android/` e `ios/`):**
  ```bash
  npm run cap:sync
  ```
- **Promover `feat/ewm-v2` para Produção (`main` → Web + APK + AAB via CI/CD) SOMENTE quando autorizado:**
  ```bash
  git checkout main && git pull --rebase origin main
  git merge feat/ewm-v2 && git push origin main
  git checkout feat/ewm-v2
  ```
  *(Ao fazer `push` na `main`, o GitHub Actions incrementa automaticamente a versão semântica e publica tanto no GitHub Pages quanto no GitHub Releases).*

---

## 3. Arquitetura Técnica Implementada

1. **Stack Híbrida Offline-First (60fps):**
   - **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (`base: '/'`).
   - **Mobile Nativo (Capacitor 8):** `@capacitor/core`, `@capacitor/app` (com listener de Deep Links `appUrlOpen`), `@capacitor/network`, `@capacitor-community/text-to-speech` (vozes nativas `en-US` e `en-GB`), `@capacitor/haptics`, `@capacitor/local-notifications`, `@capacitor/preferences` e `@capacitor-firebase/authentication`.
   - **Persistência Local Instantânea + `SyncQueue`:** `idb` (`IndexedDB` `ewm_offline_db`) + `@capacitor/preferences` com resolução *Last-Write-Wins (LWW)* e sincronização em segundo plano (`src/services/sync/offlineStorage.ts` e `src/services/sync/syncEngine.ts`).

2. **Sistema de Ranking Mensal 100% Real (`Zero Mocks`):**
   - Nenhum aluno fictício no código. Quando ainda não há pontuações no mês vigente, o atalho de capa (`src/components/TopStudentsCoverPodium.tsx`) e o modal (`src/components/MonthlyRankingModal.tsx`) exibem o *Empty State* elegante *"Seja o primeiro aluno no Ranking!"*.
   - Pontuação calculada exclusivamente com progresso legítimo do aluno (`cards dominados × 20 + em revisão × 8 + revisados no mês × 10 + acertos no Quiz × 15 + dias ativos × 50 + minutos × 2`), deduplicada por `uid` e sincronizada via `LEADERBOARD_SCORE_UPSERT` na coleção `/leaderboard/{uid}` do Firestore.

3. **UX Mobile-First, Deep Links & Compartilhamento Social:**
   - **Flashcards Mobile Compactos (-20% de altura mínima):** Cabem inteiros na tela sem rolagem vertical desnecessária (`min-h-[288px] sm:min-h-[415px]`), com barra horizontal deslizável de categorias e contraste refinado para Modo Claro e Modo Escuro.
   - **Atalho de Ranking na Capa Sem Corte de Viewport:** Painel expansível ancorado com segurança dentro de `100dvh`/`100vw` até em telas de `360px`.
   - **Gerador Nativo de Stories & WhatsApp (`src/utils/shareCardGenerator.ts` + `src/components/ShareStoryModal.tsx`):** Renderiza imagens PNG `1080×1920` (Stories 9:16) e `1080×1350` (WhatsApp/Feed 4:5) em `<canvas>` com identidade visual EWM + QR Code vetorial apontando para `https://ewm-school.github.io/`.
   - **Modal Inteligente de Download + Auto-Update (`src/components/AppDownloadModal.tsx` + `src/services/update/versionCheckService.ts`):** QR Code 100% local (`qrcode`), download direto do APK assinado, guia iOS/PWA e verificação periódica da última Release no GitHub.

4. **CI/CD com Auto-Versionamento Semântico & Tripla Proteção Anti-Loop:**
   - Script `scripts/ci-bump-version.mjs` sincroniza `package.json` (`1.2.1`, `1.2.2`...) e `android/app/build.gradle` (`versionCode` incremental + `versionName`).
   - Workflows `.github/workflows/deploy.yml` e `.github/workflows/build-android.yml` contam com tripla trava contra loop infinito:
     1. Filtro `!contains(github.event.head_commit.message, '[skip ci]') && !contains(github.event.head_commit.message, '[ci skip]')`
     2. Filtro `github.actor != 'github-actions[bot]'`
     3. Commit de bump autenticado via `GITHUB_TOKEN` padrão do Actions (que por design do GitHub não dispara novos eventos `push`).

---

## 4. Assinatura Android Oficial & Segredos no GitHub

A Keystore de produção já está configurada nos **GitHub Actions Secrets** do repositório `EWM-School/EWM-School.github.io` (nenhum arquivo `.jks`/`.keystore` fica salvo no Git):
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS` (`ewm-release`)
- `ANDROID_KEY_PASSWORD`

### Impressões Digitais Oficiais do Certificado de Produção
- **Package Name:** `com.ewm.keeppracticing`
- **SHA-1:** `27:56:41:30:EE:EE:53:67:A5:F3:2D:E2:A9:FE:A5:B4:76:6C:B2:AE`
- **SHA-256:** `40:17:DD:6B:AA:01:D6:B4:0A:72:A3:8C:95:E8:F8:8F:82:8A:99:27:4C:86:15:05:55:47:AA:6D:17:1A:A0:8A`

*(A impressão `SHA-256` acima já está publicada em `public/.well-known/assetlinks.json` para verificação automática de Android App Links).*

---

## 5. Checklist Rápido do Firebase Console (Caso Ainda Não Tenha Colado)

Projeto Firebase conectado em `firebase-applet-config.json`: **`gen-lang-client-0676218206`** (Banco Firestore: `ai-studio-fluentcards-6c9c1d19-cf9e-4bed-b170-ce1b5a66ec32`).

1. **Domínio Autorizado para Login Google:**  
   Em *Firebase Console → Authentication → Settings → Authorized domains*, garanta que **`ewm-school.github.io`** esteja na lista.
2. **Login Google Nativo no APK Android:**  
   Em *Firebase Console → Project Settings → Your apps → Android app (`com.ewm.keeppracticing`)*, cadastre os certificados **`SHA-1`** e **`SHA-256`** acima e baixe o `google-services.json` em `android/app/google-services.json` quando desejar habilitar OAuth nativo fora do navegador.
3. **Regras de Segurança do Ranking Global (`firestore.rules`):**  
   Em *Firebase Console → Firestore Database → Rules*, cole o conteúdo atualizado do arquivo `firestore.rules` da raiz deste repositório (que inclui a regra segura da coleção `/leaderboard/{userId}`) e clique em **Publish**.

---

## 6. Kit Google Play Store Pronto no Repositório

Todos os textos, metadados, classificação indicativa, questionário *Data Safety* e imagens oficiais (`512×512` e `1024×500`) estão versionados na pasta `play-store/`:
- `play-store/GOOGLE_PLAY_STORE_KIT.md`
- `play-store/icon-512x512.png`
- `play-store/feature-graphic-1024x500.png`

---

## 7. Diretrizes Persistentes para o Agente IA (Antigravity)

As regras permanentes de atuação proativa e sincronização automática Casa ⇄ Trabalho estão versionadas em:
- `AGENTS.md`
- `.agent/rules/proactive-automation.md`
- `.agents/rules/proactive-automation.md`

**Regra Permanente de Auto-Push Pós-Entrega (`feat/ewm-v2`):**
Ao concluir e validar qualquer tarefa, correção ou camada neste projeto (`npm run lint` + `npm run build` 100% limpos), o agente **DEVE automaticamente**:
1. Verificar que `.env` e artefatos sensíveis permanecem fora do stage (`git status`);
2. Criar um commit semântico descritivo (`feat(...)`, `fix(...)`, `chore(...)`);
3. Executar `git push origin feat/ewm-v2` (mantendo `main` protegida para produção até ordem explícita de release), garantindo que o computador de Casa e o computador do Trabalho recebam tudo pronto automaticamente via `npm run dev` (`scripts/auto-sync-pull.mjs`).

Ao abrir este repositório em qualquer computador no Antigravity, o agente já tem autorização de automação contínua e sempre encerrará cada entrega com a seção **"🚀 Próximas Automações Sugeridas (Deseja que eu execute?)"**.
