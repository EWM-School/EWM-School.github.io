import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, type Schema } from '@google/genai';
import {
  buildGeminiTtsDirective,
  type TtsCadenceSpeed,
  type TtsPedagogicalRole,
} from './src/utils/phoneticNormalizer.js';
import {
  injectAbsoluteSocialMetadata,
  resolvePublicOrigin,
} from './src/utils/seoMetadata.js';
import {
  OFFICIAL_FOLDERS_LIST,
  OFFICIAL_SUBTOPICS_LIST,
  classifyLinguisticIntent,
  doesSentenceContainExpression,
  enforceDeterministicGrammarVerdict,
  formatCleanExampleSentence,
  normalizeOfficialFolder,
  normalizeOfficialSubtopic,
  sanitizeGroundingArtifacts,
  toCanonicalExpressionKey,
  toLinguisticCacheDocId,
  validateInvisibleTeacherCuratorship,
  type ConsultTranslatePayload,
  type DetectedGrammarError,
  type GrammarCheckPayload,
  type LinguisticEngineResult,
} from './src/utils/linguisticNormalizer.js';
import {
  buildNonClearPronunciationResult,
  detectDigitalSilenceInAudioBytes,
  enforceDeterministicPronunciationInvariants,
  normalizeAudioMimeType,
  stripBase64DataUrlPrefix,
  tokenizeTargetWords,
  type PronunciationAccent,
  type PronunciationMode,
  type RawPronunciationPayload,
} from './src/utils/pronunciationEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

// Dedicated 6MB body parser exclusively for short multimodal audio pronunciation clips
app.use('/api/gemini/evaluate-pronunciation', express.json({ limit: '6mb' }));
app.use(express.json({ limit: '100kb' }));

// Security headers & Web App Manifest MIME compliance
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (req.path === '/manifest.webmanifest') {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  }
  next();
});

// Sliding-window In-Memory Rate Limiter (45 requests / min per IP)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 45;

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

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateLimitMap.entries()) {
    if (now > bucket.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000).unref();

function sanitizeUserInput(raw: unknown, maxLen = 220): string {
  if (!raw) return '';
  let s = String(raw);
  s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) {
    s = s.slice(0, maxLen).trim();
  }
  return s;
}

// Initialize GoogleGenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Dedicated v1beta GoogleGenAI client for Gemini 3.8 TTS
const ttsAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: 'v1beta',
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function polishNaturalPtSentence(rawPt: unknown): string {
  let s = sanitizeGroundingArtifacts(rawPt);
  if (!s) return '';
  s = s.replace(/^→\s*/, '').trim();
  if (s && !/[.!?]$/.test(s)) {
    s += '.';
  }
  return s;
}

function extractJsonPayload<T = unknown>(rawText: string): T | null {
  if (!rawText) return null;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim()) as T;
      } catch {
        // continue
      }
    }
    const startObj = trimmed.indexOf('{');
    const endObj = trimmed.lastIndexOf('}');
    if (startObj !== -1 && endObj > startObj) {
      try {
        return JSON.parse(trimmed.slice(startObj, endObj + 1)) as T;
      } catch {
        // continue
      }
    }
  }
  return null;
}

/**
 * Deterministic JSON Schema caller (`temperature: 0.0`).
 * Safeguards `responseMimeType: "application/json"` + `responseSchema` against any
 * `googleSearch` grounding incompatibility or citation injection.
 */
async function callDeterministicGeminiJson<T>(params: {
  systemInstruction: string;
  userPrompt: string;
  responseSchema: Schema;
  useGoogleSearch?: boolean;
}): Promise<{
  parsed: T | null;
  groundingSources: { uri: string; title: string }[];
  usedGrounding: boolean;
}> {
  const extractSources = (resp: unknown): { uri: string; title: string }[] => {
    const chunks =
      (
        resp as {
          candidates?: {
            groundingMetadata?: {
              groundingChunks?: { web?: { uri?: string; title?: string } }[];
            };
          }[];
        }
      )?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return chunks
      .map((c) => ({
        uri: c.web?.uri || '',
        title: c.web?.title || '',
      }))
      .filter((s) => Boolean(s.uri));
  };

  if (params.useGoogleSearch) {
    try {
      const groundedResp = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: params.userPrompt,
        config: {
          temperature: 0.0,
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
          tools: [{ googleSearch: {} }],
        },
      });
      const parsedGrounded = extractJsonPayload<T>(groundedResp.text || '');
      if (parsedGrounded) {
        return {
          parsed: parsedGrounded,
          groundingSources: extractSources(groundedResp),
          usedGrounding: true,
        };
      }
    } catch {
      // Fallback immediately to strict schema-only deterministic call (temperature: 0.0)
      // when combining googleSearch + responseMimeType: "application/json" is rejected by API
    }
  }

  const strictResp = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: params.userPrompt,
    config: {
      temperature: 0.0,
      systemInstruction: params.systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: params.responseSchema,
    },
  });

  return {
    parsed: extractJsonPayload<T>(strictResp.text || ''),
    groundingSources: [],
    usedGrounding: false,
  };
}

// -------------------------------------------------------------
// Strict Schemas (`temperature: 0.0`)
// -------------------------------------------------------------
const LOOKUP_CARD_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    term: {
      type: Type.STRING,
      description:
        'A expressão ou palavra canônica natural em inglês (sem barra "/", sem citações). Ex: "Wrap up", "Call it a day", "For now".',
    },
    category: {
      type: Type.STRING,
      enum: [...OFFICIAL_FOLDERS_LIST],
      description: 'Pasta oficial obrigatória do aplicativo EWM.',
    },
    subtopic: {
      type: Type.STRING,
      enum: [...OFFICIAL_SUBTOPICS_LIST],
      description: 'Subtópico contextual oficial obrigatório.',
    },
    literal: {
      type: Type.STRING,
      description: 'Significado natural principal em português do Brasil (claro, direto e sem portuglês).',
    },
    colloquial: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 a 4 equivalentes naturais e idiomáticos usados no Brasil.',
    },
    phoneticUs: {
      type: Type.STRING,
      description: 'Pronúncia guiada EWM em inglês americano (ex: /rép ÂP/).',
    },
    phoneticUk: {
      type: Type.STRING,
      description: 'Pronúncia guiada EWM em inglês britânico (ex: /rép ÂP/).',
    },
    ukNote: {
      type: Type.STRING,
      description: 'Diferença real entre US e UK quando houver, ou string vazia.',
    },
    exampleEn: {
      type: Type.STRING,
      description:
        'Frase de exemplo 1 100% natural, contemporânea, falada por nativos, contendo obrigatoriamente a expressão "term" (ou sua flexão legítima), sem barras "/".',
    },
    examplePt: {
      type: Type.STRING,
      description:
        'Tradução idiomática fluida da frase 1 para o português do Brasil (zero tradução literal palavra por palavra).',
    },
    exampleEn2: {
      type: Type.STRING,
      description:
        'Frase de exemplo 2 100% natural em contexto diferente, contendo obrigatoriamente "term" (ou flexão legítima), sem barras "/".',
    },
    examplePt2: {
      type: Type.STRING,
      description: 'Tradução idiomática fluida da frase 2 para o português do Brasil.',
    },
    tip: {
      type: Type.STRING,
      description: 'Dica curta de 1 linha sobre uso real, nuance ou pronúncia.',
    },
    isValidForGlobalSchoolDeck: {
      type: Type.BOOLEAN,
      description:
        'True SOMENTE se for uma palavra, phrasal verb ou expressão idiomática reutilizável, ortograficamente correta e apropriada para o acervo escolar global.',
    },
  },
  required: [
    'term',
    'category',
    'subtopic',
    'literal',
    'colloquial',
    'phoneticUs',
    'phoneticUk',
    'ukNote',
    'exampleEn',
    'examplePt',
    'exampleEn2',
    'examplePt2',
    'tip',
    'isValidForGlobalSchoolDeck',
  ],
};

