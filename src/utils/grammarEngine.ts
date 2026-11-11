import { AI_COLLOQUIAL_KB } from '../data/seedData';
import type { GrammarAuditResult } from '../types/flashcard';

export const IRREGULAR_VERB_FORMS: Record<string, string[]> = {
  be: ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
  beat: ['beat', 'beats', 'beaten', 'beating'],
  become: ['become', 'becomes', 'became', 'becoming'],
  begin: ['begin', 'begins', 'began', 'begun', 'beginning'],
  bite: ['bite', 'bites', 'bit', 'bitten', 'biting'],
  blow: ['blow', 'blows', 'blew', 'blown', 'blowing'],
  break: ['break', 'breaks', 'broke', 'broken', 'breaking'],
  bring: ['bring', 'brings', 'brought', 'bringing'],
  build: ['build', 'builds', 'built', 'building'],
  buy: ['buy', 'buys', 'bought', 'buying'],
  catch: ['catch', 'catches', 'caught', 'catching'],
  choose: ['choose', 'chooses', 'chose', 'chosen', 'choosing'],
  come: ['come', 'comes', 'came', 'coming'],
  cut: ['cut', 'cuts', 'cutting'],
  deal: ['deal', 'deals', 'dealt', 'dealing'],
  do: ['do', 'does', 'did', 'done', 'doing'],
  draw: ['draw', 'draws', 'drew', 'drawn', 'drawing'],
  drink: ['drink', 'drinks', 'drank', 'drunk', 'drinking'],
  drive: ['drive', 'drives', 'drove', 'driven', 'driving'],
  eat: ['eat', 'eats', 'ate', 'eaten', 'eating'],
  fall: ['fall', 'falls', 'fell', 'fallen', 'falling'],
  feel: ['feel', 'feels', 'felt', 'feeling'],
  fight: ['fight', 'fights', 'fought', 'fighting'],
  find: ['find', 'finds', 'found', 'finding'],
  fly: ['fly', 'flies', 'flew', 'flown', 'flying'],
  forget: ['forget', 'forgets', 'forgot', 'forgotten', 'forgetting'],
  get: ['get', 'gets', 'got', 'gotten', 'getting'],
  give: ['give', 'gives', 'gave', 'given', 'giving'],
  go: ['go', 'goes', 'went', 'gone', 'going'],
  grow: ['grow', 'grows', 'grew', 'grown', 'growing'],
  hang: ['hang', 'hangs', 'hung', 'hanging'],
  have: ['have', 'has', 'had', 'having'],
  hear: ['hear', 'hears', 'heard', 'hearing'],
  hide: ['hide', 'hides', 'hid', 'hidden', 'hiding'],
  hit: ['hit', 'hits', 'hitting'],
  hold: ['hold', 'holds', 'held', 'holding'],
  keep: ['keep', 'keeps', 'kept', 'keeping'],
  know: ['know', 'knows', 'knew', 'known', 'knowing'],
  lead: ['lead', 'leads', 'led', 'leading'],
  leave: ['leave', 'leaves', 'left', 'leaving'],
  let: ['let', 'lets', 'letting'],
  lose: ['lose', 'loses', 'lost', 'losing'],
  make: ['make', 'makes', 'made', 'making'],
  mean: ['mean', 'means', 'meant', 'meaning'],
  meet: ['meet', 'meets', 'met', 'meeting'],
  pay: ['pay', 'pays', 'paid', 'paying'],
  put: ['put', 'puts', 'putting'],
  read: ['read', 'reads', 'reading'],
  ring: ['ring', 'rings', 'rang', 'rung', 'ringing'],
  rise: ['rise', 'rises', 'rose', 'risen', 'rising'],
  run: ['run', 'runs', 'ran', 'running'],
  say: ['say', 'says', 'said', 'saying'],
  see: ['see', 'sees', 'saw', 'seen', 'seeing'],
  sell: ['sell', 'sells', 'sold', 'selling'],
  send: ['send', 'sends', 'sent', 'sending'],
  set: ['set', 'sets', 'setting'],
  shake: ['shake', 'shakes', 'shook', 'shaken', 'shaking'],
  show: ['show', 'shows', 'showed', 'shown', 'showing'],
  shut: ['shut', 'shuts', 'shutting'],
  sing: ['sing', 'sings', 'sang', 'sung', 'singing'],
  sit: ['sit', 'sits', 'sat', 'sitting'],
  sleep: ['sleep', 'sleeps', 'slept', 'sleeping'],
  speak: ['speak', 'speaks', 'spoke', 'spoken', 'speaking'],
  spend: ['spend', 'spends', 'spent', 'spending'],
  stand: ['stand', 'stands', 'stood', 'standing'],
  steal: ['steal', 'steals', 'stole', 'stolen', 'stealing'],
  stick: ['stick', 'sticks', 'stuck', 'sticking'],
  sweep: ['sweep', 'sweeps', 'swept', 'sweeping'],
  take: ['take', 'takes', 'took', 'taken', 'taking'],
  teach: ['teach', 'teaches', 'taught', 'teaching'],
  tear: ['tear', 'tears', 'tore', 'torn', 'tearing'],
  tell: ['tell', 'tells', 'told', 'telling'],
  think: ['think', 'thinks', 'thought', 'thinking'],
  throw: ['throw', 'throws', 'threw', 'thrown', 'throwing'],
  understand: ['understand', 'understands', 'understood', 'understanding'],
  wake: ['wake', 'wakes', 'woke', 'woken', 'waking'],
  wear: ['wear', 'wears', 'wore', 'worn', 'wearing'],
  win: ['win', 'wins', 'won', 'winning'],
  write: ['write', 'writes', 'wrote', 'written', 'writing'],
};

