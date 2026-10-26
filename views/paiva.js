// Tämän päivän treenin rakentaminen (speksi 6.2, 4b-2, 4h). Yhteinen Kodille ja Treenille,
// jotta Kodin treenikortti näyttää samat liikkeet, sarjat, toistot ja keston kuin Treenin aloitus.
// Ei DOM-kutsuja; aika annetaan parametrina.
import { tanaanPvm } from '../seed.js?v=19a48e7';
import {
  LIIKKEET, OHJELMAT, LAITTEET, VALINE_LAITTEET, JUOKSU, liike as haeLiike,
} from '../data.js?v=19a48e7';
import {
  suggestNextSet, goalParams, recovery, round25, onVoimatreeni, VOIMANOSTO_PAALIIKKEET,
  autoSwap, valtettavatMuisteista, estimatedStrength, eventPlan, eventDayAdditions,
} from '../engine.js?v=19a48e7';

const KAIKKI_LAITTEET = LAITTEET.map((l) => l.id);
// Matkapäivän välinerajaus laitemallissa: kehonpaino = lattia (ei telineitä), käsipainot = käsipainot.
const MATKA_VALINE_LAITTEET = { ...VALINE_LAITTEET, kehonpaino: [], 'käsipainot': ['käsipainot'] };
export const LAMMITTELY = [{ osuus: 0.5, toistot: 8 }, { osuus: 0.75, toistot: 5 }];
export const LAMMITTELY_PALAUTUS_S = 60;
const SARJAN_TYO_S = 40;   // arvioitu sarjan kesto keston sovitusta varten (demon oletus)
const VAIHTO_S = 60;       // liikkeen vaihto ja valmistelu

export function onKehonpaino(liike) {
  return !!liike && liike.valine === 'kehonpaino';
}

function vertaaAika(a, b) {
  if (a.pvm !== b.pvm) return a.pvm < b.pvm ? -1 : 1;
  const aa = a.aloitus || '';
  const bb = b.aloitus || '';
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}

// Kelvollinen tuotu ohjelma (speksi 4k D): id ja vähintään yksi päivä, jolla on liikelista.
function onKelvollinenOhjelma(o) {
  return !!o && typeof o.id === 'string' && Array.isArray(o.paivat) && o.paivat.length > 0
    && o.paivat.every((p) => p && Array.isArray(p.liikkeet) && p.liikkeet.length > 0);
}

/**
 * kaikkiOhjelmat(state) → [...OHJELMAT, ...state.omatOhjelmat]
 * Valmiit ohjelmat ja käyttäjän tuomat ohjelmat (esim. id 'oma-…'). Virheelliset tai valmiin
 * ohjelman id:n kanssa törmäävät tuodut ohjelmat ohitetaan.
 */
export function kaikkiOhjelmat(state) {
  const omat = state && Array.isArray(state.omatOhjelmat) ? state.omatOhjelmat : [];
  const idt = new Set(OHJELMAT.map((o) => o.id));
  const tulos = [...OHJELMAT];
  for (const o of omat) {
    if (!onKelvollinenOhjelma(o) || idt.has(o.id)) continue;
    idt.add(o.id);
    tulos.push(o);
  }
  return tulos;
}

export function aktiivinenOhjelma(state) {
  return kaikkiOhjelmat(state).find((o) => o.id === state.aktiivinenOhjelmaId) || OHJELMAT[0];
}

// Tämän päivän ohjelmapäivä: viimeisimmän (saman ohjelman) historiamerkinnän päivän jälkeinen.
export function tamanPaivanOhjelmapaiva(ohjelma, historia) {
  const paivat = ohjelma.paivat || [];
  const omat = (historia || [])
    .filter((t) => t && t.paivaNimi && typeof t.pvm === 'string' && (!t.ohjelmaId || t.ohjelmaId === ohjelma.id))
    .slice().sort(vertaaAika);
  const viimeisin = omat[omat.length - 1];
  const i = viimeisin ? paivat.findIndex((p) => p.nimi === viimeisin.paivaNimi) : -1;
  return paivat[(i + 1) % paivat.length];
}

