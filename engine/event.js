// Tavoitetapahtuma ja jaksotus (speksi 4k C): viikot tapahtumaan jaetaan jaksoihin, ja ohjelmapäivään
// lisätään jakson mukaan HYROX-asemat ja juoksuosuus. Puhdas moduuli: ei DOM-, window-, localStorage-
// eikä Date.now()-kutsuja. Päivämäärät ovat 'YYYY-MM-DD'-merkkijonoja.

import { addDays, daysBetween, weekStart } from './util.js?v=19a48e7';
import { onSaatavilla } from './alternatives.js?v=19a48e7';
import { LIIKKEET, TAPAHTUMATYYPIT, HYROX_ASEMAT, HYROX_DIVISIOONAT } from '../data.js?v=19a48e7';

// Jaksot ja sarjatavoitteen kertoimet (speksin taulukko). Joka 4. perus- tai kovennusviikko on
// kevennysviikko (× 0,7).
export const JAKSOT = {
  perus: { id: 'perus', nimi: 'Perusjakso', kerroin: 1.0 },
  kovennus: { id: 'kovennus', nimi: 'Kovennus', kerroin: 1.1 },
  kevennys: { id: 'kevennys', nimi: 'Kevennys', kerroin: 0.6 },
  kisaviikko: { id: 'kisaviikko', nimi: 'Kisaviikko', kerroin: 0.4 },
};
export const KEVENNYSVIIKKO_KERROIN = 0.7;
const PERUS_OSUUS = 0.40;
const KOVENNUS_OSUUS = 0.35;
const LYHYT_RAJA_VK = 4; // alle 4 viikkoa tapahtumaan: vain kovennus, kevennys ja kisaviikko

const PVM_RE = /^\d{4}-\d{2}-\d{2}$/;

// Painopisteet suomeksi tapahtuman luokan ja jakson mukaan.
const PAINOPISTE = {
  hyrox: {
    perus: 'Voima ja kestävyyspohja: perusliikkeet raskaana, yksi asema treenin lopussa ja rauhallinen juoksu.',
    kovennus: 'Lajinomaisuus kasvaa: kaksi asemaa treeniin, juoksuintervallit ja viikon viimeisenä treeninä simulaatio.',
    kevennys: 'Kevennys: volyymi alas, yksi kevyt asema ja lyhyt juoksu. Tuntuma säilyy ja väsymys poistuu.',
    kisaviikko: 'Kisaviikko: yksi kevyt aktivointi, lepoa ja hyvä uni. Kisassa tasainen alku ensimmäisillä juoksuilla.',
    kevennysviikko: 'Kevennysviikko: vähemmän sarjoja, tekniikka edellä ja kevyt juoksu, jotta keho palautuu.',
  },
  juoksu: {
    perus: 'Peruskestävyys: rauhalliset lenkit ja voimatreeni, joka tukee juoksua.',
    kovennus: 'Vauhtikestävyys: tempo- ja intervallijuoksut kisavauhtia, voimatreeni ylläpitävänä.',
    kevennys: 'Kevennys: lenkit lyhyemmiksi ja vauhti ennallaan, jotta jalat ovat kisassa tuoreet.',
    kisaviikko: 'Kisaviikko: yksi kevyt aktivointi ja lepoa. Aloita kisa maltillisesti.',
    kevennysviikko: 'Kevennysviikko: kevyempi viikko, jotta harjoittelun vaikutus ehtii näkyä.',
  },
  turnaus: {
    perus: 'Voima- ja nopeuspohja: perusliikkeet ja hyvä liikkuvuus.',
    kovennus: 'Lajinomaisuus: räjähtävyys, suunnanmuutokset ja toistuva sprinttikyky.',
    kevennys: 'Kevennys: volyymi alas, nopeus säilyy. Panosta palautumiseen.',
    kisaviikko: 'Turnausviikko: yksi kevyt aktivointi ja lepoa, jotta jaksat koko turnauksen.',
    kevennysviikko: 'Kevennysviikko: vähemmän sarjoja, jotta keho palautuu.',
  },
  oma: {
    perus: 'Perusjakso: tasainen harjoittelu ja hyvä pohja tavoitteelle.',
    kovennus: 'Kovennus: harjoittelu tehostuu tavoitetta kohti.',
    kevennys: 'Kevennys: volyymi alas ennen tavoitepäivää.',
    kisaviikko: 'Tavoiteviikko: kevyt aktivointi ja lepoa.',
    kevennysviikko: 'Kevennysviikko: vähemmän sarjoja, jotta keho palautuu.',
  },
};

