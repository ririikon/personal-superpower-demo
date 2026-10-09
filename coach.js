// Mockup-valmentaja (speksi 4h). Käsikirjoitettu chat: avainsanat tunnistetaan, ja vastaukset,
// muistit ja viikkosuunnitelmaehdotukset kootaan valmiista mallipohjista käyttäjän oikeasta datasta.
// Puhdas moduuli: ei DOMia, ei windowia, ei localStoragea eikä Date.now()-kutsuja.
// buildReply ei muuta tilaa, vaan palauttaa muutokset, jotka näkymä vie tilaan.

import { LIIKKEET, OHJELMAT, RYHMAT, LIHASRYHMAT, OLETUSPROFIILI, liike as haeLiike } from './data.js';
import { weeklyTargets, weeklyProgress } from './engine/targets.js';
import { recovery } from './engine/recovery.js';
import { addDays, daysBetween, weekStart } from './engine/util.js';

export const ESIMERKKISIRUT = [
  'Ensi viikolla olen reissussa ja pelaan 3 kertaa padelia',
  'Polvea kolottaa kyykyssä',
  'Minulla on tänään vain 30 minuuttia',
];

// ---------------------------------------------------------------------------
// Sanastot
// ---------------------------------------------------------------------------

const MATKA_RE = /matka|matko|matkust|reissu|reissa|lomall|lomalle|lomaa|mökil|mökki|mökkeil/;

// Lajit. kuormittaa = lihakset, joille lajipäivä arvioidaan 4 sarjan kuormaksi (demon oletus).
const LAJIT = [
  {
    id: 'padel', re: /padel/, nimi: 'padel', partitiivi: 'padelia', genetiivi: 'padelin', elatiivi: 'padelista',
    kuormaTeksti: 'jalkoja ja olkapäitä', palautuvat: 'jalat ja olkapäät', kerratMonikko: 'pelit',
    kuormittaa: ['etureidet', 'pohkeet', 'olkapäät'], kertoimet: { jalat: 0.6 },
  },
  {
    id: 'tennis', re: /tennis|tennik/, nimi: 'tennis', partitiivi: 'tennistä', genetiivi: 'tenniksen', elatiivi: 'tenniksestä',
    kuormaTeksti: 'jalkoja ja olkapäitä', palautuvat: 'jalat ja olkapäät', kerratMonikko: 'pelit',
    kuormittaa: ['etureidet', 'pohkeet', 'olkapäät'], kertoimet: { jalat: 0.6 },
  },
  {
    id: 'sulkapallo', re: /sulkapallo|sulkis/, nimi: 'sulkapallo', partitiivi: 'sulkapalloa', genetiivi: 'sulkapallon', elatiivi: 'sulkapallosta',
    kuormaTeksti: 'jalkoja ja olkapäitä', palautuvat: 'jalat ja olkapäät', kerratMonikko: 'pelit',
    kuormittaa: ['etureidet', 'pohkeet', 'olkapäät'], kertoimet: { jalat: 0.6 },
  },
  {
    id: 'juoksu', re: /juoks|juos|lenkk/, nimi: 'juoksu', partitiivi: 'juoksua', genetiivi: 'juoksun', elatiivi: 'juoksusta',
    kuormaTeksti: 'jalkoja', palautuvat: 'jalat', kerratMonikko: 'lenkit',
    kuormittaa: ['etureidet', 'takareidet', 'pohkeet'], kertoimet: { jalat: 0.6 },
  },
  {
    id: 'golf', re: /golf/, nimi: 'golf', partitiivi: 'golfia', genetiivi: 'golfin', elatiivi: 'golfista',
    kuormaTeksti: 'selkää ja keskivartaloa', palautuvat: 'selkä ja keskivartalo', kerratMonikko: 'kierrokset',
    kuormittaa: ['selkä', 'vatsa'], kertoimet: {},
  },
];

const KIPU_RE = /kipu|kipe|kivu|kolott|sattu|särk|säry|vamma|vammau|revähti|nyrjäh|venäht/;

// Kehonosat ja lihasryhmät. Ensimmäinen osuma voittaa (alaselkä ennen selkää).
// kuormittaa(liike) kertoo, mitkä ohjelman liikkeet kannattaa korvata.
const KEHONOSAT = [
  { id: 'alaselkä', re: /alaselk|alaselä/, nimi: 'alaselkä', vaihtoehdot: 'selkä',
    kuormittaa: (l) => ['maastaveto', 'romanialainen-maastaveto', 'romanialainen-maastaveto-kasipainot', 'kulmasoutu', 'takakyykky'].includes(l.id) },
  { id: 'polvi', re: /polv/, nimi: 'polvi', vaihtoehdot: 'polvi',
    kuormittaa: (l) => l.lihasryhma === 'etureidet' },
  { id: 'olkapää', re: /olkapä|olka|hartia|hartio/, nimi: 'olkapää', vaihtoehdot: 'olkapää',
    kuormittaa: (l) => l.lihasryhma === 'olkapäät' || ['penkkipunnerrus', 'dipit', 'penkkidipit', 'kapea-penkkipunnerrus'].includes(l.id) },
  { id: 'kyynärpää', re: /kyynär/, nimi: 'kyynärpää', vaihtoehdot: 'yleinen',
    kuormittaa: (l) => l.lihasryhma === 'ojentajat' || l.lihasryhma === 'hauis' },
  { id: 'ranne', re: /ranne|rantee|ranteet/, nimi: 'ranne', vaihtoehdot: 'yleinen',
    kuormittaa: (l) => ['penkkipunnerrus', 'hauiskaanto-tanko', 'ranskalainen-punnerrus', 'kapea-penkkipunnerrus', 'punnerrus'].includes(l.id) },
  { id: 'lonkka', re: /lonk/, nimi: 'lonkka', vaihtoehdot: 'yleinen',
    kuormittaa: (l) => ['takakyykky', 'maastaveto', 'lantionnosto', 'askelkyykky-kasipainot', 'bulgarialainen-kyykky'].includes(l.id) },
  { id: 'nilkka', re: /nilk/, nimi: 'nilkka', vaihtoehdot: 'yleinen',
    kuormittaa: (l) => l.lihasryhma === 'pohkeet' || ['takakyykky', 'askelkyykky-kasipainot', 'bulgarialainen-kyykky'].includes(l.id) },
  { id: 'niska', re: /nisk/, nimi: 'niska', vaihtoehdot: 'yleinen',
    kuormittaa: (l) => ['pystypunnerrus', 'kasipainopystypunnerrus', 'kulmasoutu', 'maastaveto'].includes(l.id) },
  { id: 'selkä', re: /selk[äa]|selä/, nimi: 'selkä', vaihtoehdot: 'selkä',
    kuormittaa: (l) => ['maastaveto', 'romanialainen-maastaveto', 'romanialainen-maastaveto-kasipainot', 'kulmasoutu', 'takakyykky'].includes(l.id) },
  { id: 'rinta', re: /rint/, nimi: 'rinta', vaihtoehdot: 'yleinen', kuormittaa: (l) => l.lihasryhma === 'rinta' },
  { id: 'hauis', re: /haui/, nimi: 'hauis', vaihtoehdot: 'yleinen', kuormittaa: (l) => l.lihasryhma === 'hauis' },
  { id: 'ojentajat', re: /ojentaj/, nimi: 'ojentajat', vaihtoehdot: 'yleinen', kuormittaa: (l) => l.lihasryhma === 'ojentajat' },
  { id: 'etureidet', re: /etureis/, nimi: 'etureisi', vaihtoehdot: 'polvi', kuormittaa: (l) => l.lihasryhma === 'etureidet' },
  { id: 'takareidet', re: /takareis/, nimi: 'takareisi', vaihtoehdot: 'yleinen', kuormittaa: (l) => l.lihasryhma === 'takareidet' },
  { id: 'pakarat', re: /pakar/, nimi: 'pakara', vaihtoehdot: 'yleinen', kuormittaa: (l) => l.lihasryhma === 'pakarat' },
  { id: 'pohkeet', re: /pohje|pohkee|pohkei/, nimi: 'pohje', vaihtoehdot: 'yleinen', kuormittaa: (l) => l.lihasryhma === 'pohkeet' },
  { id: 'vatsa', re: /vats/, nimi: 'vatsa', vaihtoehdot: 'yleinen', kuormittaa: (l) => l.lihasryhma === 'vatsa' },
];