// Hyväksytyn viikkosuunnitelman päivä tälle päivälle (tai null).
function paivanSuunnitelma(state, tanaan) {
  for (const s of state.viikkosuunnitelmat || []) {
    if (!s || !Array.isArray(s.paivat)) continue;
    const p = s.paivat.find((d) => d && d.pvm === tanaan);
    if (p) return p;
  }
  return null;
}

// Suunnitelmapäivän laiterajaus: `laitteet` sellaisenaan tai vanha `valineet` muunnettuna. null = ei rajausta.
function suunnitelmanLaitteet(suunnitelmaPaiva) {
  if (!suunnitelmaPaiva) return null;
  if (Array.isArray(suunnitelmaPaiva.laitteet)) return suunnitelmaPaiva.laitteet;
  if (!Array.isArray(suunnitelmaPaiva.valineet) || !suunnitelmaPaiva.valineet.length) return null;
  const joukko = new Set(suunnitelmaPaiva.valineet.flatMap((v) => MATKA_VALINE_LAITTEET[v] || []));
  return KAIKKI_LAITTEET.filter((id) => joukko.has(id));
}

// Päivän käytettävät laitteet: profiilin laitteet, matkapäivänä rajattuna suunnitelman laitteisiin.
function kaytettavatLaitteet(profiili, suunnitelmaPaiva) {
  const omat = Array.isArray(profiili.laitteet) ? profiili.laitteet : KAIKKI_LAITTEET;
  const rajaus = suunnitelmanLaitteet(suunnitelmaPaiva);
  if (!rajaus) return [...omat];
  const yhteiset = omat.filter((v) => rajaus.includes(v));
  return yhteiset.length ? yhteiset : [...rajaus];
}

/**
 * vaihdaPaivanLiike(state, pvm, alkuperainenId, korvaavaId) → uusi paivanVaihdot
 * Puhdas: ei muuta tilaa. korvaavaId === null tarkoittaa "Ohita liike tänään";
 * korvaavaId === alkuperainenId (tai undefined) poistaa päivän vaihdon.
 */
export function vaihdaPaivanLiike(state, pvm, alkuperainenId, korvaavaId) {
  const vanhat = state && state.paivanVaihdot && typeof state.paivanVaihdot === 'object' ? state.paivanVaihdot : {};
  const tulos = {};
  for (const [p, v] of Object.entries(vanhat)) tulos[p] = { ...v };
  const paiva = { ...(tulos[pvm] || {}) };
  if (korvaavaId === undefined || korvaavaId === alkuperainenId) delete paiva[alkuperainenId];
  else paiva[alkuperainenId] = korvaavaId;
  if (Object.keys(paiva).length) tulos[pvm] = paiva;
  else delete tulos[pvm];
  return tulos;
}

// Liikkeen tavoite goalParams-arvoista (voimanostossa apuliikkeille oma toistohaarukka).
// Viedään myös käynnissä olevan treenin liikevaihtoa varten (views/treeni.js).
export function liikkeenTavoite(gp, liikeId) {
  const h = gp.apuliikkeet && !VOIMANOSTO_PAALIIKKEET.includes(liikeId) ? gp.apuliikkeet : gp;
  return {
    toistoMin: h.toistoMin,
    toistoMax: h.toistoMax,
    sarjat: gp.sarjatMax,
    sarjatMin: gp.sarjatMin,
    palautusS: gp.palautusS,
    rirMin: gp.rirMin,
    rirMax: gp.rirMax,
  };
}

/**
 * kunnioitaOhjelmanSarjoja(state, ohjelma) → bool
 * Tosi tuodulle ohjelmalle (id state.omatOhjelmat-listassa) tai ohjelmalle, jolla on lippu
 * `kunnioitaSarjoja: true` (importedToProgram asettaa sen). Silloin PT:n sarjat ja toistot ohittavat
 * goalParams-arvot (speksi 4k D).
 */
export function kunnioitaOhjelmanSarjoja(state, ohjelma) {
  if (!ohjelma) return false;
  if (ohjelma.kunnioitaSarjoja === true) return true;
  const omat = state && Array.isArray(state.omatOhjelmat) ? state.omatOhjelmat : [];
  return omat.some((o) => o && o.id === ohjelma.id);
}

