// Tämän päivän treenin rakentaminen (speksi 6.2, 4b-2, 4h). Yhteinen Kodille ja Treenille,
// jotta Kodin treenikortti näyttää samat liikkeet, sarjat, toistot ja keston kuin Treenin aloitus.
// Ei DOM-kutsuja; aika annetaan parametrina.
import { tanaanPvm } from '../seed.js';
import { LIIKKEET, OHJELMAT, liike as haeLiike } from '../data.js';
import {
  suggestNextSet, goalParams, recovery, round25, onVoimatreeni, VOIMANOSTO_PAALIIKKEET,
} from '../engine.js';

const KAIKKI_VALINEET = ['levytanko', 'käsipainot', 'laitteet', 'taljat', 'kehonpaino'];
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

export function aktiivinenOhjelma(state) {
  return OHJELMAT.find((o) => o.id === state.aktiivinenOhjelmaId) || OHJELMAT[0];
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

function kaytettavatValineet(profiili, suunnitelmaPaiva) {
  let omat = profiili.vainKehonpaino
    ? ['kehonpaino']
    : (Array.isArray(profiili.valineet) && profiili.valineet.length ? profiili.valineet : KAIKKI_VALINEET);
  const rajaus = suunnitelmaPaiva && Array.isArray(suunnitelmaPaiva.valineet) ? suunnitelmaPaiva.valineet : null;
  if (rajaus && rajaus.length) {
    const yhteiset = omat.filter((v) => rajaus.includes(v));
    omat = yhteiset.length ? yhteiset : rajaus;
  }
  return omat;
}

// Saman päälihasryhmän liike, johon väline löytyy (sama alue ensin).
function korvaava(alkup, valineet, kaytetyt) {
  const ehdokkaat = LIIKKEET.filter((l) => l.lihasryhma === alkup.lihasryhma
    && valineet.includes(l.valine) && !kaytetyt.has(l.id));
  return ehdokkaat.find((l) => l.alue === alkup.alue) || ehdokkaat[0] || null;
}

function liikkeenTavoite(gp, liikeId) {
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

function arvioSekunnit(rivit) {
  let s = 0;
  for (const r of rivit) {
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
 * rakennaPaiva(state, nytIso) → { ohjelma, paiva, suunnitelma, valineet, kestoMin, rivit, tilat, arvioMin }
 * Tämän päivän treeni: ohjelmapäivä (ohjelmaId huomioiden), välinevaihdot, tavoitteet
 * (goalParams), keston sovitus ja lämmittelysarjat ensimmäiseen painavaan liikkeeseen.
 */
export function rakennaPaiva(state, nytIso) {
  const profiili = state.profiili || {};
  const historia = Array.isArray(state.historia) ? state.historia : [];
  const ohjelma = aktiivinenOhjelma(state);
  const paiva = tamanPaivanOhjelmapaiva(ohjelma, historia);
  const tanaan = tanaanPvm(nytIso);
  const suunnitelma = paivanSuunnitelma(state, tanaan);
  const valineet = kaytettavatValineet(profiili, suunnitelma);
  const kestoMin = suunnitelma && Number.isFinite(suunnitelma.kestoMin) ? suunnitelma.kestoMin
    : (Number.isFinite(profiili.kesto) ? profiili.kesto : 60);
  const gp = goalParams(profiili.tavoite);
  const tilat = recovery(LIIKKEET, historia, nytIso).lihakset;

  const kaytetyt = new Set();
  const rivit = [];
  for (const r of paiva.liikkeet) {
    const alkup = haeLiike(r.liikeId);
    if (!alkup) continue;
    let liike = alkup;
    let vaihdettu = null;
    if (!valineet.includes(alkup.valine)) {
      const k = korvaava(alkup, valineet, kaytetyt);
      if (k) {
        liike = k;
        vaihdettu = alkup.id;
      }
    }
    if (kaytetyt.has(liike.id)) continue;
    kaytetyt.add(liike.id);
    rivit.push({ liike, liikeId: liike.id, vaihdettu, tavoite: liikkeenTavoite(gp, liike.id), lammittelyt: [] });
  }

  // Lämmittelysarjat (50 % ja 75 %) ensimmäiseen painavaan liikkeeseen.
  if (profiili.lammittelysarjat) {
    for (const r of rivit) {
      if (onKehonpaino(r.liike)) continue;
      const eka = suggestNextSet({
        liike: r.liike, tavoite: r.tavoite, edellisetKerrat: liikkeenKerrat(historia, r.liikeId),
        tamanKerranSarjat: [], kokemus: profiili.kokemus,
        lihasTila: tilat[r.liike.lihasryhma] && tilat[r.liike.lihasryhma].tila,
      });
      if (!(eka.paino >= 20)) continue;
      r.lammittelyt = LAMMITTELY.map((l) => ({ paino: Math.max(2.5, round25(eka.paino * l.osuus)), toistot: l.toistot }));
      break;
    }
  }

  sovitaKestoon(rivit, kestoMin);
  return { ohjelma, paiva, suunnitelma, valineet, kestoMin, rivit, tilat, arvioMin: Math.round(arvioSekunnit(rivit) / 60) };
}
