import type { EnglishAccent, Flashcard } from '../types/flashcard';
import { registerDictionaryAudioUrls } from './speech';

export interface ResolvedCardPhonetics {
  meaning: string;
  us: string;
  uk: string;
  ukNote: string | null;
  ukVariantTerm: string | null;
}

interface CuratedUkEntry {
  uk: string;
  ukNote?: string;
  ukVariantTerm?: string;
}

/**
 * Hand-audited British English (Received Pronunciation / Modern Southern British — EWM-UK)
 * phonetic package for all 172 native EWM cards.
 *
 * Key phonological distinctions faithfully represented for Brazilian learners:
 * 1. Non-rhoticity: post-vocalic /r/ is silent before consonants or pauses (e.g. water /UÓ-tâ/, card /KÁAD/),
 *    while Linking R is preserved before vowel-initial words (e.g. Where are you? /uéâr áa IÚ/).
 * 2. Crisp British /t/: no American alveolar flap between vowels (water /UÓ-tâ/, beautiful /BIÚ-ti-fôl/, later /LÊI-tâ/).
 * 3. TRAP–BATH split: long /ɑː/ (/áa/) in afternoon, last, password, after; short /æ/ (/é/) in pasta (/PÉS-tâ/).
 * 4. GOAT diphthong /əʊ/: central onset (/êu/) in no /nêu/, don't /dêunt/, phone /FÊUN/, hold /rêuld/, okay /êu-KÊI/.
 * 5. Lexical contrasts: reschedule /ri-XÉ-diul/, sure /XÓA/.
 */