// Ohjelmarivin oma tavoite: sarjat ja toistohaarukka ohjelmasta, palautus ja RIR goalParamsista.
// Yksi toistoluku (toistoMin = toistoMax, esim. "4x8") on tarkka tavoite; progressio etenee silloin
// kuormalla, kun kaikki sarjat yltävät lukuun varaa jättäen. Virheellinen rivi → null (goalParams).
function ohjelmanRiviTavoite(r, gp) {
  if (!r) return null;
  const sarjat = Math.round(Number(r.sarjat));
  const toistoMin = Math.round(Number(r.toistoMin));
  const toistoMax = Math.round(Number(r.toistoMax ?? r.toistoMin));
  if (!(sarjat >= 1 && sarjat <= 10 && toistoMin >= 1 && toistoMin <= 100)) return null;
  return {
    toistoMin,
    toistoMax: Number.isFinite(toistoMax) && toistoMax >= toistoMin ? toistoMax : toistoMin,
    sarjat,
    sarjatMin: sarjat,
    palautusS: gp.palautusS,
    rirMin: gp.rirMin,
    rirMax: gp.rirMax,
  };
}

// Liikkeen aiemmat kerrat suggestNextSet-funktiolle: [{ pvm, tyyppi, sarjat }].
export function liikkeenKerrat(historia, liikeId) {
  const tulos = [];
  for (const t of historia || []) {
    if (!t || !onVoimatreeni(t)) continue;
    const sarjat = [];
    for (const tl of t.liikkeet || []) if (tl.liikeId === liikeId) sarjat.push(...(tl.sarjat || []));
    if (sarjat.length) tulos.push({ pvm: t.pvm, tyyppi: t.tyyppi, sarjat });
  }
  return tulos;
}

// Salitreenin arvioitu kesto. Tapahtuman juoksurivi (tyyppi 'kesto') ei kuulu salitreenin kestoon,
// vaan se lasketaan erikseen (kokonaisMin).
function arvioSekunnit(rivit) {
  let s = 0;
  for (const r of rivit) {
    if (r.tyyppi === 'kesto') continue;
    s += r.tavoite.sarjat * (SARJAN_TYO_S + r.tavoite.palautusS) + VAIHTO_S;
    s += (r.lammittelyt || []).length * (SARJAN_TYO_S + LAMMITTELY_PALAUTUS_S);
  }
  return s;
}

// Kesto rajoittaa sarjamäärää: pudotetaan sarjoja lopusta alkaen ensin tavoitteen
// alarajaan ja tarvittaessa kahteen sarjaan asti.
function sovitaKestoon(rivit, kestoMin) {
  const budjetti = kestoMin * 60;
  for (const lattia of [null, 2]) {
    let muuttui = true;
    while (arvioSekunnit(rivit) > budjetti && muuttui) {
      muuttui = false;
      for (let i = rivit.length - 1; i >= 0 && arvioSekunnit(rivit) > budjetti; i -= 1) {
        if (rivit[i].tyyppi === 'kesto' || rivit[i].ohjelmanTavoite) continue; // PT:n sarjoja ei karsita
        const t = rivit[i].tavoite;
        const raja = lattia === null ? t.sarjatMin : Math.min(t.sarjatMin, lattia);
        if (t.sarjat > raja) {
          t.sarjat -= 1;
          muuttui = true;
        }
      }
    }
  }
}