const SYNTHETIC_PATTERNS: string[] = [
  "in real life, you'll hear people use",
  'everyone at work uses',
  'let\'s use "',
  'in everyday conversation, people often say',
  'in everyday american english, people often say',
  'in everyday english, "',
  'you will often hear native speakers use "',
  'we really need to ',
  "it's much easier to ",
  'to be honest, the whole situation felt a little ',
  'everyone noticed how ',
  'everything worked out much better than we expected',
  'she explained the whole plan ',
  'make sure you double-check the ',
  'having a good ',
  "wait a second—didn't sarah mention something about",
  'my brother texted me this morning saying he finally figured out how to',
  'before friday, next week is going to be crazy',
  'we were grabbing coffee earlier when',
  'nobody expected things to turn out like that, but',
  'look, the easiest way to handle this whole situation is to just',
  'even after a long day at work, we still managed to',
  'can we talk for five minutes? i really need your advice on how to',
  'every time we travel together, something about',
  'she told the whole group that',
  'once you get used to it, dealing with',
  'i was watching a movie last night and heard the main character say',
  'honestly, we just need to ',
  'how did you guys manage to ',
  'right now so we can call it a day',
  'right now so we can grab some dinner',
  'earlier, and it actually went pretty well',
  'earlier, and it actually went super smoothly',
  'man, that whole meeting yesterday was totally',
  "to be honest, i've been feeling pretty",
  'everyone thought the new idea was super',
  'everyone thought the new restaurant downtown was super',
  "it's crazy how ",
  'dealing with ',
  'turned out to be a total game changer for us',
  'turned out to be a total lifesaver for us',
  'did you hear about the ',
  'we ran into an issue with the ',
  'we ran into a small issue with the ',
  'she said as soon as we walked into the room',
  'he said right before the meeting started',
  'all i could say was "',
  'her immediate answer was "',
  'mandar o "',
  'no sentido de "',
  'exemplo prático no sentido de "',
];

export function isGenericTemplateSentence(sentence: string | undefined | null): boolean {
  if (!sentence) return true;
  const lower = String(sentence).toLowerCase().trim();
  if (
    (lower.startsWith('we really need to ') && lower.endsWith(' before the end of the week.')) ||
    (lower.startsWith("it's much easier to ") && lower.endsWith(' when everyone helps out.')) ||
    (lower.startsWith('everyone noticed how ') && lower.endsWith(' things were during the trip.')) ||
    (lower.startsWith('she explained the whole plan ') && lower.endsWith(' during the meeting.')) ||
    (lower.startsWith('make sure you double-check the ') && lower.endsWith(' before leaving home.')) ||
    (lower.startsWith('having a good ') && lower.endsWith(' makes a huge difference at work.'))
  ) {
    return true;
  }
  return SYNTHETIC_PATTERNS.some((pat) => lower.includes(pat));
}

interface GrammarRule {
  code: string;
  regex: RegExp;
  reason: string;
}

