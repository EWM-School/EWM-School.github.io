import type { EnglishAccent } from '../types/flashcard';

export type TtsCadenceSpeed = 'normal' | 'slow';

export interface VoiceLikeDescriptor {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

export interface LocaleSpeechProfile {
  readonly accent: EnglishAccent;
  readonly bcp47: 'en-US' | 'en-GB';
  readonly geminiVoiceName: 'Kore' | 'Charon';
  readonly webSpeechNormalRate: number;
  readonly webSpeechSlowRate: number;
  readonly webSpeechPitch: number;
}

/**
 * Strictly isolated immutable speech profiles for General American (`en-US`)
 * and British Received Pronunciation (`en-GB`).
 */
export const LOCALE_SPEECH_PROFILES: Readonly<Record<EnglishAccent, LocaleSpeechProfile>> = {
  us: Object.freeze({
    accent: 'us',
    bcp47: 'en-US',
    geminiVoiceName: 'Kore',
    webSpeechNormalRate: 0.94,
    webSpeechSlowRate: 0.68,
    webSpeechPitch: 1.0,
  }),
  uk: Object.freeze({
    accent: 'uk',
    bcp47: 'en-GB',
    geminiVoiceName: 'Charon',
    // Natural 0.98 pitch preserves neural vocal formants with subtle baritone warmth (zero robotic distortion)
    webSpeechNormalRate: 0.91,
    webSpeechSlowRate: 0.66,
    webSpeechPitch: 0.98,
  }),
};

export interface RpLexiconEntry {
  /** Canonical British English spelling */
  ukSpelling: string;
  /** Exact Received Pronunciation (RP / Southern Standard British) IPA */
  ipa: string;
  /**
   * Optional safe G2P phonetic respelling used ONLY for non-SSML Web Speech engines
   * on heteronyms where engines frequently default to American pronunciation.
   */
  webSpeechRespell?: string;
  /** Short phonetic note for vocal direction */
  phenomenon: string;
}

/**
 * Curated British Received Pronunciation (RP) G2P & IPA Override Dictionary.
 * Targets words where TTS engines most frequently leak American pronunciations.
 */
export const UK_RP_IPA_LEXICON: Readonly<Record<string, RpLexiconEntry>> = {
  // Classic US vs UK consonant/vowel heteronyms
  schedule: {
    ukSpelling: 'schedule',
    ipa: 'ˈʃɛdjuːl',
    webSpeechRespell: 'shedule',
    phenomenon: 'initial /ʃ/ + yod /juː/',
  },
  schedules: {
    ukSpelling: 'schedules',
    ipa: 'ˈʃɛdjuːlz',
    webSpeechRespell: 'shedules',
    phenomenon: 'initial /ʃ/ + yod /juː/',
  },
  scheduled: {
    ukSpelling: 'scheduled',
    ipa: 'ˈʃɛdjuːld',
    webSpeechRespell: 'sheduled',
    phenomenon: 'initial /ʃ/ + yod /juː/',
  },
  scheduling: {
    ukSpelling: 'scheduling',
    ipa: 'ˈʃɛdjuːlɪŋ',
    webSpeechRespell: 'sheduling',
    phenomenon: 'initial /ʃ/ + yod /juː/',
  },
  reschedule: {
    ukSpelling: 'reschedule',
    ipa: 'ˌriːˈʃɛdjuːl',
    webSpeechRespell: 'reshedule',
    phenomenon: 'initial /ʃ/ in root + yod /juː/',
  },
  rescheduled: {
    ukSpelling: 'rescheduled',
    ipa: 'ˌriːˈʃɛdjuːld',
    webSpeechRespell: 'resheduled',
    phenomenon: 'initial /ʃ/ in root + yod /juː/',
  },
  rescheduling: {
    ukSpelling: 'rescheduling',
    ipa: 'ˌriːˈʃɛdjuːlɪŋ',
    webSpeechRespell: 'resheduling',
    phenomenon: 'initial /ʃ/ in root + yod /juː/',
  },
  lieutenant: {
    ukSpelling: 'lieutenant',
    ipa: 'lɛfˈtɛnənt',
    webSpeechRespell: 'leftenant',
    phenomenon: 'British /lɛf-/ realization',
  },
  lieutenants: {
    ukSpelling: 'lieutenants',
    ipa: 'lɛfˈtɛnənts',
    webSpeechRespell: 'leftenants',
    phenomenon: 'British /lɛf-/ realization',
  },
  vitamin: {
    ukSpelling: 'vitamin',
    ipa: 'ˈvɪtəmɪn',
    phenomenon: 'short /ɪ/ in first syllable',
  },
  vitamins: {
    ukSpelling: 'vitamins',
    ipa: 'ˈvɪtəmɪnz',
    phenomenon: 'short /ɪ/ in first syllable',
  },
  privacy: {
    ukSpelling: 'privacy',
    ipa: 'ˈprɪvəsi',
    phenomenon: 'short /ɪ/ in first syllable',
  },
  herb: {
    ukSpelling: 'herb',
    ipa: 'hɜːb',
    phenomenon: 'pronounced initial /h/ + non-rhotic /ɜː/',
  },
  herbs: {
    ukSpelling: 'herbs',
    ipa: 'hɜːbz',
    phenomenon: 'pronounced initial /h/ + non-rhotic /ɜː/',
  },
  herbal: {
    ukSpelling: 'herbal',
    ipa: 'ˈhɜːbəl',
    phenomenon: 'pronounced initial /h/ + non-rhotic /ɜː/',
  },
  tomato: {
    ukSpelling: 'tomato',
    ipa: 'təˈmɑːtəʊ',
    phenomenon: 'PALM vowel /ɑː/ + crisp /t/ + GOAT /əʊ/',
  },
  tomatoes: {
    ukSpelling: 'tomatoes',
    ipa: 'təˈmɑːtəʊz',
    phenomenon: 'PALM vowel /ɑː/ + crisp /t/ + GOAT /əʊ/',
  },
  garage: {
    ukSpelling: 'garage',
    ipa: 'ˈɡærɑːʒ',
    phenomenon: 'first-syllable stress /ˈɡærɑːʒ/',
  },
  garages: {
    ukSpelling: 'garages',
    ipa: 'ˈɡærɑːʒɪz',
    phenomenon: 'first-syllable stress /ˈɡærɑːʒɪz/',
  },
  either: {
    ukSpelling: 'either',
    ipa: 'ˈaɪðə',
    phenomenon: 'PRICE diphthong /aɪ/ + non-rhotic schwa',
  },
  neither: {
    ukSpelling: 'neither',
    ipa: 'ˈnaɪðə',
    phenomenon: 'PRICE diphthong /aɪ/ + non-rhotic schwa',
  },
  leisure: {
    ukSpelling: 'leisure',
    ipa: 'ˈlɛʒə',
    phenomenon: 'DRESS vowel /ɛ/ + non-rhotic schwa',
  },
  advertisement: {
    ukSpelling: 'advertisement',
    ipa: 'ədˈvɜːtɪsmənt',
    phenomenon: 'second-syllable stress + non-rhotic /ɜː/',
  },
  mobile: {
    ukSpelling: 'mobile',
    ipa: 'ˈməʊbaɪl',
    phenomenon: 'GOAT /əʊ/ + full /aɪl/',
  },
  fragile: {
    ukSpelling: 'fragile',
    ipa: 'ˈfrædʒaɪl',
    phenomenon: 'full /aɪl/ ending',
  },
  missile: {
    ukSpelling: 'missile',
    ipa: 'ˈmɪsaɪl',
    phenomenon: 'full /aɪl/ ending',
  },
  hostile: {
    ukSpelling: 'hostile',
    ipa: 'ˈhɒstaɪl',
    phenomenon: 'LOT /ɒ/ + full /aɪl/ ending',
  },
  route: {
    ukSpelling: 'route',
    ipa: 'ruːt',
    phenomenon: 'GOOSE vowel /uː/ + crisp /t/',
  },
  zebra: {
    ukSpelling: 'zebra',
    ipa: 'ˈzɛbrə',
    phenomenon: 'DRESS vowel /ɛ/',
  },
  clerk: {
    ukSpelling: 'clerk',
    ipa: 'klɑːk',
    phenomenon: 'British /klɑːk/ non-rhotic PALM vowel',
  },
  vase: {
    ukSpelling: 'vase',
    ipa: 'vɑːz',
    phenomenon: 'PALM vowel /ɑːz/',
  },
  dynasty: {
    ukSpelling: 'dynasty',
    ipa: 'ˈdɪnəsti',
    phenomenon: 'short KIT vowel /ɪ/',
  },
  patriot: {
    ukSpelling: 'patriot',
    ipa: 'ˈpætriət',
    phenomenon: 'TRAP vowel /æ/ + crisp /t/',
  },
  aluminum: {
    ukSpelling: 'aluminium',
    ipa: 'ˌæljuˈmɪniəm',
    webSpeechRespell: 'aluminium',
    phenomenon: '5-syllable British aluminium',
  },
  aluminium: {
    ukSpelling: 'aluminium',
    ipa: 'ˌæljuˈmɪniəm',
    phenomenon: '5-syllable British aluminium',
  },
  laboratory: {
    ukSpelling: 'laboratory',
    ipa: 'ləˈbɒrətri',
    phenomenon: 'second-syllable stress /ləˈbɒrətri/',
  },
  controversy: {
    ukSpelling: 'controversy',
    ipa: 'ˈkɒntrəvɜːsi',
    phenomenon: 'LOT /ɒ/ + non-rhotic /ɜː/',
  },
  pasta: {
    ukSpelling: 'pasta',
    ipa: 'ˈpæstə',
    phenomenon: 'short TRAP vowel /æ/',
  },
  yogurt: {
    ukSpelling: 'yoghurt',
    ipa: 'ˈjɒɡət',
    webSpeechRespell: 'yoghurt',
    phenomenon: 'short LOT /ɒ/ + non-rhotic schwa',
  },
  yoghurt: {
    ukSpelling: 'yoghurt',
    ipa: 'ˈjɒɡət',
    phenomenon: 'short LOT /ɒ/ + non-rhotic schwa',
  },
  oregano: {
    ukSpelling: 'oregano',
    ipa: 'ˌɒrɪˈɡɑːnəʊ',
    phenomenon: 'third-syllable stress /ˌɒrɪˈɡɑːnəʊ/',
  },
  basil: {
    ukSpelling: 'basil',
    ipa: 'ˈbæzəl',
    phenomenon: 'short TRAP vowel /æ/',
  },
  buoy: {
    ukSpelling: 'buoy',
    ipa: 'bɔɪ',
    phenomenon: 'CHOICE diphthong /bɔɪ/',
  },

  // High-frequency RP Phonological Anchors (Non-rhoticity, Crisp /t/, TRAP-BATH, LOT, Yod-retention)
  water: {
    ukSpelling: 'water',
    ipa: 'ˈwɔːtə',
    phenomenon: 'crisp alveolar /t/ + non-rhotic final schwa',
  },
  better: {
    ukSpelling: 'better',
    ipa: 'ˈbɛtə',
    phenomenon: 'crisp alveolar /t/ + non-rhotic final schwa',
  },
  matter: {
    ukSpelling: 'matter',
    ipa: 'ˈmætə',
    phenomenon: 'crisp alveolar /t/ + non-rhotic final schwa',
  },
  later: {
    ukSpelling: 'later',
    ipa: 'ˈleɪtə',
    phenomenon: 'crisp alveolar /t/ + non-rhotic final schwa',
  },
  city: {
    ukSpelling: 'city',
    ipa: 'ˈsɪti',
    phenomenon: 'crisp alveolar intervocalic /t/',
  },
  pretty: {
    ukSpelling: 'pretty',
    ipa: 'ˈprɪti',
    phenomenon: 'crisp alveolar intervocalic /t/',
  },
  little: {
    ukSpelling: 'little',
    ipa: 'ˈlɪtəl',
    phenomenon: 'crisp alveolar /t/',
  },
  bottle: {
    ukSpelling: 'bottle',
    ipa: 'ˈbɒtəl',
    phenomenon: 'rounded LOT /ɒ/ + crisp alveolar /t/',
  },
  duty: {
    ukSpelling: 'duty',
    ipa: 'ˈdjuːti',
    phenomenon: 'yod-retention /dj/ + crisp alveolar /t/',
  },
  new: {
    ukSpelling: 'new',
    ipa: 'njuː',
    phenomenon: 'yod-retention /njuː/',
  },
  knew: {
    ukSpelling: 'knew',
    ipa: 'njuː',
    phenomenon: 'yod-retention /njuː/',
  },
  tuesday: {
    ukSpelling: 'Tuesday',
    ipa: 'ˈtjuːzdeɪ',
    phenomenon: 'yod-retention /tjuː/',
  },
  student: {
    ukSpelling: 'student',
    ipa: 'ˈstjuːdnt',
    phenomenon: 'yod-retention /stjuː/',
  },
  students: {
    ukSpelling: 'students',
    ipa: 'ˈstjuːdnts',
    phenomenon: 'yod-retention /stjuː/',
  },
  opportunity: {
    ukSpelling: 'opportunity',
    ipa: 'ˌɒpəˈtjuːnɪti',
    phenomenon: 'LOT /ɒ/ + non-rhotic schwa + yod /tjuː/ + crisp /t/',
  },
  bath: {
    ukSpelling: 'bath',
    ipa: 'bɑːθ',
    phenomenon: 'BATH vowel /ɑː/',
  },
  ask: {
    ukSpelling: 'ask',
    ipa: 'ɑːsk',
    phenomenon: 'BATH vowel /ɑː/',
  },
  asked: {
    ukSpelling: 'asked',
    ipa: 'ɑːskt',
    phenomenon: 'BATH vowel /ɑː/',
  },
  dance: {
    ukSpelling: 'dance',
    ipa: 'dɑːns',
    phenomenon: 'BATH vowel /ɑː/',
  },
  "can't": {
    ukSpelling: "can't",
    ipa: 'kɑːnt',
    phenomenon: 'BATH vowel /ɑː/',
  },
  fast: {
    ukSpelling: 'fast',
    ipa: 'fɑːst',
    phenomenon: 'BATH vowel /ɑː/',
  },
  last: {
    ukSpelling: 'last',
    ipa: 'lɑːst',
    phenomenon: 'BATH vowel /ɑː/',
  },
  past: {
    ukSpelling: 'past',
    ipa: 'pɑːst',
    phenomenon: 'BATH vowel /ɑː/',
  },
  pass: {
    ukSpelling: 'pass',
    ipa: 'pɑːs',
    phenomenon: 'BATH vowel /ɑː/',
  },
  glass: {
    ukSpelling: 'glass',
    ipa: 'ɡlɑːs',
    phenomenon: 'BATH vowel /ɑː/',
  },
  glasses: {
    ukSpelling: 'glasses',
    ipa: 'ˈɡlɑːsɪz',
    phenomenon: 'BATH vowel /ɑː/',
  },
  class: {
    ukSpelling: 'class',
    ipa: 'klɑːs',
    phenomenon: 'BATH vowel /ɑː/',
  },
  classes: {
    ukSpelling: 'classes',
    ipa: 'ˈklɑːsɪz',
    phenomenon: 'BATH vowel /ɑː/',
  },
  grass: {
    ukSpelling: 'grass',
    ipa: 'ɡrɑːs',
    phenomenon: 'BATH vowel /ɑː/',
  },
  staff: {
    ukSpelling: 'staff',
    ipa: 'stɑːf',
    phenomenon: 'BATH vowel /ɑː/',
  },
  castle: {
    ukSpelling: 'castle',
    ipa: 'ˈkɑːsəl',
    phenomenon: 'BATH vowel /ɑː/ + silent t',
  },
  after: {
    ukSpelling: 'after',
    ipa: 'ˈɑːftə',
    phenomenon: 'BATH vowel /ɑː/ + non-rhotic final schwa',
  },
  afternoon: {
    ukSpelling: 'afternoon',
    ipa: 'ˌɑːftəˈnuːn',
    phenomenon: 'BATH vowel /ɑː/ + non-rhotic medial schwa',
  },
  example: {
    ukSpelling: 'example',
    ipa: 'ɪɡˈzɑːmpəl',
    phenomenon: 'BATH vowel /ɑː/',
  },
  chance: {
    ukSpelling: 'chance',
    ipa: 'tʃɑːns',
    phenomenon: 'BATH vowel /ɑː/',
  },
  answer: {
    ukSpelling: 'answer',
    ipa: 'ˈɑːnsə',
    phenomenon: 'BATH vowel /ɑː/ + non-rhotic schwa',
  },
  half: {
    ukSpelling: 'half',
    ipa: 'hɑːf',
    phenomenon: 'BATH vowel /ɑː/',
  },
  laugh: {
    ukSpelling: 'laugh',
    ipa: 'lɑːf',
    phenomenon: 'BATH vowel /ɑː/',
  },
  car: {
    ukSpelling: 'car',
    ipa: 'kɑː',
    phenomenon: 'non-rhotic /kɑː/',
  },
  hard: {
    ukSpelling: 'hard',
    ipa: 'hɑːd',
    phenomenon: 'non-rhotic /hɑːd/',
  },
  learn: {
    ukSpelling: 'learn',
    ipa: 'lɜːn',
    phenomenon: 'non-rhotic NURSE vowel /ɜː/',
  },
  lot: {
    ukSpelling: 'lot',
    ipa: 'lɒt',
    phenomenon: 'rounded short LOT vowel /ɒ/ + crisp /t/',
  },
  hot: {
    ukSpelling: 'hot',
    ipa: 'hɒt',
    phenomenon: 'rounded short LOT vowel /ɒ/ + crisp /t/',
  },
  stop: {
    ukSpelling: 'stop',
    ipa: 'stɒp',
    phenomenon: 'rounded short LOT vowel /ɒ/',
  },
  not: {
    ukSpelling: 'not',
    ipa: 'nɒt',
    phenomenon: 'rounded short LOT vowel /ɒ/ + crisp /t/',
  },
  coffee: {
    ukSpelling: 'coffee',
    ipa: 'ˈkɒfi',
    phenomenon: 'rounded short LOT vowel /ɒ/',
  },
};

/**
 * Unambiguous American -> British orthographic conversions for TTS pre-processing.
 * Display text on UI cards stays untouched; this normalizes spoken prompts so TTS engines
 * activate British grapheme-to-phoneme & prosodic rules accurately.
 */
const US_TO_UK_SPELLING_MAP: Readonly<Record<string, string>> = {
  color: 'colour',
  colors: 'colours',
  colored: 'coloured',
  colorful: 'colourful',
  favor: 'favour',
  favors: 'favours',
  favored: 'favoured',
  favorite: 'favourite',
  favorites: 'favourites',
  flavor: 'flavour',
  flavors: 'flavours',
  honor: 'honour',
  honors: 'honours',
  honored: 'honoured',
  humor: 'humour',
  labor: 'labour',
  neighbor: 'neighbour',
  neighbors: 'neighbours',
  neighborhood: 'neighbourhood',
  behavior: 'behaviour',
  rumor: 'rumour',
  rumors: 'rumours',
  center: 'centre',
  centers: 'centres',
  centered: 'centred',
  theater: 'theatre',
  theaters: 'theatres',
  meter: 'metre',
  meters: 'metres',
  kilometer: 'kilometre',
  kilometers: 'kilometres',
  liter: 'litre',
  liters: 'litres',
  fiber: 'fibre',
  organize: 'organise',
  organized: 'organised',
  organizing: 'organising',
  organization: 'organisation',
  realize: 'realise',
  realized: 'realised',
  realizing: 'realising',
  recognize: 'recognise',
  recognized: 'recognised',
  apologize: 'apologise',
  apologized: 'apologised',
  apologizing: 'apologising',
  prioritize: 'prioritise',
  prioritized: 'prioritised',
  summarize: 'summarise',
  summarized: 'summarised',
  memorize: 'memorise',
  memorized: 'memorised',
  analyze: 'analyse',
  analyzed: 'analysed',
  analyzing: 'analysing',
  paralyze: 'paralyse',
  canceled: 'cancelled',
  canceling: 'cancelling',
  traveled: 'travelled',
  traveling: 'travelling',
  traveler: 'traveller',
  travelers: 'travellers',
  labeled: 'labelled',
  labeling: 'labelling',
  modeled: 'modelled',
  modeling: 'modelling',
  defense: 'defence',
  offense: 'offence',
  pretense: 'pretence',
  catalog: 'catalogue',
  dialog: 'dialogue',
  gray: 'grey',
  skeptical: 'sceptical',
  aluminum: 'aluminium',
  yogurt: 'yoghurt',
  mustache: 'moustache',
  pajamas: 'pyjamas',
  jewelry: 'jewellery',
  fulfill: 'fulfil',
  fulfilled: 'fulfilled',
  skillful: 'skilful',
};

function preserveWordCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (
    original[0] === original[0].toUpperCase() &&
    original.slice(1) === original.slice(1).toLowerCase()
  ) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Normalizes BCP-47 language tags across browsers (`en_GB`, `en-gb`, `en-GB-oxendict` -> `en-GB`).
 */
export function normalizeVoiceLangTag(rawLang: string | null | undefined): string {
  const cleaned = String(rawLang || '').trim().replace(/_/g, '-');
  if (!cleaned) return '';
  if (/^en-gb(-|$)/i.test(cleaned) || /^en-uk(-|$)/i.test(cleaned)) return 'en-GB';
  if (/^en-us(-|$)/i.test(cleaned)) return 'en-US';
  const parts = cleaned.split('-');
  if (parts.length >= 2) {
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
  }
  return parts[0].toLowerCase();
}

export function isRoboticFallbackSynthVoice(
  voice: VoiceLikeDescriptor | null | undefined
): boolean {
  if (!voice) return true;
  const name = String(voice.name || '').toLowerCase();
  return /espeak|festival|flite|mbrola/.test(name);
}

/**
 * Strict British (`en-GB`) voice validator.
 * Rejects `en-US`, `en-AU`, `en-CA`, `en-IE`, `en-IN`, `pt-*`, and robotic eSpeak engines.
 */
export function isStrictBritishVoice(
  voice: VoiceLikeDescriptor | null | undefined
): boolean {
  if (!voice) return false;
  if (isRoboticFallbackSynthVoice(voice)) return false;
  const normLang = normalizeVoiceLangTag(voice.lang);
  if (normLang !== 'en-GB') return false;
  const name = String(voice.name || '').toLowerCase();
  if (/united states|\bus\b|american|portugu|brasil|brazil/.test(name)) return false;
  return true;
}

/**
 * Strict American (`en-US`) voice validator.
 * Rejects `en-GB`, Commonwealth locales, `pt-*`, and robotic eSpeak engines.
 */
export function isStrictAmericanVoice(
  voice: VoiceLikeDescriptor | null | undefined
): boolean {
  if (!voice) return false;
  if (isRoboticFallbackSynthVoice(voice)) return false;
  const normLang = normalizeVoiceLangTag(voice.lang);
  if (normLang !== 'en-US') return false;
  const name = String(voice.name || '').toLowerCase();
  if (/\buk\b|british|great britain|portugu|brasil|brazil/.test(name)) return false;
  return true;
}

/**
 * Detects Tier-1 Neural `en-GB` voices (`Google UK English Male/Female`, Microsoft Natural Neural, etc.).
 */
export function isHighQualityNeuralBritishVoice(
  voice: VoiceLikeDescriptor | null | undefined
): boolean {
  if (!isStrictBritishVoice(voice)) return false;
  const name = String(voice!.name || '');
  return /google uk english (male|female)|online \(natural\)|natural|\b(ryan|sonia|libby|thomas|maisie|alfie|oliver|daniel|serena|arthur)\b/i.test(
    name
  );
}

/**
 * Converts American spellings into standard British English orthography while preserving casing and punctuation.
 */
export function normalizeBritishOrthography(rawText: string): string {
  if (!rawText) return '';
  return rawText.replace(/\b([A-Za-z]+(?:'[A-Za-z]+)?)\b/g, (word) => {
    const lower = word.toLowerCase();
    const mapped = US_TO_UK_SPELLING_MAP[lower];
    if (mapped) {
      return preserveWordCase(word, mapped);
    }
    const lexEntry = UK_RP_IPA_LEXICON[lower];
    if (lexEntry && lexEntry.ukSpelling.toLowerCase() !== lower) {
      return preserveWordCase(word, lexEntry.ukSpelling);
    }
    return word;
  });
}

/**
 * Prepares plain text for non-SSML Web Speech `en-GB` engines:
 * 1. Applies British orthography (`colour`, `realise`, `centre`, `travelling`, `aluminium`).
 * 2. Applies targeted G2P respelling cues on notorious heteronyms (`schedule` -> `shedule`, `lieutenant` -> `leftenant`).
 * 3. Normalizes punctuation spacing for natural didactic clause pauses.
 */
export function prepareBritishWebSpeechText(rawText: string): string {
  const ukOrthography = normalizeBritishOrthography(rawText);
  const respelled = ukOrthography.replace(/\b([A-Za-z]+(?:'[A-Za-z]+)?)\b/g, (word) => {
    const entry = UK_RP_IPA_LEXICON[word.toLowerCase()];
    if (entry?.webSpeechRespell) {
      return preserveWordCase(word, entry.webSpeechRespell);
    }
    return word;
  });

  return respelled
    .replace(/\s*([,;:])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds W3C-valid SSML (`<speak xml:lang="en-GB"><lang xml:lang="en-GB">...`)
 * with `<phoneme alphabet="ipa" ph="...">` overrides for SSML-compatible TTS engines.
 */
export function buildBritishRpSsml(
  rawText: string,
  speed: TtsCadenceSpeed = 'normal'
): string {
  const normalized = normalizeBritishOrthography(rawText).trim();
  const rateAttr = speed === 'slow' ? '72%' : '94%';

  const tokenRegex = /([A-Za-z]+(?:'[A-Za-z]+)?)|([^A-Za-z]+)/g;
  const parts: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(normalized)) !== null) {
    const word = match[1];
    const nonWord = match[2];
    if (word) {
      const entry = UK_RP_IPA_LEXICON[word.toLowerCase()];
      const safeWord = escapeXml(word);
      if (entry) {
        parts.push(`<phoneme alphabet="ipa" ph="${escapeXml(entry.ipa)}">${safeWord}</phoneme>`);
      } else {
        parts.push(safeWord);
      }
    } else if (nonWord) {
      if (/[,;:]/.test(nonWord)) {
        parts.push(`${escapeXml(nonWord)}<break time="160ms"/>`);
      } else {
        parts.push(escapeXml(nonWord));
      }
    }
  }

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB"><lang xml:lang="en-GB"><prosody rate="${rateAttr}">${parts.join('')}</prosody></lang></speak>`;
}

export interface LinkingRInstance {
  leftWord: string;
  rightWord: string;
}

export interface BritishRpAcousticAnalysis {
  normalizedText: string;
  matchedIpaHints: Array<{ word: string; ipa: string; phenomenon: string }>;
  linkingRPairs: LinkingRInstance[];
}

/**
 * Analyzes an English phrase for British RP IPA lexicon targets and natural Linking-R boundaries
 * (word-final `-r` / `-re` followed immediately by a vowel-initial word, e.g. "for a", "clear it", "matter of").
 */
export function analyzeBritishRpFeatures(rawText: string): BritishRpAcousticAnalysis {
  const normalizedText = normalizeBritishOrthography(rawText).trim();
  const words = normalizedText.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];

  const seenLower = new Set<string>();
  const matchedIpaHints: Array<{ word: string; ipa: string; phenomenon: string }> = [];

  for (const w of words) {
    const lower = w.toLowerCase();
    if (seenLower.has(lower)) continue;
    const entry = UK_RP_IPA_LEXICON[lower];
    if (entry) {
      seenLower.add(lower);
      matchedIpaHints.push({
        word: w,
        ipa: `/${entry.ipa}/`,
        phenomenon: entry.phenomenon,
      });
    }
  }

  const linkingRPairs: LinkingRInstance[] = [];
  const pairRegex = /\b([A-Za-z]*(?:r|re))\s+([aeiouAEIOU][A-Za-z']*)\b/g;
  let pairMatch: RegExpExecArray | null;
  while ((pairMatch = pairRegex.exec(normalizedText)) !== null) {
    const left = pairMatch[1];
    const right = pairMatch[2];
    // Exclude silent-h exceptions or non-vowel /juː/ starts like "unique", "university", "use", "european"
    if (!/^(uni|use|usu|eur|one\b)/i.test(right)) {
      linkingRPairs.push({ leftWord: left, rightWord: right });
    }
  }

  return {
    normalizedText,
    matchedIpaHints,
    linkingRPairs,
  };
}

export const BRITISH_RP_SYSTEM_INSTRUCTION = `You are a native Southern Standard British English (Received Pronunciation / Modern RP) voice actor and diction coach for English learners.
Speak ONLY the exact English text provided by the user. NEVER add commentary, prefaces, explanations, or read phonetic symbols aloud.

Mandatory Acoustic & Phonological Rules (en-GB Received Pronunciation):
1. Non-rhoticity: NEVER pronounce post-vocalic /r/ at the end of syllables or before consonants (e.g., car /kɑː/, hard /hɑːd/, water /ˈwɔːtə/, better /ˈbɛtə/, learn /lɜːn/). Pronounce a smooth linking /r/ ONLY when a word ending in -r/-re is immediately followed by a vowel sound in the next word.
2. TRAP-BATH Split: Use the long open back unrounded vowel /ɑː/ in BATH lexical set words (bath, ask, dance, can't, fast, last, past, pass, glass, class, grass, staff, castle, after, afternoon, example, chance, answer, half, laugh), NEVER the American /æ/.
3. Crisp Alveolar /t/: Articulate intervocalic /t/ cleanly as a true voiceless alveolar plosive [t] (water /ˈwɔːtə/, better /ˈbɛtə/, city /ˈsɪti/, duty /ˈdjuːti/, little, bottle, matter, later). STRICTLY FORBID the American alveolar flap [ɾ] (never make medial /t/ sound like /d/).
4. LOT & THOUGHT Vowels: Produce rounded short open-mid back /ɒ/ in LOT words (lot, hot, stop, not, got, job, coffee, bottle) rather than unrounded American /ɑː/, and rounded /ɔː/ in THOUGHT/NORTH words.
5. Yod-Retention (/j/): Preserve the palatal approximant /j/ after alveolar consonants /t, d, n, s, z, l/ before /uː/ (new /njuː/, Tuesday /ˈtjuːzdeɪ/, duty /ˈdjuːti/, student /ˈstjuːdnt/, schedule /ˈʃɛdjuːl/, opportunity /ˌɒpəˈtjuːnɪti/).
6. Natural Didactic British Prosody: Deliver warm, authentic British intonation (falling-rising polite contours and crisp clause boundaries) with natural human rhythm—never robotic, monotone, or rushed.`;

export const GENERAL_AMERICAN_SYSTEM_INSTRUCTION = `You are a native General American English (en-US) voice actor and diction coach for English learners.
Speak ONLY the exact English text provided by the user. NEVER add commentary, prefaces, explanations, or read phonetic symbols aloud.
Deliver warm, natural General American pronunciation with clear rhotic /ɹ/, natural intervocalic tap [ɾ] where idiomatic (e.g., water, better), and clear didactic pacing.`;

export interface GeminiTtsDirective {
  accent: EnglishAccent;
  languageCode: 'en-US' | 'en-GB';
  voiceName: 'Kore' | 'Charon';
  normalizedText: string;
  systemInstruction: string;
  speechStyle: string;
  matchedIpaHints: Array<{ word: string; ipa: string; phenomenon: string }>;
}

/**
 * Builds the complete, strictly isolated Gemini 3.8 TTS configuration (`systemInstruction`,
 * `speechMetadata.style`, `languageCode`, `voiceName`, and normalized text) without ever leaking
 * instructions into the spoken transcript.
 */
export function buildGeminiTtsDirective(
  rawText: string,
  accent: EnglishAccent,
  speed: TtsCadenceSpeed = 'normal'
): GeminiTtsDirective {
  const profile = LOCALE_SPEECH_PROFILES[accent];
  const paceDirective =
    speed === 'slow'
      ? 'Deliberate, slow didactic learner pace (~0.7x speed) with crystal-clear syllable articulation and gentle pauses.'
      : 'Natural, clear conversational teaching pace with warm human prosody.';

  if (accent === 'uk') {
    const analysis = analyzeBritishRpFeatures(rawText);
    const ipaNotes =
      analysis.matchedIpaHints.length > 0
        ? ` Mandatory RP pronunciations in this phrase: ${analysis.matchedIpaHints
            .slice(0, 14)
            .map((h) => `"${h.word}" as ${h.ipa}`)
            .join(', ')}.`
        : '';
    const linkingNote =
      analysis.linkingRPairs.length > 0
        ? ` Apply smooth British linking-R across: ${analysis.linkingRPairs
            .map((p) => `"${p.leftWord} ${p.rightWord}"`)
            .join(', ')}.`
        : ' Strictly non-rhotic (drop all post-vocalic R sounds).';

    return {
      accent: 'uk',
      languageCode: profile.bcp47,
      voiceName: profile.geminiVoiceName,
      normalizedText: analysis.normalizedText,
      systemInstruction: BRITISH_RP_SYSTEM_INSTRUCTION,
      speechStyle: `Authentic native Southern Standard British English (Received Pronunciation, en-GB) male educator. Crisp alveolar T (no American flap), TRAP-BATH /ɑː/, rounded LOT /ɒ/, yod-retention /njuː, tjuː, djuː/.${linkingNote}${ipaNotes} ${paceDirective}`,
      matchedIpaHints: analysis.matchedIpaHints,
    };
  }

  return {
    accent: 'us',
    languageCode: profile.bcp47,
    voiceName: profile.geminiVoiceName,
    normalizedText: String(rawText || '').replace(/\s+/g, ' ').trim(),
    systemInstruction: GENERAL_AMERICAN_SYSTEM_INSTRUCTION,
    speechStyle: `Authentic native General American English (en-US) educator, warm natural prosody. ${paceDirective}`,
    matchedIpaHints: [],
  };
}