/**
 * rakennaPaiva(state, nytIso) → { ohjelma, paiva, suunnitelma, laitteet, kestoMin, rivit, tilat, arvioMin }
 * Tämän päivän treeni: ohjelmapäivä (ohjelmaId huomioiden), liikevaihdot, tavoitteet
 * (goalParams), keston sovitus ja lämmittelysarjat ensimmäiseen painavaan liikkeeseen.
 *
 * Liikevaihdot (speksi 4j), järjestyksessä:
 * 1. käyttäjän päivän vaihdot `state.paivanVaihdot[pvm][alkuperainenId]` (syy 'kayttaja');
 *    arvo null = liike ohitetaan tänään eikä sitä tule riviksi,
 * 2. autoSwap profiilin laitteilla (matkapäivänä rajattuna) ja voimassa olevilla kipumuisteilla
 *    (syy 'laite' tai 'kipu').
 * Rivi: { liike, liikeId, vaihdettu: { alkuperainen, syy } | null, johdettuLahde?, eiVaihtoehtoa?,
 *         tavoite, lammittelyt }. johdettuLahde = { liike, arvioituVoima } suggestNextSet-funktiolle,
 * kun korvatulla liikkeellä on arvioitu voima. eiVaihtoehtoa = 'laite'|'kipu', kun liike olisi pitänyt
 * vaihtaa mutta sopivaa korvaajaa ei löytynyt (liike jää ohjelmaan; näkymä voi tarjota ohitusta).
 *
 * Tavoitetapahtuma (speksi 4k), kun `profiili.tapahtuma` on asetettu ja tämä päivä kuuluu sen
 * suunnitelmaan (eventPlan):
 * - ohjelmariveiltä lisätään loppuun tapahtuman rivit (eventDayAdditions), merkintä `tapahtuma: true`:
 *   HYROX-asemat { liike, liikeId, tavoite, kuvaus, asema, kisamatka, toistoYksikko, simulaatio? } ja
 *   juoksurivi { liike: JUOKSU, liikeId: 'juoksu', tyyppi: 'kesto', tavoite: { kestoMin, matkaKm },
 *   kuvaus, lammittelyt: [] } (ei sarjoja). Juoksutapahtumille vain juoksurivi, turnauksille ja omalle
 *   tavoitteelle ei rivejä (ne vaikuttavat vain kertoimiin).
 * - kovennusjakson simulaatio-päivä on ohjelman viimeinen päivä (ei kevennysviikolla),
 * - kisaviikolla ohjelma kevenee: 3 ensimmäistä liikettä, 2 sarjaa, RIR vähintään 3 (`kevennetty: true`),
 * - tulokseen tulee `tapahtuma: { otsikko, tyyppi, jakso, jaksoNimi, kerroin, kevennysviikko,
 *   painopiste, viikkojaJaljella, simulaatio, kisaviikko } | null`.
 * arvioMin on salitreenin arvio (ohjelma ja asemat); kokonaisMin sisältää myös juoksurivin.
 *
 * Tuotu ohjelma (kunnioitaOhjelmanSarjoja): rivin sarjat ja toistohaarukka tulevat ohjelmasta
 * (`ohjelmanTavoite: true`), palautus ja RIR goalParamsista, eikä keston sovitus karsi niiden sarjoja.
 */
