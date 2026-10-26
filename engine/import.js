// Ohjelman tuonti (speksi 4k D, mockup): tekstirivien jäsennys, liikkeiden sovitus liikekirjastoon
// synonyymisanaston avulla ja tallennus OHJELMAT-muotoiseksi ohjelmaksi. Tuotteessa tekoäly lukee
// kuvan, PDF:n tai taulukon; demossa rivit tulevat esimerkkitiedostosta (data.js ESIMERKKITUONTI).
// Puhdas moduuli: ei DOM-, window-, localStorage- eikä Date.now()-kutsuja.

import { LIIKKEET } from '../data.js?v=31a36ec';

// Synonyymisanasto: yleisimmät suomen- ja englanninkieliset nimet jokaiselle kirjaston liikkeelle.
// Liikkeen oma nimi ja id (väliviivat välilyönneiksi) tunnistetaan aina. Lyhenteet (DL, RDL, DB,
// OHP…) avataan erikseen, ja niiden kautta tunnistettu rivi saa luottamuksen 'keskitaso'.
export const SYNONYYMIT = {
  penkkipunnerrus: ['penkkipunnerrus', 'penkki', 'penkkipunnerrus levytangolla', 'bench press', 'barbell bench press', 'flat bench press', 'bench'],
  'vinopenkkipunnerrus-kasipainot': ['vinopenkkipunnerrus', 'vinopenkki käsipainoilla', 'vinopenkkipunnerrus käsipainoilla', 'incline dumbbell press', 'incline dumbbell bench press'],
  kasipainopenkkipunnerrus: ['käsipainopenkki', 'käsipainopenkkipunnerrus', 'penkkipunnerrus käsipainoilla', 'dumbbell bench press', 'dumbbell press'],
  punnerrus: ['punnerrus', 'punnerrukset', 'push up', 'push ups', 'pushup', 'press up'],
  'rintaprassi-laite': ['rintaprässi', 'rintaprässi laitteessa', 'machine chest press', 'chest press'],
  taljaristikkaisveto: ['taljaristikkäisveto', 'ristikkäisveto', 'cable crossover', 'cable fly', 'cable flye'],
  leuanveto: ['leuanveto', 'leuat', 'leuanvedot', 'pull up', 'pull ups', 'pullup', 'chin up', 'chin ups'],
  kulmasoutu: ['kulmasoutu', 'kulmasoutu levytangolla', 'barbell row', 'bent over row', 'barbell bent over row'],
  ylataljaveto: ['ylätaljaveto', 'ylätalja', 'lat pulldown', 'lat pull down', 'pulldown', 'lat pulldowns'],
  alataljasoutu: ['alataljasoutu', 'alatalja', 'seated cable row', 'cable row', 'seated row'],
  kasipainosoutu: ['käsipainosoutu', 'yhden käden soutu', 'dumbbell row', 'one arm dumbbell row', 'single arm dumbbell row'],
  'superman-selkaojennus': ['superman', 'selkäojennus', 'superman selkäojennus', 'back extension', 'superman back extension'],
  pystypunnerrus: ['pystypunnerrus', 'pystypunnerrus levytangolla', 'overhead press', 'military press', 'barbell overhead press', 'standing press'],
  kasipainopystypunnerrus: ['käsipainopystypunnerrus', 'pystypunnerrus käsipainoilla', 'dumbbell shoulder press', 'seated dumbbell press', 'shoulder press'],
  vipunostot: ['vipunostot', 'vipunosto', 'sivuvipunostot', 'lateral raise', 'lateral raises', 'side raise'],
  kasvoveto: ['kasvoveto', 'kasvovedot', 'face pull', 'face pulls'],
  'pike-punnerrus': ['pike punnerrus', 'pike push up', 'pike push ups'],
  'hauiskaanto-tanko': ['hauiskääntö tangolla', 'tankohauis', 'hauiskääntö levytangolla', 'barbell curl', 'barbell biceps curl'],
  'hauiskaanto-kasipainot': ['hauiskääntö', 'hauiskäännöt', 'käsipainohauis', 'dumbbell curl', 'biceps curl', 'bicep curl'],
  vasarakaanto: ['vasarakääntö', 'vasarahauis', 'hammer curl', 'hammer curls'],
  pyyhehauis: ['pyyhehauis', 'towel curl', 'towel bicep curl'],
  'ojentajapunnerrus-talja': ['ojentajapunnerrus', 'taljaojentaja', 'ojentajat taljassa', 'triceps pushdown', 'tricep pushdown', 'cable pushdown', 'pushdown'],
  'ranskalainen-punnerrus': ['ranskalainen punnerrus', 'ranskalainen', 'skull crusher', 'skull crushers', 'lying triceps extension'],
  dipit: ['dipit', 'dippi', 'dips', 'dip', 'parallel bar dips'],
  'kapea-penkkipunnerrus': ['kapea penkki', 'kapea penkkipunnerrus', 'close grip bench press', 'close grip bench'],
  penkkidipit: ['penkkidipit', 'bench dips', 'bench dip'],
  takakyykky: ['takakyykky', 'kyykky', 'kyykyt', 'back squat', 'squat', 'barbell squat', 'barbell back squat'],
  jalkaprassi: ['jalkaprässi', 'prässi', 'leg press'],
  'askelkyykky-kasipainot': ['askelkyykky', 'askelkyykyt', 'askelkyykky käsipainoilla', 'dumbbell lunge', 'lunge', 'lunges', 'walking lunge'],
  'reiden-ojennus': ['reiden ojennus', 'jalan ojennus', 'reisiojennus', 'leg extension', 'leg extensions'],
  'bulgarialainen-kyykky': ['bulgarialainen kyykky', 'bulgarialainen askelkyykky', 'bulgarian split squat', 'split squat'],
  ilmakyykky: ['ilmakyykky', 'kyykky kehonpainolla', 'bodyweight squat', 'air squat'],
  maastaveto: ['maastaveto', 'maastavedot', 'deadlift', 'barbell deadlift', 'conventional deadlift'],
  'romanialainen-maastaveto': ['romanialainen maastaveto', 'suorin jaloin maastaveto', 'romanian deadlift', 'stiff leg deadlift'],
  'romanialainen-maastaveto-kasipainot': ['romanialainen maastaveto käsipainoilla', 'käsipaino romanialainen', 'dumbbell romanian deadlift'],
  'reiden-koukistus': ['reiden koukistus', 'jalan koukistus', 'reisikoukistus', 'leg curl', 'hamstring curl', 'lying leg curl', 'seated leg curl'],
  'liukuva-reiden-koukistus': ['liukuva reiden koukistus', 'liukukoukistus', 'sliding leg curl', 'slider leg curl'],
  lantionnosto: ['lantionnosto', 'lantionnosto levytangolla', 'hip thrust', 'barbell hip thrust'],
  pakarasilta: ['pakarasilta', 'lantionnosto lattialta', 'glute bridge', 'bridge'],
  'lonkan-loitonnus': ['lonkan loitonnus', 'loitonnus', 'hip abduction', 'abductor machine'],
  'pohjenousu-seisten': ['pohjenousu', 'pohjenousu seisten', 'standing calf raise', 'calf raise', 'calf raises'],
  'pohjenousu-istuen': ['pohjenousu istuen', 'istuva pohjenousu', 'seated calf raise'],
  'yhden-jalan-pohjenousu': ['yhden jalan pohjenousu', 'single leg calf raise', 'one leg calf raise'],
  vatsarutistus: ['vatsarutistus', 'vatsarutistukset', 'rutistus', 'crunch', 'crunches'],
  'roikkuen-jalkojen-nosto': ['jalkojen nosto roikkuen', 'roikkuen jalkojen nosto', 'hanging leg raise', 'hanging knee raise'],
  taljarutistus: ['taljarutistus', 'cable crunch', 'kneeling cable crunch'],
  skierg: ['skierg', 'ski erg', 'hiihtolaite'],
  kelkkatyonto: ['kelkkatyöntö', 'sled push'],
  kelkkaveto: ['kelkkaveto', 'sled pull'],
  'burpee-pituushyppy': ['burpee pituushyppy', 'burpee broad jump', 'burpee broad jumps'],
  soutu: ['soutu', 'soutulaite', 'row', 'rowing', 'rowing machine'],
  farmarikavely: ['farmarikävely', 'farmer carry', 'farmers carry', 'farmers walk', 'farmer walk'],
  hiekkasakkiaskelkyykky: ['hiekkasäkkiaskelkyykky', 'hiekkasäkki askelkyykky', 'sandbag lunge', 'sandbag lunges'],
  'wall-ball': ['wall ball', 'wall balls', 'wallball', 'seinäpallo'],
};