export const CURATED_SEED_UK_BY_ID: Record<string, CuratedUkEntry> = {
  // Idioms & Vocabulary (c1 – c44)
  c1: { uk: '/sâm ÂP/ (conectado: /sâ-MÂP/)' },
  c2: { uk: '/tu sâm ÂP/' },
  c3: { uk: '/lóng STÓ-ri XÓT/' },
  c4: { uk: '/kât tu dâ TCHÊIS/' },
  c5: {
    uk: '/bít a-RÁUND dâ BÚX/',
    ukNote: "No Reino Unido também é muito natural dizer 'Beat about the bush' (/bít a-BÁUT dâ BÚX/).",
    ukVariantTerm: 'Beat about the bush',
  },
  c6: {
    uk: '/têik it uíd a GRÊIN âv SÓLT/',
    ukNote: "No inglês britânico (UK), a variante consagrada é 'Take it with a pinch of salt'.",
    ukVariantTerm: 'Take it with a pinch of salt',
  },
  c7: { uk: '/nêu BRÊI-nâ/' },
  c8: { uk: '/kól it a DÊI/ (conectado: /kó-li-ta DÊI/)' },
  c9: { uk: '/plêi it bái Í-â/' },
  c10: { uk: '/ÂN-dâ dâ UÉ-dâ/' },
  c11: { uk: '/kât KÓ-nâz/' },
  c12: { uk: '/báit dâ BÚ-lit/' },
  c13: { uk: '/blêu óf STÍM/' },
  c14: { uk: '/guét kêuld FÍT/' },
  c15: { uk: '/guív sâm-uân dâ kêuld XÊU-dâ/' },
  c16: { uk: '/rép mái RÉD a-RÁUND it/' },
  c17: { uk: '/É-laiz/' },
  c18: { uk: '/É-lai/' },
  c19: { uk: '/a-PRÚ-vôl/' },
  c20: { uk: '/DÍ-ôl/' },
  c21: { uk: '/É-vri-uânz/' },
  c22: { uk: '/frâm náu ÓN/' },
  c23: {
    uk: '/GRÊIDZ/',
    ukNote: "Nos EUA usa-se 'grades'; no Reino Unido usa-se com frequência 'marks' para notas de provas.",
  },
  c24: { uk: '/LÍ-gôl ÉÂ-ri-â/' },
  c25: {
    uk: '/MÓK tést/',
    ukNote: "No Reino Unido, simulados escolares também são chamados apenas de 'mocks' (mock exams).",
  },
  c26: { uk: '/SKÓO/' },
  c27: { uk: '/SÉV-rôl/' },
  c28: { uk: '/XÓT-li/' },
  c29: { uk: '/sún i-NÂF/' },
  c30: { uk: '/STRÂ-gôlz/' },
  c31: { uk: '/SÂ-mâ-ri/' },
  c32: {
    uk: '/SÂ-mâ-raiz/',
    ukNote: "Grafia britânica (UK): 'Summarise' (com S), mantendo exatamente a mesma pronúncia.",
  },
  c33: { uk: '/ték-TÓ-nik XÍFT/' },
  c34: { uk: '/DÉÂ-fó/' },
  c35: { uk: '/uí UÂÂ/' },
  c36: { uk: '/uéâ uíâr ÉT/' },
  c37: { uk: '/UÍT-nês/' },
  c38: { uk: '/Í-xiu-in/' },
  c39: { uk: '/MÍ-zâ-râ-bôl/' },
  c40: { uk: '/rêuld ÓN/ (conectado: /rêul-DÓN/)' },
  c41: { uk: '/ri-FIÚ-zin/' },
  c42: { uk: '/MÊUST/' },
  c43: { uk: '/fól bi-RÁIND/' },
  c44: {
    uk: '/PRÍ-ti UÉL/',
    ukNote: 'No inglês britânico o T de pretty é pronunciado com nitidez (/PRÍ-ti/), sem virar R brando.',
  },

  // Dicas da Mari (mari_1 – mari_114)
  mari_1: { uk: '/gúd MÓ-nin/ (fala rápida: /gú-MÓ-nin/)' },
  mari_2: {
    uk: '/gúd áaf-tâ-NÚN/ (conectado: /gú-dáaf-tâ-NÚN/)',
    ukNote: 'No sul da Inglaterra (RP), o A de afternoon é longo e aberto (/áaf-tâ-NÚN/), e o D conecta direto sem virar R.',
  },
  mari_3: { uk: '/gúd ÍV-nin/ (conectado: /gú-dÍV-nin/)' },
  mari_4: { uk: '/gúd NÁIT/' },
  mari_5: { uk: '/RÁI/' },
  mari_6: { uk: '/ráu áa IÚ/' },
  mari_7: {
    uk: '/áim GÚD/',
    ukNote: "Britânicos também respondem muito 'I'm alright, thanks!' ou 'Not bad, thanks!'.",
  },
  mari_8: { uk: '/áim nót sêu GÚD/' },
  mari_9: {
    uk: '/THÉNK iú/',
    ukNote: "No Reino Unido, 'Cheers!' (/TCHÍ-âz/) também é muito usado informalmente para agradecer.",
  },
  mari_10: { uk: '/nêu UÂ-riz/' },
  mari_11: { uk: '/têik ió TÁIM/' },
  mari_12: { uk: '/lét mi THÍNK/' },
  mari_13: {
    uk: '/sáundz GÚD/',
    ukNote: "No Reino Unido também se ouve muito 'Sounds lovely!' ou 'Sounds brilliant!'.",
  },
  mari_14: {
    uk: '/ái dêunt GUÉT it/',
    ukNote: 'No sotaque britânico o T final de get permanece T claro (/GUÉT it/), sem virar R (/GUÉ-rit/).',
  },
  mari_15: { uk: '/kén iú ri-PÍT DÉT/' },
  mari_16: { uk: '/kén iú spík mó SLÊU-li/' },
  mari_17: { uk: '/uót dâz dét MÍN/' },
  mari_18: { uk: '/âv KÓOS/' },
  mari_19: { uk: '/nót RÍÂ-li/' },
  mari_20: { uk: '/ít di-PÉNDZ/' },
  mari_21: {
    uk: '/áim nót XÓA/',
    ukNote: 'No inglês britânico moderno, sure soa /XÓA/ (vogal longa aberta, sem R final).',
  },
  mari_22: { uk: '/áim BÍ-zi/' },
  mari_23: { uk: '/áim TÁI-âd/' },
  mari_24: { uk: '/áim UÂ-kin/' },
  mari_25: { uk: '/áim FRÍ náu/' },
  mari_26: { uk: '/uót a-BÁUT iú/ (conectado: /uó-ta-BÁUT iú/)' },
  mari_27: { uk: '/léts GRÉB a KÓ-fi/' },
  mari_28: { uk: '/áa iú RÂN-gri/' },
  mari_29: { uk: '/uót du iú THÍNK/' },
  mari_30: { uk: '/áid LÂV tu/' },
  mari_31: { uk: '/MÊI-bi NÉKST táim/' },
  mari_32: { uk: '/áa iú FRÍ tu-MÓ-rêu/' },
  mari_33: { uk: '/áim a-VÊI-lâ-bôl/' },
  mari_34: { uk: '/áa iú a-VÊI-lâ-bôl/' },
  mari_35: { uk: '/uót TÁIM uâks fâ iú/' },
  mari_36: { uk: '/dét UÂKS fâ mí/' },
  mari_37: { uk: '/sí iú DÉN/' },
  mari_38: {
    uk: '/kén uí ri-XÉ-diul/',
    ukNote: 'Contraste clássico: nos EUA diz-se /ri-SKÉ-djul/ (som de SK), enquanto no Reino Unido diz-se /ri-XÉ-diul/ (som de X)!',
  },
  mari_39: { uk: '/lét mi NÊU/' },
  mari_40: { uk: '/uéâr íz dâ BÓ-din GUÊIT/' },
  mari_41: {
    uk: '/uéâ kén ái guét mái LÂ-guidj/',
    ukNote: "'Luggage' é a palavra preferida no Reino Unido; nos EUA também se vê muito 'Baggage Claim'.",
  },
  mari_42: {
    uk: '/ráu MÂTCH íz dâ RÁID/',
    ukNote: "Em táxis no Reino Unido (black cabs), também é muito comum perguntar 'How much is the fare?'.",
  },
  mari_43: { uk: '/ráu du ái guét DÉÂ/' },
  mari_44: {
    uk: '/kén iú têik a PÍK-tchâr âv mí/',
    ukNote: "Note o R de ligação (Linking R) em 'picture of' (/PÍK-tchâr âv/) quando seguido de vogal no inglês britânico.",
  },
  mari_45: { uk: '/ái LÂV it/' },
  mari_46: { uk: '/ái LÁIK it/' },
  mari_47: { uk: '/ái DÊUNT LÁIK it/' },
  mari_48: {
    uk: '/íts mái FÊI-vâ-rit/',
    ukNote: "Grafia britânica (UK): 'It's my favourite!' (com 'ou').",
  },
  mari_49: { uk: '/ái RÊIT it/' },
  mari_50: { uk: '/mái NÊIM íz/' },
  mari_51: { uk: '/áim frâm brâ-ZÍL/' },
  mari_52: { uk: '/áim tuén-ti fáiv iîâz ÊULD/' },
  mari_53: { uk: '/ái UÂK éz a/' },
  mari_54: { uk: '/ái LÁIK PLÊI-in/' },
  mari_55: {
    uk: '/náis tu MÍT iú/',
    ukNote: "Em contextos britânicos também se ouve 'Lovely to meet you!'.",
  },
  mari_56: { uk: '/uúd iú LÁIK sâm KÓ-fi/' },
  mari_57: { uk: '/du iú UÓNT tu gréb a BÁIT/' },
  mari_58: { uk: '/gréb a BÁIT/' },
  mari_59: { uk: '/kén iú RÊLP mí/' },
  mari_60: { uk: '/áim LÚ-kin fó/' },
  mari_61: { uk: '/ráu dâz dís UÂK/' },
  mari_62: { uk: '/djâst a SÉ-kând/' },
  mari_63: { uk: '/ái a-PRÍ-xi-êit it/' },
  mari_64: { uk: '/áim RÂN-gri/' },
  mari_65: { uk: '/áim ÉN-gri/' },
  mari_66: { uk: '/áim THÂS-ti/' },
  mari_67: { uk: '/ráu MÂTCH íz it/' },
  mari_68: { uk: '/áim djâst LÚ-kin, THÉNKS/' },
  mari_69: { uk: '/kén ái TRÁI it ÓN/ (conectado: /ké-nái TRÁI i-tón/)' },
  mari_70: {
    uk: '/kén ái PÊI bái KÁAD/',
    ukNote: "No Reino Unido o R de card não é pronunciado, alongando o A (/KÁAD/); também se diz muito 'Can I pay contactless?'.",
  },
  mari_71: { uk: '/áil TÊIK it/' },
  mari_72: { uk: '/áim RÂ-nin LÊIT/' },
  mari_73: { uk: '/áim STÂK in TRÉ-fik/' },
  mari_74: {
    uk: '/mái FÊUN íz DÁI-in/',
    ukNote: "No Reino Unido, 'celular' no dia a dia é chamado de 'mobile' (My mobile is dying), enquanto nos EUA diz-se 'cell phone'.",
  },
  mari_75: { uk: '/ái fâ-GÓT mái KÍZ/' },
  mari_76: {
    uk: '/áil KÓL iú BÉK/',
    ukNote: "No Reino Unido também é comum ouvir 'I'll ring you back'.",
    ukVariantTerm: "I'll ring you back.",
  },
  mari_77: {
    uk: '/ió BIÚ-ti-fôl/',
    ukNote: 'No sotaque britânico o T de beautiful é nítido (/BIÚ-ti-fôl/), diferente do flap americano (/BIÚ-ri-fôl/).',
  },
  mari_78: { uk: '/iú lúk a-MÊI-zin/' },
  mari_79: { uk: '/ái LÂV iór ÁUT-fit/' },
  mari_80: { uk: '/iú rév a BIÚ-ti-fôl SMÁIL/' },
  mari_81: { uk: '/ái LÂV ió RÉÂ/' },
  mari_82: { uk: '/kén ái SÍ dâ MÉ-niu/' },
  mari_83: {
    uk: '/áid LÁIK dâ PÉS-tâ, PLÍZ/',
    ukNote: 'Curiosidade nativa: nos EUA pasta tem A aberto (/PÁS-ta/), enquanto no Reino Unido tem vogal frontal curta (/PÉS-tâ/)!',
  },
  mari_84: {
    uk: '/kén ái RÉV sâm UÓ-tâ/',
    ukNote: 'Exemplo clássico US vs. UK: americano /UÓ-râr/ (flap T + R final) vs. britânico /UÓ-tâ/ (T claro e sem R final)!',
  },
  mari_85: { uk: '/íts di-LÍ-xâs/' },
  mari_86: {
    uk: '/kén ái RÉV dâ BÍL, PLÍZ/',
    ukNote: "'The bill' é o padrão nativo do Reino Unido! Nos EUA também é muito comum pedir 'Can I get the check, please?'.",
  },
  mari_87: { uk: '/kén ái TÉKST iú/' },
  mari_88: { uk: '/sénd mi a PÍK-tchâ/' },
  mari_89: {
    uk: '/uéâr áa IÚ/',
    ukNote: 'Repare no R de ligação (Linking R) entre where e are (/uéâr áa/), mas sem R no final de are antes de you!',
  },
  mari_90: { uk: '/ái GÓT ió MÉ-sidj/' },
  mari_91: { uk: '/áil ri-PLÁI LÊI-tâ/' },
  mari_92: { uk: '/íts SÂ-ni/' },
  mari_93: { uk: '/íts RÊI-nin/' },
  mari_94: { uk: '/íts RÍÂ-li RÓT tu-DÊI/' },
  mari_95: { uk: '/íts FRÍ-zin/' },
  mari_96: { uk: '/íts KLÁU-di/' },
  mari_97: { uk: '/uóts dâ UÉ-dâ láik tu-DÊI/' },
  mari_98: { uk: '/nêu PRÓ-blâm/' },
  mari_99: { uk: '/déts êu-KÊI/' },
  mari_100: { uk: '/SÓ-ri áim LÊIT/' },
  mari_101: { uk: '/THÉNKS fâ ió RÊLP/' },
  mari_102: { uk: '/ái RÉV a ré-zâ-VÊI-xân/' },
  mari_103: { uk: '/áid LÁIK tu tchék ÍN/' },
  mari_104: { uk: '/íz BRÉK-fâst in-KLÚ-did/' },
  mari_105: {
    uk: '/uóts dâ UÁI-fái PÁAS-uâd/',
    ukNote: 'Em inglês britânico (RP), password usa A longo (/PÁAS-uâd/), enquanto nos EUA usa /PÉS-uôrd/.',
  },
  mari_106: { uk: '/uót TÁIM íz TCHÉK-áut/' },
  mari_107: { uk: '/KÁIND âv/ (conectado: /KÁIN-dâv/)' },
  mari_108: { uk: '/KÁIN-dâ/' },
  mari_109: { uk: '/SÓT âv/ (conectado: /SÓ-tâv/)' },
  mari_110: {
    uk: '/ét dâ LÁAST MÍ-nit/',
    ukNote: 'No inglês britânico (sul da Inglaterra / RP), last tem A longo (/LÁAST/), diferente do americano /LÉST/.',
  },
  mari_111: { uk: '/áim ig-ZÓS-tid/' },
  mari_112: { uk: '/áim uóon ÁUT/' },
  mari_113: { uk: '/áim DRÊIND/' },
  mari_114: {
    uk: '/áim BÍT/',
    ukNote: "'I'm beat' é mais norte-americano; no Reino Unido a expressão coloquial favorita para 'exausto' é 'I'm knackered!' (/áim NÉ-kâd/).",
    ukVariantTerm: "I'm knackered!",
  },

  // Phrasal Verbs (pv_1 – pv_14)
  pv_1: { uk: '/guét ÂP/ (conectado: /gué-tÂP/)' },
  pv_2: { uk: '/guív ÂP/ (conectado: /guí-vÂP/)' },
  pv_3: { uk: '/têik ÓF/ (conectado: /têi-KÓF/)' },
  pv_4: { uk: '/lúk FÓO/' },
  pv_5: { uk: '/fáind ÁUT/ (conectado: /fáin-DÁUT/)' },
  pv_6: { uk: '/kâm ÓN/ (fala rápida: /kâ-MÓN/)' },
  pv_7: { uk: '/gêu ÓN/' },
  pv_8: { uk: '/sét ÂP/ (conectado: /sé-tÂP/)' },
  pv_9: { uk: '/tân ÓN/' },
  pv_10: { uk: '/tân ÓF/' },
  pv_11: { uk: '/bríng ÂP/' },
  pv_12: {
    uk: '/lúk ÁAF-tâ/',
    ukNote: 'No inglês britânico, after tem A longo e termina em vogal neutra sem R (/ÁAF-tâ/).',
  },
  pv_13: { uk: '/kól ÓF/' },
  pv_14: { uk: '/KÉ-ri ÁUT/' },
};