const GENERATE_SENTENCE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    exampleEn: {
      type: Type.STRING,
      description:
        'Nova frase autêntica e contemporânea falada por nativos (US/UK), contendo obrigatoriamente a expressão-alvo ou sua flexão verbal legítima, sem barras "/".',
    },
    examplePt: {
      type: Type.STRING,
      description:
        'Tradução idiomática e natural equivalente no português do Brasil (zero literalismo robótico).',
    },
    contextTip: {
      type: Type.STRING,
      description: 'Breve nota de 1 linha sobre o contexto da frase.',
    },
  },
  required: ['exampleEn', 'examplePt', 'contextTip'],
};

const CONSULT_TRANSLATE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sourceLanguage: {
      type: Type.STRING,
      enum: ['pt', 'en'],
    },
    englishExpression: {
      type: Type.STRING,
      description:
        'Expressão principal mais idiomática em inglês (ex: "For now", "Figure it out", "Hang up").',
    },
    primaryTranslation: {
      type: Type.STRING,
      description:
        'Síntese clara da tradução idiomática principal (se entrada for PT, destaque o equivalente principal em EN + sentido; se EN, destaque o equivalente natural em PT-BR).',
    },
    contextualNuances: {
      type: Type.ARRAY,
      description:
        'Desambiguação semântica obrigatória (2 a 4 itens sempre que houver variações de sentido como "for now" vs "so far", "sort out" vs "figure out", "hang up" telefone vs pendurar).',
      items: {
        type: Type.OBJECT,
        properties: {
          expressionEn: { type: Type.STRING },
          meaningPt: { type: Type.STRING },
          whenToUsePt: { type: Type.STRING },
          exampleEn: { type: Type.STRING },
          examplePt: { type: Type.STRING },
        },
        required: ['expressionEn', 'meaningPt', 'whenToUsePt', 'exampleEn', 'examplePt'],
      },
    },
    usUkDifferences: {
      type: Type.STRING,
      description:
        'Diferença real de vocabulário, uso ou pronúncia entre Estados Unidos (US) e Reino Unido (UK).',
    },
    phoneticUs: {
      type: Type.STRING,
      description: 'Transcrição fonética simplificada padrão EWM-US.',
    },
    phoneticUk: {
      type: Type.STRING,
      description: 'Transcrição fonética simplificada padrão EWM-UK.',
    },
    examples: {
      type: Type.ARRAY,
      description: 'Exatamente 2 exemplos autênticos de conversação contemporânea (EN + PT natural).',
      items: {
        type: Type.OBJECT,
        properties: {
          en: { type: Type.STRING },
          pt: { type: Type.STRING },
        },
        required: ['en', 'pt'],
      },
    },
    falseCognateOrLiteralWarning: {
      type: Type.STRING,
      description:
        'Alerta curto contra tradução ao pé da letra ("portuglês") ou falso cognato relacionado.',
    },
    isValidForGlobalSchoolDeck: {
      type: Type.BOOLEAN,
      description:
        'Curadoria Professor Invisível: true APENAS para palavras, phrasal verbs e expressões idiomáticas legítimas, reutilizáveis e ortograficamente íntegras (false para frases pessoais longas, nomes próprios, ruído ou erros).',
    },
    suggestedCategory: {
      type: Type.STRING,
      enum: [...OFFICIAL_FOLDERS_LIST],
    },
    suggestedSubtopic: {
      type: Type.STRING,
      enum: [...OFFICIAL_SUBTOPICS_LIST],
    },
    colloquialPtList: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 a 4 equivalentes naturais em português do Brasil para estudo no card.',
    },
    pedagogicalTip: {
      type: Type.STRING,
      description: 'Dica prática de 1 linha da Teacher Mariana.',
    },
  },
  required: [
    'sourceLanguage',
    'englishExpression',
    'primaryTranslation',
    'contextualNuances',
    'usUkDifferences',
    'phoneticUs',
    'phoneticUk',
    'examples',
    'falseCognateOrLiteralWarning',
    'isValidForGlobalSchoolDeck',
    'suggestedCategory',
    'suggestedSubtopic',
    'colloquialPtList',
    'pedagogicalTip',
  ],
};

// STRICT ANTI-HALLUCINATION ORDER:
// `detectedErrors` and `correctedNaturalSentence` MUST be generated BEFORE `verdict`!
const GRAMMAR_EXAMINER_SCHEMA: Schema = {
  type: Type.OBJECT,
  propertyOrdering: [
    'detectedErrors',
    'isStiltedOrTruncated',
    'unnaturalnessNotePt',
    'correctedNaturalSentence',
    'alternativeNaturalSentence',
    'correctedTranslationPt',
    'phoneticUs',
    'phoneticUk',
    'verdict',
  ],
  properties: {
    detectedErrors: {
      type: Type.ARRAY,
      description:
        'Lista exaustiva de TODOS os erros gramaticais, de tempo verbal, concordância, preposição/regência, artigos, ordem sintática ou decalque do português ("portuglês"). Deve ser [] SOMENTE se houver ZERO erros.',
      items: {
        type: Type.OBJECT,
        propertyOrdering: ['exactSnippet', 'replacementSnippet', 'errorType', 'explanationPt'],
        properties: {
          exactSnippet: {
            type: Type.STRING,
            description: 'Trecho exato incorreto na frase original do aluno.',
          },
          replacementSnippet: {
            type: Type.STRING,
            description: 'Correção exata para substituir o trecho incorreto.',
          },
          errorType: {
            type: Type.STRING,
            description:
              'Categoria curta do erro em português (ex: "Tempo Verbal", "Concordância Verbal", "Portuglês / Decalque", "Preposição / Regência", "Collocation").',
          },
          explanationPt: {
            type: Type.STRING,
            description: 'Explicação pedagógica clara de 1 linha em português do Brasil sobre a regra.',
          },
        },
        required: ['exactSnippet', 'replacementSnippet', 'errorType', 'explanationPt'],
      },
    },
    isStiltedOrTruncated: {
      type: Type.BOOLEAN,
      description:
        'True se não houver erro gramatical estrito, mas a frase soar artificial, truncada, excessivamente literal ou pouco natural para um nativo.',
    },
    unnaturalnessNotePt: {
      type: Type.STRING,
      description:
        'Explicação curta de 1 linha em português sobre a naturalidade da frase (como um nativo diria ou por que está perfeita).',
    },
    correctedNaturalSentence: {
      type: Type.STRING,
      description:
        'A frase 100% corrigida e fluida como um falante nativo (US/UK) realmente diria.',
    },
    alternativeNaturalSentence: {
      type: Type.STRING,
      description: 'Segunda opção natural de dizer a mesma ideia (ou string vazia).',
    },
    correctedTranslationPt: {
      type: Type.STRING,
      description: 'Sentido equivalente em português do Brasil natural.',
    },
    phoneticUs: {
      type: Type.STRING,
      description: 'Pronúncia guiada EWM-US da frase natural corrigida.',
    },
    phoneticUk: {
      type: Type.STRING,
      description: 'Pronúncia guiada EWM-UK da frase natural corrigida.',
    },
    verdict: {
      type: Type.STRING,
      enum: ['PERFECT_NATURAL', 'UNDERSTANDABLE_UNNATURAL', 'INCORRECT'],
      description:
        'Veredito final: INCORRECT se detectedErrors tiver qualquer item; UNDERSTANDABLE_UNNATURAL se zero erros graves mas truncada/pouco natural; PERFECT_NATURAL apenas se 100% correta e idiomática.',
    },
  },
  required: [
    'detectedErrors',
    'isStiltedOrTruncated',
    'unnaturalnessNotePt',
    'correctedNaturalSentence',
    'alternativeNaturalSentence',
    'correctedTranslationPt',
    'phoneticUs',
    'phoneticUk',
    'verdict',
  ],
};

// Bounded Server-Side Collective L2 Memory Cache (500 normalized entries)
const serverLinguisticCache = new Map<string, LinguisticEngineResult>();
const MAX_SERVER_LINGUISTIC_CACHE = 500;

