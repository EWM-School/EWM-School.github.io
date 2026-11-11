import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  auditEnglishGrammarAndCollocations,
  scoreTeacherSentenceCandidate,
  isGenericTemplateSentence,
} from './src/utils/grammarEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '100kb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Sliding-window In-Memory Rate Limiter (30 requests / min per IP)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateLimitMap.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  bucket.count++;
  return true;
}

// Clean up stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateLimitMap.entries()) {
    if (now > bucket.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000).unref();

function sanitizeUserInput(raw: unknown, maxLen = 140): string {
  if (!raw) return '';
  let s = String(raw);
  // Strip control characters and collapse whitespace to prevent prompt injection breakouts
  s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) {
    s = s.slice(0, maxLen).trim();
  }
  return s;
}

// Initialize GoogleGenAI client according to AI Studio guidelines:
// Always use User-Agent: 'aistudio-build' in httpOptions
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function naturalizePortuguese(text: string): string {
  if (!text) return '';
  let s = String(text)
    .replace(/^["“'→\s]+|["”']$/g, '')
    .trim();
  s = s
    .replace(/\bNós estávamos\b/gi, 'A gente estava')
    .replace(/\bNós fomos\b/gi, 'A gente foi')
    .replace(/\bNós temos\b/gi, 'A gente tem')
    .replace(/\bEu estou\b/gi, 'Estou')
    .replace(/\bpara o\b/gi, 'pro')
    .replace(/\bpara a\b/gi, 'pra');
  if (s && !/[.!?]$/.test(s)) s += '.';
  return s;
}

function cleanSentence(text: string): string {
  if (!text) return '';
  let s = String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/^["“']+|["”']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]["']?$/.test(s)) s += '.';
  return s;
}

// Robust JSON extraction from Gemini response (which may wrap in markdown blocks or text)
function extractJsonPayload<T = unknown>(rawText: string): T | null {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText.trim()) as T;
  } catch {
    // Try code fence block ```json ... ```
    const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim()) as T;
      } catch {
        // continue
      }
    }
    // Try first { ... } or [ ... ]
    const startObj = rawText.indexOf('{');
    const endObj = rawText.lastIndexOf('}');
    if (startObj !== -1 && endObj > startObj) {
      try {
        return JSON.parse(rawText.slice(startObj, endObj + 1)) as T;
      } catch {
        // continue
      }
    }
  }
  return null;
}