/**
 * Curated word-level dictionary for offline & multi-word expression pronunciation synthesis
 * (covers function words, contractions, and high-frequency tricky words where US and UK diverge).
 */
const WORD_LEXICON_PHONETICS: Record<string, { us: string; uk: string }> = {
  a: { us: 'a', uk: 'a' },
  an: { us: 'ân', uk: 'ân' },
  the: { us: 'dâ', uk: 'dâ' },
  to: { us: 'tu', uk: 'tu' },
  of: { us: 'âv', uk: 'âv' },
  in: { us: 'in', uk: 'in' },
  on: { us: 'ÓN', uk: 'ÓN' },
  at: { us: 'ét', uk: 'ét' },
  for: { us: 'fór', uk: 'fó' },
  from: { us: 'frâm', uk: 'frâm' },
  with: { us: 'uíd', uk: 'uíd' },
  by: { us: 'bái', uk: 'bái' },
  up: { us: 'ÂP', uk: 'ÂP' },
  out: { us: 'ÁUT', uk: 'ÁUT' },
  off: { us: 'ÓF', uk: 'ÓF' },
  down: { us: 'DÁUN', uk: 'DÁUN' },
  over: { us: 'ÔU-vâr', uk: 'ÊU-vâ' },
  away: { us: 'a-UÊI', uk: 'a-UÊI' },
  back: { us: 'BÉK', uk: 'BÉK' },
  into: { us: 'ÍN-tu', uk: 'ÍN-tu' },
  after: { us: 'ÉF-târ', uk: 'ÁAF-tâ' },
  through: { us: 'THRÚ', uk: 'THRÚ' },
  around: { us: 'a-RÁUND', uk: 'a-RÁUND' },
  about: { us: 'a-BÁUT', uk: 'a-BÁUT' },
  along: { us: 'a-LÓNG', uk: 'a-LÓNG' },
  behind: { us: 'bi-RÁIND', uk: 'bi-RÁIND' },
  forward: { us: 'FÓR-uârd', uk: 'FÓ-uâd' },
  i: { us: 'ái', uk: 'ái' },
  "i'm": { us: 'áim', uk: 'áim' },
  "i'll": { us: 'áil', uk: 'áil' },
  "i'd": { us: 'áid', uk: 'áid' },
  "i've": { us: 'áiv', uk: 'áiv' },
  you: { us: 'iú', uk: 'iú' },
  "you're": { us: 'iór', uk: 'ió' },
  your: { us: 'iór', uk: 'ió' },
  we: { us: 'uí', uk: 'uí' },
  "we're": { us: 'uír', uk: 'uíâ' },
  they: { us: 'dêi', uk: 'dêi' },
  it: { us: 'it', uk: 'it' },
  "it's": { us: 'íts', uk: 'íts' },
  my: { us: 'mái', uk: 'mái' },
  me: { us: 'mí', uk: 'mí' },
  this: { us: 'dís', uk: 'dís' },
  that: { us: 'dét', uk: 'dét' },
  "that's": { us: 'déts', uk: 'déts' },
  what: { us: 'uót', uk: 'uót' },
  "what's": { us: 'uóts', uk: 'uóts' },
  where: { us: 'uér', uk: 'uéâ' },
  how: { us: 'ráu', uk: 'ráu' },
  can: { us: 'kén', uk: 'kén' },
  "can't": { us: 'ként', uk: 'káant' },
  cannot: { us: 'KÉ-nót', uk: 'KÉ-nót' },
  do: { us: 'du', uk: 'du' },
  "don't": { us: 'dôunt', uk: 'dêunt' },
  does: { us: 'dâz', uk: 'dâz' },
  "doesn't": { us: 'DÂ-zânt', uk: 'DÂ-zânt' },
  is: { us: 'íz', uk: 'íz' },
  are: { us: 'ár', uk: 'áa' },
  was: { us: 'uóz', uk: 'uóz' },
  were: { us: 'uâr', uk: 'uââ' },
  have: { us: 'rév', uk: 'rév' },
  get: { us: 'guét', uk: 'guét' },
  give: { us: 'guív', uk: 'guív' },
  go: { us: 'gôu', uk: 'gêu' },
  going: { us: 'GÔU-in', uk: 'GÊU-in' },
  take: { us: 'têik', uk: 'têik' },
  make: { us: 'mêik', uk: 'mêik' },
  come: { us: 'kâm', uk: 'kâm' },
  look: { us: 'lúk', uk: 'lúk' },
  put: { us: 'pút', uk: 'pút' },
  turn: { us: 'târn', uk: 'tân' },
  work: { us: 'UÔRK', uk: 'UÂK' },
  call: { us: 'kól', uk: 'kól' },
  keep: { us: 'kíp', uk: 'kíp' },
  let: { us: 'lét', uk: 'lét' },
  "let's": { us: 'léts', uk: 'léts' },
  run: { us: 'rân', uk: 'rân' },
  break: { us: 'brêik', uk: 'brêik' },
  bring: { us: 'bríng', uk: 'bríng' },
  catch: { us: 'kétch', uk: 'kétch' },
  check: { us: 'tchék', uk: 'tchék' },
  cut: { us: 'kât', uk: 'kât' },
  drop: { us: 'dróp', uk: 'dróp' },
  fall: { us: 'fól', uk: 'fól' },
  figure: { us: 'FÍ-guiâr', uk: 'FÍ-gâ' },
  fill: { us: 'fíl', uk: 'fíl' },
  find: { us: 'fáind', uk: 'fáind' },
  hang: { us: 'réng', uk: 'réng' },
  hold: { us: 'rôuld', uk: 'rêuld' },
  move: { us: 'múv', uk: 'múv' },
  pass: { us: 'pés', uk: 'páas' },
  pick: { us: 'pík', uk: 'pík' },
  point: { us: 'póint', uk: 'póint' },
  pull: { us: 'púl', uk: 'púl' },
  set: { us: 'sét', uk: 'sét' },
  show: { us: 'xôu', uk: 'xêu' },
  sort: { us: 'sórt', uk: 'sót' },
  speak: { us: 'spík', uk: 'spík' },
  stand: { us: 'sténd', uk: 'sténd' },
  step: { us: 'stép', uk: 'stép' },
  stick: { us: 'stík', uk: 'stík' },
  think: { us: 'THÍNK', uk: 'THÍNK' },
  throw: { us: 'thrôu', uk: 'thrêu' },
  try: { us: 'trái', uk: 'trái' },
  watch: { us: 'uótch', uk: 'uótch' },
  wear: { us: 'uér', uk: 'uéâ' },
  wrap: { us: 'rép', uk: 'rép' },
  schedule: { us: 'SKÉ-djul', uk: 'XÉ-diul' },
  reschedule: { us: 'ri-SKÉ-djul', uk: 'ri-XÉ-diul' },
  water: { us: 'UÓ-râr', uk: 'UÓ-tâ' },
  better: { us: 'BÉ-râr', uk: 'BÉ-tâ' },
  butter: { us: 'BÂ-râr', uk: 'BÂ-tâ' },
  matter: { us: 'MÉ-râr', uk: 'MÉ-tâ' },
  letter: { us: 'LÉ-râr', uk: 'LÉ-tâ' },
  city: { us: 'SÍ-ri', uk: 'SÍ-ti' },
  little: { us: 'LÍ-rôl', uk: 'LÍ-tôl' },
  bottle: { us: 'BÓ-rôl', uk: 'BÓ-tôl' },
  party: { us: 'PÁR-ri', uk: 'PÁA-ti' },
  beautiful: { us: 'BIÚ-ri-fôl', uk: 'BIÚ-ti-fôl' },
  either: { us: 'Í-dâr', uk: 'ÁI-dâ' },
  neither: { us: 'NÍ-dâr', uk: 'NÁI-dâ' },
  privacy: { us: 'PRÁI-va-si', uk: 'PRÍ-va-si' },
  vitamin: { us: 'VÁI-ra-min', uk: 'VÍ-ta-min' },
  tomato: { us: 'ta-MÊI-rôu', uk: 'ta-MÁA-têu' },
  garage: { us: 'ga-RÁJ', uk: 'GÉ-ráaj' },
  leisure: { us: 'LÍ-jâr', uk: 'LÉ-jâ' },
  advertisement: { us: 'éd-vâr-TÁIZ-mânt', uk: 'ad-VÂ-tiz-mânt' },
  ask: { us: 'ésk', uk: 'áask' },
  answer: { us: 'ÉN-sâr', uk: 'ÁAN-sâ' },
  chance: { us: 'tchéns', uk: 'tcháans' },
  dance: { us: 'déns', uk: 'dáans' },
  fast: { us: 'fést', uk: 'fáast' },
  glass: { us: 'glés', uk: 'gláas' },
  half: { us: 'réf', uk: 'ráaf' },
  laugh: { us: 'léf', uk: 'láaf' },
  last: { us: 'lést', uk: 'láast' },
  class: { us: 'klés', uk: 'kláas' },
  bath: { us: 'béth', uk: 'báath' },
  path: { us: 'péth', uk: 'páath' },
  staff: { us: 'stéf', uk: 'stáaf' },
  coffee: { us: 'KÓ-fi', uk: 'KÓ-fi' },
  sorry: { us: 'SÓ-ri', uk: 'SÓ-ri' },
  tomorrow: { us: 'tu-MÓ-rôu', uk: 'tu-MÓ-rêu' },
  know: { us: 'NÔU', uk: 'NÊU' },
  no: { us: 'nôu', uk: 'nêu' },
  so: { us: 'sôu', uk: 'sêu' },
  phone: { us: 'FÔUN', uk: 'FÊUN' },
  home: { us: 'RÔUM', uk: 'RÊUM' },
  old: { us: 'ÔULD', uk: 'ÊULD' },
  cold: { us: 'kôuld', uk: 'kêuld' },
  here: { us: 'RÍR', uk: 'RÍ-â' },
  there: { us: 'DÉR', uk: 'DÉÂ' },
  sure: { us: 'XÚR', uk: 'XÓA' },
};