const GRAMMAR_RULES: GrammarRule[] = [
  {
    code: 'PLURAL_NOUN_IT_AGREEMENT',
    regex:
      /\b(shoes|jeans|pants|trousers|shorts|glasses|sunglasses|scissors|clothes|headphones|stairs|savings|belongings)\b[^.!?]*?\b(take\s+it|try\s+it\s+on|buy\s+it|wear\s+it|love\s+it|like\s+it|find\s+it|put\s+it\s+on|it\s+is|it\s+was|it\s+fits)\b/i,
    reason:
      'Erro de concordância: substantivos plurais em inglês (shoes, jeans, pants, glasses, clothes) exigem pronome no plural ("them / they are"), nunca "it".',
  },
  {
    code: 'PLURAL_NOUN_SINGULAR_DET_OR_VERB',
    regex:
      /\b(?:(a|an|this|that)\s+(shoes|jeans|pants|trousers|shorts|glasses|sunglasses|scissors|clothes)|(shoes|jeans|pants|trousers|shorts|glasses|sunglasses|scissors|clothes)\s+(is|was|has|fits|costs))\b/i,
    reason:
      'Erro de concordância: "shoes, jeans, pants, glasses, clothes" são sempre plurais em inglês (use "these/those" e verbo no plural "are/were/fit", ou "a pair of...").',
  },
  {
    code: 'UNCOUNTABLE_PLURALIZED',
    regex:
      /\b(informations|advices|homeworks|luggages|baggages|furnitures|equipments|knowledges|feedbacks|softwares|researches|traffics|weathers|progresses)\b/i,
    reason:
      'Erro gramatical: substantivo incontável em inglês (information, advice, homework, luggage, furniture, equipment, knowledge, feedback) NUNCA recebe "s" no plural.',
  },
  {
    code: 'UNCOUNTABLE_INDEFINITE_ARTICLE',
    regex:
      /\b(a|an)\s+(?:good\s+|great\s+|new\s+|useful\s+|important\s+)?(information|advice|homework|luggage|baggage|furniture|equipment|knowledge|feedback|news|progress)\b/i,
    reason:
      'Erro gramatical: substantivo incontável não aceita artigo indefinido "a / an" (use "some...", "a piece of...", "great...").',
  },
  {
    code: 'AGE_WITH_HAVE',
    regex: /\b(i|you|he|she|we|they)\s+(have|has|had)\s+\d+\s+years\b/i,
    reason:
      'Erro clássico: para dizer a idade em inglês, usa-se o verbo "to be" ("I am 25 years old"), nunca o verbo "have".',
  },
  {
    code: 'DEPEND_OF',
    regex: /\bdepend(?:s|ed|ing)?\s+of\b/i,
    reason:
      'Erro de regência: o verbo "depend" exige sempre a preposição ON ("depend ON"), nunca "depend of".',
  },
  {
    code: 'MARRIED_WITH',
    regex: /\bmarried\s+with\b/i,
    reason:
      'Erro de regência: para dizer "casado(a) com", use sempre "married TO", nunca "married with".',
  },
  {
    code: 'INTERESTED_ON',
    regex: /\binterested\s+on\b/i,
    reason: 'Erro de regência: use sempre "interested IN" (e nunca "interested on").',
  },
  {
    code: 'ARRIVE_TO',
    regex: /\barrive(?:s|d|ing)?\s+to\b/i,
    reason:
      'Erro de preposição: nunca use "arrive to". Use "arrive IN" (cidades/países), "arrive AT" (locais específicos) ou "arrive home/here/there".',
  },
  {
    code: 'LISTEN_WITHOUT_TO',
    regex:
      /\blisten(?:s|ed|ing)?\s+(?:the|a|an|my|your|his|her|our|their|some|music|podcasts?|radios?|songs?)\b/i,
    reason:
      'Erro de regência: quando "listen" tem objeto, exige sempre a preposição TO ("listen TO music", "listen TO me").',
  },
  {
    code: 'WAIT_WITHOUT_FOR',
    regex:
      /\bwait(?:s|ed|ing)?\s+(?:me|you|him|her|us|them|the\s+bus|the\s+train|the\s+flight|the\s+cab|the\s+taxi)\b/i,
    reason:
      'Erro de regência: para "esperar por alguém ou algo", use sempre "wait FOR" ("wait for me", "wait for the bus").',
  },
  {
    code: 'EXPLAIN_WITHOUT_TO',
    regex: /\bexplain(?:s|ed|ing)?\s+(?:me|you|him|her|us|them)\b/i,
    reason:
      'Erro de regência: nunca diga "explain me / explain you". O verbo "explain" exige TO antes da pessoa ("explain it TO me" ou "explain TO me how...").',
  },
  {
    code: 'DISCUSS_ABOUT',
    regex: /\bdiscuss(?:es|ed|ing)?\s+about\b/i,
    reason:
      'Erro de regência: o verbo "discuss" já significa "conversar sobre" e NÃO aceita a preposição "about" ("discuss the project").',
  },
  {
    code: 'EMPHASIZE_ON',
    regex: /\bemphasize(?:s|d|ing)?\s+on\b/i,
    reason: 'Erro de regência: o verbo "emphasize" não aceita a preposição "on".',
  },
  {
    code: 'ASK_TELL_TO_PERSON',
    regex: /\b(?:ask|asked|tell|told)\s+to\s+(?:me|you|him|her|us|them)\b/i,
    reason:
      'Erro de regência: "ask" e "tell" recebem a pessoa diretamente sem "to" ("tell me", "ask him").',
  },
  {
    code: 'SAID_PERSON_WITHOUT_TO',
    regex: /\bsaid\s+(?:me|you|him|her|us|them)\b/i,
    reason: 'Erro de regência: com "said", use "said TO me" (ou troque por "told me").',
  },
  {
    code: 'IN_THE_LAST_MINUTE',
    regex: /\bin\s+the\s+last\s+minute\b/i,
    reason: 'Erro de preposição: em inglês dizemos "AT the last minute" (e nunca "in the last minute").',
  },
  {
    code: 'BE_AGREE',
    regex: /\b(?:am|is|are|was|were|be)\s+agree\b/i,
    reason:
      'Erro clássico: "agree" é um verbo ("I agree / Do you agree?"), portanto nunca use "to be" antes dele ("I am agree" está incorreto).',
  },
  {
    code: 'LOOK_FORWARD_TO_BASE_VERB',
    regex:
      /\blook(?:s|ed|ing)?\s+forward\s+to\s+(?:see|hear|meet|work|go|travel|start|have|be|talk|visit|receive|get|make|do)\b/i,
    reason:
      'Regra de ouro: após "look forward to", o verbo deve estar com "-ING" (ex.: "looking forward to meeting you").',
  },
  {
    code: 'DOUBLE_MODAL_OR_FOR_TO',
    regex: /\b(?:for\s+to\s+\w+|can\s+to\s+\w+|must\s+to\s+\w+|should\s+to\s+\w+)\b/i,
    reason:
      'Erro gramatical: verbos modais (can, must, should) não usam "to", e propósito em inglês usa apenas "to + verbo" (nunca "for to").',
  },
];

