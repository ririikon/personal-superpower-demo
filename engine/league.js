// Treeniliigat (speksi 4l A): viikkopisteet, keksityt kilpailijat, viikon vaihtuminen (nousu,
// pysyminen tai pudotus) ja putkisuoja. Puhdas moduuli: ei DOM-, window-, localStorage- eikä
// Date.now()-kutsuja. Aika annetaan parametrina (`nyt`: ISO-merkkijono tai paikallinen
// 'YYYY-MM-DDTHH:mm[:ss]').
//
// Kilpailijat ovat mockupia: 19 keksittyä nimeä ja pisteet generoidaan deterministisesti
// (mulberry32) tasosta ja viikosta. Käyttäjän pisteet lasketaan hänen omista kirjauksistaan.

import { addDays, weekStart, onVoimatreeni } from './util.js?v=19a48e7';
import { viikonTavoitteet, weeklyProgress } from './targets.js?v=19a48e7';
import { workoutSummary, weeklyGoalDays } from './history.js?v=19a48e7';
import { LIIKKEET } from '../data.js?v=19a48e7';
import { mulberry32, tanaanPvm } from '../seed.js?v=19a48e7';

export const LIIGATASOT = [
  { id: 'pronssi', nimi: 'Pronssi' },
  { id: 'hopea', nimi: 'Hopea' },
  { id: 'kulta', nimi: 'Kulta' },
  { id: 'platina', nimi: 'Platina' },
  { id: 'superpower', nimi: 'SuperPower' },
];
export const LIIGAN_KOKO = 20;
export const NOUSURAJA = 5;      // sijat 1–5 nousevat
export const PUTOAMISRAJA = 16;  // sijat 16–20 putoavat
export const LIIGAPISTEET_KATTO = 100;

// Pisteiden osat ja katot (speksi 4l A). Summa on enintään 100.
const SARJAKERROIN = 0.6;   // min(kokonaisPros, 100) × 0,6 → enintään 60
const PAIVAT_ENINTAAN = 25; // treenipäivät / viikkotavoite × 25, enintään 25
const ENNATYS_PISTEET = 3;  // 3 per ennätys, enintään 9
const ENNATYKSET_ENINTAAN = 9;
const PUTKI_PISTEET = 6;    // viikkotavoite täyttyi

// Keksityt etunimet. Yhteisön kavereiden nimiä (Jari, Mia, Aino, Martti, Laura) ei käytetä.
const NIMET = [
  'Eero', 'Sanna', 'Ville', 'Noora', 'Tuomas', 'Kaisa', 'Antti', 'Riikka', 'Mikko', 'Elina',
  'Joonas', 'Hanna', 'Petri', 'Veera', 'Olli', 'Johanna', 'Teemu', 'Salla', 'Lauri', 'Emmi',
  'Ilkka', 'Tiina', 'Juha', 'Katja', 'Henna', 'Aleksi', 'Minna', 'Sami', 'Pauliina', 'Topi',
];
const KIRJAIMET = 'AEHJKLMNPRSTV';

// Kilpailijoiden viikon lopulliset pisteet ennen tason kerrointa ja vaihtelua (laskeva jakauma).
// Muutama kova kärki ja tasainen keskikasti: käyttäjä, joka täyttää viikkotavoitteensa, mahtuu
// kärkiviisikon tuntumaan, ja yksikin väliin jäänyt treeni voi pudottaa keskikastiin.
const LOPPUPISTEET = [100, 96, 93, 90, 87, 83, 79, 75, 71, 66, 61, 56, 51, 45, 39, 33, 26, 19, 12];
const TASOKERROIN = { pronssi: 0.82, hopea: 1.0, kulta: 1.06, platina: 1.1, superpower: 1.14 };
const VAIHTELU = 4; // ± pistettä
const LOPPUKIRI = 1.4; // viikon kahden viimeisen päivän paino kilpailijoiden kertymässä

// --- Apurit ----------------------------------------------------------------