function getServerLinguisticCache(key: string): LinguisticEngineResult | undefined {
  const hit = serverLinguisticCache.get(key);
  if (!hit) return undefined;
  serverLinguisticCache.delete(key);
  serverLinguisticCache.set(key, hit);
  return hit;
}

function setServerLinguisticCache(key: string, val: LinguisticEngineResult): void {
  if (serverLinguisticCache.has(key)) {
    serverLinguisticCache.delete(key);
  } else if (serverLinguisticCache.size >= MAX_SERVER_LINGUISTIC_CACHE) {
    const oldest = serverLinguisticCache.keys().next().value;
    if (oldest) serverLinguisticCache.delete(oldest);
  }
  serverLinguisticCache.set(key, val);
}

// Helper to guarantee target expression presence inside generated examples at temperature: 0.0
async function ensureValidExamplePair(params: {
  term: string;
  literalPt: string;
  candidateEn: string;
  candidatePt: string;
  avoidSentences?: string[];
}): Promise<{ en: string; pt: string }> {
  const cleanEn = formatCleanExampleSentence(params.candidateEn);
  const cleanPt = polishNaturalPtSentence(params.candidatePt);

  if (
    cleanEn.length >= 12 &&
    cleanPt.length >= 3 &&
    doesSentenceContainExpression(cleanEn, params.term)
  ) {
    return { en: cleanEn, pt: cleanPt };
  }

  // Deterministic regeneration strictly enforcing the exact expression inside the dialogue
  const retry = await callDeterministicGeminiJson<{
    exampleEn: string;
    examplePt: string;
    contextTip: string;
  }>({
    useGoogleSearch: false,
    responseSchema: GENERATE_SENTENCE_SCHEMA,
    systemInstruction: `Você é uma linguista nativa C2 (US/UK) e professora sênior da escola EWM.
Gere UMA frase de exemplo contemporânea, autêntica e falada na vida real que contenha OBRIGATORIAMENTE a expressão exata "${params.term}" (ou sua flexão verbal legítima).
Proibido usar barras ("/"), colchetes de citação ou tradução literal palavra por palavra.`,
    userPrompt: `Expressão obrigatória na frase em inglês: "${params.term}" (sentido em português: "${params.literalPt}").
Não repita: ${(params.avoidSentences || []).join(' | ') || '(nenhuma)'}.`,
  });

  const fixedEn = formatCleanExampleSentence(retry.parsed?.exampleEn || cleanEn);
  const fixedPt = polishNaturalPtSentence(retry.parsed?.examplePt || cleanPt);
  return {
    en: fixedEn,
    pt: fixedPt,
  };
}

// -------------------------------------------------------------
// POST /api/gemini/lookup-card
// Deterministic (`temperature: 0.0`) + strict JSON Schema + Grounding sanitization
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
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.json({
      success: false,
      reason: 'NO_API_KEY',
      message: 'Chave Gemini não configurada no servidor.',
    });
  }

  try {
    const detectedDir =
      direction === 'pt-to-en' || direction === 'en-to-pt'
        ? direction
        : classifyLinguisticIntent(query).detectedLanguage === 'pt'
        ? 'pt-to-en'
        : 'en-to-pt';

    const isPtToEn = detectedDir === 'pt-to-en';

    const systemInstruction = `Você é o motor lexicográfico determinístico (nível C2 Cambridge, US & UK) da escola "English With Mariana (EWM)".
Regras absolutas de qualidade pedagógica:
1. Precisão semântica e idiomaticidade nativa acima de tudo. Zero "portuglês" ou traduções literais robóticas.
2. Nunca coloque barras ("/") nem marcadores de citação ([1]) dentro de "term" ou das frases de exemplo.
3. As frases "exampleEn" e "exampleEn2" DEVEM soar 100% naturais em conversas reais contemporâneas (trabalho, viagem, rotina) e DEVEM conter obrigatoriamente a expressão "term" (ou sua conjugação verbal legítima).
4. "examplePt" e "examplePt2" DEVEM ser traduções idiomáticas fluidas em português do Brasil.
5. Classifique "category" estritamente entre: "Dicas da Mari", "Palavras", "Frases", "Phrasal Verbs", "Outros".
6. Classifique "subtopic" estritamente entre: "Viagens", "Clima", "Trabalho", "Lazer", "Casual", "Outros".`;

    const userPrompt = isPtToEn
      ? `Encontre a expressão ou palavra idiomática mais autêntica em inglês para expressar em português: "${query}".
Preencha todos os campos do schema JSON com máxima precisão nativa US/UK.`
      : `Analise a palavra ou expressão em inglês: "${query}".
Forneça seu significado natural no Brasil, pronúncia guiada US/UK e 2 frases reais contemporâneas contendo a expressão.`;

    const { parsed, groundingSources, usedGrounding } = await callDeterministicGeminiJson<{
      term: string;
      category: string;
      subtopic: string;
      literal: string;
      colloquial: string[];
      phoneticUs: string;
      phoneticUk: string;
      ukNote: string;
      exampleEn: string;
      examplePt: string;
      exampleEn2: string;
      examplePt2: string;
      tip: string;
      isValidForGlobalSchoolDeck: boolean;
    }>({
      systemInstruction,
      userPrompt,
      responseSchema: LOOKUP_CARD_SCHEMA,
      useGoogleSearch: true,
    });

    if (!parsed || !parsed.term) {
      return res.json({
        success: false,
        reason: 'PARSE_FAILED',
        message: 'Não foi possível estruturar a consulta com segurança.',
      });
    }

    const cleanTerm = sanitizeGroundingArtifacts(parsed.term).replace(/\s*\/\s*.+$/, '').trim();
    const category = normalizeOfficialFolder(parsed.category, 'Frases');
    const subtopic = normalizeOfficialSubtopic(parsed.subtopic, 'Casual');
    const colloquialRaw = Array.isArray(parsed.colloquial)
      ? parsed.colloquial.map((c) => sanitizeGroundingArtifacts(c)).filter(Boolean)
      : [];
    const literal =
      sanitizeGroundingArtifacts(parsed.literal) || colloquialRaw[0] || cleanTerm;
    const colloquial = colloquialRaw.length > 0 ? colloquialRaw.slice(0, 6) : [literal];

    const ex1 = await ensureValidExamplePair({
      term: cleanTerm,
      literalPt: colloquial[0] || literal,
      candidateEn: parsed.exampleEn,
      candidatePt: parsed.examplePt,
    });

    const ex2 = await ensureValidExamplePair({
      term: cleanTerm,
      literalPt: colloquial[0] || literal,
      candidateEn: parsed.exampleEn2,
      candidatePt: parsed.examplePt2,
      avoidSentences: [ex1.en],
    });

    const isValidForGlobalSchoolDeck = validateInvisibleTeacherCuratorship({
      aiApproved: Boolean(parsed.isValidForGlobalSchoolDeck),
      englishExpression: cleanTerm,
      primaryTranslation: colloquial[0] || literal,
      exampleEn: ex1.en,
      examplePt: ex1.pt,
      category,
      subtopic,
    });

    return res.json({
      success: true,
      source: usedGrounding ? 'gemini-grounded-schema' : 'gemini-deterministic-schema',
      card: {
        term: cleanTerm,
        canonicalKey: toCanonicalExpressionKey(cleanTerm),
        category,
        subtopic,
        literal,
        colloquial,
        phoneticUs: sanitizeGroundingArtifacts(parsed.phoneticUs),
        phoneticUk: sanitizeGroundingArtifacts(parsed.phoneticUk),
        ukNote: sanitizeGroundingArtifacts(parsed.ukNote),
        exampleEn: ex1.en,
        examplePt: ex1.pt,
        exampleEn2: ex2.en,
        examplePt2: ex2.pt,
        tip: sanitizeGroundingArtifacts(parsed.tip),
        isValidForGlobalSchoolDeck,
      },
      groundingSources,
    });
  } catch (err) {
    console.error('Error in /api/gemini/lookup-card:', err);
    return res.json({
      success: false,
      reason: 'GEMINI_ERROR',
      error: 'Serviço de IA temporariamente indisponível. Verifique sua conexão e tente novamente.',
    });
  }
});

