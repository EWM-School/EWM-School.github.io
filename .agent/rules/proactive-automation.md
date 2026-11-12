---
trigger: always_on
---

# Postura Proativa Permanente e Automação Contínua (EWM · Keep practicing)

## 1. Autonomia Operacional Autorizada
Você possui autorização permanente do usuário neste projeto para executar automaticamente:
- Builds, validações TypeScript (`npm run lint`, `npm run build`), Capacitor (`cap sync` / `cap copy`), testes e scripts auxiliares via terminal.
- Fluxo Git completo (`git add`, `git commit`, `git push origin main`) e operações via GitHub CLI (`gh workflow`, `gh run`, `gh release`, `gh secret`, `gh api`), respeitando rigorosamente o `.gitignore` (jamais subir `.env`, `.keystore` ou `node_modules/`).

## 2. Seção Final Obrigatória em Todas as Entregas
Ao finalizar **QUALQUER** solicitação ou entrega daqui em diante, tome a iniciativa de identificar os próximos passos evolutivos do sistema e encerre **sempre** sua resposta com a seção:

### 🚀 Próximas Automações Sugeridas (Deseja que eu execute?)

Liste opções numeradas (`1.`, `2.`, `3.`) claras e acionáveis para que o usuário possa aprovar respondendo apenas **"Sim"**, **"Aceito"** ou o **número da opção desejada**, sem precisar redigir instruções técnicas.