export function auditEnglishGrammarAndCollocations(
  enText: string,
  _termToMatch = ''
): GrammarAuditResult {
  if (!enText || typeof enText !== 'string') {
    return { valid: false, ruleCode: 'EMPTY', reason: 'A frase em inglês está vazia.' };
  }
  const clean = enText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length < 12) {
    return {
      valid: false,
      ruleCode: 'TOO_SHORT',
      reason: 'A frase é muito curta para demonstrar contexto real.',
    };
  }
  if (isGenericTemplateSentence(clean)) {
    return {
      valid: false,
      ruleCode: 'SYNTHETIC_TEMPLATE',
      reason: 'Frase sintética/molde genérico bloqueada para proteger a qualidade do estudo.',
    };
  }
  if (/\s\/\s/.test(clean)) {
    return {
      valid: false,
      ruleCode: 'SLASH_IN_SENTENCE',
      reason: 'Evite unir duas frases ou palavras com barra (/) na mesma caixa de exemplo.',
    };
  }

  for (const r of GRAMMAR_RULES) {
    if (r.regex.test(clean)) {
      return { valid: false, ruleCode: r.code, reason: r.reason };
    }
  }

  return {
    valid: true,
    ruleCode: 'OK',
    reason: 'Frase gramaticalmente íntegra e validada pelo motor do professor.',
  };
}