// Lyhenteet → auki kirjoitettuna (sanatasolla).
const LYHENTEET = {
  dl: 'deadlift',
  rdl: 'romanian deadlift',
  sldl: 'stiff leg deadlift',
  db: 'dumbbell',
  bb: 'barbell',
  ohp: 'overhead press',
  bp: 'bench press',
  cgbp: 'close grip bench press',
};

const KESKITASO_RAJA = 0.85;
const MATALA_RAJA = 0.7;
const OLETUS_SARJAT = 3;
const OLETUS_TOISTOT = 10;

const SARJA_RE = /(\d{1,2})\s*[x×*]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/i;
const SARJA_SANAT_RE = /(\d{1,2})\s*(?:sarjaa|sarja|sets?)\s*(?:x|×|of|à|a)?\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/i;
const OTSIKKO_RE = /^(päivä|paiva|day|treeni|workout|viikko|week)(?=[\s\d:–-]|$)/i;

// --- Normalisointi ja samankaltaisuus --------------------------------------------

/** normalisoi(teksti) → pienaakkoset, ä/ö/å → a/o/a, välimerkit pois, yksi välilyönti. */
function normalisoi(teksti) {
  return String(teksti || '')
    .toLowerCase()
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function avaaLyhenteet(teksti) {
  return teksti.split(' ').map((s) => LYHENTEET[s] || s).join(' ');
}

function bigrammit(s) {
  const tulos = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    tulos.set(b, (tulos.get(b) || 0) + 1);
  }
  return tulos;
}