// -------------------------------------------------------------
// POST /api/gemini/generate-sentence
// Deterministic (`temperature: 0.0`) + strict JSON Schema + Target-expression guarantee
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

  const { term, currentExamples, slot, category, literal } = req.body || {};
  const cleanTerm = sanitizeUserInput(term, 140);

  if (!cleanTerm) {
    return res.status(400).json({ success: false, error: 'Termo não informado ou inválido.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.json({
      success: false,
      reason: 'NO_API_KEY',
      message: 'Chave Gemini não configurada no servidor.',
    });
  }

  try {
    const existingList = Array.isArray(currentExamples)
      ? currentExamples.map((x) => sanitizeUserInput(x, 260)).filter(Boolean)
      : [];

    const systemInstruction = `Você é uma linguista nativa (US/UK, nível C2) da escola English With Mariana (EWM).
Gere UMA NOVA frase de exemplo autêntica, contemporânea e falada na vida real usando obrigatoriamente a expressão "${cleanTerm}" (ou sua flexão verbal legítima).
Regras obrigatórias:
1. A situação deve ser completamente diferente das frases anteriores fornecidas.
2. Zero barras ("/"), zero colchetes de citação e zero moldes artificiais de livro antigo.
3. A tradução em português do Brasil deve ser 100% fluida e idiomática (nunca tradução palavra por palavra).`;

    const userPrompt = `Expressão-alvo obrigatória: "${cleanTerm}" (${sanitizeUserInput(literal, 120) || sanitizeUserInput(category, 40) || 'uso cotidiano nativo'}).
Frases que você NÃO pode repetir nem parafrasear de perto:
${existingList.map((e, idx) => `${idx + 1}. "${e}"`).join('\n') || '(Nenhuma)'}`;

    const { parsed, groundingSources, usedGrounding } = await callDeterministicGeminiJson<{
      exampleEn: string;
      examplePt: string;
      contextTip: string;
    }>({
      systemInstruction,
      userPrompt,
      responseSchema: GENERATE_SENTENCE_SCHEMA,
      useGoogleSearch: true,
    });

    if (!parsed || !parsed.exampleEn || !parsed.examplePt) {
      return res.json({
        success: false,
        reason: 'PARSE_FAILED',
        message: 'Não foi possível gerar uma nova frase validada agora.',
      });
    }

    const verifiedPair = await ensureValidExamplePair({
      term: cleanTerm,
      literalPt: sanitizeUserInput(literal, 120) || cleanTerm,
      candidateEn: parsed.exampleEn,
      candidatePt: parsed.examplePt,
      avoidSentences: existingList,
    });

    if (!verifiedPair.en || !verifiedPair.pt) {
      return res.json({
        success: false,
        reason: 'VALIDATION_FAILED',
        message: 'A frase gerada não atendeu ao critério de autenticidade. Tente novamente.',
      });
    }

    return res.json({
      success: true,
      source: usedGrounding ? 'gemini-grounded-schema' : 'gemini-deterministic-schema',
      slot: slot || 1,
      exampleEn: verifiedPair.en,
      examplePt: verifiedPair.pt,
      contextTip: sanitizeGroundingArtifacts(parsed.contextTip),
      groundingSources,
    });
  } catch (err) {
    console.error('Error in /api/gemini/generate-sentence:', err);
    return res.json({
      success: false,
      reason: 'GEMINI_ERROR',
      error: 'Não foi possível conectar ao motor de frases agora. Verifique sua conexão.',
    });
  }
});