// FNV-1a: merkkijono → 32-bittinen siemen mulberry32:lle.
function siemen(teksti) {
  let h = 0x811c9dc5;
  for (let i = 0; i < teksti.length; i++) {
    h ^= teksti.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function tasoIndeksi(taso) {
  const i = LIIGATASOT.findIndex((t) => t.id === taso);
  return i >= 0 ? i : 0;
}

function tasoId(taso) {
  return LIIGATASOT[tasoIndeksi(taso)].id;
}

function profiiliOf(tila) {
  return (tila && tila.profiili) || {};
}

function viikonAlkuAsetus(tila) {
  return profiiliOf(tila).viikonAlku === 'sunnuntai' ? 'sunnuntai' : 'maanantai';
}

// Kellonaika vartteina (0–95) nyt-hetkestä, paikallisessa ajassa. Kilpailijoiden pisteet päivittyvät
// vartin välein, joten saman vartin laskennat ovat identtisiä (leagueWeek-muistiointi).
const VARTTEJA = 96;
function paivanVartti(nyt) {
  const d = new Date(Date.parse(nyt));
  if (!Number.isFinite(d.getTime())) return VARTTEJA / 2;
  return Math.floor((d.getHours() * 60 + d.getMinutes()) / 15);
}

function liiga(tila) {
  const l = tila && tila.liiga && typeof tila.liiga === 'object' ? tila.liiga : null;
  return l;
}

function suojatOf(l) {
  return l && l.suojat && typeof l.suojat === 'object' && !Array.isArray(l.suojat) ? l.suojat : {};
}

// --- Kilpailijat -----------------------------------------------------------

/**
 * leagueOpponents(taso, viikonAlku) → [{ id, nimi, loppupisteet, kertyma: [7 lukua 0–1] }] (19 kpl)
 * Deterministinen: siemen tasosta ja viikosta. kertyma[d] = osuus viikon pisteistä päivän d loppuun
 * mennessä (päivä 0 = viikon ensimmäinen päivä, kertyma[6] = 1).
 */
export function leagueOpponents(taso, viikonAlku) {
  const id = tasoId(taso);
  const rng = mulberry32(siemen(`liiga|${id}|${viikonAlku}`));
  const nimet = NIMET.slice();
  for (let i = nimet.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [nimet[i], nimet[j]] = [nimet[j], nimet[i]];
  }
  const kerroin = TASOKERROIN[id];
  return LOPPUPISTEET.map((perus, i) => {
    const kirjain = KIRJAIMET[Math.floor(rng() * KIRJAIMET.length)];
    const vaihtelu = (rng() * 2 - 1) * VAIHTELU;
    const loppupisteet = Math.max(4, Math.min(LIIGAPISTEET_KATTO, Math.round(perus * kerroin + vaihtelu)));
    // Treenipäivät (noin puolet päivistä) painolla ~1, muut päivät pieni kertymä (kävelyt ym.).
    // Viikon kaksi viimeistä päivää painavat hieman enemmän: moni kirijä tekee viikonloppuna.
    const painot = Array.from({ length: 7 }, (_, d) => (rng() < 0.5 ? 0.7 + rng() * 0.6 : 0.05 + rng() * 0.15)
      * (d >= 5 ? LOPPUKIRI : 1));
    const summa = painot.reduce((s, w) => s + w, 0);
    let kertyma = 0;
    return {
      id: `liiga-${id}-${i + 1}`,
      nimi: `${nimet[i]} ${kirjain}.`,
      loppupisteet,
      kertyma: painot.map((w, d) => {
        kertyma += w / summa;
        return d === 6 ? 1 : Math.round(kertyma * 1000) / 1000;
      }),
    };
  });
}

// Kilpailijan pisteet nyt-hetkellä: päättyneet päivät kokonaan, tämä päivä kellonajan mukaan.
function kilpailijanPisteet(k, viikonAlku, tanaan, osuus) {
  const loppu = addDays(viikonAlku, 6);
  if (tanaan < viikonAlku) return 0;
  if (tanaan > loppu) return k.loppupisteet;
  const d = Math.round((Date.parse(`${tanaan}T12:00:00Z`) - Date.parse(`${viikonAlku}T12:00:00Z`)) / 864e5);
  const ennen = d > 0 ? k.kertyma[d - 1] : 0;
  const tama = k.kertyma[d] - ennen;
  return Math.round(k.loppupisteet * (ennen + tama * osuus));
}

// --- Julkiset funktiot -----------------------------------------------------

/**
 * leaguePoints(tila, viikonAlku, nyt) → {
 *   yhteensa, katto: 100,
 *   erittely: [{ id: 'sarjat'|'paivat'|'ennatykset'|'putki', nimi, pisteet, enintaan, arvo }]
 * }
 * Viikko [viikonAlku, viikonAlku + 6], kirjaukset nyt-päivään asti (tasapainotettu, speksi 4l A):
 * - sarjat: min(kokonaisPros, 100) × 0,6 (viikonTavoitteet + weeklyProgress; ylimääräiset sarjat
 *   eivät tuo pisteitä, koska tavoitteen ylitys ei kasvata prosenttia), arvo = kokonaisPros
 * - paivat: eri päivät, joina on mikä tahansa kirjaus / profiili.treenitViikossa × 25, enintään 25,
 *   arvo = { tehty, tavoite }
 * - ennatykset: 3 per ennätys (liike, jossa treeni teki ennätyksen; sama liike samassa treenissä
 *   lasketaan kerran), enintään 9, arvo = ennätysten määrä
 * - putki: 6, jos viikkotavoite (päiviä ≥ treenitViikossa) täyttyi, arvo = bool
 */
export function leaguePoints(tila, viikonAlku, nyt) {
  const t = tila || {};
  const profiili = profiiliOf(t);
  const tanaan = tanaanPvm(nyt);
  const loppu = addDays(viikonAlku, 6);
  const raja = tanaan < loppu ? tanaan : loppu;
  const kaikki = (Array.isArray(t.historia) ? t.historia : []).filter((x) => x && typeof x.pvm === 'string' && x.pvm <= raja);
  const viikolla = kaikki.filter((x) => x.pvm >= viikonAlku && x.pvm <= loppu);
  const tavoite = Number.isFinite(profiili.treenitViikossa) && profiili.treenitViikossa >= 1 ? profiili.treenitViikossa : 3;

  const { tavoitteet } = viikonTavoitteet(t, viikonAlku);
  const ed = weeklyProgress(viikolla, LIIKKEET, tavoitteet, viikonAlku);
  const sarjaPisteet = Math.round(Math.min(ed.kokonaisPros, 100) * SARJAKERROIN);

  const paivat = weeklyGoalDays(viikolla, viikonAlkuAsetus(t), viikonAlku, tavoite);
  const paivaPisteet = Math.min(PAIVAT_ENINTAAN, Math.round((paivat.tehty / tavoite) * PAIVAT_ENINTAAN));

  let ennatyksia = 0;
  for (const tr of viikolla.filter(onVoimatreeni)) {
    const liikkeet = new Set(workoutSummary(tr, LIIKKEET, kaikki).ennatykset.map((e) => e.liikeId));
    ennatyksia += liikkeet.size;
  }
  const ennatysPisteet = Math.min(ENNATYKSET_ENINTAAN, ennatyksia * ENNATYS_PISTEET);
  const taytetty = paivat.tehty >= tavoite;
  const putkiPisteet = taytetty ? PUTKI_PISTEET : 0;

  const erittely = [
    { id: 'sarjat', nimi: 'Sarjatavoitteet', pisteet: sarjaPisteet, enintaan: 60, arvo: ed.kokonaisPros },
    { id: 'paivat', nimi: 'Treenipäivät', pisteet: paivaPisteet, enintaan: PAIVAT_ENINTAAN, arvo: { tehty: paivat.tehty, tavoite } },
    { id: 'ennatykset', nimi: 'Ennätykset', pisteet: ennatysPisteet, enintaan: ENNATYKSET_ENINTAAN, arvo: ennatyksia },
    { id: 'putki', nimi: 'Viikkotavoite täynnä', pisteet: putkiPisteet, enintaan: PUTKI_PISTEET, arvo: taytetty },
  ];
  return {
    yhteensa: Math.min(LIIGAPISTEET_KATTO, erittely.reduce((s, e) => s + e.pisteet, 0)),
    katto: LIIGAPISTEET_KATTO,
    erittely,
  };
}

/**
 * leagueWeek(tila, nyt) → {
 *   taso, tasoNimi, viikonAlku, loppuu: 'YYYY-MM-DD' (viikon viimeinen päivä), osallistuu,
 *   sijoitukset: [{ id, nimi, pisteet, kayttaja, sija }]   (20 riviä; ilman käyttäjää 19, jos ei osallistu),
 *   omaSija: 1–20 | null, omatPisteet: leaguePoints-tulos | null,
 *   nousuRaja: 5, putoamisRaja: 16, ylinTaso, alinTaso, suojaKaytossa
 * }
 * Viikko seuraa profiilin viikonAlku-asetusta. Järjestys pisteiden mukaan; tasapisteissä käyttäjä
 * ennen kilpailijaa, kilpailijat keskenään listan järjestyksessä. Sijat ovat yksilöllisiä.
 * Kilpailijoiden pisteet päivittyvät vartin välein. Tulos muistioidaan (sama tila-olio, päivä, vartti
 * ja sisältö → sama olio), joten palautettua oliota ei saa muokata.
 */
export function leagueWeek(tila, nyt) {
  const tanaan = tanaanPvm(nyt);
  const viikonAlku = weekStart(tanaan, viikonAlkuAsetus(tila));
  if (!tila || typeof tila !== 'object') return viikonTaulukko(tila, viikonAlku, nyt);
  // Muistiointi (speksi 4l, suorituskyky): tila-olion identiteetti + päivä + vartti + sormenjälki
  // niistä tilan osista, joista tulos riippuu. Saman olion muokkaus paikallaan muuttaa sormenjälkeä,
  // joten vanhentunutta tulosta ei palauteta. Palautettua oliota ei saa muokata.
  const avain = `${tanaan}|${paivanVartti(nyt)}|${sormenjalki(tila, viikonAlku)}`;
  let muisti = MUISTI.get(tila);
  if (!muisti) {
    muisti = new Map();
    MUISTI.set(tila, muisti);
  }
  if (muisti.has(avain)) return muisti.get(avain);
  const tulos = viikonTaulukko(tila, viikonAlku, nyt);
  if (muisti.size >= MUISTI_KOKO) muisti.delete(muisti.keys().next().value);
  muisti.set(avain, tulos);
  return tulos;
}

const MUISTI = new WeakMap();
const MUISTI_KOKO = 8;

function sormenjalki(tila, viikonAlku) {
  const historia = Array.isArray(tila.historia) ? tila.historia : [];
  const loppu = addDays(viikonAlku, 6);
  const viikolla = historia.filter((x) => x && typeof x.pvm === 'string' && x.pvm >= viikonAlku && x.pvm <= loppu);
  return JSON.stringify([tila.liiga || null, tila.profiili || null, historia.length, viikolla, tila.viikkosuunnitelmat || null]);
}

// Liigan taulukko annetulle viikolle (viikonAlku) nyt-hetken tilanteessa. Kun nyt on viikon jälkeen,
// kilpailijoilla on lopulliset pisteet ja käyttäjällä koko viikon pisteet.
function viikonTaulukko(tila, viikonAlku, nyt) {
  const l = liiga(tila) || {};
  const taso = tasoId(l.taso);
  const tanaan = tanaanPvm(nyt);
  const osuus = paivanVartti(nyt) / (VARTTEJA - 1);
  const osallistuu = l.osallistuu !== false;

  const rivit = leagueOpponents(taso, viikonAlku).map((k) => ({
    id: k.id, nimi: k.nimi, pisteet: kilpailijanPisteet(k, viikonAlku, tanaan, osuus), kayttaja: false,
  }));
  let omatPisteet = null;
  if (osallistuu) {
    omatPisteet = leaguePoints(tila, viikonAlku, nyt);
    rivit.unshift({ id: 'kayttaja', nimi: profiiliOf(tila).nimi || 'Sinä', pisteet: omatPisteet.yhteensa, kayttaja: true });
  }
  const sijoitukset = rivit
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => b.pisteet - a.pisteet || a.i - b.i)
    .map(({ i, ...r }, n) => ({ ...r, sija: n + 1 }));
  const oma = sijoitukset.find((r) => r.kayttaja);
  return {
    taso,
    tasoNimi: LIIGATASOT[tasoIndeksi(taso)].nimi,
    viikonAlku,
    loppuu: addDays(viikonAlku, 6),
    osallistuu,
    sijoitukset,
    omaSija: oma ? oma.sija : null,
    omatPisteet,
    nousuRaja: NOUSURAJA,
    putoamisRaja: PUTOAMISRAJA,
    ylinTaso: tasoIndeksi(taso) === LIIGATASOT.length - 1,
    alinTaso: tasoIndeksi(taso) === 0,
    suojaKaytossa: suojaViikolla(l, viikonAlku, viikonAlkuAsetus(tila)),
  };
}

function suojaViikolla(l, viikonAlku, asetus) {
  return Object.values(suojatOf(l)).some((p) => typeof p === 'string' && weekStart(p.slice(0, 10), asetus) === viikonAlku);
}

/**
 * leagueOutcome(sija, taso, suojaKaytossa = false) → { tulos: 'nousu'|'pysyi'|'putosi', uusiTaso, suojattu }
 * Viikon lopputulos sijasta: 1–5 nousee, 16–20 putoaa. Ylimmästä tasosta ei nousta eikä alimmasta
 * pudota. Putkisuoja estää pudotuksen (suojattu: true, kun suoja pelasti pudotukselta).
 */
export function leagueOutcome(sija, taso, suojaKaytossa = false) {
  const i = tasoIndeksi(taso);
  if (sija <= NOUSURAJA && i < LIIGATASOT.length - 1) {
    return { tulos: 'nousu', uusiTaso: LIIGATASOT[i + 1].id, suojattu: false };
  }
  const pudotusalue = sija >= PUTOAMISRAJA && i > 0;
  if (pudotusalue && !suojaKaytossa) return { tulos: 'putosi', uusiTaso: LIIGATASOT[i - 1].id, suojattu: false };
  return { tulos: 'pysyi', uusiTaso: LIIGATASOT[i].id, suojattu: pudotusalue && !!suojaKaytossa };
}

/**
 * rolloverLeague(tila, nyt) → { tila, tulos: 'nousu'|'pysyi'|'putosi'|null, viikko: historiarivi | null }
 * Viikon vaihtuessa (liiga.viimeksiNaytettyViikko on ennen tämän päivän viikkoa) päättyneen viikon
 * lopputulos lasketaan viikon viimeisen päivän lopussa: sijat 1–5 nousevat ja 16–20 putoavat; ylimmästä
 * tasosta ei nousta eikä alimmasta pudota, ja putkisuoja estää pudotuksen. Tulos lisätään
 * liiga.historia-listaan ({ viikonAlku, taso, sija, pisteet, tulos, uusiTaso, suojattu }) ja
 * liiga.odottavaTulos-kenttään ("viikko vaihtui" -näkymä; UI tyhjentää sen näytettyään).
 * Useamman viikon tauon jälkeen lasketaan vain viimeksi näytetty viikko. Kerran viikossa: jos viikko on
 * jo käsitelty, palautetaan sama tila-olio ja tulos null. Puuttuva viimeksiNaytettyViikko asetetaan
 * tähän viikkoon ilman tulosta. Jos käyttäjä ei osallistu, viikko päivitetään ilman tulosta.
 * Päättynyt viikko lasketaan tallennetusta viikon alusta (viimeksiNaytettyViikko). Jos se ei ala
 * nykyisellä viikonalulla (asetus vaihtunut), seuranta alkaa tästä viikosta ilman tulosta.
 */
export function rolloverLeague(tila, nyt) {
  const l = liiga(tila);
  if (!l) return { tila, tulos: null, viikko: null };
  const asetus = viikonAlkuAsetus(tila);
  const tama = weekStart(tanaanPvm(nyt), asetus);
  const edellinen = typeof l.viimeksiNaytettyViikko === 'string' ? l.viimeksiNaytettyViikko : null;
  if (edellinen && edellinen >= tama) return { tila, tulos: null, viikko: null };
  // Puuttuva viikko, ei osallistu tai viikonalun asetus on vaihtunut (tallennettu viikko ei ala
  // nykyisellä viikonalulla): seuranta alkaa tästä viikosta ilman tulosta.
  if (!edellinen || l.osallistuu === false || weekStart(edellinen, asetus) !== edellinen) {
    return { tila: { ...tila, liiga: { ...l, viimeksiNaytettyViikko: tama } }, tulos: null, viikko: null };
  }

  // Päättynyt viikko lasketaan suoraan tallennetusta viikon alusta (ei tämän päivän viikosta),
  // seuraavan päivän alussa, jolloin kaikki viikon päivät ovat päättyneet.
  const viikko = viikonTaulukko(tila, edellinen, `${addDays(edellinen, 7)}T00:00:00`);
  const { tulos, uusiTaso, suojattu } = leagueOutcome(viikko.omaSija, viikko.taso, viikko.suojaKaytossa);
  const oma = viikko.sijoitukset.find((r) => r.kayttaja);
  const rivi = {
    viikonAlku: edellinen,
    taso: viikko.taso,
    sija: viikko.omaSija,
    pisteet: oma ? oma.pisteet : 0,
    tulos,
    uusiTaso,
    suojattu,
  };
  const historia = Array.isArray(l.historia) ? l.historia : [];
  return {
    tila: {
      ...tila,
      liiga: {
        ...l,
        taso: uusiTaso,
        historia: [...historia, rivi],
        viimeksiNaytettyViikko: tama,
        odottavaTulos: rivi,
      },
    },
    tulos,
    viikko: rivi,
  };
}

/**
 * simulateRollover(tila, nyt) → { tila, tulos: 'nousu'|'pysyi'|'putosi'|null, viikko: historiarivi | null }
 * Demo "Simuloi viikon vaihto": kuluva viikko päätetään nyt sen hetkisillä pisteillä ja sijalla, aivan
 * kuin viikko olisi päättynyt. Taso vaihtuu, rivi ({ ..., simuloitu: true }) lisätään historiaan (saman
 * viikon aiempi simulointi korvataan) ja liiga.odottavaTulos-kenttään. viimeksiNaytettyViikko siirtyy
 * seuraavaan viikkoon, joten oikea rollover ei käsittele samaa viikkoa uudelleen. Ei liigaa tai ei
 * osallistu → sama tila ja tulos null.
 */
export function simulateRollover(tila, nyt) {
  const l = liiga(tila);
  if (!l || l.osallistuu === false) return { tila, tulos: null, viikko: null };
  const tama = weekStart(tanaanPvm(nyt), viikonAlkuAsetus(tila));
  const viikko = viikonTaulukko(tila, tama, nyt);
  const { tulos, uusiTaso, suojattu } = leagueOutcome(viikko.omaSija, viikko.taso, viikko.suojaKaytossa);
  const oma = viikko.sijoitukset.find((r) => r.kayttaja);
  const rivi = {
    viikonAlku: tama,
    taso: viikko.taso,
    sija: viikko.omaSija,
    pisteet: oma ? oma.pisteet : 0,
    tulos,
    uusiTaso,
    suojattu,
    simuloitu: true,
  };
  const historia = (Array.isArray(l.historia) ? l.historia : []).filter((r) => !(r && r.simuloitu && r.viikonAlku === tama));
  return {
    tila: {
      ...tila,
      liiga: {
        ...l,
        taso: uusiTaso,
        historia: [...historia, rivi],
        viimeksiNaytettyViikko: addDays(tama, 7),
        odottavaTulos: rivi,
      },
    },
    tulos,
    viikko: rivi,
  };
}

/**
 * vaihdaViikonAlku(tila, viikonAlku, nyt) → uusi tila (puhdas)
 * Profiilin "Viikon alku" -asetus: profiili.viikonAlku vaihtuu ja liigan seuranta asetetaan kuluvaan
 * viikkoon uudella viikonalulla, joten vaihto ei käynnistä rolloveria eikä laske kesken olevaa viikkoa.
 */
export function vaihdaViikonAlku(tila, viikonAlku, nyt) {
  const t = tila || {};
  const asetus = viikonAlku === 'sunnuntai' ? 'sunnuntai' : 'maanantai';
  const uusi = { ...t, profiili: { ...(t.profiili || {}), viikonAlku: asetus } };
  const l = liiga(t);
  if (l) uusi.liiga = { ...l, viimeksiNaytettyViikko: weekStart(tanaanPvm(nyt), asetus) };
  return uusi;
}

/**
 * useStreakShield(tila, nyt, viikonAlku?) → { tila, ok, syy?: 'eiLiigaa'|'eiOsallistu'|'kaytetty'|'joSuojattu', viikonAlku }
 * Putkisuoja: 1 kalenterikuukaudessa (kuukausi = nyt-päivän kuukausi). Suojaa tämän viikon (oletus)
 * tai annetun viikon (esim. ensi viikon reissu): liiga.suojat[YYYY-MM] = suojatun viikon päivä
 * (tämä päivä tai annetun viikon ensimmäinen päivä). Puhdas: palauttaa uuden tilan.
 */
export function useStreakShield(tila, nyt, viikonAlku) {
  const l = liiga(tila);
  const asetus = viikonAlkuAsetus(tila);
  const tanaan = tanaanPvm(nyt);
  const tama = weekStart(tanaan, asetus);
  const kohde = typeof viikonAlku === 'string' && viikonAlku > tama ? weekStart(viikonAlku, asetus) : tama;
  if (!l) return { tila, ok: false, syy: 'eiLiigaa', viikonAlku: kohde };
  if (l.osallistuu === false) return { tila, ok: false, syy: 'eiOsallistu', viikonAlku: kohde };
  const kk = tanaan.slice(0, 7);
  const suojat = suojatOf(l);
  if (suojat[kk]) return { tila, ok: false, syy: 'kaytetty', viikonAlku: kohde };
  if (suojaViikolla(l, kohde, asetus)) return { tila, ok: false, syy: 'joSuojattu', viikonAlku: kohde };
  const pvm = kohde === tama ? tanaan : kohde;
  return {
    tila: { ...tila, liiga: { ...l, suojat: { ...suojat, [kk]: pvm } } },
    ok: true,
    viikonAlku: kohde,
  };
}

const SUOJAMUISTI_RE = /reissu|matka|lomal|mökil|oireile|kipu|kipe|kolott|sattu|vamma/i;

/**
 * shieldSuggestion(tila, nyt) → { viikonAlku, syy: 'matka'|'kipu' } | null
 * Valmentaja ehdottaa putkisuojaa (speksi 4l A), kun käyttäjä osallistuu liigaan, kuukauden suoja on
 * käyttämättä ja tällä tai ensi viikolla on voimassa matka- tai kipumuisti (tilapäinen muisti, jonka
 * teksti kertoo reissusta, matkasta tai oireilusta) tai hyväksytyssä viikkosuunnitelmassa on
 * matkapäiviä. Jo suojattu viikko ohitetaan. Lähin viikko ensin.
 */
export function shieldSuggestion(tila, nyt) {
  const l = liiga(tila);
  if (!l || l.osallistuu === false) return null;
  const tanaan = tanaanPvm(nyt);
  if (suojatOf(l)[tanaan.slice(0, 7)]) return null;
  const asetus = viikonAlkuAsetus(tila);
  const tama = weekStart(tanaan, asetus);
  const muistit = Array.isArray(tila.muistit) ? tila.muistit : [];
  const suunnitelmat = Array.isArray(tila.viikkosuunnitelmat) ? tila.viikkosuunnitelmat : [];
  for (const alku of [tama, addDays(tama, 7)]) {
    if (suojaViikolla(l, alku, asetus)) continue;
    const loppu = addDays(alku, 6);
    const ensimmainen = alku === tama ? tanaan : alku;
    for (const m of muistit) {
      if (!m || m.tyyppi === 'pysyvä' || !SUOJAMUISTI_RE.test(m.teksti || '')) continue;
      const a = m.voimassaAlku || '0000-00-00';
      const b = m.voimassaLoppu || '9999-12-31';
      if (a <= loppu && b >= ensimmainen) {
        return { viikonAlku: alku, syy: /oireile|kipu|kipe|kolott|sattu|vamma/i.test(m.teksti) ? 'kipu' : 'matka' };
      }
    }
    const matkapaivia = suunnitelmat.some((s) => s && (s.paivat || []).some((p) => p && p.tyyppi === 'matka'
      && p.pvm >= ensimmainen && p.pvm <= loppu));
    if (matkapaivia) return { viikonAlku: alku, syy: 'matka' };
  }
  return null;
}

/** shieldSuggested(tila, nyt) → bool: ehdottaako valmentaja putkisuojaa (ks. shieldSuggestion). */
export function shieldSuggested(tila, nyt) {
  return !!shieldSuggestion(tila, nyt);
}