// -------------------------------------------------------------
// POST /api/gemini/lookup-card
// Performs deep Google-grounded search via gemini-3.8-flash with googleSearch tool
// Returns complete, audited card data with authentic translations and real native sentences
// -------------------------------------------------------------
app.post('/api/gemini/lookup-card', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      reason: 'RATE_LIMITED',
      error: 'Muitas consultas consecutivas. Aguarde um instante para continuar.',
    });
  }

  const { input, direction } = req.body || {};
  const query = sanitizeUserInput(input, 140);

  if (!query) {
    return res.status(400).json({ success: false, error: 'Termo de busca vazio ou inválido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({
      success: false,
      reason: 'NO_API_KEY',
      message: 'Chave Gemini não configurada. Ativando acervo local verificado.',
    });
  }

  try {
    const isPtToEn = direction === 'pt-to-en';

    const systemInstruction = `Você é o motor linguístico oficial do sistema de ensino "English With Mariana (EWM - Keep practicing)".
Seu papel é encontrar o uso autêntico falado por nativos em inglês americano e britânico, com rigor absoluto contra traduções robóticas ou moldes sintéticos.
Para cada termo ou expressão:
1. Identifique o equivalente nativo mais falado e natural.
2. Forneça traduções em português brasileiro coloquial (como as pessoas realmente falam no Brasil, sem erudição artificial).
3. Busque na web / base do Google duas frases reais e práticas usadas por nativos em contextos reais (trabalho, viagens, conversas diárias). NUNCA invente frases como "I have a book" ou moldes artificiais.
4. Traduza as duas frases para português brasileiro natural e fluido.
5. Forneça a transcrição fonética simplificada no padrão EWM para falantes de português (US e UK).
6. Classifique a categoria entre: "Dicas da Mari", "Palavras", "Frases", "Phrasal Verbs", "Outros".
7. Classifique o subtópico entre: "Viagens", "Clima", "Trabalho", "Lazer", "Casual", "Outros".`;

    const userPrompt = isPtToEn
      ? `Pesquise no Google e na base linguística nativa a melhor expressão/palavra em inglês para a ideia em português: "${query}".
Retorne estritamente um objeto JSON com a seguinte estrutura:
{
  "term": "Expressão em inglês em Title Case",
  "category": "Phrasal Verbs | Palavras | Frases | Dicas da Mari | Outros",
  "subtopic": "Casual | Trabalho | Viagens | Lazer | Clima | Outros",
  "literal": "Significado base ou sentido literal curto",
  "colloquial": ["Tradução coloquial 1", "Tradução coloquial 2", "Tradução coloquial 3"],
  "phoneticUs": "Transcrição fonética adaptada US (ex: /FÍ-guiur áut/)",
  "phoneticUk": "Transcrição fonética adaptada UK (ex: /FÍ-guiur áut/)",
  "ukNote": "Diferença ou curiosidade britânica relevante (ou vazio)",
  "exampleEn": "Frase real 1 falada por nativo",
  "examplePt": "Tradução natural 1 em português brasileiro",
  "exampleEn2": "Frase real 2 falada por nativo em contexto diferente",
  "examplePt2": "Tradução natural 2 em português brasileiro",
  "tip": "Dica prática da Teacher Mariana sobre como e quando usar a expressão"
}`
      : `Pesquise no Google e na base linguística nativa a expressão/palavra em inglês: "${query}".
Descubra como nativos americanos e britânicos realmente a usam no dia a dia, suas traduções coloquiais para o Brasil e 2 frases reais de exemplo.
Retorne estritamente um objeto JSON com a seguinte estrutura:
{
  "term": "Expressão em inglês em Title Case",
  "category": "Phrasal Verbs | Palavras | Frases | Dicas da Mari | Outros",
  "subtopic": "Casual | Trabalho | Viagens | Lazer | Clima | Outros",
  "literal": "Significado base ou sentido literal curto",
  "colloquial": ["Tradução coloquial 1", "Tradução coloquial 2", "Tradução coloquial 3"],
  "phoneticUs": "Transcrição fonética adaptada US (ex: /rép ÂP/)",
  "phoneticUk": "Transcrição fonética adaptada UK (ex: /rép ÂP/)",
  "ukNote": "Diferença ou curiosidade britânica relevante (ou vazio)",
  "exampleEn": "Frase real 1 falada por nativo",
  "examplePt": "Tradução natural 1 em português brasileiro",
  "exampleEn2": "Frase real 2 falada por nativo em contexto diferente",
  "examplePt2": "Tradução natural 2 em português brasileiro",
  "tip": "Dica prática da Teacher Mariana sobre como e quando usar a expressão"
}`;

    // Call gemini-3.8-flash with googleSearch tool as required
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = response.text || '';
    const parsed = extractJsonPayload<Record<string, unknown>>(rawText);

    if (!parsed || !parsed.term) {
      return res.json({
        success: false,
        reason: 'PARSE_FAILED',
        message: 'Resposta da IA não pôde ser estruturada. Usando base local auditada.',
      });
    }

    const term = String(parsed.term || query).trim();
    let ex1En = cleanSentence(String(parsed.exampleEn || ''));
    let ex1Pt = naturalizePortuguese(String(parsed.examplePt || ''));
    let ex2En = cleanSentence(String(parsed.exampleEn2 || ''));
    let ex2Pt = naturalizePortuguese(String(parsed.examplePt2 || ''));

    // Check sentence 1 grammar and templates
    const audit1 = auditEnglishGrammarAndCollocations(ex1En, term);
    if (!audit1.valid || isGenericTemplateSentence(ex1En)) {
      ex1En = '';
      ex1Pt = '';
    }

    // Check sentence 2 grammar and templates
    if (ex2En) {
      const audit2 = auditEnglishGrammarAndCollocations(ex2En, term);
      if (!audit2.valid || isGenericTemplateSentence(ex2En)) {
        ex2En = '';
        ex2Pt = '';
      }
    }

    const colloquialRaw = Array.isArray(parsed.colloquial)
      ? (parsed.colloquial as unknown[]).map((c) => String(c).trim()).filter(Boolean)
      : [String(parsed.literal || '')].filter(Boolean);

    // Extract grounding web URLs if available
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingSources = groundingChunks
      .map((c: { web?: { uri?: string; title?: string } }) => ({
        uri: c.web?.uri || '',
        title: c.web?.title || '',
      }))
      .filter((s: { uri: string }) => Boolean(s.uri));

    return res.json({
      success: true,
      source: 'gemini-google-search',
      card: {
        term,
        category: String(parsed.category || 'Frases'),
        subtopic: String(parsed.subtopic || 'Casual'),
        literal: String(parsed.literal || colloquialRaw[0] || term),
        colloquial: colloquialRaw.length > 0 ? colloquialRaw : [term],
        phoneticUs: String(parsed.phoneticUs || ''),
        phoneticUk: String(parsed.phoneticUk || ''),
        ukNote: String(parsed.ukNote || ''),
        exampleEn: ex1En,
        examplePt: ex1Pt,
        exampleEn2: ex2En,
        examplePt2: ex2Pt,
        tip: String(parsed.tip || ''),
      },
      groundingSources,
    });
  } catch (err) {
    console.error('Error in /api/gemini/lookup-card:', err);
    return res.json({
      success: false,
      reason: 'GEMINI_ERROR',
      error: 'Consulta temporariamente indisponível. Ativando acervo local verificado.',
    });
  }
});