export function extractRawLiteralAndUsPhonetic(literal: string): {
  meaning: string;
  usPhonetic: string | null;
} {
  const raw = String(literal || '').trim();
  const markerMatch = raw.match(/\(Pronúncia:\s*/i);
  if (!markerMatch || markerMatch.index === undefined) {
    return { meaning: raw, usPhonetic: null };
  }
  const startIdx = markerMatch.index;
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < raw.length; i++) {
    if (raw[i] === '(') depth++;
    else if (raw[i] === ')') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) {
    return { meaning: raw, usPhonetic: null };
  }
  const inner = raw.slice(startIdx + markerMatch[0].length, endIdx).trim();
  const meaning = (raw.slice(0, startIdx) + raw.slice(endIdx + 1)).replace(/\s+/g, ' ').trim();
  return { meaning, usPhonetic: inner || null };
}

/**
 * Ensures phonetic strings are wrapped cleanly in `/.../` slashes.
 */
export function normalizeSlashNotation(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
}

/**
 * Converts standard IPA (American or British) into Brazilian-friendly EWM phonetic notation.
 * Primary stressed syllables (`ˈ`) are rendered in UPPERCASE with Portuguese acute/circumflex accents.
 */
export function ipaToEwmPhonetic(ipaRaw: string, accent: EnglishAccent): string {
  const cleaned = String(ipaRaw || '')
    .trim()
    .replace(/^[/[\]\s]+|[/[\]\s]+$/g, '')
    .replace(/\([^)]*\)/g, '');
  if (!cleaned) return '';

  // Split words first
  const words = cleaned.split(/\s+/).filter(Boolean);
  const convertedWords = words.map((word) => convertSingleIpaWord(word, accent));
  const joined = convertedWords.filter(Boolean).join(' ');
  return joined ? `/${joined}/` : '';
}