const KIPU_VAIHTOEHDOT = {
  polvi: [
    'Pakarasilta tai lantionnosto: polvi pysyy lähes paikallaan, ja pakarat tekevät työn.',
    'Romanialainen maastaveto käsipainoilla kevyellä painolla: lonkkasaranaliike kuormittaa polvea vähemmän kuin kyykky.',
    'Kyykky lyhyemmällä liikeradalla, esimerkiksi penkille istuen, mutta vain jos se on täysin kivuton.',
  ],
  olkapää: [
    'Punnerrukset käsipainoilla neutraalilla otteella (kämmenet vastakkain) ja vain kivuttomalla liikeradalla.',
    'Alataljasoutu ja kasvoveto kevyellä painolla: ne vahvistavat olkapään takaosaa ilman pään yläpuolista kuormaa.',
    'Pystypunnerrus ja dipit tauolle, ja alavartalo normaalisti.',
  ],
  selkä: [
    'Jalkaprässi takakyykyn tilalle: selkä on tuettuna selkänojaa vasten.',
    'Reiden koukistus laitteessa ja pakarasilta maastavedon tilalle.',
    'Alataljasoutu tai ylätaljaveto kulmasoudun tilalle, jolloin selän ei tarvitse kannatella eteen kallistunutta ylävartaloa.',
  ],
  yleinen: [
    'Saman lihasryhmän liike laitteessa, jossa liikerata on tuettu ja hallittu.',
    'Kevyempi paino ja vain kivuton liikerata, jokaisessa sarjassa 3 toistoa varaan (RIR 3).',
    'Muut lihasryhmät normaalisti, niin treenirytmi säilyy.',
  ],
};

// Mistä liikkeestä käyttäjä puhuu kivun yhteydessä ("Polvi oireilee kyykyssä").
const KIPU_TILANTEET = [
  { re: /kyyky|kyykk/, teksti: 'kyykyssä' },
  { re: /maastave/, teksti: 'maastavedossa' },
  { re: /penkk/, teksti: 'penkkipunnerruksessa' },
  { re: /pystypunn/, teksti: 'pystypunnerruksessa' },
  { re: /leuanve|leuko/, teksti: 'leuanvedossa' },
  { re: /soud/, teksti: 'soudussa' },
  { re: /juoks|juos/, teksti: 'juostessa' },
  { re: /punner/, teksti: 'punnerruksissa' },
];

const VASYMYS_RE = /väsy|uupu|stress|univaje|nukuin huonosti|nukkunut huonosti|huonosti nuk|huonot yöunet|huono yö|valvoin|valvonut/;
const KIIRE_RE = /kiire|kiirei|vähän aikaa|aikaa vähän|nopea treeni|lyhyt treeni|pikatreeni/;
const MUISTI_RE = /mitä.*tänään|tänään.*mitä|muistat|tällä viikolla|tämän viikon/;

const LUKUSANAT = { yksi: 1, yhden: 1, kaksi: 2, kahdesti: 2, kolme: 3, kolmesti: 3, neljä: 4, neljästi: 4, viisi: 5, viidesti: 5, kuusi: 6, kuudesti: 6 };
const KERRAT_OLETUS = 2;

const VKP_LYHYT = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const VKP_TAYSI = [/sunnuntai/, /maanantai/, /tiistai/, /keskiviik/, /torstai/, /perjantai/, /lauantai/];
const MATKA_OLETUS = [1, 5]; // ma–pe

const RYHMA_NIMI = { tyonnot: 'työnnöt', vedot: 'vedot', jalat: 'jalat' };

const MATKATREENI_KESTO = 30;
const MATKA_VALINEET = ['kehonpaino', 'käsipainot'];
const MATKATREENIT_YLA = [
  { fokus: 'ylävartalo ja keskivartalo', liikkeet: ['punnerrus', 'kasipainosoutu', 'penkkidipit', 'vatsarutistus'] },
  { fokus: 'ylävartalo ja keskivartalo', liikkeet: ['kasipainosoutu', 'punnerrus', 'hauiskaanto-kasipainot', 'vatsarutistus'] },
];
const MATKATREENIT_KOKO = [
  { fokus: 'koko keho', liikkeet: ['ilmakyykky', 'punnerrus', 'kasipainosoutu', 'vatsarutistus'] },
  { fokus: 'koko keho', liikkeet: ['bulgarialainen-kyykky', 'penkkidipit', 'romanialainen-maastaveto-kasipainot', 'vatsarutistus'] },
];
const LAJIKUORMA_SARJAT = 4;

// ---------------------------------------------------------------------------
// Pienet apurit
// ---------------------------------------------------------------------------

function viikonpaiva(pvm) {
  return new Date(pvm + 'T12:00:00Z').getUTCDay(); // 0 = sunnuntai
}