export function rakennaPaiva(state, nytIso) {
  const profiili = state.profiili || {};
  const historia = Array.isArray(state.historia) ? state.historia : [];
  const ohjelma = aktiivinenOhjelma(state);
  const paiva = tamanPaivanOhjelmapaiva(ohjelma, historia);
  const tanaan = tanaanPvm(nytIso);
  const suunnitelma = paivanSuunnitelma(state, tanaan);
  const laitteet = kaytettavatLaitteet(profiili, suunnitelma);
  const kestoMin = suunnitelma && Number.isFinite(suunnitelma.kestoMin) ? suunnitelma.kestoMin
    : (Number.isFinite(profiili.kesto) ? profiili.kesto : 60);
  const gp = goalParams(profiili.tavoite);
  const tilat = recovery(LIIKKEET, historia, nytIso).lihakset;

  const kaikkiVaihdot = state.paivanVaihdot && typeof state.paivanVaihdot === 'object' ? state.paivanVaihdot : {};
  const omatVaihdot = kaikkiVaihdot[tanaan] && typeof kaikkiVaihdot[tanaan] === 'object' ? kaikkiVaihdot[tanaan] : {};
  const ohjelmanIdt = paiva.liikkeet.map((r) => r.liikeId).filter((id) => haeLiike(id));
  const kayttajanVaihto = (id) => Object.prototype.hasOwnProperty.call(omatVaihdot, id);
  const kayttajanKorvaajat = ohjelmanIdt.filter(kayttajanVaihto).map((id) => omatVaihdot[id]).filter(Boolean);

  // Automaattiset vaihdot liikkeille, joita käyttäjä ei ole itse vaihtanut. Päivän muut liikkeet
  // (myös käyttäjän valitsemat korvaajat) eivät kelpaa korvaajiksi.
  const { valtettavat, kipualueet } = valtettavatMuisteista(state.muistit, tanaan);
  const automaattiset = autoSwap(ohjelmanIdt.filter((id) => !kayttajanVaihto(id)), {
    laitteet, valtettavat, kipualueet, historia, nyt: tanaan,
    muutLiikkeet: [...ohjelmanIdt, ...kayttajanKorvaajat],
  });
  const autoMap = new Map(automaattiset.map((v) => [v.alkuperainen, v]));

  // Tuodun ohjelman (PT:n määräys) sarjat ja toistot kunnioitetaan (speksi 4k D).
  const kunnioita = kunnioitaOhjelmanSarjoja(state, ohjelma);
  const ohjelmanRivit = new Map();
  for (const r of paiva.liikkeet) if (!ohjelmanRivit.has(r.liikeId)) ohjelmanRivit.set(r.liikeId, r);

  const kaytetyt = new Set();
  const rivit = [];
  for (const id of ohjelmanIdt) {
    const alkup = haeLiike(id);
    let liike = alkup;
    let vaihdettu = null;
    let eiVaihtoehtoa = null;
    if (kayttajanVaihto(id)) {
      if (!omatVaihdot[id]) continue; // ohitettu tänään
      const k = haeLiike(omatVaihdot[id]);
      if (k) {
        liike = k;
        vaihdettu = { alkuperainen: id, syy: 'kayttaja' };
      }
    } else if (autoMap.has(id)) {
      const v = autoMap.get(id);
      const k = v.korvaava ? haeLiike(v.korvaava) : null;
      if (k) {
        liike = k;
        vaihdettu = { alkuperainen: id, syy: v.syy };
      } else {
        eiVaihtoehtoa = v.syy;
      }
    }
    if (kaytetyt.has(liike.id)) continue;
    kaytetyt.add(liike.id);
    // Vaihdettu liike perii alkuperäisen ohjelmarivin sarjat ja toistot (PT:n määräämä paikka).
    const ohjelmanTavoite = kunnioita ? ohjelmanRiviTavoite(ohjelmanRivit.get(id), gp) : null;
    const rivi = {
      liike, liikeId: liike.id, vaihdettu, tavoite: ohjelmanTavoite || liikkeenTavoite(gp, liike.id), lammittelyt: [],
    };
    if (ohjelmanTavoite) rivi.ohjelmanTavoite = true;
    if (eiVaihtoehtoa) rivi.eiVaihtoehtoa = eiVaihtoehtoa;
    if (vaihdettu) {
      const voima = estimatedStrength(alkup, historia, tanaan);
      if (voima && voima.yksikko === 'kg') rivi.johdettuLahde = { liike: alkup, arvioituVoima: voima.arvo };
    }
    rivit.push(rivi);
  }

  // Lämmittelysarjat (50 % ja 75 %) ensimmäiseen painavaan liikkeeseen.
  if (profiili.lammittelysarjat) {
    for (const r of rivit) {
      if (onKehonpaino(r.liike)) continue;
      const eka = suggestNextSet({
        liike: r.liike, tavoite: r.tavoite, edellisetKerrat: liikkeenKerrat(historia, r.liikeId),
        tamanKerranSarjat: [], kokemus: profiili.kokemus,
        lihasTila: tilat[r.liike.lihasryhma] && tilat[r.liike.lihasryhma].tila,
        johdettuLahde: r.johdettuLahde,
      });
      if (!(eka.paino >= 20)) continue;
      r.lammittelyt = LAMMITTELY.map((l) => ({ paino: Math.max(2.5, round25(eka.paino * l.osuus)), toistot: l.toistot }));
      break;
    }
  }

  const tapahtuma = lisaaTapahtumanRivit({
    profiili, tanaan, ohjelma, paiva, laitteet, gp, rivit, kaytetyt,
  });

  sovitaKestoon(rivit, kestoMin);
  const arvioMin = Math.round(arvioSekunnit(rivit) / 60);
  const juoksuMin = rivit.filter((r) => r.tyyppi === 'kesto').reduce((s, r) => s + (r.tavoite.kestoMin || 0), 0);
  return {
    ohjelma, paiva, suunnitelma, laitteet, kestoMin, rivit, tilat, arvioMin,
    kokonaisMin: arvioMin + juoksuMin, tapahtuma,
  };
}