// -------------------------------------------------------------
// POST /api/gemini/linguistic-engine
// Unified Super-Barra Engine (`temperature: 0.0` + Strict JSON Schema):
// - Mode A: CONSULT_TRANSLATE (Semantic Disambiguation + US/UK + Anti-Portuglês + Invisible Curatorship)
// - Mode B: GRAMMAR_CHECK (C2/Cambridge Implacable Examiner + Mathematical Zero-False-Positive Lock)
// -------------------------------------------------------------
app.post('/api/gemini/linguistic-engine', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      reason: 'RATE_LIMITED',
      error: 'Muitas consultas em sequência. Aguarde alguns segundos e tente novamente.',
    });
  }

  const rawInput = sanitizeUserInput(req.body?.input ?? req.body?.query, 260);
  const rawOverride = req.body?.modeOverride;
  const modeOverride: 'auto' | 'consult' | 'grammar' =
    rawOverride === 'consult' || rawOverride === 'grammar' ? rawOverride : 'auto';

  if (!rawInput) {
    return res.status(400).json({
      success: false,
      reason: 'INVALID_INPUT',
      error: 'Digite ou fale uma palavra, expressão ou frase para consultar.',
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.json({
      success: false,
      reason: 'NO_API_KEY',
      error: 'Chave Gemini não configurada no servidor.',
    });
  }

  const { mode } = classifyLinguisticIntent(rawInput, modeOverride);
  const cacheKey = toLinguisticCacheDocId(
    mode === 'GRAMMAR_CHECK' ? 'grammar' : 'consult',
    rawInput
  );

  const serverCached = getServerLinguisticCache(cacheKey);
  if (serverCached) {
    return res.json({
      success: true,
      cached: true,
      cacheKey,
      result: serverCached,
    });
  }

  try {
    if (mode === 'GRAMMAR_CHECK') {
      const grammarSystemInstruction = `Você é um Examinador Oficial Cambridge C2 Proficiency (CPE) e especialista em interferência linguística Português -> Inglês na escola EWM.
Sua diretriz inegociável é VERDADE LINGUÍSTICA ABSOLUTA (zero falso positivo):
1. Inspecione implacavelmente a frase em inglês quanto a:
   - Concordância sujeito-verbo (ex.: "She go" -> "She went/goes", "He don't likes" -> "He doesn't like", "people is" -> "people are").
   - Tempos verbais e marcadores de tempo (ex.: "yesterday" exige Simple Past; "since/for" com estado contínuo exige Present Perfect).
   - Regência e preposições (ex.: "depend of" -> "depend on", "married with" -> "married to", "arrive to" -> "arrive at/in", "discuss about" -> "discuss", "explain me" -> "explain to me", "listen music" -> "listen to music").
   - Substantivos incontáveis, plurais e artigos (ex.: "informations", "an advice", "homeworks", "a news").
   - Ordem sintática e estrutura de perguntas/negações.
   - Collocations e decalques literais do português ("portuglês", como "I have 25 years" -> "I'm 25 years old", "make a travel", "lose the bus", "take a coffee" quando não natural).
2. ORDEM DE RACIOCÍNIO OBRIGATÓRIA:
   - Preencha PRIMEIRO "detectedErrors" listando cada erro encontrado com o trecho exato ("exactSnippet"), a correção ("replacementSnippet"), o tipo ("errorType") e 1 linha clara em português ("explanationPt").
   - Se houver QUALQUER erro em "detectedErrors", o campo "verdict" DEVE obrigatoriamente ser "INCORRECT".
   - Se "detectedErrors" for vazio ([]), avalie a fluidez nativa:
     * Se a frase for gramaticalmente aceitável, porém truncada, robótica, engessada ou pouco natural para um nativo (ex.: excesso de "of the", construção artificial), marque "isStiltedOrTruncated": true e "verdict": "UNDERSTANDABLE_UNNATURAL", mostrando em "correctedNaturalSentence" como um nativo diria naturalmente.
     * Marque "verdict": "PERFECT_NATURAL" SOMENTE se a frase tiver zero erros e soar 100% autêntica e natural na boca de um nativo.`;

      const grammarUserPrompt = `Examine rigorosamente esta frase em inglês submetida por um aluno brasileiro:
"${rawInput}"`;

      const { parsed } = await callDeterministicGeminiJson<{
        detectedErrors: DetectedGrammarError[];
        isStiltedOrTruncated: boolean;
        unnaturalnessNotePt: string;
        correctedNaturalSentence: string;
        alternativeNaturalSentence: string;
        correctedTranslationPt: string;
        phoneticUs: string;
        phoneticUk: string;
        verdict: string;
      }>({
        systemInstruction: grammarSystemInstruction,
        userPrompt: grammarUserPrompt,
        responseSchema: GRAMMAR_EXAMINER_SCHEMA,
        useGoogleSearch: false,
      });

      if (!parsed || !parsed.correctedNaturalSentence) {
        return res.json({
          success: false,
          reason: 'PARSE_FAILED',
          error: 'Não foi possível concluir a auditoria gramatical com segurança.',
        });
      }

      const cleanedErrors: DetectedGrammarError[] = Array.isArray(parsed.detectedErrors)
        ? parsed.detectedErrors
            .map((e) => ({
              exactSnippet: sanitizeGroundingArtifacts(e.exactSnippet),
              replacementSnippet: sanitizeGroundingArtifacts(e.replacementSnippet),
              errorType: sanitizeGroundingArtifacts(e.errorType) || 'Ajuste Gramatical',
              explanationPt: sanitizeGroundingArtifacts(e.explanationPt),
            }))
            .filter((e) => Boolean(e.explanationPt))
        : [];

      // HARDCODED MATHEMATICAL GUARD: Zero False Positives guaranteed in TypeScript
      const finalVerdict = enforceDeterministicGrammarVerdict({
        detectedErrors: cleanedErrors,
        isStiltedOrTruncated: Boolean(parsed.isStiltedOrTruncated),
        rawVerdict: parsed.verdict,
      });

      const grammarResult: GrammarCheckPayload = {
        mode: 'GRAMMAR_CHECK',
        originalSentence: rawInput,
        detectedErrors: cleanedErrors,
        isStiltedOrTruncated: Boolean(parsed.isStiltedOrTruncated),
        unnaturalnessNotePt: sanitizeGroundingArtifacts(parsed.unnaturalnessNotePt),
        correctedNaturalSentence: formatCleanExampleSentence(parsed.correctedNaturalSentence),
        alternativeNaturalSentence: parsed.alternativeNaturalSentence
          ? formatCleanExampleSentence(parsed.alternativeNaturalSentence)
          : undefined,
        correctedTranslationPt: polishNaturalPtSentence(parsed.correctedTranslationPt),
        phoneticUs: sanitizeGroundingArtifacts(parsed.phoneticUs),
        phoneticUk: sanitizeGroundingArtifacts(parsed.phoneticUk),
        verdict: finalVerdict,
        cacheLayer: 'L3_GEMINI',
      };

      setServerLinguisticCache(cacheKey, grammarResult);

      return res.json({
        success: true,
        cached: false,
        cacheKey,
        result: grammarResult,
      });
    }

    // Mode A: CONSULT_TRANSLATE (Contextual Consultant & Translator)
    const consultSystemInstruction = `Você é o Consultor Lexicográfico Bilíngue Sênior (Inglês Nativo US/UK ⇄ Português do Brasil) da escola English With Mariana (EWM).
Regras pedagógicas inegociáveis:
1. DESAMBIGUAÇÃO SEMÂNTICA OBRIGATÓRIA:
   - Se o aluno consultar uma expressão em português com mais de um equivalente em inglês conforme o contexto (ex.: "por enquanto" -> "for now" para algo provisório/momentâneo vs. "so far" para "até o momento"; "dar um jeito" -> "figure out", "sort out", "make it work"), NUNCA devolva uma palavra solta sem contexto! Detalhe cada variação em "contextualNuances" explicando claramente QUANDO usar cada uma.
   - Se o aluno consultar um phrasal verb ou expressão em inglês com mais de um sentido comum (ex.: "hang up" -> desligar o telefone vs. pendurar algo; "work out" -> treinar vs. dar certo/resolver), detalhe as nuances reais em "contextualNuances".
   - Se o aluno digitar uma frase inteira em português para traduzir, entregue a tradução nativa principal em "englishExpression" e mostre variações naturais de tom (casual vs. trabalho) em "contextualNuances".
2. Diferencie claramente o uso/pronúncia US vs. UK em "usUkDifferences".
3. Forneça 2 exemplos contemporâneos e 100% naturais em "examples" (EN + PT idiomático, sem barras "/").
4. Em "falseCognateOrLiteralWarning", alerte de forma direta contra a armadilha de tradução ao pé da letra ("portuglês") daquela expressão.
5. Curadoria "Professor Invisível" ("isValidForGlobalSchoolDeck"): marque true SOMENTE se "englishExpression" for uma palavra, phrasal verb ou expressão idiomática reutilizável (1 a 6 palavras), ortograficamente íntegra e útil para todos os alunos da escola (marque false para frases pessoais específicas, nomes próprios, gírias ofensivas ou ruído).`;

    const consultUserPrompt = `Consulta linguística do aluno: "${rawInput}".
Retorne a análise contextual completa seguindo rigorosamente o schema JSON.`;

    const { parsed } = await callDeterministicGeminiJson<{
      sourceLanguage: 'pt' | 'en';
      englishExpression: string;
      primaryTranslation: string;
      contextualNuances: {
        expressionEn: string;
        meaningPt: string;
        whenToUsePt: string;
        exampleEn: string;
        examplePt: string;
      }[];
      usUkDifferences: string;
      phoneticUs: string;
      phoneticUk: string;
      examples: { en: string; pt: string }[];
      falseCognateOrLiteralWarning: string;
      isValidForGlobalSchoolDeck: boolean;
      suggestedCategory: string;
      suggestedSubtopic: string;
      colloquialPtList: string[];
      pedagogicalTip: string;
    }>({
      systemInstruction: consultSystemInstruction,
      userPrompt: consultUserPrompt,
      responseSchema: CONSULT_TRANSLATE_SCHEMA,
      useGoogleSearch: false,
    });

    if (!parsed || !parsed.englishExpression) {
      return res.json({
        success: false,
        reason: 'PARSE_FAILED',
        error: 'Não foi possível estruturar a consulta contextual agora.',
      });
    }

    const englishExpression = sanitizeGroundingArtifacts(parsed.englishExpression)
      .replace(/\s*\/\s*.+$/, '')
      .trim();
    const canonicalKey = toCanonicalExpressionKey(englishExpression);
    const suggestedCategory = normalizeOfficialFolder(parsed.suggestedCategory, 'Frases');
    const suggestedSubtopic = normalizeOfficialSubtopic(parsed.suggestedSubtopic, 'Casual');

    const rawExamples = Array.isArray(parsed.examples) ? parsed.examples : [];
    const ex1 = await ensureValidExamplePair({
      term: englishExpression,
      literalPt: parsed.primaryTranslation,
      candidateEn: rawExamples[0]?.en || '',
      candidatePt: rawExamples[0]?.pt || '',
    });
    const ex2 = await ensureValidExamplePair({
      term: englishExpression,
      literalPt: parsed.primaryTranslation,
      candidateEn: rawExamples[1]?.en || '',
      candidatePt: rawExamples[1]?.pt || '',
      avoidSentences: [ex1.en],
    });

    const nuances = Array.isArray(parsed.contextualNuances)
      ? parsed.contextualNuances
          .map((n) => ({
            expressionEn: sanitizeGroundingArtifacts(n.expressionEn),
            meaningPt: sanitizeGroundingArtifacts(n.meaningPt),
            whenToUsePt: sanitizeGroundingArtifacts(n.whenToUsePt),
            exampleEn: formatCleanExampleSentence(n.exampleEn),
            examplePt: polishNaturalPtSentence(n.examplePt),
          }))
          .filter((n) => Boolean(n.expressionEn && n.meaningPt))
          .slice(0, 4)
      : [];

    const colloquialPtList = Array.isArray(parsed.colloquialPtList)
      ? parsed.colloquialPtList.map((c) => sanitizeGroundingArtifacts(c)).filter(Boolean).slice(0, 6)
      : [];

    const primaryTranslation =
      sanitizeGroundingArtifacts(parsed.primaryTranslation) ||
      colloquialPtList[0] ||
      englishExpression;

    const isValidForGlobalSchoolDeck = validateInvisibleTeacherCuratorship({
      aiApproved: Boolean(parsed.isValidForGlobalSchoolDeck),
      englishExpression,
      primaryTranslation: colloquialPtList[0] || primaryTranslation,
      exampleEn: ex1.en,
      examplePt: ex1.pt,
      category: suggestedCategory,
      subtopic: suggestedSubtopic,
    });

    const consultResult: ConsultTranslatePayload = {
      mode: 'CONSULT_TRANSLATE',
      query: rawInput,
      sourceLanguage: parsed.sourceLanguage === 'pt' ? 'pt' : 'en',
      canonicalKey,
      englishExpression,
      primaryTranslation,
      contextualNuances: nuances,
      usUkDifferences: sanitizeGroundingArtifacts(parsed.usUkDifferences),
      phoneticUs: sanitizeGroundingArtifacts(parsed.phoneticUs),
      phoneticUk: sanitizeGroundingArtifacts(parsed.phoneticUk),
      examples: [ex1, ex2],
      falseCognateOrLiteralWarning: sanitizeGroundingArtifacts(parsed.falseCognateOrLiteralWarning),
      isValidForGlobalSchoolDeck,
      suggestedCategory,
      suggestedSubtopic,
      colloquialPtList:
        colloquialPtList.length > 0 ? colloquialPtList : [primaryTranslation],
      pedagogicalTip: sanitizeGroundingArtifacts(parsed.pedagogicalTip),
      cacheLayer: 'L3_GEMINI',
    };

    setServerLinguisticCache(cacheKey, consultResult);

    return res.json({
      success: true,
      cached: false,
      cacheKey,
      result: consultResult,
    });
  } catch (err) {
    console.error('Error in /api/gemini/linguistic-engine:', err);
    return res.json({
      success: false,
      reason: 'GEMINI_ERROR',
      error: 'Sem conexão com o motor linguístico no momento. Verifique sua rede e tente novamente.',
    });
  }
});

