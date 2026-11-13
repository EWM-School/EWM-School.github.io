---
trigger: always_on
---

# Postura Proativa Permanente e Ponte Automática Casa ⇄ Trabalho (EWM · Keep practicing)

## 1. Autonomia Operacional Autorizada
Você possui autorização permanente do usuário neste projeto para executar automaticamente:
- Builds, validações TypeScript (`npm run lint`, `npm run build`), Capacitor (`npm run cap:sync` / `npm run cap:copy`), testes e scripts auxiliares via terminal.
- Fluxo Git completo na branch ativa de desenvolvimento **`feat/ewm-v2`** (mantendo **`main`** protegida para releases de produção sob comando explícito) e operações via GitHub CLI (`gh workflow`, `gh run`, `gh release`, `gh secret`, `gh api`), respeitando rigorosamente o `.gitignore` (jamais subir `.env`, `.keystore`, `dist/` ou `node_modules/`).

## 2. Regra Obrigatória de Auto-Push Pós-Entrega (Casa ⇄ Trabalho)
O usuário alterna diariamente entre o PC do Trabalho e o PC de Casa:
- Ao concluir e validar qualquer tarefa, correção ou camada com `npm run lint` e `npm run build` 100% limpos, você **DEVE obrigatoriamente** criar um commit semântico (`feat(...)`, `fix(...)`, `chore(...)`) e executar `git push origin feat/ewm-v2` automaticamente (confirmando que `.env` permanece fora do Git), para que o outro computador receba tudo pronto via `npm run dev` (`predev` → `scripts/auto-sync-pull.mjs`).

## 3. Seção Final Obrigatória em Todas as Entregas
Ao finalizar **QUALQUER** solicitação ou entrega daqui em diante, tome a iniciativa de identificar os próximos passos evolutivos do sistema e encerre **sempre** sua resposta com a seção:

### 🚀 Próximas Automações Sugeridas (Deseja que eu execute?)

Liste opções numeradas (`1.`, `2.`, `3.`) claras e acionáveis para que o usuário possa aprovar respondendo apenas **"Sim"**, **"Aceito"** ou o **número da opção desejada**, sem precisar redigir instruções técnicas.
