// Esimerkkidata (speksi 3, 4b-2, 4e, 4i ja 5): demon alkutila noin 120 treenin historialla.
// Puhdas moduuli: ei DOMia, ei windowia, ei localStoragea eikä Date.now()-kutsuja.
// Aika annetaan parametrina (`nyt`: ISO-merkkijono). Sama `nyt` tuottaa aina saman tilan,
// koska satunnaisuus tulee siemenellisestä generaattorista (mulberry32).
//
// Rakenne:
// - Kahdeksan viimeisintä viikkoa ovat täysiä koko-kroppa-3-treenejä (päivät A, B, C vuorotellen,
//   3 kertaa viikossa). Viikolla 4 viikkoa sitten yksi treeni jäi väliin, joten putki on 3–4 viikkoa.
// - Viimeisin treeni on noin 20 h ennen `nyt`-hetkeä ja se on jalkapäivä (Päivä C:n
//   alavartaloliikkeet ja pohjenousu), joten palautumisessa näkyy väsyneitä jalkoja.
// - Vetoliikkeet olivat vahvimmillaan 6–8 viikkoa sitten ja notkahtivat sen jälkeen (laskeva trendi).
// - Penkkipunnerrus on jumiutunut: kolme viimeistä kertaa samalla painolla ilman toistojen kasvua.
// - Muut liikkeet etenevät kaksoisprogressiolla data.js:n aloituspainoista.
// - Vanhemmat merkinnät ovat kevyitä voimamerkintöjä (kokonaismäärä ja merkkipaalut).
// - Viimeisille 3 viikolle 7 tuotua kävelyä tai pyöräilyä, joista kaksi samana päivänä.

import { OHJELMAT, OLETUSPROFIILI, liike as haeLiike } from './data.js?v=31a36ec';
import { onVoimatreeni } from './engine/util.js?v=31a36ec';

export const SEED_OHJELMA_ID = 'koko-kroppa-3';

const SIEMEN = 20261009;
const TUNTI_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const TAYDET_PV = 56;          // täydet treenit: 8 viimeisintä viikkoa
const VOIMATREENEJA = 113;     // + 7 tuotua aktiviteettia = 120 merkintää
const VALIT = [2, 2, 3];       // treenipäivien välit taaksepäin: 3 treeniä / 7 päivää
const VEDOT = new Set(['ylataljaveto', 'leuanveto', 'hauiskaanto-tanko', 'kasipainosoutu']);
const JUMIUTUNUT = 'penkkipunnerrus';

// --- Apurit -----------------------------------------------------------------