// -------------------------------------------------------------
// POST /api/gemini/tts
// Synthesizes isolated General American (en-US) or British Received Pronunciation (en-GB)
// neural speech via gemini-3.8-flash-lite-tts with vocal direction & LRU WAV caching
// -------------------------------------------------------------
interface CachedTtsEntry {
  audioBase64: string;
  mimeType: string;
  locale: 'en-US' | 'en-GB';
  voiceName: string;
  createdAt: number;
}

const ttsAudioCache = new Map<string, CachedTtsEntry>();
const MAX_TTS_CACHE_ITEMS = 160;

function getCachedTts(key: string): CachedTtsEntry | undefined {
  const hit = ttsAudioCache.get(key);
  if (!hit) return undefined;
  ttsAudioCache.delete(key);
  ttsAudioCache.set(key, hit);
  return hit;
}

function setCachedTts(key: string, entry: CachedTtsEntry): void {
  if (ttsAudioCache.has(key)) {
    ttsAudioCache.delete(key);
  } else if (ttsAudioCache.size >= MAX_TTS_CACHE_ITEMS) {
    const oldestKey = ttsAudioCache.keys().next().value;
    if (oldestKey) ttsAudioCache.delete(oldestKey);
  }
  ttsAudioCache.set(key, entry);
}

app.post('/api/gemini/tts', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      reason: 'RATE_LIMITED',
      error: 'Muitas solicitações de áudio em sequência. Aguarde um instante.',
    });
  }

  const rawText = sanitizeUserInput(req.body?.text, 320);
  const accent: 'us' | 'uk' = req.body?.accent === 'uk' ? 'uk' : 'us';
  const speed: TtsCadenceSpeed = req.body?.speed === 'slow' ? 'slow' : 'normal';
  const role: TtsPedagogicalRole | undefined =
    req.body?.role === 'sentence'
      ? 'sentence'
      : req.body?.role === 'term'
      ? 'term'
      : undefined;

  if (!rawText) {
    return res.status(400).json({
      success: false,
      reason: 'INVALID_TEXT',
      error: 'Texto de pronúncia vazio ou inválido.',
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.json({
      success: false,
      reason: 'NO_API_KEY',
      error: 'Chave Gemini não configurada no servidor.',
    });
  }

  const directive = buildGeminiTtsDirective(rawText, accent, speed, role);
  const cacheKey = `${directive.languageCode}|${speed}|${directive.role}|${directive.normalizedText.toLowerCase()}`;

  const cached = getCachedTts(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      cached: true,
      mimeType: cached.mimeType,
      audioBase64: cached.audioBase64,
      locale: cached.locale,
      voiceName: cached.voiceName,
      appliedRules: directive.matchedIpaHints,
    });
  }

  const comprehensiveDirectorStyle = `${directive.speechStyle} ${directive.systemInstruction.replace(/\s+/g, ' ').trim()}`;

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response =
        attempt === 0
          ? await ttsAi.models.generateContent({
              model: 'gemini-3.8-flash-lite-tts',
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: directive.normalizedText,
                      speechMetadata: {
                        style: comprehensiveDirectorStyle,
                      },
                    },
                  ],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: directive.voiceName,
                    },
                  },
                },
              },
            })
          : await ttsAi.models.generateContent({
              model: 'gemini-3.8-flash-lite-tts',
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: directive.normalizedText,
                      speechMetadata: {
                        style: directive.speechStyle,
                      },
                    },
                  ],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                systemInstruction: directive.systemInstruction,
                speechConfig: {
                  languageCode: directive.languageCode,
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: directive.voiceName,
                    },
                  },
                },
              },
            });

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const audioBase64 = inlineData?.data || '';
      const mimeType = inlineData?.mimeType || 'audio/wav';

      if (!audioBase64) {
        return res.json({
          success: false,
          reason: 'EMPTY_AUDIO',
          error: 'O sintetizador neural não retornou áudio.',
        });
      }

      setCachedTts(cacheKey, {
        audioBase64,
        mimeType,
        locale: directive.languageCode,
        voiceName: directive.voiceName,
        createdAt: Date.now(),
      });

      return res.json({
        success: true,
        cached: false,
        mimeType,
        audioBase64,
        locale: directive.languageCode,
        voiceName: directive.voiceName,
        appliedRules: directive.matchedIpaHints,
      });
    } catch (err) {
      lastError = err;
      if (req.destroyed || res.writableEnded) {
        return;
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }

  const errMsg = lastError instanceof Error ? lastError.message : String(lastError || '');
  return res.json({
    success: false,
    reason: 'GEMINI_TTS_ERROR',
    error: errMsg || 'Falha temporária na síntese neural Gemini TTS.',
  });
});

// ---------------------------------------------------------------------------
// PARTE 1 (CAMADA 3) — DETERMINISTIC MULTIMODAL PHONETIC EVALUATION ENGINE
// ---------------------------------------------------------------------------
const BLIND_ACOUSTIC_GATE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    audioQualityStatus: {
      type: Type.STRING,
      enum: ['CLEAR', 'NO_SPEECH_DETECTED', 'TOO_NOISY_OR_LOW', 'WRONG_LANGUAGE'],
      description:
        'Avaliação cega e estrita da presença de voz humana inteligível em inglês: use NO_SPEECH_DETECTED para silêncio, tons sintéticos (bipes/senoides), cliques ou respiração sem fala; TOO_NOISY_OR_LOW se estiver inaudível; WRONG_LANGUAGE se falar em português ou outro idioma; CLEAR somente se houver fala humana inteligível em inglês.',
    },
    heardTranscript: {
      type: Type.STRING,
      description:
        'Transcrição fonética crua e fiel do que foi efetivamente falado no áudio (sem corrigir gramática nem adivinhar palavras). Ex.: se o falante disse "She sink it workee today", transcreva exatamente "She sink it workee today". Se não houver fala humana clara, retorne "".',
    },
  },
  required: ['audioQualityStatus', 'heardTranscript'],
  propertyOrdering: ['audioQualityStatus', 'heardTranscript'],
};