// HYROX: asemien määrä ja sarjamäärä jakson mukaan.
const ASEMIA = { perus: 1, kovennus: 2, kevennys: 1, kisaviikko: 0, kevennysviikko: 1, simulaatio: 3 };
const KEVYET_SARJAT = 2;
const YLA_ASEMAT = ['skierg', 'soutu', 'kelkkaveto', 'farmarikavely'];
const ALA_ASEMAT = ['kelkkatyonto', 'wall-ball', 'hiekkasakkiaskelkyykky', 'burpee-pituushyppy'];
// Simulaatio-päivän lyhennetyt asemat (noin puolet kisamatkasta) toistoYksikön mukaan.
const SIMULAATIO = {
  skierg: [25, 30], kelkkatyonto: [2, 2], kelkkaveto: [2, 2], 'burpee-pituushyppy': [10, 12],
  soutu: [25, 30], farmarikavely: [4, 4], hiekkasakkiaskelkyykky: [20, 24], 'wall-ball': [40, 50],
};
const YKSIKKO_TEKSTI = { kcal: 'kcal', osuutta: 'osuutta', toistoa: 'toistoa' };

// Matka-aseman haarukka metreinä tekstiin, esim. "2 osuutta (25 m)".
function matkaTeksti(liike, toistoMax) {
  return liike.osuusM ? ` (${String(liike.osuusM * toistoMax).replace('.', ',')} m)` : '';
}

// Juoksurivit: [kestoMin, matkaKm|null, kuvaus].
const HYROX_JUOKSU = {
  perus: [25, null, 'Rauhallinen juoksu 25 min: peruskestävyys, vauhti jolla pystyt puhumaan.'],
  kovennus: [30, 4, 'Juoksuintervallit 4 × 1 km kisavauhtia, palautus 90 s kävellen.'],
  kevennys: [20, null, 'Kevyt juoksu 20 min.'],
  kevennysviikko: [20, null, 'Kevyt juoksu 20 min.'],
  kisaviikko: [15, null, 'Aktivointi: 15 min kevyesti ja lopuksi 3 × 20 s reippaasti.'],
  simulaatio: [15, 1.5, 'Simulaatio: 3 kierrosta, joilla 500 m juoksua ja yksi asema vuorotellen, lyhennettynä kisasta.'],
};
const JUOKSUKISA_JUOKSU = {
  'juoksu-5km': {
    perus: [30, null, 'Rauhallinen lenkki 30 min.'],
    kovennus: [35, 4, 'Intervallit 5 × 800 m 5 km:n kisavauhtia, palautus 2 min hölkäten.'],
    kevennys: [20, null, 'Kevyt lenkki 20 min ja 4 lyhyttä vetoa.'],
  },
  'juoksu-10km': {
    perus: [40, null, 'Rauhallinen lenkki 40 min.'],
    kovennus: [45, 6, 'Tempojuoksu 3 × 2 km 10 km:n kisavauhtia, palautus 2 min hölkäten.'],
    kevennys: [25, null, 'Kevyt lenkki 25 min ja 4 lyhyttä vetoa.'],
  },
  puolimaraton: {
    perus: [50, null, 'Pitkä rauhallinen lenkki 50 min.'],
    kovennus: [85, 15, 'Pitkä lenkki 14–16 km, viimeiset 3 km puolimaratonin kisavauhtia.'],
    kevennys: [30, null, 'Kevyt lenkki 30 min.'],
  },
};
const JUOKSUKISA_YHTEINEN = {
  kevennysviikko: [25, null, 'Kevyt lenkki 25 min.'],
  kisaviikko: [15, null, 'Aktivointi: 15 min kevyesti ja lopuksi 3 × 20 s reippaasti.'],
};