function convertSingleIpaWord(ipaWord: string, accent: EnglishAccent): string {
  // Normalize stress & syllable boundaries into explicit syllable chunks
  const normalized = ipaWord
    .replace(/ˈ/g, '|*')
    .replace(/ˌ/g, '|')
    .replace(/\./g, '|')
    .replace(/^\|+/, '');

  const rawSyllables = normalized.split('|').filter(Boolean);
  if (rawSyllables.length === 0) return '';

  const hasExplicitStress = rawSyllables.some((s) => s.startsWith('*'));

  const mapped = rawSyllables.map((rawSyl, idx) => {
    const isStressed = rawSyl.startsWith('*') || (!hasExplicitStress && rawSyllables.length === 1 && idx === 0);
    const s = rawSyl.replace(/^\*/, '');
    let out = mapIpaSegment(s, accent, isStressed);
    if (!out) return '';
    if (isStressed) {
      out = emphasizeSyllable(out);
    }
    return out;
  });

  return mapped.filter(Boolean).join('-');
}

function mapIpaSegment(seg: string, accent: EnglishAccent, isStressed: boolean): string {
  let s = seg;

  // Multi-character diphthongs & affricates first (longest match first)
  s = s
    .replace(/tʃ/g, 'tch')
    .replace(/dʒ/g, 'dj')
    .replace(/aɪə/g, accent === 'uk' ? 'ái-â' : 'ái-âr')
    .replace(/aʊə/g, accent === 'uk' ? 'áu-â' : 'áu-âr')
    .replace(/eɪ/g, 'êi')
    .replace(/aɪ/g, 'ái')
    .replace(/ɔɪ/g, 'ói')
    .replace(/aʊ/g, 'áu')
    .replace(/oʊ/g, accent === 'uk' ? 'êu' : 'ôu')
    .replace(/əʊ/g, accent === 'uk' ? 'êu' : 'ôu')
    .replace(/ɪə/g, accent === 'uk' ? 'íâ' : 'ír')
    .replace(/eə/g, accent === 'uk' ? 'éâ' : 'ér')
    .replace(/ɛə/g, accent === 'uk' ? 'éâ' : 'ér')
    .replace(/ʊə/g, accent === 'uk' ? 'óâ' : 'úr')
    .replace(/juː/g, 'iú')
    .replace(/jʊ/g, 'iu')
    .replace(/ɝː|ɝ/g, accent === 'uk' ? 'â' : 'âr')
    .replace(/ɜːr/g, accent === 'uk' ? 'â' : 'âr')
    .replace(/ɜː|ɜ/g, accent === 'uk' ? 'â' : 'âr')
    .replace(/ɚ/g, accent === 'uk' ? 'â' : 'âr')
    .replace(/ɑːr/g, accent === 'uk' ? 'áa' : 'ár')
    .replace(/ɔːr/g, accent === 'uk' ? 'óo' : 'ór')
    .replace(/ɑː/g, accent === 'uk' ? 'áa' : 'á')
    .replace(/ɔː/g, 'ó')
    .replace(/iː/g, 'í')
    .replace(/uː/g, 'ú')
    .replace(/əl|l̩/g, 'ôl')
    .replace(/ən|n̩/g, 'ân');

  // American intervocalic flap /ɾ/ -> r in US, crisp t in UK
  s = s.replace(/ɾ/g, accent === 'uk' ? 't' : 'r');

  // Consonant & short vowel mappings
  s = s
    .replace(/^h/g, 'r')
    .replace(/h/g, 'r')
    .replace(/θ/g, 'th')
    .replace(/ð/g, 'd')
    .replace(/ʃ/g, 'x')
    .replace(/ʒ/g, 'j')
    .replace(/ŋg/g, 'ng')
    .replace(/ŋ/g, 'n')
    .replace(/ɹ|ɻ/g, 'r')
    .replace(/w/g, 'u')
    .replace(/j/g, 'i')
    .replace(/ɡ/g, 'g')
    .replace(/ʔ/g, 't')
    .replace(/æ/g, 'é')
    .replace(/ɛ/g, 'é')
    .replace(/e/g, isStressed ? 'é' : 'e')
    .replace(/ɪ/g, isStressed ? 'í' : 'i')
    .replace(/i/g, isStressed ? 'í' : 'i')
    .replace(/ɒ/g, 'ó')
    .replace(/ɑ/g, 'á')
    .replace(/ɔ/g, 'ó')
    .replace(/ʊ/g, 'ú')
    .replace(/u/g, isStressed ? 'ú' : 'u')
    .replace(/ʌ/g, 'â')
    .replace(/ə/g, 'â')
    .replace(/ː/g, '');

  // Prevent Portuguese soft 'g' before e/i ("ge"/"gi" sounds like /ʒ/ in PT-BR, so write "gue"/"gui")
  s = s.replace(/g([eéêií])/gi, 'gu$1');

  // Non-rhotic cleanup in UK when coda 'r' precedes consonant or end of syllable
  if (accent === 'uk') {
    s = s.replace(/([aáâeéêiíoóôuú])r(?=[bcdfghjklmnpqstvwxz]|$)/gi, '$1');
  }

  return s;
}

