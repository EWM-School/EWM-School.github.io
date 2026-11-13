# Diretrizes Permanentes do Workspace — EWM · Keep practicing

## 1. Autorização Permanente de Automação Contínua (DevOps & Full-Stack)
O usuário concedeu autorização permanente e integral neste projeto para executar de forma 100% autônoma e sem interrupções desnecessárias:
- Comandos de terminal, instalação de pacotes (`npm install --legacy-peer-deps`), lint (`npm run lint`), compilação (`npm run build`) e sincronização híbrida (`npm run cap:copy` / `npm run cap:sync`).
- Operações completas de versionamento Git na branch ativa de desenvolvimento (`feat/ewm-v2`), mantendo a branch `main` protegida para releases de produção quando explicitamente solicitado.
- Automações de CI/CD, GitHub Pages, GitHub Actions, Secrets e Releases via GitHub CLI (`gh`).

> **Regra de Segurança Inegociável:** Nunca versione arquivos sensíveis (`.env`, `.env.local`, chaves privadas `.keystore`/`.jks` ou `node_modules/` e `dist/`). Credenciais de assinatura devem residir exclusivamente em GitHub Actions Secrets, e o `.env` deve permanecer 100% ignorado pelo `.gitignore`.

## 2. Ponte Automática Casa ⇄ Trabalho (Regra Obrigatória de Auto-Push Pós-Entrega)
O desenvolvimento alterna diariamente entre os computadores de **Casa** e **Trabalho**:
1. **Na inicialização (`npm run dev`):** O script `scripts/auto-sync-pull.mjs` (`predev`) sincroniza automaticamente o workspace via `git pull --rebase --autostash origin feat/ewm-v2` (com tolerância total a modo offline).
2. **Na conclusão de qualquer entrega:** Ao finalizar e validar qualquer tarefa, correção ou camada (`npm run lint` + `npm run build` limpos), você **DEVE automaticamente**:
   - Confirmar que `.env` permanece fora do Git (`git check-ignore .env`);
   - Criar um commit semântico claro (`git add` seletivo/seguro + `git commit -m "..."`);
   - Executar `git push origin feat/ewm-v2` imediatamente para que o outro computador já receba o código pronto ao iniciar.

## 3. Postura Proativa Obrigatória ao Final de TODA Resposta
Ao concluir **QUALQUER** tarefa, correção, análise ou implementação neste workspace daqui para frente, você **DEVE** obrigatoriamente:
1. Mapear proativamente as próximas melhorias técnicas de alto impacto, otimizações de performance (60fps / Offline-First / Mobile / Web), segurança ou automações de produto/DevOps aplicáveis ao estado atual do projeto.
2. Encerrar sua resposta com uma seção clara exatamente intitulada:

`### 🚀 Próximas Automações Sugeridas (Deseja que eu execute?)`

3. Listar opções numeradas (`1.`, `2.`, `3.`...) objetivas, de alto valor prático e prontas para execução imediata, de modo que o usuário precise apenas responder **"Sim"**, **"Aceito"** ou digitar o **número escolhido** (ex.: `"1"`, `"2 e 3"`), sem nunca precisar escrever comandos técnicos.