function dice(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigrammit(a);
  const bb = bigrammit(b);
  let yhteiset = 0;
  for (const [k, n] of ba) yhteiset += Math.min(n, bb.get(k) || 0);
  return (2 * yhteiset) / (a.length - 1 + b.length - 1);
}

// Sanatason samankaltaisuus: kunkin sanan paras vastine toisesta merkkijonosta, molempiin suuntiin.
// Heikko sanavastine (< 0,5) ei anna osapisteitä, jotta esim. "landmine press" ei sovi
// "standing press" -nimeen pelkän yhteisen sanan perusteella.
const SANA_RAJA = 0.5;
function samankaltaisuus(a, b) {
  const ta = a.split(' ');
  const tb = b.split(' ');
  const paras = (s, lista) => {
    const d = Math.max(...lista.map((x) => dice(s, x)));
    return d >= SANA_RAJA ? d : 0;
  };
  const summa = ta.reduce((s, x) => s + paras(x, tb), 0) + tb.reduce((s, x) => s + paras(x, ta), 0);
  let pisteet = summa / (ta.length + tb.length);
  // Synonyymi sisältyy kokonaan riviin ("barbell bench press" ⊇ "bench press").
  if (tb.every((x) => ta.includes(x))) pisteet = Math.max(pisteet, tb.length >= 2 ? KESKITASO_RAJA : 0.75);
  return pisteet;
}

// Sanasto normalisoituna: [{ liikeId, s }]. Liikkeen nimi ja id ovat mukana.
let SANASTO = null;
function sanasto() {
  if (SANASTO) return SANASTO;
  const nahty = new Set();
  SANASTO = [];
  const lisaa = (liikeId, teksti) => {
    const s = normalisoi(teksti);
    if (!s || nahty.has(s)) return;
    nahty.add(s);
    SANASTO.push({ liikeId, s });
  };
  for (const [id, lista] of Object.entries(SYNONYYMIT)) for (const x of lista) lisaa(id, x);
  for (const l of LIIKKEET) {
    lisaa(l.id, l.nimi);
    lisaa(l.id, l.id.replace(/-/g, ' '));
  }
  return SANASTO;
}

// --- Jäsennys -------------------------------------------------------------------------

function rivilista(rivit) {
  if (typeof rivit === 'string') return rivit.split(/\r?\n/);
  return Array.isArray(rivit) ? rivit : [];
}

