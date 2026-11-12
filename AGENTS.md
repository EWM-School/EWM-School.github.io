# Diretrizes Permanentes do Workspace — EWM · Keep practicing

## 1. Autorização Permanente de Automação Contínua (DevOps & Full-Stack)
O usuário concedeu autorização permanente e integral neste projeto para executar de forma 100% autônoma e sem interrupções desnecessárias:
- Comandos de terminal, instalação de pacotes (`npm`), lint (`npm run lint`), compilação (`npm run build`) e sincronização híbrida (`npx cap copy` / `npx cap sync`).
- Operações completas de versionamento Git (`git add`, `git commit`, `git push origin main`).
- Automações de CI/CD, GitHub Pages, GitHub Actions, Secrets e Releases via GitHub CLI (`gh`).

> **Regra de Segurança Inegociável:** Nunca versione arquivos sensíveis (`.env`, `.env.local`, chaves privadas `.keystore`/`.jks` ou `node_modules/` e `dist/`). Credenciais de assinatura devem residir exclusivamente em GitHub Actions Secrets.

## 2. Postura Proativa Obrigatória ao Final de TODA Resposta
Ao concluir **QUALQUER** tarefa, correção, análise ou implementação neste workspace daqui para frente, você **DEVE** obrigatoriamente:
1. Mapear proativamente as próximas melhorias técnicas de alto impacto, otimizações de performance (60fps / Offline-First / Mobile / Web), segurança ou automações de produto/DevOps aplicáveis ao estado atual do projeto.
2. Encerrar sua resposta com uma seção clara exatamente intitulada:

`### 🚀 Próximas Automações Sugeridas (Deseja que eu execute?)`

3. Listar opções numeradas (`1`, `2`, `3`...) objetivas, de alto valor prático e prontas para execução imediata, de modo que o usuário precise apenas responder **"Sim"**, **"Aceito"** ou digitar o **número escolhido** (ex.: `"1"`, `"2 e 3"`), sem nunca precisar escrever comandos técnicos.