// -------------------------------------------------------------
// POST /api/gemini/generate-sentence
// Generates a NEW, fresh, authentic example sentence using Google Search data
// specifically for the requested term, distinct from existing examples
// -------------------------------------------------------------
app.post('/api/gemini/generate-sentence', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      reason: 'RATE_LIMITED',
      error: 'Muitas consultas consecutivas. Aguarde um instante para continuar.',
    });
  }

  const { term, currentExamples, slot, category, subtopic, literal } = req.body || {};
  const cleanTerm = sanitizeUserInput(term, 140);

  if (!cleanTerm) {
    return res.status(400).json({ success: false, error: 'Termo não informado ou inválido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({
      success: false,
      reason: 'NO_API_KEY',
      message: 'Chave Gemini não configurada. Ativando gerador local de frases verificadas.',
    });
  }

  try {
    const existingList = Array.isArray(currentExamples)
      ? currentExamples.map((x) => sanitizeUserInput(x, 260)).filter(Boolean)
      : [];

    const systemInstruction = `Você é especialista em ensino de inglês coloquial para brasileiros (método Teacher Mariana - EWM).
Sua missão é buscar no Google e em bases autênticas de falantes nativos uma NOVA frase de exemplo para a expressão "${cleanTerm}".
Regras fundamentais:
1. A frase deve soar 100% natural para um nativo americano ou britânico.
2. Não use moldes genéricos nem clichês como "We really need to...", "It's much easier to...", "She loves...", etc.
3. A nova frase DEVE ser diferente das frases já conhecidas: [${existingList.join(' | ')}].
4. Forneça uma tradução natural em português brasileiro (PT-BR) que capture a gíria ou o tom coloquial sem traduzir ao pé da letra.
5. Retorne estritamente um JSON.`;

    const userPrompt = `Gere uma nova frase de exemplo prática e autêntica em inglês com a expressão "${cleanTerm}" (${literal || category || 'inglês nativo'}).
Frases existentes que você NÃO deve repetir:
${existingList.map((e, idx) => `${idx + 1}. "${e}"`).join('\n') || '(Nenhuma)'}

Retorne um JSON com esta estrutura exata:
{
  "exampleEn": "Nova frase real e natural em inglês usando ${cleanTerm}",
  "examplePt": "Tradução natural e idiomática em português brasileiro",
  "contextTip": "Por que esta frase é boa ou em que situação ela é usada"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = response.text || '';
    const parsed = extractJsonPayload<{
      exampleEn?: string;
      examplePt?: string;
      contextTip?: string;
    }>(rawText);

    if (!parsed || !parsed.exampleEn) {
      return res.json({
        success: false,
        reason: 'PARSE_FAILED',
        message: 'Não foi possível estruturar a nova frase do Gemini.',
      });
    }

    const exEn = cleanSentence(parsed.exampleEn);
    const exPt = naturalizePortuguese(parsed.examplePt || '');

    const audit = auditEnglishGrammarAndCollocations(exEn, cleanTerm);
    if (!audit.valid || isGenericTemplateSentence(exEn)) {
      return res.json({
        success: false,
        reason: 'AUDIT_FAILED',
        message: `Frase gerada reprovada na auditoria (${audit.reason}).`,
      });
    }

    const score = scoreTeacherSentenceCandidate(exEn, cleanTerm, 'ai_teacher');

    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingSources = groundingChunks
      .map((c: { web?: { uri?: string; title?: string } }) => ({
        uri: c.web?.uri || '',
        title: c.web?.title || '',
      }))
      .filter((s: { uri: string }) => Boolean(s.uri));

    return res.json({
      success: true,
      source: 'gemini-google-search',
      slot: slot || 1,
      exampleEn: exEn,
      examplePt: exPt,
      contextTip: parsed.contextTip || 'Nova frase verificada no banco de dados do Google.',
      score,
      groundingSources,
    });
  } catch (err) {
    console.error('Error in /api/gemini/generate-sentence:', err);
    return res.json({
      success: false,
      reason: 'GEMINI_ERROR',
      error: 'Geração de frase temporariamente indisponível. Usando gerador contextual auditado.',
    });
  }
});

// Mount Vite in dev mode or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