const PRONUNCIATION_EVALUATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    audioQualityStatus: {
      type: Type.STRING,
      enum: ['CLEAR', 'NO_SPEECH_DETECTED', 'TOO_NOISY_OR_LOW', 'WRONG_LANGUAGE'],
      description:
        'PRIMEIRO CAMPO OBRIGATÓRIO: Avalie estritamente a qualidade acústica real do áudio enviado. Use NO_SPEECH_DETECTED se houver silêncio/respiração vazia, TOO_NOISY_OR_LOW se estiver inaudível/com ruído excessivo, WRONG_LANGUAGE se falar em português ou outro idioma que não seja inglês, ou CLEAR se houver fala audível em inglês.',
    },
    heardTranscript: {
      type: Type.STRING,
      description:
        'Transcrição fonética fiel do que o aluno REALMENTE falou no áudio, SEM autocorrigir palavras erradas, omitidas ou trocadas pelo contexto da frase-alvo. Se não houver fala clara, retorne string vazia "".',
    },
    wordBreakdown: {
      type: Type.ARRAY,
      description:
        'Avaliação alinhada palavra por palavra para CADA palavra da frase-alvo (targetText). Se audioQualityStatus !== "CLEAR", retorne array vazio [].',
      items: {
        type: Type.OBJECT,
        properties: {
          word: {
            type: Type.STRING,
            description: 'A palavra exata correspondente na frase-alvo (targetText).',
          },
          status: {
            type: Type.STRING,
            enum: ['EXACT', 'CLOSE_NEEDS_POLISH', 'MISPRONOUNCED_OR_MISSING'],
            description:
              'EXACT: pronúncia limpa e natural no sotaque escolhido; CLOSE_NEEDS_POLISH: compreensível, mas com sotaque/vogal/ritmo a lapidar; MISPRONOUNCED_OR_MISSING: palavra omitida, trocada ou com erro fonético claro (ex.: epêntese "work-ee", "-ed" falado "-êdi", TH trocado por T/D/S/F, letra muda pronunciada).',
          },
          phoneticCuePtBr: {
            type: Type.STRING,
            description:
              'Guia intuitivo e legível para leigos brasileiros de como soar a palavra (ex.: "wârkt /wɜːrkt/ — T seco no final, sem som de i"), usando IPA apenas como apoio discreto.',
          },
          tipPtBr: {
            type: Type.STRING,
            description:
              'Dica cirúrgica de 1 linha clara em português do Brasil explicando posição de língua/boca/ar para corrigir (ou elogio curto se EXACT).',
          },
        },
        required: ['word', 'status', 'phoneticCuePtBr', 'tipPtBr'],
        propertyOrdering: ['word', 'status', 'phoneticCuePtBr', 'tipPtBr'],
      },
    },
    overallScore: {
      type: Type.INTEGER,
      description:
        'Nota acústica global de 0 a 100. Se audioQualityStatus !== "CLEAR", retorne 0. Se houver qualquer palavra essencial com MISPRONOUNCED_OR_MISSING, NUNCA ultrapasse 84.',
    },
    verdict: {
      type: Type.STRING,
      enum: ['NATIVE_LIKE', 'UNDERSTANDABLE_POLISH', 'NEEDS_PRACTICE'],
      description:
        'Veredito pedagógico honesto: NATIVE_LIKE (85-100, sem erros fonéticos), UNDERSTANDABLE_POLISH (60-84, compreensível com ajustes pontuais) ou NEEDS_PRACTICE (0-59 ou sem fala clara).',
    },
    coachSummaryPtBr: {
      type: Type.STRING,
      description:
        '1 frase direta, encorajadora e construtiva em português do Brasil resumindo o ponto principal da pronúncia.',
    },
  },
  required: [
    'audioQualityStatus',
    'heardTranscript',
    'wordBreakdown',
    'overallScore',
    'verdict',
    'coachSummaryPtBr',
  ],
  propertyOrdering: [
    'audioQualityStatus',
    'heardTranscript',
    'wordBreakdown',
    'overallScore',
    'verdict',
    'coachSummaryPtBr',
  ],
};