const KISAVIIKKO_LIIKKEITA = 3;
const KISAVIIKKO_SARJAT = 2;
const KISAVIIKKO_RIR_MIN = 3;

// Tavoitetapahtuman rivit ja kisaviikon kevennys (speksi 4k). Muokkaa rivit-listaa; palauttaa
// tapahtuman tiedot näkymälle tai null.
function lisaaTapahtumanRivit({ profiili, tanaan, ohjelma, paiva, laitteet, gp, rivit, kaytetyt }) {
  if (!profiili.tapahtuma) return null;
  const plan = eventPlan(profiili.tapahtuma, tanaan, { viikonAlku: profiili.viikonAlku || 'maanantai' });
  if (!plan || !plan.nykyinen) return null;
  const viikko = plan.nykyinen;
  const kisaviikko = viikko.jakso === 'kisaviikko';
  const paivat = ohjelma.paivat || [];
  const simulaatio = viikko.jakso === 'kovennus' && !viikko.kevennysviikko
    && paivat.length > 0 && paivat[paivat.length - 1] === paiva;

  if (kisaviikko) {
    rivit.splice(KISAVIIKKO_LIIKKEITA);
    for (const r of rivit) {
      r.tavoite.sarjat = Math.min(r.tavoite.sarjat, KISAVIIKKO_SARJAT);
      r.tavoite.sarjatMin = Math.min(r.tavoite.sarjatMin, KISAVIIKKO_SARJAT);
      r.tavoite.rirMin = Math.max(r.tavoite.rirMin, KISAVIIKKO_RIR_MIN);
      r.tavoite.rirMax = Math.max(r.tavoite.rirMax, r.tavoite.rirMin);
      r.kevennetty = true;
    }
  }

  for (const lisa of eventDayAdditions(profiili.tapahtuma, viikko, paiva, { laitteet, simulaatio })) {
    if (lisa.tyyppi === 'kesto') {
      const rivi = {
        liike: JUOKSU, liikeId: JUOKSU.id, tyyppi: 'kesto', vaihdettu: null,
        tavoite: { kestoMin: lisa.kestoMin, matkaKm: lisa.matkaKm ?? null },
        lammittelyt: [], tapahtuma: true, kuvaus: lisa.kuvaus,
      };
      if (lisa.simulaatio) rivi.simulaatio = true;
      rivit.push(rivi);
      continue;
    }
    const liike = haeLiike(lisa.liikeId);
    if (!liike || kaytetyt.has(liike.id)) continue;
    kaytetyt.add(liike.id);
    const rivi = {
      liike, liikeId: liike.id, vaihdettu: null,
      tavoite: {
        toistoMin: lisa.toistoMin, toistoMax: lisa.toistoMax, sarjat: lisa.sarjat, sarjatMin: lisa.sarjat,
        palautusS: lisa.palautusS, rirMin: gp.rirMin, rirMax: gp.rirMax,
      },
      lammittelyt: [], tapahtuma: true, kuvaus: lisa.kuvaus,
      asema: lisa.asema, kisamatka: lisa.kisamatka, toistoYksikko: lisa.toistoYksikko,
    };
    if (lisa.simulaatio) rivi.simulaatio = true;
    rivit.push(rivi);
  }

  return {
    otsikko: plan.otsikko,
    tyyppi: plan.tapahtuma.tyyppi,
    jakso: viikko.jakso,
    jaksoNimi: viikko.jaksoNimi,
    kerroin: viikko.kerroin,
    kevennysviikko: viikko.kevennysviikko,
    painopiste: viikko.painopiste,
    viikkojaJaljella: plan.viikkojaJaljella,
    simulaatio,
    kisaviikko,
  };
}