function emphasizeSyllable(syl: string): string {
  let upper = syl.toUpperCase();
  // Preserve lowercase 'u' in 'GUÉ'/'GUÍ' digraph so Brazilians don't read 'G-U-É'
  upper = upper.replace(/GU([EÉÊIÍ])/g, 'gu$1').replace(/^gu/, 'GU');
  if (!/[ÁÂÉÊÍÓÔÚ]/.test(upper)) {
    upper = upper
      .replace(/A/, 'Á')
      .replace(/E/, 'É')
      .replace(/I/, 'Í')
      .replace(/O/, 'Ó')
      .replace(/U/, 'Ú');
  }
  return upper;
}

/**
 * Rule-based phonological US -> UK converter used when a card has a custom US phonetic
 * notation but no explicit UK override yet.
 */
export function deriveUkFromUsPhonetic(usPhoneticRaw: string, term = ''): string {
  const cleanUs = normalizeSlashNotation(usPhoneticRaw);
  if (!cleanUs) return '';

  const lowerTerm = term.toLowerCase().trim();
  if (lowerTerm.includes('reschedule')) {
    return cleanUs.replace(/ri-SKÉ-djul/gi, 'ri-XÉ-diul');
  }
  if (lowerTerm.includes('schedule')) {
    return cleanUs.replace(/SKÉ-djul/gi, 'XÉ-diul');
  }

  // Transform only the primary phonetic block (strip US-only flap fast-speech parentheticals if they contain flap r)
  const mainPart = cleanUs.replace(/\s*\((?:fala rápida|conectado):[^)]*\)/gi, '').trim();

  let uk = mainPart
    // GOAT diphthong: ôu -> êu
    .replace(/ôu/g, 'êu')
    .replace(/ÔU/g, 'ÊU')
    // Common American flap words back to crisp British T
    .replace(/UÓ-râr/g, 'UÓ-tâ')
    .replace(/BIÚ-ri-fôl/g, 'BIÚ-ti-fôl')
    .replace(/LÊI-râr/g, 'LÊI-tâ')
    .replace(/PRÍ-ri/g, 'PRÍ-ti')
    .replace(/GUÉ-rit/g, 'GUÉT it')
    // Non-rhotic unstressed -âr / -er at syllable/word end -> -â
    .replace(/-râr\b/g, '-tâ')
    .replace(/([bcdfghjklmnpqstvwxz])âr(?=[/\s-])/gi, '$1â')
    // NURSE / WORK rhotics
    .replace(/UÔRKS/g, 'UÂKS')
    .replace(/UÔRK/g, 'UÂK')
    .replace(/UÔR-/g, 'UÂ-')
    // Centering & coda R before slash, hyphen+consonant, or consonant
    .replace(/ÍR(?=[/\s])/g, 'Í-â')
    .replace(/ÉR(?=[/\s])/g, 'ÉÂ')
    .replace(/uér(?=\s+[bcdfghjklmnpqstvwxz])/g, 'uéâ')
    .replace(/iór(?=\s+[bcdfghjklmnpqstvwxzi])/g, 'ió')
    .replace(/fór(?=\s+[bcdfghjklmnpqstvwxzi])/g, 'fâ')
    .replace(/ár(?=\s+[bcdfghjklmnpqstvwxzi])/g, 'áa')
    .replace(/ÁRD(?=[/\s])/g, 'ÁAD')
    .replace(/ÓRT(?=[/\s-])/g, 'ÓT')
    .replace(/ÓRS(?=[/\s])/g, 'ÓOS');

  return normalizeSlashNotation(uk);
}