export function getWordFormsRegex(word: string): string {
  const w = word.toLowerCase();
  if (IRREGULAR_VERB_FORMS[w]) {
    return '(?:' + IRREGULAR_VERB_FORMS[w].join('|') + ')';
  }
  const forms = new Set<string>([
    w,
    w + 's',
    w + 'es',
    w + 'd',
    w + 'ed',
    w + 'ing',
    w + 'ly',
    w + 'er',
    w + 'est',
  ]);
  if (w.endsWith('e') && w.length > 2) {
    const stem = w.slice(0, -1);
    forms.add(stem + 'ed');
    forms.add(stem + 'ing');
    forms.add(stem + 'er');
    forms.add(stem + 'est');
  }
  if (w.endsWith('y') && w.length > 2 && !/[aeiou]y$/.test(w)) {
    const yStem = w.slice(0, -1) + 'i';
    forms.add(yStem + 'es');
    forms.add(yStem + 'ed');
    forms.add(yStem + 'er');
    forms.add(yStem + 'est');
    forms.add(yStem + 'ly');
  }
  if (w.length >= 3 && /[^aeiou][aeiou][bdfglmnprt]$/.test(w)) {
    const lastChar = w.slice(-1);
    forms.add(w + lastChar + 'ed');
    forms.add(w + lastChar + 'ing');
    forms.add(w + lastChar + 'er');
    forms.add(w + lastChar + 'est');
  }
  return (
    '(?:' +
    Array.from(forms)
      .map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|') +
    ')'
  );
}

export function isGoodRealExampleSentence(s: string, termToMatch: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const clean = s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length < 18 || clean.length > 135) return false;
  const wordCount = clean.split(/\s+/).length;
  if (wordCount < 4 || wordCount > 22) return false;
  if (isGenericTemplateSentence(clean)) return false;
  const grammarAudit = auditEnglishGrammarAndCollocations(clean, termToMatch);
  if (!grammarAudit.valid) return false;
  if (
    /(\bthou\b|\bthee\b|\bthy\b|\bhath\b|\bdoth\b|\bunto\b|\bwhereof\b|\bshal\b|\[\d+|\(\d{4}\)|ibid\.|op\. cit|^["“'][^"”']+["”'],\s*(?:he|she|they|i)\s+said)/i.test(
      clean
    )
  ) {
    return false;
  }

  const rawTokens = String(termToMatch || '')
    .toLowerCase()
    .replace(/^to\s+/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z\s']/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (rawTokens.length === 0) return true;

  const lowerClean = clean.toLowerCase();
  if (rawTokens.length === 1) {
    const reSingle = new RegExp('\\b' + getWordFormsRegex(rawTokens[0]) + '\\b', 'i');
    return reSingle.test(lowerClean);
  }

  const firstPattern = getWordFormsRegex(rawTokens[0]);
  const restPatterns = rawTokens
    .slice(1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const phrasalRegexStr =
    '\\b' +
    firstPattern +
    '\\b(?:\\s+\\w+){0,5}?\\s+\\b' +
    restPatterns.join('\\s+') +
    '\\b';
  try {
    const rePhrasal = new RegExp(phrasalRegexStr, 'i');
    return rePhrasal.test(lowerClean);
  } catch {
    return lowerClean.includes(rawTokens.join(' '));
  }
}

export function scoreTeacherSentenceCandidate(
  enSentence: string,
  termToMatch: string,
  sourceType = 'dictionary'
): number {
  if (!isGoodRealExampleSentence(enSentence, termToMatch)) return -100;
  let score = 0;
  const wc = enSentence.trim().split(/\s+/).length;

  if (sourceType === 'ai_teacher') score += 45;
  else if (sourceType === 'google_dict') score += 40;
  else if (sourceType === 'oxford_dict') score += 38;
  else if (sourceType === 'wiktionary') score += 30;
  else if (sourceType === 'tatoeba') score += 25;

  if (wc >= 6 && wc <= 15) score += 25;
  else if (wc >= 5 && wc <= 18) score += 12;
  else score -= 10;

  if (
    /\b(work|meeting|office|project|report|client|team|boss|schedule|deadline|trip|flight|hotel|airport|travel|coffee|dinner|lunch|friend|family|phone|call|message|email|today|tomorrow|yesterday|morning|night|weekend|week|always|usually|never|really|because|before|after|when|while|if|so)\b/i.test(
      enSentence
    )
  ) {
    score += 18;
  }

  if (/[:;]/.test(enSentence)) score -= 8;
  if (/\b(Tom|Mary)\b/.test(enSentence)) score -= 6;

  return score;
}

export function normalizePhrasalLookupKey(rawInput: string): string {
  let k = String(rawInput || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[.!?,"'“”]+/g, '')
    .trim();
  k = k.replace(/^to\s+/, '');
  if (AI_COLLOQUIAL_KB[k]) return k;
  const stripped = k
    .replace(/\b(someone|somebody|something|it|them|him|her|me|you|us|one's|your|my)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (AI_COLLOQUIAL_KB[stripped]) return stripped;
  return k;
}