function puhdistaNimi(s) {
  return String(s || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[–—:;,.@]+\s*$/g, '')
    .replace(/^\s*[-–—•*\d.)]+\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * parseImportText(rivit) → [{ rivi, nimi, sarjat, toistot, toistoMax, paiva }]
 * rivit: merkkijonolista tai rivinvaihdoin eroteltu teksti. Tunnistaa muodot "Bench press 4x8",
 * "Kyykky 3 x 10", "3×12 Lat pulldown", "Leg press 3x8-12" ja "Penkki 4 sarjaa 8". Otsikkorivit
 * ("Päivä 1 – Ylävartalo", "Day 2", rivi joka päättyy kaksoispisteeseen) vaihtavat päivää eivätkä
 * tule tulokseen. Rivi ilman sarjamerkintää saa sarjat ja toistot null. Tyhjät rivit ohitetaan.
 */
export function parseImportText(rivit) {
  const tulos = [];
  let paiva = 'Päivä 1';
  let paivia = 0;
  for (const raaka of rivilista(rivit)) {
    if (typeof raaka !== 'string') continue;
    const rivi = raaka.trim();
    if (!rivi) continue;
    const m = rivi.match(SARJA_SANAT_RE) || rivi.match(SARJA_RE);
    if (!m && (OTSIKKO_RE.test(rivi) || /:\s*$/.test(rivi))) {
      paivia += 1;
      paiva = puhdistaNimi(rivi.replace(/:\s*$/, '')) || `Päivä ${paivia}`;
      continue;
    }
    let nimi = rivi;
    let sarjat = null;
    let toistot = null;
    let toistoMax = null;
    if (m) {
      const ennen = rivi.slice(0, m.index);
      const jalkeen = rivi.slice(m.index + m[0].length);
      nimi = puhdistaNimi(ennen) || puhdistaNimi(jalkeen);
      sarjat = Number(m[1]);
      toistot = Number(m[2]);
      toistoMax = m[3] ? Math.max(toistot, Number(m[3])) : null;
    } else {
      nimi = puhdistaNimi(rivi);
    }
    tulos.push({ rivi, nimi, sarjat, toistot, toistoMax, paiva });
  }
  return tulos;
}

/**
 * matchExercise(nimi) → { liikeId|null, luottamus: 'korkea'|'keskitaso'|'matala', pisteet }
 * korkea = nimi on sanastossa sellaisenaan; keskitaso = tunnistettu lyhenteen kautta tai
 * samankaltaisuus ≥ 0,85; matala = samankaltaisuus ≥ 0,7; muuten liikeId null ja luottamus matala.
 */
export function matchExercise(nimi) {
  const q = normalisoi(nimi);
  if (!q) return { liikeId: null, luottamus: 'matala', pisteet: 0 };
  const sanat = sanasto();
  const tasan = sanat.find((x) => x.s === q);
  if (tasan) return { liikeId: tasan.liikeId, luottamus: 'korkea', pisteet: 1 };
  const auki = avaaLyhenteet(q);
  if (auki !== q) {
    const lyhenne = sanat.find((x) => x.s === auki);
    if (lyhenne) return { liikeId: lyhenne.liikeId, luottamus: 'keskitaso', pisteet: 0.9 };
  }
  let paras = null;
  for (const x of sanat) {
    const p = samankaltaisuus(auki, x.s);
    if (!paras || p > paras.pisteet) paras = { liikeId: x.liikeId, pisteet: p };
  }
  const pisteet = Math.round(paras.pisteet * 100) / 100;
  if (paras.pisteet >= KESKITASO_RAJA) return { liikeId: paras.liikeId, luottamus: 'keskitaso', pisteet };
  if (paras.pisteet >= MATALA_RAJA) return { liikeId: paras.liikeId, luottamus: 'matala', pisteet };
  return { liikeId: null, luottamus: 'matala', pisteet };
}

/**
 * matchImportedExercises(rivit) → [{ rivi, nimi, liikeId|null, luottamus: 'korkea'|'keskitaso'|'matala',
 *   sarjat, toistot, toistoMax, paiva }]
 * rivit: raakarivit (merkkijonot tai teksti, jäsennetään parseImportText-funktiolla) tai valmiiksi
 * jäsennetyt rivit. Tuntematon liike → liikeId null ("Valitse vastaava liike").
 */
export function matchImportedExercises(rivit) {
  const lista = rivilista(rivit);
  const jasennetyt = lista.length && lista.every((r) => r && typeof r === 'object')
    ? lista
    : parseImportText(lista);
  return jasennetyt.map((r) => {
    const { liikeId, luottamus } = matchExercise(r.nimi);
    return {
      rivi: r.rivi,
      nimi: r.nimi,
      liikeId,
      luottamus,
      sarjat: r.sarjat ?? null,
      toistot: r.toistot ?? null,
      toistoMax: r.toistoMax ?? null,
      paiva: r.paiva || 'Päivä 1',
    };
  });
}

function rajaa(n, min, max, oletus) {
  if (n == null || n === '') return oletus;
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return oletus;
  return Math.min(max, Math.max(min, x));
}

function palautus(toistot) {
  if (toistot <= 6) return 180;
  if (toistot <= 10) return 120;
  if (toistot <= 12) return 90;
  return 60;
}

function slug(teksti) {
  return normalisoi(teksti).replace(/ /g, '-').slice(0, 30) || 'ohjelma';
}

function tiiviste(teksti) {
  let h = 0x811c9dc5;
  for (let i = 0; i < teksti.length; i++) {
    h ^= teksti.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * importedToProgram(rivit, nimi, { id, kuvaus } = {}) → OHJELMAT-muotoinen ohjelma | null
 *   { id: 'oma-…', nimi, kuvaus, tasot: 'oma', tuotu: true, kunnioitaSarjoja: true,
 *     paivat: [{ nimi, liikkeet: [{ liikeId, sarjat, toistoMin, toistoMax, palautusS }] }] }
 * rivit: raakarivit tai matchImportedExercises-tulos (käyttäjä on voinut korjata liikeId:t).
 * Rivit, joiden liikeId puuttuu tai on tuntematon, jätetään pois. Puuttuvat sarjat 3 ja toistot 10;
 * toistoMax = annettu yläraja tai sama kuin toistot (PT:n tarkka tavoite). Ei kelvollisia rivejä → null.
 * kunnioitaSarjoja: rakennaPaiva käyttää ohjelman sarjoja ja toistoja goalParamsin sijaan.
 * id on deterministinen nimestä ja sisällöstä, ellei sitä anneta.
 */
export function importedToProgram(rivit, nimi, { id, kuvaus } = {}) {
  const lista = rivilista(rivit);
  const sovitetut = lista.length && lista.every((r) => r && typeof r === 'object' && 'liikeId' in r)
    ? lista
    : matchImportedExercises(lista);
  const tunnetut = new Set(LIIKKEET.map((l) => l.id));
  const paivat = [];
  for (const r of sovitetut) {
    if (!r || !tunnetut.has(r.liikeId)) continue;
    const paivaNimi = String(r.paiva || 'Päivä 1');
    let paiva = paivat.find((p) => p.nimi === paivaNimi);
    if (!paiva) {
      paiva = { nimi: paivaNimi, liikkeet: [] };
      paivat.push(paiva);
    }
    const sarjat = rajaa(r.sarjat, 1, 10, OLETUS_SARJAT);
    const toistoMin = rajaa(r.toistot, 1, 50, OLETUS_TOISTOT);
    // Yksi luku ("4x8") on PT:n tarkka tavoite: haarukka 8–8, ja progressio etenee kuormalla.
    const toistoMax = r.toistoMax != null ? Math.max(toistoMin, rajaa(r.toistoMax, 1, 60, toistoMin)) : toistoMin;
    paiva.liikkeet.push({ liikeId: r.liikeId, sarjat, toistoMin, toistoMax, palautusS: palautus(toistoMin) });
  }
  if (!paivat.length) return null;
  const ohjelmanNimi = (typeof nimi === 'string' && nimi.trim()) || 'Tuotu ohjelma';
  const sisalto = paivat.map((p) => `${p.nimi}:${p.liikkeet.map((x) => `${x.liikeId}/${x.sarjat}/${x.toistoMin}`).join(',')}`).join('|');
  return {
    id: typeof id === 'string' && id ? id : `oma-${slug(ohjelmanNimi)}-${tiiviste(sisalto)}`,
    nimi: ohjelmanNimi,
    kuvaus: typeof kuvaus === 'string' && kuvaus ? kuvaus
      : `Tuotu ohjelma: ${paivat.length} ${paivat.length === 1 ? 'päivä' : 'päivää'}, ${paivat.reduce((s, p) => s + p.liikkeet.length, 0)} liikettä.`,
    tasot: 'oma',
    tuotu: true,
    kunnioitaSarjoja: true,
    paivat,
  };
}