// --- Apurit ------------------------------------------------------------------

function pvm10(arvo) {
  if (typeof arvo !== 'string') return null;
  const p = arvo.slice(0, 10);
  if (!PVM_RE.test(p)) return null;
  const d = new Date(`${p}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === p ? p : null;
}

function pvmLyhyt(pvm) {
  const [, m, d] = pvm.split('-').map(Number);
  return `${d}.${m}.`;
}

function siemen(teksti) {
  let h = 0x811c9dc5;
  for (let i = 0; i < teksti.length; i++) {
    h ^= teksti.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** tapahtumaTyyppi(tyyppiId) → TAPAHTUMATYYPIT-rivi; tuntematon tyyppi tulkitaan omaksi tavoitteeksi. */
export function tapahtumaTyyppi(tyyppiId) {
  return TAPAHTUMATYYPIT.find((t) => t.id === tyyppiId) || TAPAHTUMATYYPIT.find((t) => t.id === 'oma');
}

/** divisioona(id) → HYROX_DIVISIOONAT-rivi tai null. */
export function hyroxDivisioona(id) {
  return HYROX_DIVISIOONAT.find((d) => d.id === id) || null;
}

// Jaksot viikoittain: [{ jakso, kevennysviikko }], viimeinen = kisaviikko.
function jaksota(n) {
  if (n <= 1) return [{ jakso: 'kisaviikko', kevennysviikko: false }];
  if (n === 2) return [{ jakso: 'kevennys', kevennysviikko: false }, { jakso: 'kisaviikko', kevennysviikko: false }];
  const rakennus = n - 2;
  // Aikaa alle 4 viikkoa (viikkoja tämän viikon jälkeen < 4): vain kovennus, kevennys ja kisaviikko.
  const lyhyt = n - 1 < LYHYT_RAJA_VK;
  const perus = lyhyt ? 0 : Math.round((rakennus * PERUS_OSUUS) / (PERUS_OSUUS + KOVENNUS_OSUUS));
  const tulos = [];
  for (let i = 0; i < rakennus; i++) {
    // Joka 4. rakennusviikko kevennetään, paitsi viimeinen ennen kevennysjaksoa (kaksi kevyttä peräkkäin).
    const kevennysviikko = !lyhyt && i % 4 === 3 && i !== rakennus - 1;
    tulos.push({ jakso: i < perus ? 'perus' : 'kovennus', kevennysviikko });
  }
  tulos.push({ jakso: 'kevennys', kevennysviikko: false }, { jakso: 'kisaviikko', kevennysviikko: false });
  return tulos;
}

function painopiste(luokka, jakso, kevennysviikko) {
  const tekstit = PAINOPISTE[luokka] || PAINOPISTE.oma;
  return kevennysviikko ? tekstit.kevennysviikko : tekstit[jakso];
}

// --- Julkiset funktiot -------------------------------------------------------

/**
 * eventPlan(tapahtuma, tanaan, { viikonAlku = 'maanantai' } = {}) →
 *   { tapahtuma: { tyyppi, nimi, luokka, pvm, divisioona }, otsikko: 'HYROX 14.12.',
 *     viikot: [{ indeksi, alku, loppu, jakso: 'perus'|'kovennus'|'kevennys'|'kisaviikko', jaksoNimi,
 *                kerroin, kevennysviikko, painopiste }],
 *     jaksot: [{ jakso, nimi, alku, loppu, viikkoja }],
 *     nykyinen: viikko (tämän päivän viikko), viikkojaJaljella, paiviaJaljella } | null
 * Viikot ovat kalenteriviikkoja (viikonAlku) suunnitelman alusta tapahtuman viikkoon (= kisaviikko).
 * Suunnitelma alkaa tapahtuman asetuspäivän (`tapahtuma.asetettu`, jos se on ennen tätä päivää)
 * viikosta, jotta jaksojen rajat eivät siirry viikko viikolta; muuten tämän päivän viikosta.
 * Rakennusviikot jaetaan perusjaksoon ja kovennukseen suhteessa 40 : 35; jos tapahtumaan on alle
 * 4 viikkoa (viikkoja suunnitelman ensimmäisen viikon jälkeen < 4), mukana on vain kovennus, kevennys
 * ja kisaviikko. Puuttuva tai mennyt päivämäärä → null.
 * viikkojaJaljella = viikkoja tämän viikon jälkeen kisaviikkoon (kisaviikolla 0).
 */
export function eventPlan(tapahtuma, tanaan, { viikonAlku = 'maanantai' } = {}) {
  if (!tapahtuma || typeof tapahtuma !== 'object') return null;
  const pvm = pvm10(tapahtuma.pvm);
  const t = pvm10(tanaan);
  if (!pvm || !t || pvm < t) return null;
  const tyyppi = tapahtumaTyyppi(tapahtuma.tyyppi);
  const asetettu = pvm10(tapahtuma.asetettu);
  const alku = asetettu && asetettu <= t ? asetettu : t;
  const ensimmainen = weekStart(alku, viikonAlku);
  const kisaViikko = weekStart(pvm, viikonAlku);
  const n = Math.round(daysBetween(ensimmainen, kisaViikko) / 7) + 1;

  const viikot = jaksota(n).map(({ jakso, kevennysviikko }, i) => {
    const vAlku = addDays(ensimmainen, 7 * i);
    return {
      indeksi: i,
      alku: vAlku,
      loppu: addDays(vAlku, 6),
      jakso,
      jaksoNimi: JAKSOT[jakso].nimi,
      kerroin: kevennysviikko ? KEVENNYSVIIKKO_KERROIN : JAKSOT[jakso].kerroin,
      kevennysviikko,
      painopiste: painopiste(tyyppi.luokka, jakso, kevennysviikko),
    };
  });

  const jaksot = [];
  for (const v of viikot) {
    const viimeinen = jaksot[jaksot.length - 1];
    if (viimeinen && viimeinen.jakso === v.jakso) {
      viimeinen.loppu = v.loppu;
      viimeinen.viikkoja += 1;
    } else {
      jaksot.push({ jakso: v.jakso, nimi: v.jaksoNimi, alku: v.alku, loppu: v.loppu, viikkoja: 1 });
    }
  }

  const nykyinenIndeksi = Math.round(daysBetween(ensimmainen, weekStart(t, viikonAlku)) / 7);
  const div = tyyppi.id === 'hyrox' ? hyroxDivisioona(tapahtuma.divisioona) : null;
  return {
    tapahtuma: {
      tyyppi: tyyppi.id, nimi: tyyppi.nimi, luokka: tyyppi.luokka, pvm, divisioona: div ? div.id : null,
    },
    otsikko: `${tyyppi.id === 'oma' && typeof tapahtuma.nimi === 'string' && tapahtuma.nimi.trim()
      ? tapahtuma.nimi.trim() : tyyppi.nimi} ${pvmLyhyt(pvm)}`,
    viikot,
    jaksot,
    nykyinen: viikot[nykyinenIndeksi],
    viikkojaJaljella: n - 1 - nykyinenIndeksi,
    paiviaJaljella: daysBetween(t, pvm),
  };
}

/**
 * eventWeekMultiplier(tapahtuma, pvm, opts) → sarjatavoitteen kerroin päivän pvm viikolle (1 ilman
 * tapahtumaa tai tapahtuman jälkeen). Käytä weeklyTargets-funktion kolmantena parametrina.
 */
export function eventWeekMultiplier(tapahtuma, pvm, opts = {}) {
  const plan = eventPlan(tapahtuma, pvm, opts);
  return plan && plan.nykyinen ? plan.nykyinen.kerroin : 1;
}

function asemaSaatavilla(liike, laitteet) {
  if (!Array.isArray(laitteet)) return true;
  if (onSaatavilla(liike, laitteet)) return true;
  return (liike.vaihtoehtoTarvikkeet || []).some((setti) => setti.every((x) => laitteet.includes(x)));
}

function korvaavaTarvikeTeksti(liike, laitteet) {
  if (!Array.isArray(laitteet) || onSaatavilla(liike, laitteet)) return null;
  const setti = (liike.vaihtoehtoTarvikkeet || []).find((s) => s.every((x) => laitteet.includes(x)));
  if (!setti) return null;
  if (setti.includes('kahvakuulat')) return 'kahvakuulalla';
  if (setti.includes('käsipainot')) return 'käsipainolla';
  return null;
}

// Päivän painotus: alavartalopäivälle ylävartalon asemat ja päinvastoin.
function onAlapaiva(paiva) {
  let ala = 0;
  let yla = 0;
  for (const r of (paiva && paiva.liikkeet) || []) {
    const l = LIIKKEET.find((x) => x.id === r.liikeId);
    if (!l) continue;
    if (l.alue === 'ala') ala += 1;
    else yla += 1;
  }
  return ala > yla;
}

function valitseAsemat(paiva, maara, simulaatio, laitteet) {
  if (maara <= 0) return [];
  const saatavilla = HYROX_ASEMAT.filter((a) => {
    const l = LIIKKEET.find((x) => x.id === a.liikeId);
    return l && asemaSaatavilla(l, laitteet);
  });
  if (!saatavilla.length) return [];
  const siirto = siemen(String((paiva && paiva.nimi) || ''));
  if (simulaatio) {
    // Kolme peräkkäistä asemaa kisajärjestyksessä, aloituskohta päivän mukaan.
    const alku = siirto % saatavilla.length;
    const valitut = [];
    for (let i = 0; i < Math.min(maara, saatavilla.length); i++) valitut.push(saatavilla[(alku + i) % saatavilla.length]);
    return valitut.sort((a, b) => a.asema - b.asema);
  }
  const ensisijaiset = onAlapaiva(paiva) ? YLA_ASEMAT : ALA_ASEMAT;
  const toissijaiset = onAlapaiva(paiva) ? ALA_ASEMAT : YLA_ASEMAT;
  const kierra = (lista) => lista.map((_, i) => lista[(siirto + i) % lista.length]);
  const jarjestys = [...kierra(ensisijaiset), ...kierra(toissijaiset)];
  const valitut = [];
  for (const id of jarjestys) {
    const a = saatavilla.find((x) => x.liikeId === id);
    if (a && !valitut.includes(a)) valitut.push(a);
    if (valitut.length >= maara) break;
  }
  return valitut;
}

function juoksuRivi([kestoMin, matkaKm, kuvaus], lisa = {}) {
  const rivi = { liikeId: 'juoksu', tyyppi: 'kesto', kestoMin, tapahtuma: true, kuvaus, ...lisa };
  if (matkaKm != null) rivi.matkaKm = matkaKm;
  return rivi;
}

/**
 * eventDayAdditions(tapahtuma, jakso, paiva, { laitteet, simulaatio = false, kevennysviikko } = {}) → [liikerivit]
 * jakso: 'perus'|'kovennus'|'kevennys'|'kisaviikko' tai eventPlan-viikko ({ jakso, kevennysviikko }).
 * paiva: ohjelmapäivä { nimi, liikkeet } (alavartalopäivälle valitaan ylävartalon asemia ja päinvastoin).
 * - HYROX: asemarivit { liikeId, sarjat, toistoMin, toistoMax, palautusS, toistoYksikko, asema, kisamatka,
 *   kuvaus, tapahtuma: true, simulaatio? } ja lopuksi juoksurivi. Asemia: perus 1, kovennus 2,
 *   kevennys ja kevennysviikko 1 (2 sarjaa), kisaviikko 0 (vain aktivointijuoksu). Kovennuksessa
 *   `simulaatio: true` tekee simulaatio-päivän: 3 lyhennettyä asemaa ja juoksut vuorotellen.
 * - Juoksutapahtuma: vain juoksurivi. Turnaus ja oma tavoite: [] (vaikuttavat vain kertoimiin).
 * Juoksurivi: { liikeId: 'juoksu', tyyppi: 'kesto', kestoMin, matkaKm?, kuvaus, tapahtuma: true } (ei sarjoja).
 * laitteet (valinnainen): asemat, joiden laitteita ei ole, ohitetaan; vaihtoehtoTarvikkeet kelpaavat.
 */
export function eventDayAdditions(tapahtuma, jakso, paiva, opts = {}) {
  if (!tapahtuma || typeof tapahtuma !== 'object' || !jakso) return [];
  const jaksoId = typeof jakso === 'string' ? jakso : jakso.jakso;
  if (!JAKSOT[jaksoId]) return [];
  const kevennysviikko = opts.kevennysviikko ?? (typeof jakso === 'object' && !!jakso.kevennysviikko);
  const tyyppi = tapahtumaTyyppi(tapahtuma.tyyppi);

  if (tyyppi.luokka === 'juoksu') {
    const taulu = { ...JUOKSUKISA_YHTEINEN, ...(JUOKSUKISA_JUOKSU[tyyppi.id] || JUOKSUKISA_JUOKSU['juoksu-10km']) };
    const avain = kevennysviikko && taulu.kevennysviikko ? 'kevennysviikko' : jaksoId;
    return [juoksuRivi(taulu[avain])];
  }
  if (tyyppi.luokka !== 'hyrox') return [];

  const simulaatio = opts.simulaatio === true && jaksoId === 'kovennus' && !kevennysviikko;
  const avain = simulaatio ? 'simulaatio' : (kevennysviikko ? 'kevennysviikko' : jaksoId);
  const kevyt = avain === 'kevennys' || avain === 'kevennysviikko';
  const div = hyroxDivisioona(tapahtuma.divisioona);
  const asemat = valitseAsemat(paiva, ASEMIA[avain], simulaatio, opts.laitteet);

  const rivit = asemat.map((a) => {
    const l = LIIKKEET.find((x) => x.id === a.liikeId);
    const [simMin, simMax] = SIMULAATIO[a.liikeId] || [a.harjoitus.toistoMin, a.harjoitus.toistoMax];
    const sarjat = simulaatio ? 1 : (kevyt ? Math.min(KEVYET_SARJAT, a.harjoitus.sarjat) : a.harjoitus.sarjat);
    const toistoMin = simulaatio ? simMin : a.harjoitus.toistoMin;
    const toistoMax = simulaatio ? simMax : a.harjoitus.toistoMax;
    const yksikko = YKSIKKO_TEKSTI[l.toistoYksikko] || 'toistoa';
    const haarukka = toistoMin === toistoMax ? `${toistoMin}` : `${toistoMin}–${toistoMax}`;
    const osat = [
      `Asema ${a.asema} (kisassa ${a.kisamatka}).`,
      simulaatio
        ? `Simulaatio: ${haarukka} ${yksikko}${matkaTeksti(l, toistoMax)} juoksun jälkeen.`
        : `${sarjat} × ${haarukka} ${yksikko}${matkaTeksti(l, toistoMax)}${kevyt ? ' kevyesti' : ''}.`,
    ];
    const korvaava = korvaavaTarvikeTeksti(l, opts.laitteet);
    if (korvaava) osat.push(`Tee ${korvaava}.`);
    if (div) osat.push(div.painoOhje);
    const rivi = {
      liikeId: a.liikeId,
      sarjat,
      toistoMin,
      toistoMax,
      palautusS: simulaatio ? 0 : a.harjoitus.palautusS,
      toistoYksikko: l.toistoYksikko,
      asema: a.asema,
      kisamatka: a.kisamatka,
      kuvaus: osat.join(' '),
      tapahtuma: true,
    };
    if (simulaatio) rivi.simulaatio = true;
    return rivi;
  });
  rivit.push(juoksuRivi(HYROX_JUOKSU[avain], simulaatio ? { simulaatio: true } : {}));
  return rivit;
}