// mulberry32: pieni siemenellinen satunnaislukugeneraattori, palauttaa luvun välillä [0, 1).
export function mulberry32(siemen) {
  let a = siemen >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Paikallinen päivämäärä 'YYYY-MM-DD' millisekunneista.
function pvmMs(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// `nyt`-hetken paikallinen päivämäärä. Seed käyttää tätä "tänään"-päivänä.
export function tanaanPvm(nyt) {
  return pvmMs(Date.parse(nyt));
}

// Paikallinen kellonaika annettuna päivänä → millisekunnit.
function paikallinenMs(pvm, tunnit, minuutit) {
  const [y, m, d] = pvm.split('-').map(Number);
  return new Date(y, m - 1, d, tunnit, minuutit).getTime();
}

function keskipaiva(pvm) {
  return new Date(pvm + 'T12:00:00Z');
}

function addDays(pvm, n) {
  const d = keskipaiva(pvm);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((keskipaiva(b) - keskipaiva(a)) / (24 * TUNTI_MS));
}

// Maanantaina alkavan viikon ensimmäinen päivä (oletusprofiilin viikonAlku).
function maanantai(pvm) {
  return addDays(pvm, -((keskipaiva(pvm).getUTCDay() + 6) % 7));
}

function round25(kg) {
  return Math.round(kg / 2.5) * 2.5 + 0;
}

function e1rm(paino, toistot) {
  return toistot <= 1 ? paino : paino * (1 + toistot / 30);
}

function kokonaisluku(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// --- Sarjojen generointi ----------------------------------------------------

// Yksi kerta: { paino, toistot: [3], rir: [3] }.
function kerta(paino, toistot, rir) {
  return { paino, toistot, rir };
}

// Tavallinen työkerta: ensimmäinen sarja `r` toistoa, seuraavat samat tai yhden vähemmän.
function tavallinenKerta(rng, paino, r, min) {
  const r2 = Math.max(min - 1, r - (rng() < 0.5 ? 1 : 0));
  const r3 = Math.max(min - 1, r2 - (rng() < 0.5 ? 1 : 0));
  const rir1 = kokonaisluku(rng, 1, 3);
  const rir2 = Math.max(0, rir1 - (rng() < 0.5 ? 1 : 0));
  const rir3 = Math.max(0, rir2 - (rng() < 0.6 ? 1 : 0));
  return kerta(paino, [r, r2, r3], [rir1, rir2, rir3]);
}

// Kaksoisprogressio: toistot nousevat kerta kerralta. Kun kaikki sarjat yltävät toistoMax:iin,
// paino nousee askeleen ja toistot asettuvat niin, että paras e1RM silti kasvaa. Näin
// arvioitu voima nousee joka kerralla eikä liike näytä jumiutuneelta.
// Kehonpainoliikkeillä (paino 0) toistot nousevat yhden joka kerta tai joka toinen kerta.
function nousevat(rng, liike, rivi, n, alku) {
  const askel = liike.alue === 'ala' ? 5 : 2.5;
  const kp = liike.valine === 'kehonpaino';
  const { toistoMin, toistoMax } = rivi;
  const tulos = [];
  let w = alku.paino;
  let r = alku.toistot;
  let edellinenTaysi = false;
  let edellinenE = null;
  for (let j = 0; j < n; j++) {
    if (j > 0) {
      if (kp) {
        r = Math.min(toistoMax, r + (alku.hidas ? j % 2 : 1));
      } else if (edellinenTaysi) {
        w += askel;
        r = toistoMin;
        while (r < toistoMax && e1rm(w, r) <= edellinenE) r += 1;
      } else {
        r = Math.min(toistoMax, r + 1);
      }
    }
    const taysi = !kp && r >= toistoMax;
    tulos.push(taysi ? kerta(w, [r, r, r], [2, 2, 1]) : tavallinenKerta(rng, w, r, toistoMin));
    edellinenTaysi = taysi;
    edellinenE = e1rm(w, r);
  }
  return tulos;
}

// Liikkeen kerrat täysillä viikoilla. `pvmt` on liikkeen kertojen päivämäärät aikajärjestyksessä.
function liikkeenKerrat(rng, liike, rivi, pvmt) {
  const n = pvmt.length;
  const kp = liike.valine === 'kehonpaino';
  const askel = liike.alue === 'ala' ? 5 : 2.5;

  if (liike.id === JUMIUTUNUT && n >= 4) {
    // Eteneminen kunnes kolme viimeistä kertaa samalla painolla, toistot samat tai laskevat.
    const alku = nousevat(rng, liike, { ...rivi, toistoMax: rivi.toistoMax - 1 }, n - 2,
      { paino: liike.aloituspaino + 2 * askel, toistot: rivi.toistoMin });
    const viimeinen = alku[alku.length - 1];
    const w = viimeinen.paino;
    const r = viimeinen.toistot[0];
    return [
      ...alku.slice(0, -1),
      kerta(w, [r, r - 1, r - 1], [1, 1, 0]),
      kerta(w, [r, r - 1, r - 2], [1, 0, 0]),
      kerta(w, [r - 1, r - 1, r - 2], [0, 0, 0]),
    ];
  }

  if (VEDOT.has(liike.id)) {
    // Vahvimmillaan yli 6 viikkoa ennen viimeisintä kertaa, sen jälkeen notkahdus ja hidas nousu.
    const viimeksi = pvmt[n - 1];
    let varhaiset = pvmt.filter((p) => daysBetween(p, viimeksi) > 41).length;
    if (varhaiset === 0) varhaiset = 1;
    const huippuPaino = kp ? 0 : liike.aloituspaino + 2 * askel;
    const varhainen = [];
    for (let j = 0; j < varhaiset; j++) {
      const r = Math.min(rivi.toistoMax, rivi.toistoMax - (varhaiset - 1 - j));
      varhainen.push(kerta(huippuPaino, [r, r - 1, r - 1], [1, 1, 0]));
    }
    const myohemmat = nousevat(rng, liike, rivi, n - varhaiset, kp
      ? { paino: 0, toistot: rivi.toistoMin + 1, hidas: true }
      : { paino: liike.aloituspaino, toistot: rivi.toistoMin });
    return [...varhainen, ...myohemmat];
  }

  return nousevat(rng, liike, rivi, n, {
    paino: kp ? 0 : liike.aloituspaino,
    toistot: rivi.toistoMin + (rng() < 0.5 ? 0 : 1),
  });
}

function sarjoiksi(k) {
  return k.toistot.map((toistot, i) => ({ paino: k.paino, toistot, rir: k.rir[i] }));
}

// --- Historia ----------------------------------------------------------------

function voimatreeniPaivat(rng, tanaan, viimePvm) {
  // Viikko 4 viikkoa sitten (maanantaista sunnuntaihin): yksi treeni jää väliin.
  const vk4Alku = addDays(maanantai(tanaan), -28);
  const vk4Loppu = addDays(vk4Alku, 6);
  const pvmt = [viimePvm];
  let d = viimePvm;
  let i = 0;
  let ohitettu = false;
  while (pvmt.length < VOIMATREENEJA) {
    d = addDays(d, -VALIT[i % VALIT.length]);
    i += 1;
    if (!ohitettu && d >= vk4Alku && d <= vk4Loppu) {
      ohitettu = true;
      continue;
    }
    // Vanhemmilla viikoilla satunnaisia välikertoja.
    if (daysBetween(d, tanaan) >= TAYDET_PV && rng() < 0.12) continue;
    pvmt.push(d);
  }
  return pvmt.reverse();
}

function tuodutAktiviteetit(rng, tanaan) {
  // 6 eri päivää viimeisiltä 3 viikolta (1–20 päivää sitten) + toinen merkintä yhdelle päivälle.
  const paivat = Array.from({ length: 20 }, (_, i) => i + 1);
  for (let i = paivat.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [paivat[i], paivat[j]] = [paivat[j], paivat[i]];
  }
  const valitut = paivat.slice(0, 6).sort((a, b) => b - a);
  const tuplapaiva = valitut[2];
  const merkinnat = valitut.map((sitten) => ({ sitten, laji: rng() < 0.6 ? 'kävely' : 'pyöräily', aamu: rng() < 0.4 }));
  // Tuplapäivä: aamukävely ja iltapyöräily.
  const tupla = merkinnat.find((m) => m.sitten === tuplapaiva);
  tupla.laji = 'kävely';
  tupla.aamu = true;
  merkinnat.push({ sitten: tuplapaiva, laji: 'pyöräily', aamu: false });

  return merkinnat.map((m) => {
    const pvm = addDays(tanaan, -m.sitten);
    const tunnit = m.aamu ? kokonaisluku(rng, 6, 8) : kokonaisluku(rng, 17, 20);
    const alkuMs = paikallinenMs(pvm, tunnit, kokonaisluku(rng, 0, 11) * 5); // aina ennen tätä päivää
    const kavely = m.laji === 'kävely';
    const kestoMin = kavely ? kokonaisluku(rng, 25, 60) : kokonaisluku(rng, 30, 75);
    const nopeus = kavely ? 5 + rng() : 17 + rng() * 5; // km/h
    const nimi = kavely
      ? (m.aamu ? 'Aamukävely' : 'Iltakävely')
      : (m.aamu ? 'Aamupyöräily' : 'Pyörälenkki');
    return {
      pvm: pvmMs(alkuMs),
      aloitus: new Date(alkuMs).toISOString(),
      kestoS: kestoMin * 60,
      lahde: 'terveys',
      tyyppi: m.laji,
      nimi,
      kcal: Math.round(kestoMin * (kavely ? 4.2 : 7.5)),
      matkaKm: Math.round((kestoMin / 60) * nopeus * 10) / 10,
      liikkeet: [],
    };
  });
}

function kehonpainoHistoria(rng, tanaan) {
  // Mittaus 3–4 päivän välein 8 viikon ajalta; lievä lasku noin 81,5 kg:sta 80 kg:aan.
  const pvmt = [];
  let d = addDays(tanaan, -1);
  while (daysBetween(d, tanaan) <= 55) {
    pvmt.push(d);
    d = addDays(d, -(rng() < 0.5 ? 3 : 4));
  }
  pvmt.reverse();
  return pvmt.map((pvm, i) => {
    if (i === pvmt.length - 1) return { pvm, kg: OLETUSPROFIILI.kehonpaino };
    const trendi = 81.5 - (1.5 * i) / (pvmt.length - 1);
    const kohina = (rng() - 0.5) * 0.8;
    return { pvm, kg: Math.round((trendi + kohina) * 10) / 10 };
  });
}

// --- Yhteisö (speksi 4i) -------------------------------------------------------
// Kaikki sosiaalinen data on keksittyä. Kaverien lähtötasot (`lahtotasot`) ovat viikkoarvoja;
// engine/challenges.js skaalaa ne haasteen pituudelle ja generoi edistymisen niistä.
// Jari on kokenut ja raakaluvuissa selvästi vahvin; tasapainotettuna käyttäjä on kärjessä
// tai toisena (Mia on aloittelija ja kehittyy suhteessa nopeimmin).

const KUUKAUDET_GEN = ['Tammikuun', 'Helmikuun', 'Maaliskuun', 'Huhtikuun', 'Toukokuun', 'Kesäkuun',
  'Heinäkuun', 'Elokuun', 'Syyskuun', 'Lokakuun', 'Marraskuun', 'Joulukuun'];

const KAVERIT = [
  {
    id: 'kaveri-jari', nimi: 'Jari L.', nimikirjaimet: 'JL', vari: '#3B5BDB', taso: 10, pisteet: 5840,
    profiili: 'kokenut',
    lahtotasot: { treenit: 5, volyymi: 52000, sarjat: 105, aktiivisetPaivat: 6, putki: 1 },
  },
  {
    id: 'kaveri-mia', nimi: 'Mia K.', nimikirjaimet: 'MK', vari: '#E8590C', taso: 2, pisteet: 410,
    profiili: 'aloittelija',
    lahtotasot: { treenit: 2, volyymi: 6500, sarjat: 34, aktiivisetPaivat: 3, putki: 0.5 },
  },
  {
    id: 'kaveri-aino', nimi: 'Aino S.', nimikirjaimet: 'AS', vari: '#0CA678', taso: 4, pisteet: 1190,
    profiili: 'keskitaso',
    lahtotasot: { treenit: 3, volyymi: 15500, sarjat: 58, aktiivisetPaivat: 5, putki: 0.9 },
  },
  {
    id: 'kaveri-martti', nimi: 'Martti H.', nimikirjaimet: 'MH', vari: '#F59F00', taso: 5, pisteet: 1730,
    profiili: 'keskitaso',
    lahtotasot: { treenit: 3, volyymi: 21000, sarjat: 64, aktiivisetPaivat: 4, putki: 0.8 },
  },
  {
    id: 'kaveri-laura', nimi: 'Laura V.', nimikirjaimet: 'LV', vari: '#AE3EC9', taso: 6, pisteet: 2360,
    profiili: 'keskitaso',
    lahtotasot: { treenit: 4, volyymi: 24000, sarjat: 76, aktiivisetPaivat: 5, putki: 1 },
  },
];

/**
 * seedYhteiso(tanaan, historia) → { kaverit, haasteet, tsempit, ansaitutMerkit, lunastetutEdut, kutsut }
 * Haasteiden päivämäärät ja osa tavoitteista lasketaan `tanaan`-päivästä ja seed-historiasta:
 * - kuukauden treenihaaste on melkein valmis (tavoite = kuun treenit + 1, vähintään 4),
 * - kumppanihaasteessa on 5/7 treeniä tehty (~70 %) ja aikaa jäljellä 2 treenille,
 * - aktiivinen kaverihaaste alkoi 6 päivää sitten (2 viikkoa), päättynyt kaverihaaste oli
 *   toissa viikolla (ma–su) ja käyttäjä voitti sen tasapainotettuna.
 */
function seedYhteiso(tanaan, historia) {
  const [y, m] = tanaan.split('-').map(Number);
  const kuu = KUUKAUDET_GEN[m - 1];
  const kuuAlku = `${y}-${pad(m)}-01`;
  const kuuLoppu = addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`, -1);
  const voima = historia.filter((t) => onVoimatreeni(t) && t.pvm <= tanaan).map((t) => t.pvm).sort();
  const kuunTreenit = voima.filter((p) => p >= kuuAlku).length;
  const lahella = Math.max(4, kuunTreenit + 1);
  const kumppaniAlku = voima[voima.length - 5];
  const edellinenViikko = addDays(maanantai(tanaan), -14);

  const haasteet = [
    {
      id: 'oma-kuu-treenit', tyyppi: 'oma', nimi: `${kuu} ${lahella} treeniä`,
      kuvaus: `Tee ${lahella} voimatreeniä tämän kuukauden aikana.`,
      mittari: 'treenit', tavoite: lahella, alku: kuuAlku, loppu: kuuLoppu,
      palkinto: { pisteet: 50, merkkiId: 'kuukauden-haaste' }, liittynyt: true, luoja: 'demo',
    },
    {
      id: 'oma-kuu-volyymi', tyyppi: 'oma', nimi: `${kuu} 60 000 kg`,
      kuvaus: 'Nosta kuukauden aikana yhteensä 60 000 kg työsarjoissa.',
      mittari: 'volyymi', tavoite: 60000, alku: kuuAlku, loppu: kuuLoppu,
      palkinto: { pisteet: 75, merkkiId: 'kuukauden-haaste' }, liittynyt: true, luoja: 'demo',
    },
    {
      id: 'oma-kuu-aktiiviset', tyyppi: 'oma', nimi: `${kuu} 20 aktiivista päivää`,
      kuvaus: 'Liiku 20 eri päivänä. Myös kävelyt, pyöräilyt ja kirjatut lajipäivät lasketaan.',
      mittari: 'aktiivisetPaivat', tavoite: 20, alku: kuuAlku, loppu: kuuLoppu,
      palkinto: { pisteet: 50, merkkiId: 'kuukauden-haaste' }, liittynyt: false, luoja: 'demo',
    },
    {
      id: 'oma-kuu-putki', tyyppi: 'oma', nimi: '4 viikon putki',
      kuvaus: 'Täytä viikkotavoitteesi neljänä peräkkäisenä viikkona tämän kuukauden aikana.',
      mittari: 'putki', tavoite: 4, alku: kuuAlku, loppu: kuuLoppu,
      palkinto: { pisteet: 60, merkkiId: 'kuukauden-haaste' }, liittynyt: false, luoja: 'demo',
    },
    {
      id: 'kaveri-volyymi-2vk', tyyppi: 'kaveri', nimi: 'Kahden viikon volyymikisa',
      kuvaus: 'Kuka nostaa eniten kiloja kahdessa viikossa? Tasapainotus vertaa jokaista omaan lähtötasoonsa.',
      mittari: 'volyymi', tavoite: null, alku: addDays(tanaan, -6), loppu: addDays(tanaan, 7),
      osallistujat: ['kaveri-jari', 'kaveri-mia', 'kaveri-aino', 'kaveri-laura'], tasapainotus: true,
      palkinto: { pisteet: 100 }, liittynyt: true, luoja: 'kayttaja',
    },
    {
      id: 'kaveri-sarjat-1vk', tyyppi: 'kaveri', nimi: 'Viikon sarjakisa',
      kuvaus: 'Eniten työsarjoja viikossa, tasapainotettuna omaan lähtötasoon.',
      mittari: 'sarjat', tavoite: null, alku: edellinenViikko, loppu: addDays(edellinenViikko, 6),
      osallistujat: ['kaveri-jari', 'kaveri-aino', 'kaveri-martti'], tasapainotus: true,
      palkinto: { pisteet: 100, merkkiId: 'voitettu-kaverihaaste' }, liittynyt: true, luoja: 'demo',
    },
    {
      id: 'sali-kuu', tyyppi: 'sali', nimi: `${kuu} jäsenhaaste`,
      kuvaus: 'Salin jäsenet nostavat kuukauden aikana yhdessä 2 000 000 kg. Oma tavoitteesi on 40 000 kg. '
        + 'Salit voivat järjestää omia jäsenhaasteitaan.',
      mittari: 'volyymi', tavoite: 40000, saliTavoite: 2000000, saliPaivassa: 62000, saliJasenia: 148,
      alku: kuuAlku, loppu: kuuLoppu, osallistujat: ['kaveri-martti', 'kaveri-laura'],
      palkinto: { pisteet: 50 }, liittynyt: false, luoja: 'demo',
    },
    {
      // Kumppani on keksitty: geneerinen nimi, jotta mikään oikea yritys ei sekoitu demoon.
      id: 'kumppani-x', tyyppi: 'kumppani', nimi: 'Kumppani X: 7 treeniä 2 viikossa',
      kuvaus: 'Tee 7 voimatreeniä 14 päivässä ja saat 25 % alennuksen Kumppani X:n verkkokaupasta. '
        + 'Demo: kuvitteellinen kumppani.',
      mittari: 'treenit', tavoite: 7, alku: kumppaniAlku, loppu: addDays(kumppaniAlku, 13),
      palkinto: {
        pisteet: 50,
        merkkiId: 'kumppanihaaste',
        etu: { kumppani: 'Kumppani X', teksti: '25 % alennus Kumppani X:n verkkokaupasta', koodi: 'PSP-DEMO-25' },
      },
      liittynyt: true, luoja: 'demo',
    },
  ];

  // Ansaittuja merkkejä ei tallenneta seediin: badges() johtaa ne tilasta (esim. päättyneen
  // kaverihaasteen voitto), joten migraatio ei voi antaa merkkiä, jota käyttäjän historia ei tue.
  return {
    kaverit: structuredClone(KAVERIT),
    haasteet,
    tsempit: [],
    ansaitutMerkit: [],
    lunastetutEdut: [],
    kutsut: [], // kaverikutsut (speksi 4k): [{ id, luotu, mittari, kesto, tila, kaveriNimi? }]
  };
}

// Demon kuukausihaasteiden nimissä käytetty kuukausi (genetiivi), esim. 'Marraskuun'.
export function kuukausiGen(pvm) {
  return KUUKAUDET_GEN[Number(String(pvm).slice(5, 7)) - 1];
}

/**
 * seedHistory(nyt) → { historia, kehonpainoHistoria }
 * Historia on aikajärjestyksessä (vanhin ensin).
 */
export function seedHistory(nyt) {
  const rng = mulberry32(SIEMEN);
  const nytMs = Date.parse(nyt);
  const tanaan = pvmMs(nytMs);
  const ohjelma = OHJELMAT.find((o) => o.id === SEED_OHJELMA_ID);

  // Viimeisin treeni 20 h ± 30 min ennen nyt-hetkeä.
  const viimeMs = nytMs - 20 * TUNTI_MS + kokonaisluku(rng, -30, 30) * MIN_MS;
  const viimePvm = pvmMs(viimeMs);

  const pvmt = voimatreeniPaivat(rng, tanaan, viimePvm);
  const N = pvmt.length;
  // Viimeisin treeni on jalkapäivä: Päivä C:n alavartaloliikkeet ja pohjenousu (Päivä B:stä).
  // Ylävartaloliikkeet jäivät väliin, joten palautumisnäkymässä jalat ovat väsyneet ja
  // ylävartalo enimmäkseen palautunut.
  const paivaC = ohjelma.paivat[2];
  const jalkapaiva = {
    nimi: paivaC.nimi,
    liikkeet: [
      ...paivaC.liikkeet.filter((r) => haeLiike(r.liikeId).alue === 'ala'),
      ohjelma.paivat[1].liikkeet.find((r) => r.liikeId === 'pohjenousu-seisten'),
    ],
  };
  // Päivät vuorottelevat niin, että viimeisin on Päivä C.
  const treenit = pvmt.map((pvm, i) => {
    const k = N - 1 - i;
    const paiva = k === 0 ? jalkapaiva : ohjelma.paivat[(((2 - k) % 3) + 3) % 3];
    const taysi = daysBetween(pvm, tanaan) < TAYDET_PV;
    const alkuMs = i === N - 1
      ? viimeMs
      : paikallinenMs(pvm, kokonaisluku(rng, 16, 18), kokonaisluku(rng, 0, 11) * 5);
    return {
      pvm,
      aloitus: new Date(alkuMs).toISOString(),
      kestoS: taysi ? kokonaisluku(rng, 52, 72) * 60 + kokonaisluku(rng, 0, 59) : kokonaisluku(rng, 20, 40) * 60,
      lahde: 'psp',
      tyyppi: 'voima',
      ohjelmaId: SEED_OHJELMA_ID,
      paivaNimi: paiva.nimi,
      liikkeet: [],
      ehdotukset: [],
      _paiva: paiva,
      _taysi: taysi,
    };
  });

  // Täydet treenit: jokaisen ohjelmaliikkeen kerrat generoidaan liikkeittäin.
  const kerratLiikkeittain = new Map();
  for (const t of treenit) {
    if (!t._taysi) continue;
    for (const rivi of t._paiva.liikkeet) {
      if (!kerratLiikkeittain.has(rivi.liikeId)) kerratLiikkeittain.set(rivi.liikeId, { rivi, treenit: [] });
      kerratLiikkeittain.get(rivi.liikeId).treenit.push(t);
    }
  }
  const sarjatTreeneille = new Map();
  for (const [liikeId, { rivi, treenit: lt }] of kerratLiikkeittain) {
    const l = haeLiike(liikeId);
    const kerrat = liikkeenKerrat(rng, l, rivi, lt.map((t) => t.pvm));
    lt.forEach((t, j) => sarjatTreeneille.set(`${t.pvm}|${liikeId}`, sarjoiksi(kerrat[j])));
  }
  for (const t of treenit) {
    if (t._taysi) {
      t.liikkeet = t._paiva.liikkeet.map((rivi) => ({
        liikeId: rivi.liikeId,
        sarjat: sarjatTreeneille.get(`${t.pvm}|${rivi.liikeId}`),
      }));
    } else {
      // Kevyt merkintä: 1–2 päivän liikettä, 1–2 sarjaa, noin 80 % aloituspainosta.
      const maara = rng() < 0.5 ? 1 : 2;
      t.liikkeet = t._paiva.liikkeet.slice(0, maara).map((rivi) => {
        const l = haeLiike(rivi.liikeId);
        const paino = l.valine === 'kehonpaino' ? 0 : round25(l.aloituspaino * 0.8);
        const toistot = l.valine === 'kehonpaino' ? Math.max(1, rivi.toistoMin - 1) : rivi.toistoMin + 2;
        const sarjoja = rng() < 0.5 ? 1 : 2;
        return {
          liikeId: rivi.liikeId,
          sarjat: Array.from({ length: sarjoja }, () => ({ paino, toistot, rir: kokonaisluku(rng, 2, 3) })),
        };
      });
    }
    delete t._paiva;
    delete t._taysi;
  }

  const historia = [...treenit, ...tuodutAktiviteetit(rng, tanaan)]
    .sort((a, b) => (a.aloitus < b.aloitus ? -1 : a.aloitus > b.aloitus ? 1 : 0))
    .map((t, i) => ({ id: `seed-${String(i + 1).padStart(3, '0')}`, ...t }));

  return { historia, kehonpainoHistoria: kehonpainoHistoria(rng, tanaan) };
}

/**
 * seedState(nyt) → täysi tila (speksin kohta 5), onboardattu: false.
 */
export function seedState(nyt) {
  const { historia, kehonpainoHistoria: kp } = seedHistory(nyt);
  return {
    versio: 1,
    onboardattu: false,
    profiili: structuredClone(OLETUSPROFIILI),
    aktiivinenOhjelmaId: SEED_OHJELMA_ID,
    historia,
    kehonpainoHistoria: kp,
    muistit: [],
    viikkosuunnitelmat: [],
    chat: [],
    kaynnissa: null,
    paivanVaihdot: {}, // { [pvm]: { [alkuperainenId]: korvaavaId | null } } (speksi 4j)
    asetukset: { teema: 'vaalea' }, // vaalea | tumma | auto (auto = laitteen asetus)
    yhteiso: seedYhteiso(tanaanPvm(nyt), historia),
    // Speksi 4k: tuodut ohjelmat (OHJELMAT-muoto) ja käyttäjän kommentit viikkoraporttiin
    // ({ [viikonAlku]: teksti }). profiili.tapahtuma ja profiili.valmentaja puuttuvat oletuksena.
    omatOhjelmat: [],
    raporttiKommentit: {},
  };
}