app.post('/api/gemini/evaluate-pronunciation', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      reason: 'RATE_LIMITED',
      error: 'Muitas avaliações acústicas seguidas. Aguarde alguns segundos e tente novamente.',
    });
  }

  const targetText = sanitizeUserInput(req.body?.targetText, 280);
  const rawAccent = String(req.body?.accent || 'en-US').trim();
  const accent: PronunciationAccent =
    rawAccent === 'en-GB' || rawAccent.toLowerCase() === 'uk' ? 'en-GB' : 'en-US';
  const mode: PronunciationMode =
    req.body?.mode === 'card-quick' ? 'card-quick' : 'lab-detailed';

  if (!targetText || tokenizeTargetWords(targetText).length === 0) {
    return res.status(400).json({
      success: false,
      reason: 'INVALID_TARGET_TEXT',
      error: 'Frase-alvo inválida para avaliação de pronúncia.',
    });
  }

  const cleanMimeType = normalizeAudioMimeType(req.body?.mimeType);
  if (!cleanMimeType) {
    return res.status(400).json({
      success: false,
      reason: 'UNSUPPORTED_AUDIO_MIME',
      error: 'Formato de áudio não suportado para análise acústica.',
    });
  }

  const cleanBase64 = stripBase64DataUrlPrefix(req.body?.audioBase64);
  if (!cleanBase64) {
    const silentEval = buildNonClearPronunciationResult('NO_SPEECH_DETECTED', accent, mode);
    return res.json({
      success: true,
      evaluation: silentEval,
    });
  }

  let audioBytes: Uint8Array;
  try {
    audioBytes = new Uint8Array(Buffer.from(cleanBase64, 'base64'));
  } catch {
    return res.status(400).json({
      success: false,
      reason: 'INVALID_AUDIO_BASE64',
      error: 'Buffer de áudio corrompido ou inválido.',
    });
  }

  // Server-side 0ms acoustic guard against empty/tiny/silent buffers (zero hallucination guarantee)
  const silenceCheck = detectDigitalSilenceInAudioBytes(audioBytes, cleanMimeType);
  if (silenceCheck.isSilentOrTooTiny) {
    const silentEval = buildNonClearPronunciationResult('NO_SPEECH_DETECTED', accent, mode);
    return res.json({
      success: true,
      evaluation: silentEval,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return res.status(503).json({
      success: false,
      reason: 'NO_API_KEY',
      error: 'Chave Gemini não configurada no servidor para avaliação acústica.',
    });
  }

  const targetWordsList = tokenizeTargetWords(targetText);
  const accentProfileDescription =
    accent === 'en-GB'
      ? 'Inglês Britânico (en-GB / Received Pronunciation — não-rótico no final de sílaba, T articulado limpo, vogais britânicas em bath/lot/thought)'
      : 'Inglês Americano (en-US / General American — R retroflexo audível, flap T natural entre vogais como em "water/better", vogal /æ/ aberta)';

  try {
    // PASS 1 — BLIND ACOUSTIC ANTI-HALLUCINATION GATE (ZERO knowledge of targetText!)
    // Because `targetText` is completely absent from Pass 1, it is information-theoretically
    // impossible for the model to hallucinate `targetText` on tones, noise, silence, or swapped words.
    const blindGateResp = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: cleanMimeType,
                data: cleanBase64,
              },
            },
            {
              text: [
                'Escute estritamente este clipe de áudio sem adivinhar contexto.',
                '1. Se houver apenas silêncio, tom puro/sinal sintético (bipe/senoide), sopro ou ruído sem fala humana articulada, retorne audioQualityStatus = "NO_SPEECH_DETECTED" e heardTranscript = "".',
                '2. Se houver tentativa de fala mas inaudível ou coberta por ruído alto, retorne "TOO_NOISY_OR_LOW".',
                '3. Se a fala estiver em português ou outro idioma diferente do inglês, retorne "WRONG_LANGUAGE".',
                '4. Somente se houver fala humana audível tentando falar inglês, retorne "CLEAR" e transcreva em heardTranscript exatamente os sons/palavras falados, SEM autocorrigir erros fonéticos (ex.: mantenha "sink", "workee", palavras omitidas ou trocadas).',
              ].join('\n'),
            },
          ],
        },
      ],
      config: {
        temperature: 0.0,
        responseMimeType: 'application/json',
        responseSchema: BLIND_ACOUSTIC_GATE_SCHEMA,
      },
    });

    const blindParsed = extractJsonPayload<{
      audioQualityStatus?: string;
      heardTranscript?: string;
    }>(blindGateResp.text || '');

    const blindStatus = String(blindParsed?.audioQualityStatus || 'NO_SPEECH_DETECTED')
      .trim()
      .toUpperCase();
    const blindTranscript = String(blindParsed?.heardTranscript || '').trim();

    if (blindStatus !== 'CLEAR' || !blindTranscript) {
      const nonClearStatus =
        blindStatus === 'TOO_NOISY_OR_LOW' || blindStatus === 'WRONG_LANGUAGE'
          ? blindStatus
          : 'NO_SPEECH_DETECTED';
      return res.json({
        success: true,
        evaluation: buildNonClearPronunciationResult(
          nonClearStatus,
          accent,
          mode,
          blindTranscript
        ),
      });
    }

    // PASS 2 — DETAILED BRAZILIAN-LEARNER PHONETIC INSPECTION ON RAW AUDIO + UNBIASED TRANSCRIPT
    const systemInstruction = [
      'Você é um Fonoaudiólogo Acústico e Professor Sênior de Pronúncia de Inglês especializado em alunos brasileiros (EWM Keep practicing).',
      'DIRETRIZ INEGOCIÁVEL: Escute DIRETAMENTE o sinal acústico real do áudio anexado e respeite a transcrição acústica cega (blindHeardTranscript) capturada sem viés.',
      'PROIBIDO autocorrigir palavras omitidas ou trocadas! Se uma palavra de targetText não aparece em blindHeardTranscript ou foi pronunciada como outra palavra (ex.: "sink" em vez de "thinks", "workee" em vez de "worked", palavra pulada), marque OBRIGATORIAMENTE status = "MISPRONOUNCED_OR_MISSING".',
      'Inspecione rigorosamente os padrões fonéticos de falantes brasileiros:',
      '  a) Vogal epentética /i/ após consoantes mudas/oclusivas finais (ex.: falar "work-ee", "stop-ee", "Facebook-ee", "hot-ee", "back-ee");',
      '  b) Sons de TH desvozeado /θ/ (think, three, worth) e vozeado /ð/ (this, brother, the, that) trocados por /t/, /d/, /s/, /z/ ou /f/;',
      '  c) Terminações do passado regular -ed (/t/, /d/ vs /ɪd/) pronunciadas incorretamente com sílaba extra "-êdi" (ex.: "worked" deve soar /wɜːrkt/ com T seco, NUNCA "uórkêdi");',
      '  d) Contraste de vogais críticas (/ɪ/ curto vs /iː/ longo como live/leave, ship/sheep, it/eat; /æ/ vs /ɛ/ como bad/bed), L velarizado final (dark L em call, feel, well — língua tocando atrás dos dentes superiores, não som puro de U "cóu/fíu") e letras mudas (subtle, debt, doubt, muscle, listen, honest);',
      '  e) Sílaba tônica (word stress), linking e ritmo natural compatíveis com o sotaque selecionado.',
      'CLAREZA PEDAGÓGICA LEIGA: Em phoneticCuePtBr, escreva um guia intuitivo que qualquer brasileiro entenda de imediato (ex.: "wârkt (/wɜːrkt/ · T seco, sem som de i)"), evitando jargão acadêmico intimidador. Em tipPtBr, dê 1 linha prática e cirúrgica de posição de boca/língua em português.',
    ].join('\n');

    const userPrompt = [
      `Sotaque de referência selecionado pelo aluno: ${accent} (${accentProfileDescription})`,
      `Modo de feedback: ${mode === 'card-quick' ? 'Micro-treino rápido de Flashcard (seja conciso e cirúrgico)' : 'Laboratório completo Speaking Lab (diagnóstico fonético detalhado palavra por palavra)'}`,
      `Transcrição acústica cega ouvida sem viés (blindHeardTranscript): "${blindTranscript}"`,
      `Frase-alvo esperada (targetText): "${targetText}"`,
      `Lista ordenada de palavras de targetText (${targetWordsList.length} palavras): ${JSON.stringify(targetWordsList)}`,
      'Analise acusticamente cada palavra do áudio contra targetText e retorne estritamente o JSON validado.',
    ].join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: cleanMimeType,
                data: cleanBase64,
              },
            },
            {
              text: userPrompt,
            },
          ],
        },
      ],
      config: {
        temperature: 0.0,
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: PRONUNCIATION_EVALUATION_SCHEMA,
      },
    });

    const parsed = extractJsonPayload<RawPronunciationPayload>(response.text || '');
    if (!parsed) {
      throw new Error('Resposta JSON vazia na avaliação acústica.');
    }

    // Anchor heardTranscript to the unbiased Pass 1 transcript if model left it blank
    if (!parsed.heardTranscript || !parsed.heardTranscript.trim()) {
      parsed.heardTranscript = blindTranscript;
    }

    const validatedEvaluation = enforceDeterministicPronunciationInvariants(
      parsed,
      targetText,
      accent,
      mode
    );

    return res.json({
      success: true,
      evaluation: validatedEvaluation,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err || '');
    return res.status(502).json({
      success: false,
      reason: 'ACOUSTIC_EVALUATION_FAILED',
      error:
        errMsg ||
        'Não foi possível concluir a análise acústica neste momento. Verifique sua conexão e tente novamente.',
    });
  }
});

app.get('/api/dev/tunnel', async (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.json({ active: false, tunnelUrl: null });
  }
  try {
    const tunnelFile = path.join(__dirname, '.tunnel-url.tmp');
    const raw = (await fs.promises.readFile(tunnelFile, 'utf-8')).trim();
    if (/^https:\/\/[a-z0-9.-]+/i.test(raw)) {
      return res.json({ active: true, tunnelUrl: raw });
    }
  } catch {
    // No active tunnel file
  }
  return res.json({ active: false, tunnelUrl: null });
});

// Mount Vite in dev mode or serve static files in production, injecting absolute HTTPS OpenGraph URLs
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        allowedHosts: true,
      },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/@') ||
        req.path.startsWith('/src/') ||
        req.path.startsWith('/node_modules/')
      ) {
        return next();
      }
      const ext = path.extname(req.path);
      if (ext && ext !== '.html') {
        return next();
      }
      try {
        const rawTemplate = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        const origin = resolvePublicOrigin(req.headers, process.env.APP_URL);
        const finalHtml = injectAbsoluteSocialMetadata(transformed, origin, req.path);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(finalHtml);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    const distIndexPath = path.join(distPath, 'index.html');
    app.use(express.static(distPath, { index: false }));

    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      const ext = path.extname(req.path);
      if (ext && ext !== '.html') {
        return res.status(404).end();
      }
      try {
        const distTemplate = await fs.promises.readFile(distIndexPath, 'utf-8');
        const origin = resolvePublicOrigin(req.headers, process.env.APP_URL);
        const finalHtml = injectAbsoluteSocialMetadata(distTemplate, origin, req.path);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(finalHtml);
      } catch (err) {
        next(err);
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();