function isoAlku(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function pvmLyhyt(pvm) {
  const [, m, d] = pvm.split('-').map(Number);
  return `${d}.${m}.`;
}

function valiTeksti(a, b) {
  if (a === b) return pvmLyhyt(a);
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  if (ya === yb && ma === mb) return `${da}.–${db}.${mb}.`;
  return `${pvmLyhyt(a)}–${pvmLyhyt(b)}`;
}

function paivaJaPvm(pvm) {
  return `${VKP_LYHYT[viikonpaiva(pvm)]} ${pvmLyhyt(pvm)}`;
}

function desimaali(n) {
  return String(n).replace('.', ',');
}

function luettelo(nimet) {
  if (nimet.length <= 1) return nimet.join('');
  return `${nimet.slice(0, -1).join(', ')} ja ${nimet[nimet.length - 1]}`;
}

function valitse(vaihtoehdot, teksti) {
  return vaihtoehdot[(teksti || '').length % vaihtoehdot.length];
}

// ---------------------------------------------------------------------------
// Tunnistus
// ---------------------------------------------------------------------------

function poimiLaji(t) {
  return LAJIT.find((l) => l.re.test(t)) || null;
}

function poimiKerrat(t, laji) {
  const lajiLahde = laji ? laji.re.source : '(?!)';
  let m = t.match(/(\d+)\s*(?:kertaa|krt|x|×)/);
  if (!m) m = t.match(new RegExp(`(\\d+)\\s+(?:${lajiLahde})`));
  if (m) return Math.min(7, Math.max(1, Number(m[1])));
  for (const [sana, arvo] of Object.entries(LUKUSANAT)) {
    const adverbi = sana.endsWith('sti');
    const re = adverbi
      ? new RegExp(`(?:^|[^a-zåäö])${sana}(?![a-zåäö])`)
      : new RegExp(`(?:^|[^a-zåäö])${sana}\\s+(?:kertaa|krt|${lajiLahde})`);
    if (re.test(t)) return arvo;
  }
  return KERRAT_OLETUS;
}

function poimiKehonosa(t) {
  return KEHONOSAT.find((k) => k.re.test(t)) || null;
}

function poimiMinuutit(t) {
  const m = t.match(/(\d+)\s*(?:min|minuut)/);
  return m ? Number(m[1]) : null;
}

// Matkapäivät tekstistä ("ma–pe", "maanantaista perjantaihin") → [alkuViikonpäivä, loppuViikonpäivä].
function poimiMatkapaivat(t) {
  const lyhyt = t.match(/(?:^|[^a-zåäö])(ma|ti|ke|to|pe|la|su)\s*[-–—]\s*(ma|ti|ke|to|pe|la|su)(?![a-zåäö])/);
  if (lyhyt) return [VKP_LYHYT.indexOf(lyhyt[1]), VKP_LYHYT.indexOf(lyhyt[2])];
  const taysiLahde = '(sunnuntai|maanantai|tiistai|keskiviik|torstai|perjantai|lauantai)';
  const taysi = t.match(new RegExp(`${taysiLahde}[a-zåäö]*\\s*[-–—]?\\s*${taysiLahde}[a-zåäö]*`));
  if (taysi) {
    const a = VKP_TAYSI.findIndex((re) => re.test(taysi[1]));
    const b = VKP_TAYSI.findIndex((re) => re.test(taysi[2]));
    if (a >= 0 && b >= 0) return [a, b];
  }
  return null;
}

/**
 * detectScenario(teksti) → { id: 'reissu-laji'|'reissu'|'kipu'|'vasymys'|'kiire'|'muisti'|'muu', laji?, kerrat?, lihas? }
 * Tunnistus pienaakkosiksi muutetusta tekstistä, ensimmäinen osuma voittaa.
 */
export function detectScenario(teksti) {
  const t = String(teksti || '').toLowerCase();
  if (!t.trim()) return { id: 'muu' };

  const matka = MATKA_RE.test(t);
  const laji = poimiLaji(t);
  if (matka && laji) return { id: 'reissu-laji', laji: laji.id, kerrat: poimiKerrat(t, laji) };
  if (matka) return { id: 'reissu' };

  if (KIPU_RE.test(t)) {
    const osa = poimiKehonosa(t);
    if (osa) return { id: 'kipu', lihas: osa.id };
  }

  if (VASYMYS_RE.test(t)) return { id: 'vasymys' };

  const min = poimiMinuutit(t);
  if ((min !== null && min > 0 && min <= 45) || KIIRE_RE.test(t)) return { id: 'kiire' };

  if (MUISTI_RE.test(t)) return { id: 'muisti' };

  return { id: 'muu' };
}

// ---------------------------------------------------------------------------
// Päivämäärät ja muistit
// ---------------------------------------------------------------------------

/** nextWeekRange(tanaan, viikonAlku) → { alku, loppu }: profiilin viikonalun mukainen ensi viikko. */
export function nextWeekRange(tanaan, viikonAlku = 'maanantai') {
  const alku = addDays(weekStart(tanaan, viikonAlku), 7);
  return { alku, loppu: addDays(alku, 6) };
}

function tamaViikko(tanaan, viikonAlku) {
  const alku = weekStart(tanaan, viikonAlku);
  return { alku, loppu: addDays(alku, 6) };
}

/**
 * activeMemories(muistit, tanaan) → muistit[]
 * Voimassa tänään tai tulevaisuudessa, sekä tilapäiset, joiden päättymisestä on alle 14 päivää.
 */
export function activeMemories(muistit, tanaan) {
  return (muistit || [])
    .filter((m) => {
      if (!m) return false;
      if (!m.voimassaLoppu || m.voimassaLoppu >= tanaan) return true;
      return m.tyyppi === 'tilapäinen' && daysBetween(m.voimassaLoppu, tanaan) < 14;
    })
    .slice()
    .sort((a, b) => String(a.voimassaAlku || '').localeCompare(String(b.voimassaAlku || '')));
}

function luoMuisti(k, teksti, tyyppi, voimassaAlku, voimassaLoppu, jarjestys = 1) {
  const leima = String(k.nyt).replace(/\D/g, '').slice(0, 14);
  return {
    id: `muisti-${leima}-${k.muistit.length + jarjestys}`,
    teksti,
    tyyppi,
    voimassaAlku,
    voimassaLoppu,
    luotu: k.nyt,
    lahde: 'chat',
  };
}

function paallekkain(m, alku, loppu) {
  const a = m.voimassaAlku || '0000-00-00';
  const b = m.voimassaLoppu || '9999-12-31';
  return a <= loppu && b >= alku;
}

// ---------------------------------------------------------------------------
// Konteksti, ohjelma ja palautuminen
// ---------------------------------------------------------------------------

function normalisoi(konteksti) {
  const k = konteksti || {};
  const tanaan = k.tanaan;
  const profiili = { ...OLETUSPROFIILI, ...(k.profiili || {}) };
  let ohjelma = k.ohjelma;
  if (typeof ohjelma === 'string') ohjelma = OHJELMAT.find((o) => o.id === ohjelma);
  if (!ohjelma || !Array.isArray(ohjelma.paivat) || !ohjelma.paivat.length) ohjelma = OHJELMAT[0];
  const liikkeet = Array.isArray(k.liikkeet) && k.liikkeet.length ? k.liikkeet : LIIKKEET;
  return {
    tanaan,
    nyt: k.nyt || `${tanaan}T12:00:00`,
    profiili,
    ohjelma,
    historia: Array.isArray(k.historia) ? k.historia : [],
    liikkeet,
    liikeMap: new Map(liikkeet.map((l) => [l.id, l])),
    muistit: Array.isArray(k.muistit) ? k.muistit : [],
    viikkosuunnitelmat: Array.isArray(k.viikkosuunnitelmat) ? k.viikkosuunnitelmat : [],
  };
}

function etunimi(profiili) {
  const nimi = String(profiili.nimi || '').trim() || 'Demokäyttäjä';
  return nimi.split(/\s+/)[0];
}

function liikeTieto(k, id) {
  return k.liikeMap.get(id) || haeLiike(id) || { id, nimi: id, lihasryhma: null, alue: null, valine: null };
}

function seuraavaPaivaIndeksi(k) {
  const nimet = k.ohjelma.paivat.map((p) => p.nimi);
  const omat = k.historia
    .filter((t) => t && (t.tyyppi == null || t.tyyppi === 'voima'))
    .filter((t) => nimet.includes(t.paivaNimi) && (!t.ohjelmaId || t.ohjelmaId === k.ohjelma.id))
    .filter((t) => !k.tanaan || !t.pvm || t.pvm <= k.tanaan)
    .map((t) => ({ t, avain: t.aloitus || `${t.pvm}T12:00:00` }))
    .sort((a, b) => a.avain.localeCompare(b.avain));
  if (!omat.length) return 0;
  const viimeisin = omat[omat.length - 1].t;
  return (nimet.indexOf(viimeisin.paivaNimi) + 1) % nimet.length;
}

function lajiKuormat(k) {
  const kuormat = [];
  for (const s of k.viikkosuunnitelmat) {
    for (const p of (s && s.paivat) || []) {
      if (p.tyyppi !== 'laji' || !(p.pvm < k.tanaan)) continue;
      const laji = LAJIT.find((l) => l.id === p.laji) || LAJIT[0];
      const lihakset = {};
      for (const lihas of laji.kuormittaa) lihakset[lihas] = LAJIKUORMA_SARJAT;
      kuormat.push({ aika: `${p.pvm}T18:00:00`, lihakset });
    }
  }
  return kuormat;
}

function paivanLihakset(k, paiva) {
  const lihakset = new Set();
  for (const r of paiva.liikkeet) {
    const l = liikeTieto(k, r.liikeId);
    if (l.lihasryhma) lihakset.add(l.lihasryhma);
  }
  return lihakset;
}

function palautumistila(k) {
  return recovery(k.liikkeet, k.historia, k.nyt, lajiKuormat(k));
}

// Päivän pääliikkeiden lihasryhmät, jotka ovat nyt tilassa 'väsynyt'.
function vasyneetPaivalle(k, paiva) {
  const rec = palautumistila(k);
  const paivan = paivanLihakset(k, paiva);
  return LIHASRYHMAT.filter((l) => paivan.has(l) && rec.lihakset[l] && rec.lihakset[l].tila === 'väsynyt');
}

function palautumisTeksti(k, paiva) {
  const rec = palautumistila(k);
  const kesken = LIHASRYHMAT
    .filter((l) => rec.lihakset[l] && rec.lihakset[l].tila !== 'palautunut')
    .sort((a, b) => rec.lihakset[a].palautuminenPros - rec.lihakset[b].palautuminenPros);
  if (!kesken.length) {
    return 'Palautuminen: kaikki lihasryhmät ovat palautuneet, joten keho on valmis treeniin.';
  }
  const lista = kesken.slice(0, 3).map((l) => `${l} ${rec.lihakset[l].palautuminenPros} %`);
  let teksti = `Palautuminen: ${rec.palautuneita}/${LIHASRYHMAT.length} lihasryhmää on palautunut. Vielä palautumassa: ${luettelo(lista)}.`;
  if (paiva) {
    const vasyneet = vasyneetPaivalle(k, paiva);
    if (vasyneet.length) {
      teksti += ` ${paiva.nimi} kuormittaa vielä väsyneitä lihaksia (${luettelo(vasyneet)}), joten tee niiden liikkeet tänään kevyemmin tai siirrä treeni huomiseen.`;
    }
  }
  return teksti;
}

function viikkoTilanneTeksti(k) {
  const viikonAlku = weekStart(k.tanaan, k.profiili.viikonAlku);
  const suunnitelma = k.viikkosuunnitelmat.find((s) => s && s.viikonAlku === viikonAlku) || null;
  const tavoitteet = weeklyTargets(k.profiili, suunnitelma);
  const ed = weeklyProgress(k.historia, k.liikkeet, tavoitteet, viikonAlku);
  const muokattu = suunnitelma && suunnitelma.sarjatavoiteKertoimet && Object.keys(suunnitelma.sarjatavoiteKertoimet).length
    ? ' (muokattu viikko)' : '';
  const jaljessa = Object.entries(ed.ryhmat).sort((a, b) => b[1].jaljella - a[1].jaljella)[0];
  if (!jaljessa || jaljessa[1].jaljella === 0) {
    return `Tämän viikon sarjatavoitteet${muokattu} ovat täynnä. Hienoa työtä!`;
  }
  return `Tämän viikon sarjatavoitteista${muokattu} on tehty ${ed.kokonaisPros} %. Eniten jäljellä: ${RYHMA_NIMI[jaljessa[0]]}, ${jaljessa[1].jaljella} sarjaa.`;
}

function jalkaSummat(profiili, suunnitelma) {
  const t = weeklyTargets(profiili, suunnitelma);
  return RYHMAT.jalat.reduce((s, l) => s + (t[l] || 0), 0);
}

function onRaskasJalkaliike(l) {
  return l.alue === 'ala' && (l.valine === 'levytanko' || l.id === 'jalkaprassi');
}

// ---------------------------------------------------------------------------
// Viikkosuunnitelma
// ---------------------------------------------------------------------------

function levitaTasaisesti(kerrat) {
  const k = Math.min(7, Math.max(1, kerrat));
  const paikat = [];
  for (let i = 0; i < k; i += 1) paikat.push(Math.floor(((i + 0.5) * 7) / k));
  return paikat;
}

function valitseMatkatreenipaivat(vapaat) {
  if (vapaat.length <= 2) return vapaat.slice();
  return [vapaat[0], vapaat[Math.floor(vapaat.length * 0.6)]];
}

function valitseSalipaivat(ehdokkaat, maara, pvmt, lajiIdx) {
  const viereinenLaji = (i) => lajiIdx.has(i - 1) || lajiIdx.has(i + 1);
  const viikonloppu = (i) => [0, 6].includes(viikonpaiva(pvmt[i]));
  const jarjestys = ehdokkaat.slice().sort((a, b) =>
    (viikonloppu(b) - viikonloppu(a)) || (viereinenLaji(a) - viereinenLaji(b)) || (b - a));
  const valitut = [];
  for (const i of jarjestys) {
    if (valitut.length >= maara) break;
    if (valitut.some((v) => Math.abs(v - i) === 1)) continue;
    valitut.push(i);
  }
  for (const i of jarjestys) {
    if (valitut.length >= maara) break;
    if (!valitut.includes(i)) valitut.push(i);
  }
  return valitut.sort((a, b) => a - b);
}

// Ohjelmapäivä, jossa on vähiten raskaita jalkaliikkeitä (tasatilanteessa kierron mukaan).
function kevytJalkainenPaiva(k, alkaenIdx) {
  const n = k.ohjelma.paivat.length;
  let paras = null;
  for (let j = 0; j < n; j += 1) {
    const paiva = k.ohjelma.paivat[(alkaenIdx + j) % n];
    const raskaat = paiva.liikkeet.map((r) => liikeTieto(k, r.liikeId)).filter(onRaskasJalkaliike);
    if (!paras || raskaat.length < paras.raskaat.length) paras = { paiva, raskaat };
  }
  return paras;
}

function matkatreeniHuomio(k, treeni) {
  const nimet = treeni.liikkeet.map((id) => liikeTieto(k, id).nimi);
  return `${isoAlku(treeni.fokus)}: ${luettelo(nimet)}. 3 kierrosta, RIR 1–2.`;
}

function rakennaViikko(k, { alku, matkaPaivat, laji, kerrat }) {
  const pvmt = Array.from({ length: 7 }, (_, i) => addDays(alku, i));
  const vkp = pvmt.map(viikonpaiva);

  const ia = vkp.indexOf(matkaPaivat[0]);
  const ib = vkp.indexOf(matkaPaivat[1]);
  const matkaIdx = [];
  for (let i = ia; i <= (ib >= ia ? ib : 6); i += 1) matkaIdx.push(i);
  const matka = new Set(matkaIdx);

  const lajiIdx = new Set(laji ? levitaTasaisesti(kerrat) : []);
  const matkaTreeniIdx = valitseMatkatreenipaivat(matkaIdx.filter((i) => !lajiIdx.has(i)));
  const vapaatKotona = pvmt.map((_, i) => i).filter((i) => !matka.has(i) && !lajiIdx.has(i));
  const ilmanJalkoja = !!(laji && laji.kertoimet.jalat && laji.kertoimet.jalat < 1);
  const saliMaara = laji ? 1 : Math.max(1, (k.profiili.treenitViikossa || 3) - matkaTreeniIdx.length);
  const saliIdx = valitseSalipaivat(vapaatKotona, saliMaara, pvmt, lajiIdx);

  const matkatreenit = laji && laji.kertoimet.jalat ? MATKATREENIT_YLA : MATKATREENIT_KOKO;
  const seuraava = seuraavaPaivaIndeksi(k);
  const kesto = k.profiili.kesto || 60;

  const paivat = [];
  const rivit = [];
  let salikierto = seuraava + 1; // seuraava ohjelmapäivä tehdään vielä ennen reissua
  pvmt.forEach((pvm, i) => {
    const otsikko = isoAlku(paivaJaPvm(pvm));
    const mtIndeksi = matkaTreeniIdx.indexOf(i);
    if (lajiIdx.has(i)) {
      paivat.push({
        pvm, tyyppi: 'laji', laji: laji.id,
        huomio: `${isoAlku(laji.nimi)} kuormittaa ${laji.kuormaTeksti}. Lämmittele 10 min ennen peliä.`,
      });
      rivit.push(`${otsikko}: ${laji.nimi}${matka.has(i) ? ' (reissussa)' : ''}`);
    } else if (mtIndeksi >= 0) {
      const treeni = matkatreenit[mtIndeksi % matkatreenit.length];
      paivat.push({
        pvm, tyyppi: 'matka', kestoMin: MATKATREENI_KESTO, valineet: [...MATKA_VALINEET],
        huomio: matkatreeniHuomio(k, treeni),
      });
      rivit.push(`${otsikko}: matkatreeni ${MATKATREENI_KESTO} min, ${treeni.fokus} (kehonpaino ja käsipainot)`);
    } else if (saliIdx.includes(i)) {
      if (ilmanJalkoja) {
        const { paiva, raskaat } = kevytJalkainenPaiva(k, salikierto % k.ohjelma.paivat.length);
        const pois = raskaat.map((l) => l.nimi);
        paivat.push({
          pvm, tyyppi: 'treeni', ohjelmaPaiva: paiva.nimi, kestoMin: kesto,
          huomio: pois.length
            ? `Ilman raskaita jalkaliikkeitä: jätä ${luettelo(pois)} pois. Ylävartalo ja keskivartalo normaalisti.`
            : 'Ilman raskaita jalkaliikkeitä. Ylävartalo ja keskivartalo normaalisti.',
        });
        rivit.push(`${otsikko}: salitreeni ${paiva.nimi} ilman raskaita jalkaliikkeitä`);
      } else {
        const paiva = k.ohjelma.paivat[salikierto % k.ohjelma.paivat.length];
        salikierto += 1;
        paivat.push({ pvm, tyyppi: 'treeni', ohjelmaPaiva: paiva.nimi, kestoMin: kesto });
        rivit.push(`${otsikko}: salitreeni ${paiva.nimi}`);
      }
    } else if (matka.has(i)) {
      paivat.push({ pvm, tyyppi: 'lepo', huomio: 'Matkapäivä: lepo. Kävely ja kevyt liikkuvuus riittävät.' });
      rivit.push(`${otsikko}: lepo (matkapäivä)`);
    } else {
      paivat.push({ pvm, tyyppi: 'lepo', huomio: 'Palautumispäivä.' });
      rivit.push(`${otsikko}: lepo`);
    }
  });

  return { paivat, rivit, matkaIdx, pvmt, matkaTreeneja: matkaTreeniIdx.length, ilmanJalkoja };
}

// ---------------------------------------------------------------------------
// Skenaarioiden vastaukset
// ---------------------------------------------------------------------------

function viikkoTekstille(t, k) {
  const tamaPyynto = /tällä viikolla|tämän viikon/.test(t);
  const vali = tamaPyynto ? tamaViikko(k.tanaan, k.profiili.viikonAlku) : nextWeekRange(k.tanaan, k.profiili.viikonAlku);
  return { ...vali, sana: tamaPyynto ? 'tämä viikko' : 'ensi viikko', sanaAdessiivi: tamaPyynto ? 'tällä viikolla' : 'ensi viikolla' };
}

function vastausReissu(teksti, k, skenaario) {
  const t = teksti.toLowerCase();
  const nimi = etunimi(k.profiili);
  const laji = skenaario.laji ? LAJIT.find((l) => l.id === skenaario.laji) : null;
  const kerrat = skenaario.kerrat || KERRAT_OLETUS;
  const viikko = viikkoTekstille(t, k);
  const matkaPaivat = poimiMatkapaivat(t) || MATKA_OLETUS;
  const lyhenne = `${VKP_LYHYT[matkaPaivat[0]]}–${VKP_LYHYT[matkaPaivat[1]]}`;

  const viikkoRak = rakennaViikko(k, { alku: viikko.alku, matkaPaivat, laji, kerrat });
  const matkaAlku = viikkoRak.pvmt[viikkoRak.matkaIdx[0]];
  const matkaLoppu = viikkoRak.pvmt[viikkoRak.matkaIdx[viikkoRak.matkaIdx.length - 1]];
  const matkaVali = valiTeksti(matkaAlku, matkaLoppu);
  const viikkoVali = valiTeksti(viikko.alku, viikko.loppu);

  const kertoimet = laji && Object.keys(laji.kertoimet).length ? { ...laji.kertoimet } : null;
  const ehdotus = { viikonAlku: viikko.alku, paivat: viikkoRak.paivat };
  if (kertoimet) ehdotus.sarjatavoiteKertoimet = kertoimet;

  const seuraava = k.ohjelma.paivat[seuraavaPaivaIndeksi(k)];
  const kappaleet = [];

  if (laji) {
    kappaleet.push(valitse([
      `Kiva, että kerroit ajoissa, ${nimi}! Rakennetaan viikko reissun ja ${laji.genetiivi} ympärille, niin treeni kulkee mukana.`,
      `Hyvä suunnitelma, ${nimi}. Reissu ja ${laji.nimi} sopivat hyvin samaan viikkoon, kun salitreenit mitoitetaan niiden mukaan.`,
      `Selvä, ${nimi}! Katsotaan ${viikko.sana} kokonaisuutena, niin saat siitä kaiken irti.`,
    ], teksti));
    kappaleet.push(`${isoAlku(viikko.sanaAdessiivi)} ${viikkoVali} olet reissussa ${lyhenne} ${matkaVali} ja pelaat ${laji.partitiivi} ${kerrat} kertaa.`);
  } else {
    kappaleet.push(valitse([
      `Kiva, että kerroit ajoissa, ${nimi}! Reissu ei tarkoita taukoa treenistä, kun treenit mitoitetaan matkaan sopiviksi.`,
      `Hyvä, että suunnittelet etukäteen, ${nimi}. Tehdään reissuviikosta sellainen, että treeni kulkee mukana.`,
      `Selvä, ${nimi}! Katsotaan ${viikko.sana} kokonaisuutena.`,
    ], teksti));
    kappaleet.push(`${isoAlku(viikko.sanaAdessiivi)} ${viikkoVali} olet reissussa ${lyhenne} ${matkaVali}.`);
  }

  kappaleet.push(`Ehdotukseni viikolle:\n${viikkoRak.rivit.map((r) => `• ${r}`).join('\n')}`);

  const perustelut = [];
  let perustelu;
  if (laji && kertoimet && kertoimet.jalat) {
    const ennen = jalkaSummat(k.profiili, null);
    const jalkeen = jalkaSummat(k.profiili, ehdotus);
    perustelut.push(`${isoAlku(laji.nimi)} kuormittaa ${laji.kuormaTeksti}, joten salilla painotetaan ylävartaloa ja keskivartaloa, ja jalkojen sarjatavoite on × ${desimaali(kertoimet.jalat)} (${ennen} → ${jalkeen} sarjaa viikossa).`);
    perustelut.push(`${isoAlku(laji.kerratMonikko)} ovat eri päivinä, jotta ${laji.palautuvat} ehtivät palautua niiden välissä.`);
    perustelu = `${isoAlku(laji.nimi)} kuormittaa ${laji.kuormaTeksti}, joten salilla painotetaan ylävartaloa ja keskivartaloa ja jalkojen sarjatavoite on × ${desimaali(kertoimet.jalat)}. Lajipäivien väliin jää palautumispäivä, ja matkalla treenataan ${viikkoRak.matkaTreeneja} × ${MATKATREENI_KESTO} min kehonpainolla ja käsipainoilla.`;
  } else if (laji) {
    perustelut.push(`${isoAlku(laji.nimi)} kuormittaa ${laji.kuormaTeksti}, joten raskaat selkäliikkeet kannattaa tehdä eri päivinä kuin ${laji.kerratMonikko}. Sarjatavoitteet pysyvät ennallaan.`);
    perustelu = `${isoAlku(laji.nimi)} kuormittaa ${laji.kuormaTeksti}. Lajipäivät on jaettu tasaisesti, ja matkalla treenataan ${viikkoRak.matkaTreeneja} × ${MATKATREENI_KESTO} min kehonpainolla ja käsipainoilla.`;
  } else {
    perustelu = `Matkalla treenataan ${viikkoRak.matkaTreeneja} × ${MATKATREENI_KESTO} min kehonpainolla ja käsipainoilla, jotta treenirytmi säilyy ilman salia. Kotona tehdään ohjelman salitreeni normaalisti.`;
  }
  perustelut.push(`Matkatreenit ovat lyhyitä, ${viikkoRak.matkaTreeneja} × ${MATKATREENI_KESTO} min, jotta ne mahtuvat reissupäiviin ja pitävät rytmin yllä ilman salia.`);
  kappaleet.push(`Miksi näin: ${perustelut.join(' ')}`);
  ehdotus.perustelu = perustelu;

  if (viikko.sana === 'ensi viikko') {
    const jalkoja = viikkoRak.ilmanJalkoja && [...paivanLihakset(k, seuraava)].some((l) => RYHMAT.jalat.includes(l));
    kappaleet.push(jalkoja
      ? `Ennen reissua ehdit vielä tehdä seuraavan treenisi, ${seuraava.nimi}. Tee siinä jalat kunnolla, koska ne saavat ensi viikolla vähemmän salityötä.`
      : `Ennen reissua ehdit vielä tehdä seuraavan treenisi, ${seuraava.nimi}.`);
  }

  // Muisti: koko viikko, jos mukana on laji; muuten matkapäivät.
  const muistinAlku = laji ? viikko.alku : matkaAlku;
  const muistinLoppu = laji ? viikko.loppu : matkaLoppu;
  const muistiTeksti = laji
    ? `Reissussa ${matkaVali} ja pelaa ${laji.partitiivi} ${kerrat} kertaa (viikko ${viikkoVali})`
    : `Reissussa ${matkaVali}, matkatreenit kehonpainolla ja käsipainoilla`;
  const poistettavat = k.muistit
    .filter((m) => m && /^Reissu/.test(m.teksti || '') && paallekkain(m, muistinAlku, muistinLoppu))
    .map((m) => m.id);
  const muisti = luoMuisti(k, muistiTeksti, 'tilapäinen', muistinAlku, muistinLoppu);
  kappaleet.push(`${poistettavat.length ? 'Päivitin muistiin' : 'Tallensin muistiin'}: "${muistiTeksti}". Muistan sen myös seuraavissa keskusteluissa.`);
  kappaleet.push('Katso ehdotus alla olevasta kortista ja paina Ota käyttöön, jos se sopii sinulle. Mitään ei muuteta ennen kuin hyväksyt sen.');

  return {
    teksti: kappaleet.join('\n\n'),
    muistit: [muisti],
    poistettavat,
    ehdotus,
    sirut: ['Mitä teen tänään?'],
  };
}

function vastausKipu(teksti, k, skenaario) {
  const t = teksti.toLowerCase();
  const nimi = etunimi(k.profiili);
  const osa = KEHONOSAT.find((o) => o.id === skenaario.lihas) || KEHONOSAT[1];
  const tilanne = KIPU_TILANTEET.find((s) => s.re.test(t));
  const vaihtoehdot = KIPU_VAIHTOEHDOT[osa.vaihtoehdot] || KIPU_VAIHTOEHDOT.yleinen;
  const seuraava = k.ohjelma.paivat[seuraavaPaivaIndeksi(k)];
  const osuvat = seuraava.liikkeet.map((r) => liikeTieto(k, r.liikeId)).filter((l) => osa.kuormittaa(l)).map((l) => l.nimi);

  const alku = k.tanaan;
  const loppu = addDays(k.tanaan, 13); // 14 päivää tänään mukaan lukien
  const muistiTeksti = `${isoAlku(osa.nimi)} oireilee${tilanne ? ` ${tilanne.teksti}` : ''}`;
  const poistettavat = k.muistit
    .filter((m) => m && (m.teksti || '').startsWith(`${isoAlku(osa.nimi)} oireilee`))
    .map((m) => m.id);
  const muisti = luoMuisti(k, muistiTeksti, 'tilapäinen', alku, loppu);

  const kappaleet = [
    valitse([
      `Ikävä kuulla, ${nimi}. Hyvä, että kerroit, niin osaan ottaa sen huomioon.`,
      `Kiitos, että kerroit, ${nimi}. Kipua ei kannata treenata läpi, joten muokataan treeniä sen ympärille.`,
      `Otetaan tämä vakavasti, ${nimi}: kipu on merkki keventää, ei puskea läpi.`,
    ], teksti),
    'En pysty arvioimaan, mistä kipu johtuu. Jos se jatkuu yli pari viikkoa, pahenee tai tuntuu myös levossa, käänny lääkärin tai fysioterapeutin puoleen.',
    `Sillä välin voit treenata kipua välttäen:\n${vaihtoehdot.map((v) => `• ${v}`).join('\n')}`,
    osuvat.length
      ? `Seuraavassa treenissäsi (${seuraava.nimi}) tämä koskee liikettä ${luettelo(osuvat)}. Korvaa se jollakin yllä olevista tai jätä tällä kertaa pois.`
      : `Seuraavassa treenissäsi (${seuraava.nimi}) ei ole liikkeitä, jotka kuormittavat tätä aluetta suoraan, joten voit tehdä sen normaalisti ja seurata tuntemuksia.`,
    'Yleissääntö: jos liike sattuu, lopeta se siihen ja valitse kivuton vaihtoehto.',
    `${poistettavat.length ? 'Päivitin muistiin' : 'Tallensin muistiin'}: "${muistiTeksti}" (tilapäinen, 14 pv, ${valiTeksti(alku, loppu)}). Otan sen huomioon, kun kysyt seuraavista treeneistä.`,
  ];

  return { teksti: kappaleet.join('\n\n'), muistit: [muisti], poistettavat, ehdotus: null, sirut: ['Mitä teen tänään?'] };
}

function vastausVasymys(teksti, k) {
  const nimi = etunimi(k.profiili);
  const paiva = k.ohjelma.paivat[seuraavaPaivaIndeksi(k)];
  const rivit = paiva.liikkeet.map((r) => {
    const uusi = Math.max(1, r.sarjat - 1);
    return `• ${liikeTieto(k, r.liikeId).nimi}: ${uusi} sarjaa (normaalisti ${r.sarjat})`;
  });
  rivit.push('• Jätä jokaiseen sarjaan 2–3 toistoa varaan (RIR 2–3), äläkä nosta painoja tänään.');
  rivit.push('• Jos olo paranee lämmittelyn aikana, ensimmäisen liikkeen voi tehdä normaalisti.');

  const kappaleet = [
    valitse([
      `Kiitos, että kerroit, ${nimi}. Väsyneenä treeniä ei tarvitse jättää väliin, kun sitä kevennetään fiksusti.`,
      `Ymmärrän, ${nimi}. Huonon yön jälkeen keho palautuu hitaammin, joten tehdään tänään kevyempi versio.`,
      `Hyvä, että kuuntelet kehoasi, ${nimi}. Pienellä säädöllä treeni tukee palautumista eikä kuormita lisää.`,
    ], teksti),
    `Tänään vuorossa on ${paiva.nimi}. Muutokset tähän päivään:\n${rivit.join('\n')}`,
    palautumisTeksti(k, paiva),
    'Kevyempi treeni pitää rytmin yllä, ja siitä palautuu nopeammin kuin täydestä treenistä väsyneenä. Jos väsymys jatkuu useamman päivän, kerro, niin katsotaan koko viikkoa.',
  ];
  return { teksti: kappaleet.join('\n\n'), muistit: [], poistettavat: [], ehdotus: null, sirut: [] };
}

function vastausKiire(teksti, k) {
  const nimi = etunimi(k.profiili);
  const poimitut = poimiMinuutit(teksti.toLowerCase());
  const minuutit = poimitut && poimitut <= 45 ? poimitut : 30;
  const paiva = k.ohjelma.paivat[seuraavaPaivaIndeksi(k)];

  let budjetti = Math.max(4, Math.floor((minuutit - 5) / 2.5));
  const mukana = [];
  const pois = [];
  for (const r of paiva.liikkeet) {
    let s = Math.min(r.sarjat, 3);
    if (mukana.length < 4 && budjetti >= 2) {
      s = Math.min(s, budjetti);
      budjetti -= s;
      mukana.push({ liike: liikeTieto(k, r.liikeId), sarjat: s });
    } else {
      pois.push(liikeTieto(k, r.liikeId).nimi);
    }
  }

  const tyonto = mukana.find((m) => RYHMAT.tyonnot.includes(m.liike.lihasryhma));
  const veto = mukana.find((m) => RYHMAT.vedot.includes(m.liike.lihasryhma));

  const kappaleet = [
    valitse([
      `Onnistuu, ${nimi}! ${minuutit} minuutissa saa tehtyä hyvän treenin, kun keskitytään olennaiseen.`,
      `Selvä, ${nimi}. Lyhytkin treeni pitää rytmin yllä, joten tehdään tänään tiivis ${minuutit} minuutin versio.`,
      `Hienoa, että treenaat kiireestä huolimatta, ${nimi}! Tässä ${minuutit} minuutin versio.`,
    ], teksti),
    `Tänään vuorossa on ${paiva.nimi}. Tiivistetty versio:\n${mukana.map((m) => `• ${m.liike.nimi}: ${m.sarjat} sarjaa`).join('\n')}`,
  ];
  if (pois.length) kappaleet.push(`Jätä tällä kertaa pois: ${luettelo(pois)}.`);
  kappaleet.push(tyonto && veto
    ? `Lyhennä palautukset 60–90 sekuntiin ja tee ${tyonto.liike.nimi} ja ${veto.liike.nimi} vuorotellen supersarjana, niin aikaa säästyy. Isot moniniveliset liikkeet tuovat suurimman osan treenin hyödystä, joten pysyt näin hyvin kehityksen tahdissa.`
    : 'Lyhennä palautukset 60–90 sekuntiin. Isot moniniveliset liikkeet tuovat suurimman osan treenin hyödystä, joten pysyt näin hyvin kehityksen tahdissa.');
  kappaleet.push(viikkoTilanneTeksti(k));
  return { teksti: kappaleet.join('\n\n'), muistit: [], poistettavat: [], ehdotus: null, sirut: [] };
}

function suunnitelmanPaivaKuvaus(p) {
  if (p.tyyppi === 'matka') return `matkatreeni, ${p.kestoMin || MATKATREENI_KESTO} min kehonpainolla ja käsipainoilla`;
  if (p.tyyppi === 'laji') {
    const laji = LAJIT.find((l) => l.id === p.laji);
    return `${laji ? laji.nimi : p.laji || 'laji'}päivä`;
  }
  if (p.tyyppi === 'treeni') return `salitreeni ${p.ohjelmaPaiva || ''}`.trim();
  return 'lepopäivä';
}

function suunnitelmanYhteenveto(s) {
  const paivat = s.paivat || [];
  const osat = [];
  const matka = paivat.filter((p) => p.tyyppi === 'matka').length;
  const laji = paivat.filter((p) => p.tyyppi === 'laji');
  const sali = paivat.filter((p) => p.tyyppi === 'treeni').length;
  if (matka) osat.push(`${matka} matkatreeniä`);
  if (laji.length) {
    const l = LAJIT.find((x) => x.id === laji[0].laji);
    osat.push(`${l ? l.nimi : laji[0].laji} ${laji.length} kertaa`);
  }
  if (sali) osat.push(`${sali} salitreeni${sali > 1 ? 'ä' : ''}`);
  return luettelo(osat);
}

function vastausMuisti(teksti, k) {
  const nimi = etunimi(k.profiili);
  const muistit = activeMemories(k.muistit, k.tanaan);
  const voimassa = muistit.filter((m) => !m.voimassaLoppu || m.voimassaLoppu >= k.tanaan);
  const paattyneet = muistit.filter((m) => m.voimassaLoppu && m.voimassaLoppu < k.tanaan);
  const seuraava = k.ohjelma.paivat[seuraavaPaivaIndeksi(k)];

  const kappaleet = [valitse([
    `Hei ${nimi}! Tässä mitä muistan ja mitä tänään kannattaa tehdä.`,
    `Hyvä kysymys, ${nimi}. Katsotaan tilanne muistini ja suunnitelmasi pohjalta.`,
    `Tässä tämän päivän tilanne, ${nimi}.`,
  ], teksti)];

  if (muistit.length) {
    const rivit = [
      ...voimassa.map((m) => `• ${m.teksti}`),
      ...paattyneet.map((m) => `• ${m.teksti} (päättyi ${pvmLyhyt(m.voimassaLoppu)})`),
    ];
    kappaleet.push(`Muistan nämä:\n${rivit.join('\n')}`);
    if (paattyneet.length) kappaleet.push('Miten se meni? Jos jotain jäi päälle, kerro, niin otan sen huomioon.');
  } else {
    kappaleet.push('Muistiini ei ole vielä tallennettu mitään erityistä. Kerro esimerkiksi tulevasta reissusta, lajista tai vaivasta, niin otan sen huomioon.');
  }

  const tamanPaivanSuunnitelma = k.viikkosuunnitelmat.find((s) => s && (s.paivat || []).some((p) => p.pvm === k.tanaan));
  if (tamanPaivanSuunnitelma) {
    const paivat = tamanPaivanSuunnitelma.paivat;
    const i = paivat.findIndex((p) => p.pvm === k.tanaan);
    const p = paivat[i];
    let rivi = `Hyväksytyn viikkosuunnitelman mukaan tänään (${paivaJaPvm(k.tanaan)}) on ${suunnitelmanPaivaKuvaus(p)}.`;
    if (p.huomio) rivi += ` ${p.huomio}`;
    if (paivat[i + 1]) rivi += ` Huomenna: ${suunnitelmanPaivaKuvaus(paivat[i + 1])}.`;
    kappaleet.push(rivi);
    if (p.tyyppi === 'treeni') {
      const paiva = k.ohjelma.paivat.find((d) => d.nimi === p.ohjelmaPaiva) || null;
      kappaleet.push(palautumisTeksti(k, paiva));
    }
  } else {
    const tuleva = k.viikkosuunnitelmat
      .filter((s) => s && s.viikonAlku > k.tanaan)
      .sort((a, b) => a.viikonAlku.localeCompare(b.viikonAlku))[0];
    if (tuleva) {
      const loppu = addDays(tuleva.viikonAlku, 6);
      kappaleet.push(`Hyväksytty viikkosuunnitelma alkaa ${paivaJaPvm(tuleva.viikonAlku)} (${valiTeksti(tuleva.viikonAlku, loppu)}): ${suunnitelmanYhteenveto(tuleva)}.`);
    }
    let rivi = `Tänään vuorossa on ohjelmasi seuraava treeni, ${seuraava.nimi}.`;
    const jalkaKerroin = tuleva && tuleva.sarjatavoiteKertoimet && tuleva.sarjatavoiteKertoimet.jalat;
    const jalkoja = [...paivanLihakset(k, seuraava)].some((l) => RYHMAT.jalat.includes(l));
    const jalatVasyneet = vasyneetPaivalle(k, seuraava).some((l) => RYHMAT.jalat.includes(l));
    if (jalkaKerroin && jalkaKerroin < 1 && jalkoja && !jalatVasyneet) {
      const lajiPaiva = (tuleva.paivat || []).find((p) => p.tyyppi === 'laji');
      const laji = lajiPaiva ? LAJIT.find((l) => l.id === lajiPaiva.laji) : null;
      const milloin = tuleva.viikonAlku === nextWeekRange(k.tanaan, k.profiili.viikonAlku).alku ? 'ensi viikolla' : 'suunnitelman viikolla';
      rivi += ` Siinä on jalkaliikkeitä, joten tee ne nyt kunnolla: ${milloin} jalat saavat työnsä ${laji ? laji.elatiivi : 'lajista'} eivätkä salilta.`;
    }
    kappaleet.push(rivi);
    kappaleet.push(palautumisTeksti(k, seuraava));
  }

  // Voimassa olevat kiputilat: mitä tämän päivän treenissä kannattaa korvata.
  for (const m of voimassa) {
    const osa = /oireilee/.test(m.teksti || '') ? poimiKehonosa(m.teksti.toLowerCase()) : null;
    if (!osa) continue;
    const osuvat = seuraava.liikkeet.map((r) => liikeTieto(k, r.liikeId)).filter((l) => osa.kuormittaa(l)).map((l) => l.nimi);
    kappaleet.push(osuvat.length
      ? `Koska ${osa.nimi} oireilee, korvaa tänään ${luettelo(osuvat)} kivuttomalla vaihtoehdolla.`
      : `${isoAlku(osa.nimi)} oireilee vielä, mutta tämän päivän liikkeet eivät kuormita sitä suoraan. Seuraa tuntemuksia.`);
  }

  kappaleet.push(viikkoTilanneTeksti(k));
  return { teksti: kappaleet.join('\n\n'), muistit: [], poistettavat: [], ehdotus: null, sirut: [] };
}

function vastausMuu(teksti, k) {
  const nimi = etunimi(k.profiili);
  const seuraava = k.ohjelma.paivat[seuraavaPaivaIndeksi(k)];
  const kappaleet = [
    valitse([
      `Hei ${nimi}! Olen Personal SuperPowerin valmentaja.`,
      `Kiitos viestistä, ${nimi}!`,
      `Hei ${nimi}, kiva kuulla sinusta!`,
    ], teksti),
    'Tässä demossa vastaukseni ovat valmiiksi kirjoitettuja esimerkkejä, joten ymmärrän vielä vain muutaman aiheen. Voit kertoa tulevasta reissusta ja lajeista, kivusta tai vaivasta, väsymyksestä tai kiireestä, tai kysyä "Mitä teen tänään?".',
    `Seuraava treenisi on ${seuraava.nimi}. Kokeile jotakin alla olevista esimerkeistä.`,
  ];
  return { teksti: kappaleet.join('\n\n'), muistit: [], poistettavat: [], ehdotus: null, sirut: [...ESIMERKKISIRUT] };
}

/**
 * buildReply(teksti, konteksti) → { teksti, muistit: [uusiMuisti], poistettavat: [id], ehdotus: Viikkosuunnitelma|null, sirut: [] }
 * konteksti = { tanaan, nyt, profiili, ohjelma, historia, liikkeet, muistit, viikkosuunnitelmat }
 * Puhdas funktio: palauttaa muutokset, eikä muuta kontekstia.
 */
export function buildReply(teksti, konteksti) {
  const syote = String(teksti || '');
  const k = normalisoi(konteksti);
  const skenaario = detectScenario(syote);
  switch (skenaario.id) {
    case 'reissu-laji':
    case 'reissu':
      return vastausReissu(syote, k, skenaario);
    case 'kipu':
      return vastausKipu(syote, k, skenaario);
    case 'vasymys':
      return vastausVasymys(syote, k);
    case 'kiire':
      return vastausKiire(syote, k);
    case 'muisti':
      return vastausMuisti(syote, k);
    default:
      return vastausMuu(syote, k);
  }
}
