// Yhteisö (speksi 4i): haasteiden mittarit, lähtötasot, tulostaulukot, kavereiden edistyminen,
// pisteet ja tasot, merkit ja aktiviteettisyöte. Puhdas moduuli: ei DOM-, window-, localStorage-
// eikä Date.now()-kutsuja. Aika annetaan parametrina (`nyt`: ISO-merkkijono).
//
// Kaikki sosiaalinen data on mockup: kavereiden edistyminen ja syöte generoidaan deterministisesti
// (mulberry32) haasteesta, kaverista ja päivämäärästä. Oma edistyminen lasketaan historiasta.

import { addDays, daysBetween, onVoimatreeni, onTyosarja } from './util.js?v=19a48e7';
import { workoutSummary, streakWeeks, milestones } from './history.js?v=19a48e7';
import { LIIKKEET, MERKKIPAALUT, HAASTEMERKIT } from '../data.js?v=19a48e7';
import { mulberry32, tanaanPvm } from '../seed.js?v=19a48e7';
// Kehäviittaus invite.js ↔ challenges.js on turvallinen: molemmat käyttävät toisiaan vain funktiokutsuissa.
import { inviteBonusPoints } from './invite.js?v=19a48e7';

const LAHTOTASO_PV = 28;            // lähtötaso: 4 edellistä viikkoa
const PISTEET = { voimatreeni: 10, aktiviteetti: 3, haaste: 50, merkki: 20 };
// Demon katto kutsupisteille (speksi 4k): enintään 5 palkittua kutsua eli 500 pistettä.
export const KUTSUPISTEET_ENINTAAN_KUTSUJA = 5;
const KUTSUPISTEET_KATTO = KUTSUPISTEET_ENINTAAN_KUTSUJA * 100;
// Pisteerittelyn rivien nimet näkymille.
export const PISTE_ERITTELY_NIMET = {
  treenit: 'Treenit', aktiviteetit: 'Aktiviteetit', haasteet: 'Haasteet', merkit: 'Merkit',
  kutsut: `Kutsut (enintään ${KUTSUPISTEET_ENINTAAN_KUTSUJA})`,
};
const TASOPISTEET = 100;            // taso n vaatii 100 × n × (n + 1) / 2 pistettä

// Kaverin suoritus suhteessa omaan lähtötasoonsa profiilin mukaan (demon oletus):
// aloittelija kehittyy nopeasti, kokenut on lähellä kattoaan.
const PROFIILIKERROIN = { aloittelija: 1.25, keskitaso: 0.95, kokenut: 0.88 };

// Merkkipaalujen ehdot "saatavilla"-listaan (määritelmät ovat data.js:ssä).
const MERKKIPAALU_EHDOT = {
  'eka-treeni': 'Kirjaa ensimmäinen treeni',
  'treenit-10': 'Kirjaa 10 treeniä',
  'treenit-50': 'Kirjaa 50 treeniä',
  'treenit-100': 'Kirjaa 100 treeniä',
  'eka-ennatys': 'Tee ensimmäinen ennätys',
  'putki-4-viikkoa': 'Täytä viikkotavoite 4 viikkoa peräkkäin',
  'volyymi-10000': 'Nosta 10 000 kg yhdessä treenissä',
};

const SYOTE_PAIVIA = 7;
const SYOTE_ENINTAAN = 12;

// --- Sisäiset apurit -------------------------------------------------------