/**
 * Offline deterministic word-by-word synthesis of US & UK phonetics for any English phrase
 * when neither curated card overrides nor live IPA lookup are available.
 */
export function synthesizeOfflinePhrasePhonetics(term: string): { us: string; uk: string } {
  const clean = String(term || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[…".!?]+/g, '')
    .trim();
  if (!clean) return { us: '', uk: '' };

  const rawTokens = clean.split(/\s+/).filter(Boolean);
  const usParts: string[] = [];
  const ukParts: string[] = [];

  rawTokens.forEach((tok, idx) => {
    const lower = tok.toLowerCase().replace(/^['"“”]+|['"“”,;:]+$/g, '');
    if (!lower) return;
    const nextLower = (rawTokens[idx + 1] || '').toLowerCase().replace(/^['"“”]+/, '');
    const nextStartsWithVowel = /^[aeiou]/i.test(nextLower) && !/^(you|your|uni|use)/i.test(nextLower);

    const lex = WORD_LEXICON_PHONETICS[lower];
    if (lex) {
      usParts.push(lex.us);
      // Preserve British Linking R when 'where', 'there', 'for', 'are', 'your', 'more' precede a vowel!
      if (
        nextStartsWithVowel &&
        (lower === 'where' || lower === 'there' || lower === 'for' || lower === 'are' || lower === 'your')
      ) {
        ukParts.push(`${lex.uk}r`);
      } else {
        ukParts.push(lex.uk);
      }
      return;
    }

    // Fallback conservative orthographic approximation for rare words
    const approxUs = approximateSingleWordUs(lower, rawTokens.length === 1 || idx === rawTokens.length - 1);
    const approxUk = deriveUkFromUsPhonetic(`/${approxUs}/`, lower).replace(/^\/|\/$/g, '');
    usParts.push(approxUs);
    ukParts.push(approxUk || approxUs);
  });

  return {
    us: usParts.length > 0 ? `/${usParts.join(' ')}/` : '',
    uk: ukParts.length > 0 ? `/${ukParts.join(' ')}/` : '',
  };
}

function approximateSingleWordUs(word: string, emphasize: boolean): string {
  let s = word
    .replace(/^kn/, 'n')
    .replace(/^wr/, 'r')
    .replace(/tion$/, '-xân')
    .replace(/sion$/, '-jân')
    .replace(/ing$/, '-in')
    .replace(/igh/g, 'ái')
    .replace(/ee/g, 'í')
    .replace(/oo/g, 'ú')
    .replace(/ou/g, 'áu')
    .replace(/ow/g, 'ôu')
    .replace(/ea/g, 'í')
    .replace(/sh/g, 'x')
    .replace(/ch/g, 'tch')
    .replace(/th/g, 'th')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/^h/, 'r')
    .replace(/^w/, 'u')
    .replace(/^y/, 'i');
  if (emphasize) {
    const segs = s.split('-');
    segs[0] = emphasizeSyllable(segs[0]);
    s = segs.join('-');
  }
  return s;
}

interface DictApiPhoneticItem {
  text?: string;
  audio?: string;
}

interface DictApiEntry {
  word?: string;
  phonetic?: string;
  phonetics?: DictApiPhoneticItem[];
}

/**
 * Queries dictionaryapi.dev for real US and UK IPA transcriptions (and registers studio human MP3 URLs
 * when available) to produce verified EWM-US and EWM-UK phonetics for newly added cards.
 */
export async function fetchVerifiedPhoneticsForTerm(
  term: string
): Promise<{ phoneticUs: string; phoneticUk: string; ukNote?: string }> {
  const clean = String(term || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[…".!?]+/g, '')
    .trim();
  if (!clean) {
    return { phoneticUs: '', phoneticUk: '' };
  }

  // Check if exact term matches one of our 172 seed cards first
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length <= 5 && typeof fetch === 'function') {
    try {
      const perWordResults = await Promise.all(
        words.map(async (rawWord) => {
          const lower = rawWord.toLowerCase().replace(/^['"“”]+|['"“”,;:]+$/g, '');
          if (!lower) return { us: '', uk: '' };

          // Fast path for function words & contractions so unstressed weak forms stay natural!
          if (words.length > 1 && WORD_LEXICON_PHONETICS[lower]) {
            return {
              us: WORD_LEXICON_PHONETICS[lower].us,
              uk: WORD_LEXICON_PHONETICS[lower].uk,
            };
          }

          // Curated tricky single words (reschedule, schedule, water, etc.)
          if (WORD_LEXICON_PHONETICS[lower]) {
            // Still fetch human audio URLs in background if single word, but trust curated EWM transcription
            void fetchAndCacheSingleWordDict(lower);
            return {
              us: WORD_LEXICON_PHONETICS[lower].us,
              uk: WORD_LEXICON_PHONETICS[lower].uk,
            };
          }

          const dict = await fetchAndCacheSingleWordDict(lower);
          if (dict.usIpa || dict.ukIpa) {
            const usConverted = dict.usIpa
              ? ipaToEwmPhonetic(dict.usIpa, 'us').replace(/^\/|\/$/g, '')
              : '';
            const ukConverted = dict.ukIpa
              ? ipaToEwmPhonetic(dict.ukIpa, 'uk').replace(/^\/|\/$/g, '')
              : usConverted
              ? deriveUkFromUsPhonetic(`/${usConverted}/`, lower).replace(/^\/|\/$/g, '')
              : '';
            if (usConverted || ukConverted) {
              return {
                us: usConverted || ukConverted,
                uk: ukConverted || usConverted,
              };
            }
          }

          const fallback = synthesizeOfflinePhrasePhonetics(lower);
          return {
            us: fallback.us.replace(/^\/|\/$/g, ''),
            uk: fallback.uk.replace(/^\/|\/$/g, ''),
          };
        })
      );

      const usJoined = perWordResults
        .map((r) => r.us)
        .filter(Boolean)
        .join(' ');
      const ukJoined = perWordResults
        .map((r) => r.uk)
        .filter(Boolean)
        .join(' ');

      if (usJoined && ukJoined) {
        return {
          phoneticUs: `/${usJoined}/`,
          phoneticUk: `/${ukJoined}/`,
        };
      }
    } catch {
      // Fall through to offline synthesis
    }
  }

  const offline = synthesizeOfflinePhrasePhonetics(clean);
  return {
    phoneticUs: offline.us,
    phoneticUk: offline.uk,
  };
}

async function fetchAndCacheSingleWordDict(
  lowerWord: string
): Promise<{ usIpa: string; ukIpa: string }> {
  try {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), 3200);
    const resp = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerWord)}`,
      { signal: controller.signal }
    );
    globalThis.clearTimeout(timer);
    if (!resp.ok) return { usIpa: '', ukIpa: '' };

    const entries = (await resp.json()) as DictApiEntry[];
    if (!Array.isArray(entries) || entries.length === 0) return { usIpa: '', ukIpa: '' };

    let usIpa = '';
    let ukIpa = '';
    let generalIpa = '';
    let usAudio = '';
    let ukAudio = '';

    for (const entry of entries) {
      if (!generalIpa && entry.phonetic) {
        generalIpa = entry.phonetic;
      }
      for (const p of entry.phonetics || []) {
        const audio = String(p.audio || '').trim();
        const text = String(p.text || '').trim();
        const isUsAudio = /-us\.mp3/i.test(audio);
        const isUkAudio = /-uk\.mp3/i.test(audio);

        if (isUsAudio && audio && !usAudio) usAudio = audio;
        if (isUkAudio && audio && !ukAudio) ukAudio = audio;

        if (text) {
          if (!generalIpa) generalIpa = text;
          if (isUsAudio && !usIpa) {
            usIpa = text;
          } else if (isUkAudio && !ukIpa) {
            ukIpa = text;
          } else if (/ɝ|ɚ|oʊ|ɾ/.test(text) && !usIpa) {
            usIpa = text;
          } else if (/əʊ|ɒ|ɪə|eə|ɜː/.test(text) && !ukIpa) {
            ukIpa = text;
          }
        }
      }
    }

    if (usAudio || ukAudio) {
      registerDictionaryAudioUrls(lowerWord, {
        usUrl: usAudio || undefined,
        ukUrl: ukAudio || undefined,
      });
    }

    return {
      usIpa: usIpa || generalIpa,
      ukIpa: ukIpa || generalIpa,
    };
  } catch {
    return { usIpa: '', ukIpa: '' };
  }
}

/**
 * Resolves the complete US + UK phonetic package for any card (built-in 172 seed card,
 * Admin global broadcast card, or student custom card).
 */
export function getCardPhonetics(
  card: Pick<Flashcard, 'id' | 'term' | 'literal' | 'phoneticUs' | 'phoneticUk' | 'ukNote'>
): ResolvedCardPhonetics {
  const { meaning, usPhonetic } = extractRawLiteralAndUsPhonetic(card.literal || '');
  const curatedUk = card.id ? CURATED_SEED_UK_BY_ID[card.id] : undefined;

  // 1. Resolve US phonetic
  let resolvedUs = card.phoneticUs ? normalizeSlashNotation(card.phoneticUs) : '';
  if (!resolvedUs && usPhonetic) {
    resolvedUs = normalizeSlashNotation(usPhonetic);
  }
  if (!resolvedUs) {
    resolvedUs = synthesizeOfflinePhrasePhonetics(card.term || '').us;
  }

  // 2. Resolve UK phonetic
  let resolvedUk = card.phoneticUk ? normalizeSlashNotation(card.phoneticUk) : '';
  if (!resolvedUk && curatedUk?.uk) {
    resolvedUk = normalizeSlashNotation(curatedUk.uk);
  }
  if (!resolvedUk && resolvedUs) {
    resolvedUk = deriveUkFromUsPhonetic(resolvedUs, card.term || '');
  }
  if (!resolvedUk) {
    resolvedUk = synthesizeOfflinePhrasePhonetics(card.term || '').uk || resolvedUs;
  }

  // 3. Resolve UK note & variant
  const resolvedUkNote =
    (card.ukNote && card.ukNote.trim()) || curatedUk?.ukNote || null;

  return {
    meaning: meaning || card.literal || '',
    us: resolvedUs,
    uk: resolvedUk,
    ukNote: resolvedUkNote,
    ukVariantTerm: curatedUk?.ukVariantTerm || null,
  };
}
