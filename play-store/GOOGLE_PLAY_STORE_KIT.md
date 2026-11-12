# 📦 Kit Oficial de Publicação — Google Play Store (`pt-BR`)

Este kit contém todos os textos prontos para copiar e colar no **Google Play Console**, declarações obrigatórias da **LGPD / Segurança de Dados**, classificação indicativa e artes de alta resolução geradas na pasta [`play-store/`](./).

---

## 1. Artefatos e Links Oficiais para Upload no Google Play Console

| Item no Google Play Console | Valor / Arquivo Oficial |
| :--- | :--- |
| **Pacote Assinado de Produção (`.aab`)** | [`https://github.com/EWM-School/EWM-School.github.io/releases/latest/download/EWM-Keep-Practicing.aab`](https://github.com/EWM-School/EWM-School.github.io/releases/latest/download/EWM-Keep-Practicing.aab) |
| **Application ID (`package_name`)** | `com.ewm.keeppracticing` |
| **Ícone de Alta Resolução (512 × 512 px, PNG 32 bits)** | `play-store/icon-512x512.png` |
| **Imagem de Recurso / Feature Graphic (1024 × 500 px)** | `play-store/feature-graphic-1024x500.png` |
| **URL da Política de Privacidade (LGPD)** | `https://ewm-school.github.io/privacy.html` |
| **URL de Exclusão de Conta (Web / In-App)** | `https://ewm-school.github.io/privacy.html#exclusao-de-dados` |
| **Verificação Digital Asset Links (`SHA-256`)** | `https://ewm-school.github.io/.well-known/assetlinks.json` |

---

## 2. Ficha Principal da Loja (`pt-BR` — Português do Brasil)

### Nome do aplicativo *(máx. 30 caracteres — possui 23 caracteres)*
```text
EWM · Keep practicing
```

### Breve descrição *(máx. 80 caracteres — possui 78 caracteres)*
```text
Pratique inglês real com áudio US e UK, flashcards, Modo Quiz e estudo offline
```

### Descrição completa *(máx. 4.000 caracteres)*
```text
Destrave sua escuta e fala com o inglês que os nativos realmente usam todos os dias!

O EWM · Keep practicing é o aplicativo oficial de prática contínua da Teacher Mariana (English With Mariana). Projetado para brasileiros que querem ir além da tradução literal, o app combina repetição ativa, pronúncia comparativa nos sotaques Americano (US) e Britânico (UK), Modo Quiz interativo e funcionamento 100% Offline-First.

✨ PRINCIPAIS RECURSOS:

• Expressões Reais do Dia a Dia:
Aprenda phrasal verbs, expressões coloquiais, vocabulário de viagens, trabalho, clima e conversas casuais com equivalências naturais em português e notas culturais.

• Áudio Nativo Duplo — Inglês Americano (US) e Britânico (UK):
Ouça cada expressão e duas frases completas de exemplo nos dois sotaques, compare US → UK em sequência e ative a velocidade didática lenta (0.7x) para treinar sua pronúncia em voz alta.

• Crie e Conecte Seus Próprios Baralhos:
Adicione palavras novas das suas aulas, monte baralhos temáticos personalizados e misture suas criações com o acervo oficial da Teacher Mariana.

• Modo Quiz Gamificado & Ranking Real:
Teste seus reflexos no Desafio Rápido com feedback explicativo imediato, acompanhe sua meta diária de revisão, dias ativos no mês e compartilhe suas conquistas nos Stories e WhatsApp.

• 100% Offline-First com Sincronização na Nuvem:
Estude no metrô, no avião ou sem sinal de internet! Todo o seu progresso é salvo instantaneamente no aparelho e sincronizado de forma automática quando a conexão retorna.

• Privacidade Total & Sem Anúncios:
Aplicativo leve, fluido (60fps), com Modo Claro e Modo Noturno, zero anúncios e total transparência com seus dados (LGPD).

Keep practicing todos os dias — 15 minutos de constância transformam sua fluência!
```

---

## 3. Categorização e Detalhes de Contato

- **Aplicativo ou Jogo:** `Aplicativo`
- **Categoria:** `Educação`
- **Gratuito ou Pago:** `Gratuito`
- **Contém anúncios?** `Não, meu app não contém anúncios`
- **E-mail de suporte na ficha da loja:** `igordesouzaar@gmail.com`
- **Website oficial:** `https://ewm-school.github.io/`

---

## 4. Respostas Prontas — Questionário "Segurança dos Dados" (Data Safety / LGPD)

1. **O app coleta ou compartilha algum dos tipos de dados obrigatórios do usuário?**
   - **Resposta:** `Sim` (apenas caso o aluno opte voluntariamente por criar conta de sincronização; nenhum dado é compartilhado com terceiros).
2. **Todos os dados do usuário coletados pelo app são criptografados em trânsito?**
   - **Resposta:** `Sim` (HTTPS / TLS via Firebase Auth & Cloud Firestore).
3. **Você oferece uma forma para os usuários solicitarem a exclusão dos próprios dados?**
   - **Resposta:** `Sim`
   - **URL de instruções / exclusão:** `https://ewm-school.github.io/privacy.html#exclusao-de-dados` (além do botão direto dentro do app em *Minha Conta → Excluir minha conta e dados na nuvem*).
4. **Tipos de dados selecionados no formulário:**
   - **Informações pessoais → Nome e Endereço de e-mail:** Coletados *apenas opcionalmente* para `Funcionalidade do app` e `Gerenciamento da conta` (login/sincronização). **Não compartilhados com terceiros.**
   - **Informações pessoais → IDs de usuário (`Firebase UID`):** Coletado *opcionalmente* para `Funcionalidade do app` e `Gerenciamento da conta`. **Não compartilhado.**
   - **Atividade no app → Outras ações no app / Conteúdo gerado no app (progresso de flashcards, baralhos e pontuação do ranking):** Coletados para `Funcionalidade do app`.
5. **Declaração de ID de Publicidade (`AD_ID`):**
   - **O app usa o ID de publicidade?** `Não`.

---

## 5. Acesso ao App (Instruções para o Revisor do Google Play)

- **Opção:** `Todas as funcionalidades ou parte delas estão disponíveis sem restrições de acesso` *(o modo Visitante Offline libera 100% dos flashcards, áudios US/UK, criação de baralhos e Modo Quiz imediatamente sem exigir login; o login Google ou E-mail é 100% opcional para backup na nuvem).*
- **Classificação Indicativa (IARC):** `Livre para todos os públicos` (conteúdo 100% educacional de ensino de idiomas, sem violência, sem compras não moderadas e sem chat aberto entre usuários).