// FNV-1a: merkkijono → 32-bittinen siemen mulberry32:lle.
function siemen(teksti) {
  let h = 0x811c9dc5;
  for (let i = 0; i < teksti.length; i++) {
    h ^= teksti.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function jaksonPituus(haaste) {
  return daysBetween(haaste.alku, haaste.loppu) + 1;
}

function osat(tila) {
  const t = tila || {};
  const yhteiso = t.yhteiso || {};
  return {
    historia: Array.isArray(t.historia) ? t.historia : [],
    profiili: t.profiili || {},
    viikkosuunnitelmat: Array.isArray(t.viikkosuunnitelmat) ? t.viikkosuunnitelmat : [],
    kaverit: Array.isArray(yhteiso.kaverit) ? yhteiso.kaverit : [],
    haasteet: Array.isArray(yhteiso.haasteet) ? yhteiso.haasteet : [],
    ansaitutMerkit: Array.isArray(yhteiso.ansaitutMerkit) ? yhteiso.ansaitutMerkit : [],
  };
}

function mittariOpts(o, tanaan) {
  return { liikkeet: LIIKKEET, profiili: o.profiili, viikkosuunnitelmat: o.viikkosuunnitelmat, tanaan };
}

// Tasapainotettu tulos: arvo / lähtötaso × 100 %. Nollalähtötasolla mikä tahansa tulos on 100 %.
function suhde(arvo, lahtotaso) {
  if (lahtotaso > 0) return Math.round((arvo / lahtotaso) * 100);
  return arvo > 0 ? 100 : 0;
}

function pyorista1(x) {
  return Math.round(x * 10) / 10;
}

function etunimi(nimi) {
  return String(nimi || '').trim().split(/\s+/)[0] || 'Kaveri';
}

function kaverinLahtotaso(kaveri, haaste) {
  const viikossa = Number((kaveri && kaveri.lahtotasot && kaveri.lahtotasot[haaste.mittari]) || 0);
  return (viikossa * jaksonPituus(haaste)) / 7;
}

function tasonKynnys(n) {
  return (TASOPISTEET * n * (n + 1)) / 2;
}

// Päivä, jona haasteen tavoite täyttyi (null, jos ei ole täyttynyt `tanaan` mennessä).
function valmistumisPvm(haaste, o, tanaan) {
  if (!(haaste.tavoite > 0) || tanaan < haaste.alku) return null;
  const raja = tanaan < haaste.loppu ? tanaan : haaste.loppu;
  const opts = mittariOpts(o, tanaan);
  for (let d = haaste.alku; d <= raja; d = addDays(d, 1)) {
    if (metricValue(haaste.mittari, o.historia, haaste.alku, d, opts) >= haaste.tavoite) return d;
  }
  return null;
}

// Salin muiden jäsenten osuudet: deterministinen, vino jakauma (muutama ahkera, moni kevyt).
function saliTiedot(haaste, arvo, tanaan, paattynyt) {
  const kuluneet = tanaan < haaste.alku ? 0 : daysBetween(haaste.alku, paattynyt ? haaste.loppu : tanaan) + (paattynyt ? 1 : 0.5);
  const muut = Math.round((haaste.saliPaivassa || 0) * kuluneet);
  const jasenia = Math.max(1, Math.round(haaste.saliJasenia || 1));
  const rng = mulberry32(siemen(`sali|${haaste.id}`));
  const painot = Array.from({ length: jasenia - 1 }, () => Math.pow(-Math.log(1 - rng() * 0.999), 1.6));
  const summa = painot.reduce((s, w) => s + w, 0) || 1;
  const sija = 1 + painot.filter((w) => (muut * w) / summa > arvo).length;
  const kertyma = muut + arvo;
  const tavoite = haaste.saliTavoite || 0;
  return {
    kertyma,
    tavoite,
    pros: tavoite > 0 ? Math.min(100, Math.round((kertyma / tavoite) * 100)) : 0,
    omaOsuus: arvo,
    sija,
    jasenia,
  };
}

// --- Julkiset funktiot -----------------------------------------------------

/**
 * metricValue(mittari, historia, alku, loppu, { liikkeet, profiili, viikkosuunnitelmat, tanaan? }) → luku
 * Aikaväli [alku, loppu] päivämäärinä, molemmat mukaan lukien.
 * - treenit: voimatreenien määrä (tuodut aktiviteetit eivät kerry)
 * - volyymi: työsarjojen kg, käsipainoilla × 2 (lämmittelysarjat eivät kerry)
 * - sarjat: työsarjojen määrä
 * - aktiivisetPaivat: eri päivät, joina on mikä tahansa merkintä (myös tuodut) tai kirjattu lajipäivä
 *   (viikkosuunnitelman 'laji'-päivä, joka on ennen `tanaan`-päivää tai merkitty toteutuneeksi)
 * - putki: peräkkäiset viikot, joina viikkotavoite (profiili.treenitViikossa) täyttyi; viikkoja
 *   lasketaan taaksepäin `loppu`-päivän viikosta, joten anna loppu enintään tänään.
 */
export function metricValue(mittari, historia, alku, loppu, opts = {}) {
  if (!alku || !loppu || loppu < alku) return 0;
  const liikkeet = Array.isArray(opts.liikkeet) && opts.liikkeet.length ? opts.liikkeet : LIIKKEET;
  const profiili = opts.profiili || {};
  const jakso = (historia || []).filter((t) => t && typeof t.pvm === 'string' && t.pvm >= alku && t.pvm <= loppu);
  const voima = jakso.filter(onVoimatreeni);

  switch (mittari) {
    case 'treenit':
      return voima.length;
    case 'volyymi':
      return voima.reduce((s, t) => s + workoutSummary(t, liikkeet).volyymi, 0);
    case 'sarjat':
      return voima.reduce(
        (s, t) => s + (t.liikkeet || []).reduce((n, tl) => n + (tl.sarjat || []).filter(onTyosarja).length, 0),
        0,
      );
    case 'aktiivisetPaivat': {
      const raja = opts.tanaan || addDays(loppu, 1);
      const paivat = new Set(jakso.map((t) => t.pvm));
      for (const s of opts.viikkosuunnitelmat || []) {
        for (const p of (s && s.paivat) || []) {
          if (!p || p.tyyppi !== 'laji' || typeof p.pvm !== 'string') continue;
          if (p.pvm < alku || p.pvm > loppu) continue;
          if (p.pvm < raja || (p.toteutunut && p.pvm <= raja)) paivat.add(p.pvm);
        }
      }
      return paivat.size;
    }
    case 'putki':
      return streakWeeks(jakso, profiili.treenitViikossa ?? 3, profiili.viikonAlku || 'maanantai', loppu);
    default:
      return 0;
  }
}

/**
 * baseline(mittari, historia, alku, loppu, opts) → luku (1 desimaali)
 * Lähtötaso = mittarin arvo neljältä haastetta edeltävältä viikolta ([alku − 28, alku − 1])
 * skaalattuna haasteen pituudelle (pituus / 28).
 */
export function baseline(mittari, historia, alku, loppu, opts = {}) {
  const pituus = daysBetween(alku, loppu) + 1;
  if (!(pituus > 0)) return 0;
  const a = addDays(alku, -LAHTOTASO_PV);
  const b = addDays(alku, -1);
  const arvo = metricValue(mittari, historia, a, b, { ...opts, tanaan: alku });
  return pyorista1((arvo * pituus) / LAHTOTASO_PV);
}

/**
 * challengeProgress(haaste, tila, nyt) →
 *   { arvo, tavoite, pros, suoritettu, paivaaJaljella, alkanut, paattynyt,
 *     lahtotaso? (kaveri- ja työpaikkahaaste), sali? { kertyma, tavoite, pros, omaOsuus, sija, jasenia } (salihaaste) }
 * Työpaikkahaaste (tyyppi 'tyopaikka', speksi 4l D): tavoite on haasteen tavoite tai oma lähtötaso,
 * ja haaste on suoritettu, kun arvo ≥ tavoite. Tiimien taulukko: engine/workplace.js teamStandings.
 * arvo lasketaan historiasta väliltä [alku, min(loppu, tänään)]. pros on 0–100.
 * Kaverihaaste: tavoite on haasteen tavoite tai käyttäjän oma lähtötaso, ja haaste on suoritettu,
 * kun se on päättynyt. Muut: suoritettu, kun arvo ≥ tavoite.
 * paivaaJaljella sisältää tämän päivän (0, kun haaste on päättynyt).
 */
export function challengeProgress(haaste, tila, nyt) {
  const o = osat(tila);
  const tanaan = tanaanPvm(nyt);
  const alkanut = tanaan >= haaste.alku;
  const paattynyt = tanaan > haaste.loppu;
  const raja = paattynyt ? haaste.loppu : tanaan;
  const opts = mittariOpts(o, tanaan);
  const arvo = alkanut ? metricValue(haaste.mittari, o.historia, haaste.alku, raja, opts) : 0;

  const tulos = {};
  let tavoite = Number.isFinite(haaste.tavoite) ? haaste.tavoite : 0;
  // Kaveri- ja työpaikkahaaste (speksi 4l D): oma lähtötaso on tavoite, ellei tavoitetta ole annettu.
  if (haaste.tyyppi === 'kaveri' || haaste.tyyppi === 'tyopaikka') {
    const lahtotaso = baseline(haaste.mittari, o.historia, haaste.alku, haaste.loppu, opts);
    tulos.lahtotaso = lahtotaso;
    if (!Number.isFinite(haaste.tavoite)) tavoite = Math.max(1, Math.round(lahtotaso));
  }
  const pros = tavoite > 0 ? Math.min(100, Math.round((arvo / tavoite) * 100)) : 0;
  const suoritettu = haaste.tyyppi === 'kaveri' ? paattynyt : tavoite > 0 && arvo >= tavoite;
  const paivaaJaljella = paattynyt ? 0 : daysBetween(tanaan, haaste.loppu) + 1;
  if (haaste.tyyppi === 'sali') tulos.sali = saliTiedot(haaste, arvo, tanaan, paattynyt);
  return { arvo, tavoite, pros, suoritettu, paivaaJaljella, alkanut, paattynyt, ...tulos };
}

/**
 * friendProgress(kaveri, haaste, nyt) → arvo (deterministinen)
 * Kaverin edistyminen generoidaan hänen lähtötasostaan (kaveri.lahtotasot[mittari] on viikkoarvo):
 * päivittäinen kertymä = lähtötaso / pituus × profiilikerroin × haastekohtainen vire × päivän vaihtelu.
 * Vain tätä päivää edeltävät päivät kertyvät; päättyneessä haasteessa koko jakso.
 */
export function friendProgress(kaveri, haaste, nyt) {
  if (!kaveri || !haaste) return 0;
  const tanaan = tanaanPvm(nyt);
  if (tanaan <= haaste.alku) return 0;
  const pituus = jaksonPituus(haaste);
  const paivia = tanaan > haaste.loppu ? pituus : Math.min(pituus, daysBetween(haaste.alku, tanaan));
  const kerroin = PROFIILIKERROIN[kaveri.profiili] ?? 1;
  const rng = mulberry32(siemen(`${kaveri.id}|${haaste.id}|${haaste.alku}`));
  const vire = 0.96 + 0.08 * rng();
  const paivassa = (kaverinLahtotaso(kaveri, haaste) / pituus) * kerroin * vire;
  let summa = 0;
  for (let i = 0; i < pituus; i++) {
    const vaihtelu = 0.85 + 0.3 * rng();
    if (i < paivia) summa += paivassa * vaihtelu;
  }
  return haaste.mittari === 'putki' ? Math.floor(summa) : Math.round(summa);
}

/**
 * leaderboard(haaste, tila, nyt, { tasapainotettu = false }) →
 *   [{ id, nimi, arvo, pros, lahtotaso, sija, kayttaja }]
 * Käyttäjä (id 'kayttaja') ja haasteen osallistujat. Raakana järjestys arvon mukaan, tasapainotettuna
 * pros = arvo / lähtötaso × 100 % mukaan. Tasatilanteessa sama sija.
 */
export function leaderboard(haaste, tila, nyt, { tasapainotettu = false } = {}) {
  const o = osat(tila);
  const tanaan = tanaanPvm(nyt);
  const p = challengeProgress(haaste, tila, nyt);
  const omaLahto = p.lahtotaso ?? baseline(haaste.mittari, o.historia, haaste.alku, haaste.loppu, mittariOpts(o, tanaan));
  const rivit = [{
    id: 'kayttaja', nimi: o.profiili.nimi || 'Sinä', arvo: p.arvo, lahtotaso: omaLahto, kayttaja: true,
  }];
  for (const id of haaste.osallistujat || []) {
    const k = o.kaverit.find((x) => x.id === id);
    if (!k) continue;
    rivit.push({
      id: k.id, nimi: k.nimi, arvo: friendProgress(k, haaste, nyt), lahtotaso: pyorista1(kaverinLahtotaso(k, haaste)), kayttaja: false,
    });
  }
  const avain = (r) => (tasapainotettu ? r.pros : r.arvo);
  const jarjestetty = rivit
    .map((r, i) => ({ ...r, pros: suhde(r.arvo, r.lahtotaso), i }))
    .sort((a, b) => avain(b) - avain(a) || a.i - b.i);
  let sija = 0;
  return jarjestetty.map((r, i) => {
    if (i === 0 || avain(r) !== avain(jarjestetty[i - 1])) sija = i + 1;
    return { id: r.id, nimi: r.nimi, arvo: r.arvo, pros: r.pros, lahtotaso: r.lahtotaso, sija, kayttaja: r.kayttaja };
  });
}

/**
 * badges(tila, nyt) → {
 *   ansaitut: [{ id, nimi, kuvake, pvm }]           (vanhin ensin),
 *   saatavilla: [{ id, nimi, kuvake, ehto, pros }]
 * }
 * Merkkipaalut lasketaan historiasta, haastemerkit liitetyistä haasteista. Tilaan tallennetut
 * (yhteiso.ansaitutMerkit) säilyvät, vaikka haaste poistuisi; niiden päivämäärä voittaa.
 */
export function badges(tila, nyt) {
  const o = osat(tila);
  const tanaan = tanaanPvm(nyt);
  const historia = o.historia.filter((t) => t && typeof t.pvm === 'string' && t.pvm <= tanaan);
  const tavoite = o.profiili.treenitViikossa ?? 3;
  const viikonAlku = o.profiili.viikonAlku || 'maanantai';

  const pvmt = new Map();
  for (const m of milestones(historia, { liikkeet: LIIKKEET, tavoite, viikonAlku })) pvmt.set(m.id, m.pvm);

  const aiempi = (id, pvm) => {
    if (pvm && (!pvmt.has(id) || pvm < pvmt.get(id))) pvmt.set(id, pvm);
  };
  const liitetyt = o.haasteet.filter((h) => h && h.liittynyt);
  const edistyminen = new Map(liitetyt.map((h) => [h.id, challengeProgress(h, tila, nyt)]));
  for (const h of liitetyt) {
    const p = edistyminen.get(h.id);
    if (h.tyyppi === 'oma' && p.suoritettu) aiempi('kuukauden-haaste', valmistumisPvm(h, o, tanaan));
    if (h.tyyppi === 'kumppani' && p.suoritettu) aiempi('kumppanihaaste', valmistumisPvm(h, o, tanaan));
    if (h.tyyppi === 'kaveri' && p.paattynyt) {
      aiempi('eka-kaverihaaste', h.loppu);
      const lauta = leaderboard(h, tila, nyt, { tasapainotettu: !!h.tasapainotus });
      const oma = lauta.find((r) => r.kayttaja);
      if (oma && oma.sija === 1) aiempi('voitettu-kaverihaaste', h.loppu);
    }
  }
  const tallennetut = new Map();
  for (const m of o.ansaitutMerkit) {
    if (m && m.id && m.pvm) tallennetut.set(m.id, m.pvm);
  }

  const maaritelmat = [...MERKKIPAALUT, ...HAASTEMERKIT];
  const ansaitut = maaritelmat
    .filter((m) => tallennetut.has(m.id) || pvmt.has(m.id))
    .map((m, i) => ({ id: m.id, nimi: m.nimi, kuvake: m.kuvake, pvm: tallennetut.get(m.id) || pvmt.get(m.id), i }))
    .sort((a, b) => (a.pvm < b.pvm ? -1 : a.pvm > b.pvm ? 1 : a.i - b.i))
    .map(({ id, nimi, kuvake, pvm }) => ({ id, nimi, kuvake, pvm }));
  const ansaittuIdt = new Set(ansaitut.map((m) => m.id));

  // Saatavilla olevien edistyminen (0–99 %).
  const maara = historia.length;
  const voima = historia.filter(onVoimatreeni);
  const suurinVolyymi = voima.reduce((s, t) => Math.max(s, workoutSummary(t, LIIKKEET).volyymi), 0);
  const putki = streakWeeks(historia, tavoite, viikonAlku, tanaan);
  const aktiiviset = liitetyt.filter((h) => !edistyminen.get(h.id).paattynyt);
  const parasPros = (tyyppi) => Math.max(0, ...aktiiviset.filter((h) => h.tyyppi === tyyppi).map((h) => edistyminen.get(h.id).pros));
  const kaveriKulunut = Math.max(0, ...aktiiviset.filter((h) => h.tyyppi === 'kaveri').map((h) => {
    const pituus = jaksonPituus(h);
    return Math.round((Math.max(0, daysBetween(h.alku, tanaan)) / pituus) * 100);
  }));
  const kaveriKarki = Math.max(0, ...aktiiviset.filter((h) => h.tyyppi === 'kaveri').map((h) => {
    const lauta = leaderboard(h, tila, nyt, { tasapainotettu: !!h.tasapainotus });
    const avain = (r) => (h.tasapainotus ? r.pros : r.arvo);
    const karki = Math.max(...lauta.map(avain));
    const oma = lauta.find((r) => r.kayttaja);
    return karki > 0 ? Math.round((avain(oma) / karki) * 100) : 0;
  }));
  const raaka = {
    'eka-treeni': maara * 100,
    'treenit-10': (maara / 10) * 100,
    'treenit-50': (maara / 50) * 100,
    'treenit-100': maara,
    'eka-ennatys': 0,
    'putki-4-viikkoa': (putki / 4) * 100,
    'volyymi-10000': suurinVolyymi / 100,
    'kuukauden-haaste': parasPros('oma'),
    'eka-kaverihaaste': kaveriKulunut,
    'voitettu-kaverihaaste': kaveriKarki,
    kumppanihaaste: parasPros('kumppani'),
  };
  const saatavilla = maaritelmat
    .filter((m) => !ansaittuIdt.has(m.id))
    .map((m) => ({
      id: m.id,
      nimi: m.nimi,
      kuvake: m.kuvake,
      ehto: m.ehto || MERKKIPAALU_EHDOT[m.id] || m.nimi,
      pros: Math.max(0, Math.min(99, Math.round(raaka[m.id] || 0))),
    }));

  return { ansaitut, saatavilla };
}

/**
 * pointsAndLevel(tila, nyt) → { pisteet, taso, seuraavaan, pros, erittely: { treenit, aktiviteetit, haasteet, merkit, kutsut } }
 * Pisteet: voimatreeni 10, tuotu aktiviteetti 3, suoritettu liitetty haaste palkinto.pisteet (oletus 50),
 * ansaittu merkki 20, palkittu kaverikutsu 100 (inviteBonusPoints, speksi 4k), kutsuista enintään 5 eli 500 pistettä
 * (erittelyn nimi PISTE_ERITTELY_NIMET.kutsut = 'Kutsut (enintään 5)'). Taso n vaatii kumulatiivisesti 100 × n × (n + 1) / 2 pistettä (taso 0 alussa).
 * seuraavaan = pisteet, jotka puuttuvat tasosta n + 1; pros = edistyminen nykyiseltä tasolta seuraavalle.
 */
export function pointsAndLevel(tila, nyt) {
  const o = osat(tila);
  const tanaan = tanaanPvm(nyt);
  const historia = o.historia.filter((t) => t && typeof t.pvm === 'string' && t.pvm <= tanaan);
  const voimaa = historia.filter(onVoimatreeni).length;
  const erittely = {
    treenit: voimaa * PISTEET.voimatreeni,
    aktiviteetit: (historia.length - voimaa) * PISTEET.aktiviteetti,
    haasteet: o.haasteet
      .filter((h) => h && h.liittynyt && challengeProgress(h, tila, nyt).suoritettu)
      .reduce((s, h) => s + ((h.palkinto && Number.isFinite(h.palkinto.pisteet)) ? h.palkinto.pisteet : PISTEET.haaste), 0),
    merkit: badges(tila, nyt).ansaitut.length * PISTEET.merkki,
    // Kutsupalkkiot (speksi 4k): +100 per palkittu kutsu, näkymässä rivi "Kutsut".
    kutsut: Math.min(inviteBonusPoints(tila), KUTSUPISTEET_KATTO),
  };
  const pisteet = erittely.treenit + erittely.aktiviteetit + erittely.haasteet + erittely.merkit + erittely.kutsut;
  let taso = 0;
  while (tasonKynnys(taso + 1) <= pisteet) taso += 1;
  const ala = tasonKynnys(taso);
  const yla = tasonKynnys(taso + 1);
  return {
    pisteet,
    taso,
    seuraavaan: yla - pisteet,
    pros: Math.round(((pisteet - ala) / (yla - ala)) * 100),
    erittely,
  };
}

/**
 * feed(tila, nyt) → [{ id, kaveriId, tyyppi: 'treeni'|'liittyi'|'merkki', teksti, aika }] (uusin ensin)
 * Kavereiden tapahtumat viimeiseltä 7 päivältä. Päivän tapahtumat määräytyvät päivämäärästä, joten
 * sama päivä tuottaa aina samat tapahtumat ja tunnisteet (tsempit säilyvät). Vain nyt-hetkeä
 * edeltävät tapahtumat näytetään.
 */
export function feed(tila, nyt) {
  const o = osat(tila);
  if (!o.kaverit.length) return [];
  const tanaan = tanaanPvm(nyt);
  const nytMs = Date.parse(nyt);
  const merkit = [...MERKKIPAALUT, ...HAASTEMERKIT];
  // Työpaikkahaasteessa (speksi 4l D) ovat työkaverit, eivät yhteisön kaverit.
  const yhteiset = o.haasteet.filter((h) => h && h.tyyppi !== 'oma' && h.tyyppi !== 'tyopaikka');
  const tapahtumat = [];
  for (let n = 0; n < SYOTE_PAIVIA; n++) {
    const pvm = addDays(tanaan, -n);
    const [y, kk, d] = pvm.split('-').map(Number);
    const rng = mulberry32(siemen(`syote|${pvm}`));
    const maara = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < maara; i++) {
      const kaveri = o.kaverit[Math.floor(rng() * o.kaverit.length)];
      const r = rng();
      const tunti = 7 + Math.floor(rng() * 15);
      const minuutti = Math.floor(rng() * 12) * 5;
      const valinta = rng();
      const ennatyksia = Math.floor(rng() * 3);
      const aika = new Date(y, kk - 1, d, tunti, minuutti).toISOString();
      if (!(Date.parse(aika) <= nytMs)) continue;
      const nimi = etunimi(kaveri.nimi);
      // Kaveri liittyy haasteeseen, jonka osallistuja hän on, tai avoimeen sali- tai kumppanihaasteeseen.
      const kaynnissa = yhteiset.filter((h) => h.alku <= pvm && h.loppu >= pvm
        && (h.tyyppi !== 'kaveri' || (h.osallistujat || []).includes(kaveri.id)));
      let tyyppi;
      let teksti;
      if (r < 0.55 || (r < 0.8 && !kaynnissa.length)) {
        tyyppi = 'treeni';
        teksti = `${nimi} teki treenin`
          + (ennatyksia === 1 ? ' · 1 ennätys' : ennatyksia > 1 ? ` · ${ennatyksia} ennätystä` : '');
      } else if (r < 0.8) {
        tyyppi = 'liittyi';
        teksti = `${nimi} liittyi haasteeseen "${kaynnissa[Math.floor(valinta * kaynnissa.length)].nimi}"`;
      } else {
        tyyppi = 'merkki';
        teksti = `${nimi} ansaitsi merkin "${merkit[Math.floor(valinta * merkit.length)].nimi}"`;
      }
      tapahtumat.push({ id: `syote-${pvm}-${i}`, kaveriId: kaveri.id, tyyppi, teksti, aika });
    }
  }
  return tapahtumat
    .sort((a, b) => (a.aika < b.aika ? 1 : a.aika > b.aika ? -1 : a.id < b.id ? -1 : 1))
    .slice(0, SYOTE_ENINTAAN);
}
