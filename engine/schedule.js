// Kalenterivalmentaja (speksi 4l B): keksitty demokalenteri, viikon treenien sijoittelu kalenterin
// vapaisiin rakoihin, muutos uuden palaverin jälkeen (siirto tai tiivistys), varausten hyväksyntä ja
// toteutuminen. Puhdas moduuli: ei DOM-, window-, localStorage- eikä Date.now()-kutsuja. Aika annetaan
// parametrina. Kalenterin ajat ovat paikallisia merkkijonoja 'YYYY-MM-DDTHH:mm'.
//
// Demossa kalenterin tapahtumat ovat keksittyjä. Tuotteessa kalenterista luetaan luvalla vain
// varattu/vapaa-tieto, ei tapahtumien nimiä.

import { addDays, daysBetween, weekStart, onVoimatreeni } from './util.js?v=19a48e7';
import { jaksoViikolle } from './targets.js?v=19a48e7';
import { LIIKKEET, OHJELMAT } from '../data.js?v=19a48e7';
import { mulberry32, tanaanPvm } from '../seed.js?v=19a48e7';

// Suosikkiaikojen ikkunat minuutteina vuorokauden alusta. `suosittu` = ensimmäinen kokeiltava alkuaika.
// Arkipäivinä käytetään aamua, lounasta ja iltaa, viikonloppuna viikonloppuikkunaa.
export const AIKAIKKUNAT = {
  aamu: { id: 'aamu', nimi: 'Aamu', alku: 6 * 60, loppu: 9 * 60, suosittu: 6 * 60 + 30, arki: true, adverbi: 'aamulla' },
  lounas: { id: 'lounas', nimi: 'Lounas', alku: 11 * 60, loppu: 13 * 60, suosittu: 11 * 60, arki: true, adverbi: 'lounasaikaan' },
  ilta: { id: 'ilta', nimi: 'Ilta', alku: 16 * 60, loppu: 20 * 60, suosittu: 17 * 60, arki: true, adverbi: 'illalla' },
  viikonloppu: { id: 'viikonloppu', nimi: 'Viikonloppu', alku: 9 * 60, loppu: 18 * 60, suosittu: 10 * 60, arki: false, adverbi: 'viikonloppuna' },
};
const IKKUNAJARJESTYS = ['aamu', 'lounas', 'ilta', 'viikonloppu'];

// Kalenterin oletusasetukset (speksi 4l B). Treenien määrä viikossa ja kesto tulevat profiilista.
export const KALENTERI_OLETUSASETUKSET = {
  suosikkiajat: ['ilta', 'viikonloppu'],
  aukiolo: { alku: 5, loppu: 23 }, // salin aukiolo tunteina
  matkaMin: 15,                    // matka-aika salille suuntaansa
};

export const TIIVISTYS_MIN = 30; // tiivistetyn treenin vähimmäiskesto
const ASKEL_MIN = 15;            // alkuaikojen tarkkuus
const MUU_AIKA_SAKKO = 10;       // planWeek: muu kuin suosikkiaika (vrt. epätasainen jakauma 0,5 × poikkeama²)
const OLETUSSIEMEN = 'psp-kalenteri';
const VKP = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const OTSIKOT_AAMU = ['Palaveri', 'Tiimipalaveri', 'Aamupalaveri', 'Varattu'];
const OTSIKOT_IP = ['Palaveri', 'Asiakaspalaveri', 'Projektipalaveri', 'Varattu', 'Työpaja'];

// --- Aika-apurit -------------------------------------------------------------

function pad(n) {
  return String(n).padStart(2, '0');
}

function hhmm(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

function aika(pvm, min) {
  return `${pvm}T${hhmm(min)}`;
}

// 'YYYY-MM-DDTHH:mm' → { pvm, min } (null, jos virheellinen).
function jasenna(s) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(s || ''));
  return m ? { pvm: m[1], min: Number(m[2]) * 60 + Number(m[3]) } : null;
}

function viikonpaiva(pvm) {
  return new Date(`${pvm}T12:00:00Z`).getUTCDay(); // 0 = sunnuntai
}

function onViikonloppu(pvm) {
  const d = viikonpaiva(pvm);
  return d === 0 || d === 6;
}

function pisteKello(min) {
  return `${Math.floor(min / 60)}.${pad(min % 60)}`;
}

function paivaTeksti(pvm) {
  const [, m, d] = pvm.split('-').map(Number);
  return `${VKP[viikonpaiva(pvm)]} ${d}.${m}.`;
}

// Nyt-hetken paikallinen päivä ja minuutti.
function nytOsat(nyt) {
  if (!nyt) return null;
  const d = new Date(Date.parse(nyt));
  if (!Number.isFinite(d.getTime())) return null;
  return { pvm: tanaanPvm(nyt), min: d.getHours() * 60 + d.getMinutes() };
}

// FNV-1a: merkkijono → 32-bittinen siemen mulberry32:lle.
function hajautus(teksti) {
  let h = 0x811c9dc5;
  for (let i = 0; i < teksti.length; i++) {
    h ^= teksti.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function viikonAlkuAsetus(tila) {
  return tila && tila.profiili && tila.profiili.viikonAlku === 'sunnuntai' ? 'sunnuntai' : 'maanantai';
}

function asetuksetOf(tila) {
  const a = (tila && tila.kalenteri && tila.kalenteri.asetukset) || {};
  const suosikit = Array.isArray(a.suosikkiajat) ? a.suosikkiajat.filter((s) => AIKAIKKUNAT[s]) : KALENTERI_OLETUSASETUKSET.suosikkiajat;
  const aukiolo = a.aukiolo && Number.isFinite(a.aukiolo.alku) && Number.isFinite(a.aukiolo.loppu) ? a.aukiolo : KALENTERI_OLETUSASETUKSET.aukiolo;
  const matkaMin = Number.isFinite(a.matkaMin) && a.matkaMin >= 0 ? a.matkaMin : KALENTERI_OLETUSASETUKSET.matkaMin;
  return { suosikkiajat: suosikit, aukiolo, matkaMin };
}

function tapahtumatOf(tila) {
  const t = tila && tila.kalenteri && Array.isArray(tila.kalenteri.tapahtumat) ? tila.kalenteri.tapahtumat : [];
  return t.filter((x) => x && jasenna(x.alku) && jasenna(x.loppu));
}

function varauksetOf(tila) {
  const v = tila && tila.kalenteri && Array.isArray(tila.kalenteri.varaukset) ? tila.kalenteri.varaukset : [];
  return v.filter((x) => x && typeof x.pvm === 'string');
}

// Päivän varatut välit minuutteina [[a, b), ...]. Yön yli menevät tapahtumat leikataan päivään.
function varatutValit(pvm, tapahtumat) {
  const valit = [];
  for (const t of tapahtumat) {
    const a = jasenna(t.alku);
    const b = jasenna(t.loppu);
    if (!a || !b || a.pvm > pvm || b.pvm < pvm) continue;
    const alku = a.pvm < pvm ? 0 : a.min;
    const loppu = b.pvm > pvm ? 24 * 60 : b.min;
    if (loppu > alku) valit.push([alku, loppu]);
  }
  return valit;
}

function vapaa(valit, a, b) {
  return valit.every(([x, y]) => b <= x || a >= y);
}

// --- Ohjelma ja lihasryhmät ------------------------------------------------------

function kelvollinenOhjelma(o) {
  return !!o && typeof o.id === 'string' && Array.isArray(o.paivat) && o.paivat.length > 0
    && o.paivat.every((p) => p && Array.isArray(p.liikkeet));
}

function aktiivinenOhjelma(tila) {
  const omat = tila && Array.isArray(tila.omatOhjelmat) ? tila.omatOhjelmat.filter(kelvollinenOhjelma) : [];
  const kaikki = [...OHJELMAT, ...omat.filter((o) => !OHJELMAT.some((x) => x.id === o.id))];
  return kaikki.find((o) => o.id === (tila && tila.aktiivinenOhjelmaId)) || OHJELMAT[0];
}

const LIIKE = new Map(LIIKKEET.map((l) => [l.id, l]));

function paivanLihakset(paiva) {
  const s = new Set();
  for (const r of (paiva && paiva.liikkeet) || []) {
    const l = LIIKE.get(r.liikeId);
    if (l && l.lihasryhma) s.add(l.lihasryhma);
  }
  return s;
}

function treeninLihakset(treeni) {
  const s = new Set();
  for (const tl of treeni.liikkeet || []) {
    const l = LIIKE.get(tl.liikeId);
    if (l && l.lihasryhma && (tl.sarjat || []).some((x) => x && !x.lammittely)) s.add(l.lihasryhma);
  }
  return s;
}

function leikkaa(a, b) {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

// Seuraavan ohjelmapäivän indeksi historiasta (viimeisimmän saman ohjelman merkinnän jälkeinen).
function seuraavaIndeksi(ohjelma, historia, ennen) {
  const nimet = ohjelma.paivat.map((p) => p.nimi);
  const omat = (historia || [])
    .filter((t) => t && t.paivaNimi && typeof t.pvm === 'string' && (!ennen || t.pvm < ennen)
      && (!t.ohjelmaId || t.ohjelmaId === ohjelma.id) && nimet.includes(t.paivaNimi))
    .slice()
    .sort((a, b) => (a.pvm + (a.aloitus || '')).localeCompare(b.pvm + (b.aloitus || '')));
  if (!omat.length) return 0;
  return (nimet.indexOf(omat[omat.length - 1].paivaNimi) + 1) % nimet.length;
}

// Voimatreenipäivät ja niiden lihakset: { [pvm]: Set }.
function voimapaivat(historia) {
  const m = new Map();
  for (const t of historia || []) {
    if (!onVoimatreeni(t) || typeof t.pvm !== 'string') continue;
    const s = m.get(t.pvm) || new Set();
    for (const l of treeninLihakset(t)) s.add(l);
    m.set(t.pvm, s);
  }
  return m;
}

function suunnitelmaViikolle(tila, viikonAlku) {
  const lista = tila && Array.isArray(tila.viikkosuunnitelmat) ? tila.viikkosuunnitelmat : [];
  const loppu = addDays(viikonAlku, 7);
  return lista.find((s) => s && s.viikonAlku === viikonAlku)
    || lista.find((s) => s && (s.paivat || []).some((p) => p && p.pvm >= viikonAlku && p.pvm < loppu))
    || null;
}

// --- Rakon etsintä ----------------------------------------------------------------

// Päivän ikkunat: suosikit ensin (asetusten järjestyksessä), sitten muut sopivat.
function paivanIkkunat(pvm, suosikit) {
  const sopivat = IKKUNAJARJESTYS.filter((id) => AIKAIKKUNAT[id].arki !== onViikonloppu(pvm));
  const ensin = suosikit.filter((id) => sopivat.includes(id));
  return [
    ...ensin.map((id) => ({ ikkuna: AIKAIKKUNAT[id], suosikki: true })),
    ...sopivat.filter((id) => !ensin.includes(id)).map((id) => ({ ikkuna: AIKAIKKUNAT[id], suosikki: false })),
  ];
}

// Ensimmäinen alkuaika ikkunassa, johon mahtuu kesto + matka molempiin suuntiin.
// Kokeilujärjestys: suosittu alkuaika ja sen jälkeiset, sitten aiemmat.
function etsiAlku(ikkuna, kesto, matka, valit, aukiolo, minAlku) {
  const ala = Math.max(ikkuna.alku, aukiolo.alku * 60);
  const yla = Math.min(ikkuna.loppu, aukiolo.loppu * 60) - kesto;
  if (yla < ala) return null;
  const alut = [];
  const suosittu = Math.min(Math.max(ikkuna.suosittu, ala), yla);
  for (let a = suosittu; a <= yla; a += ASKEL_MIN) alut.push(a);
  for (let a = suosittu - ASKEL_MIN; a >= ala; a -= ASKEL_MIN) alut.push(a);
  for (const a of alut) {
    if (minAlku != null && a - matka < minAlku) continue;
    if (vapaa(valit, a - matka, a + kesto + matka)) return a;
  }
  return null;
}

function parasRako(pvm, kesto, { valit, asetukset, minAlku, vainSuosikit = false }) {
  for (const { ikkuna, suosikki } of paivanIkkunat(pvm, asetukset.suosikkiajat)) {
    if (vainSuosikit && !suosikki) continue;
    const a = etsiAlku(ikkuna, kesto, asetukset.matkaMin, valit, asetukset.aukiolo, minAlku);
    if (a != null) return { alku: a, loppu: a + kesto, ikkuna: ikkuna.id, suosikki };
  }
  return null;
}

// Pisin treenikesto (5 min tarkkuudella), joka mahtuu päivän johonkin ikkunaan matkoineen.
function pisinRako(pvm, { valit, asetukset, minAlku, vainSuosikit = false }) {
  let paras = null;
  for (const { ikkuna, suosikki } of paivanIkkunat(pvm, asetukset.suosikkiajat)) {
    if (vainSuosikit && !suosikki) continue;
    const ala = Math.max(ikkuna.alku, asetukset.aukiolo.alku * 60);
    const yla = Math.min(ikkuna.loppu, asetukset.aukiolo.loppu * 60);
    for (let a = ala; a < yla; a += 5) {
      if (minAlku != null && a - asetukset.matkaMin < minAlku) continue;
      let b = a;
      while (b + 5 <= yla && vapaa(valit, a - asetukset.matkaMin, b + 5 + asetukset.matkaMin)) b += 5;
      const kesto = b - a;
      if (kesto > 0 && (!paras || kesto > paras.loppu - paras.alku)) {
        paras = { alku: a, loppu: b, ikkuna: ikkuna.id, suosikki };
      }
    }
  }
  return paras;
}

// --- Demokalenteri -------------------------------------------------------------------

function viikonTapahtumat(alku, siemen) {
  const rng = mulberry32(hajautus(`${siemen}|${alku}`));
  const tapahtumat = [];
  const lisaa = (pvm, a, b, otsikko) => {
    tapahtumat.push({ id: `kal-${pvm}-${tapahtumat.filter((t) => t.alku.startsWith(pvm)).length + 1}`, alku: aika(pvm, a), loppu: aika(pvm, b), otsikko });
  };
  const valitse = (lista) => lista[Math.floor(rng() * lista.length)];
  // Yksi ilta viikossa (ti, ke tai to) on varattu.
  const iltaVkp = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < 7; i++) {
    const pvm = addDays(alku, i);
    const vkp = viikonpaiva(pvm);
    if (vkp >= 1 && vkp <= 5) {
      if (rng() < 0.75) {
        const a = valitse([8 * 60, 8 * 60 + 30, 9 * 60]);
        lisaa(pvm, a, a + (rng() < 0.5 ? 30 : 60), valitse(OTSIKOT_AAMU));
      }
      if (rng() < 0.4) lisaa(pvm, 10 * 60, 11 * 60, 'Varattu');
      if (rng() < 0.3) lisaa(pvm, 11 * 60 + 30, 12 * 60 + 30, 'Lounastapaaminen');
      const iltapaivia = 1 + (rng() < 0.5 ? 1 : 0);
      let a = 13 * 60 + Math.floor(rng() * 2) * 30;
      for (let n = 0; n < iltapaivia && a < 16 * 60; n++) {
        const kesto = valitse([30, 60, 60, 90]);
        const b = Math.min(16 * 60, a + kesto);
        lisaa(pvm, a, b, valitse(OTSIKOT_IP));
        a = b + 30 + Math.floor(rng() * 2) * 30;
      }
      if (rng() < 0.25) lisaa(pvm, 16 * 60, 17 * 60, 'Palaveri');
      if (vkp === iltaVkp) lisaa(pvm, 17 * 60 + 30, 21 * 60, 'Varattu');
    } else if (vkp === 6) {
      if (rng() < 0.5) lisaa(pvm, 10 * 60, 13 * 60, 'Varattu');
    } else if (rng() < 0.3) {
      lisaa(pvm, 12 * 60, 15 * 60, 'Varattu');
    }
  }
  return tapahtumat;
}

/**
 * demoCalendar(viikonAlku, siemen = 'psp-kalenteri') → [{ id, alku, loppu, otsikko }]
 * Keksityt varaukset kolmelle viikolle: edellinen, kuluva (viikonAlku) ja seuraava viikko, jotta myös
 * "Viime viikko" näyttää todelliselta.
 * Arkiaamuisin ja iltapäivisin on tyypillisiä palavereita, joskus lounastapaaminen, ja yksi ilta
 * viikossa (ti, ke tai to) on varattu klo 17.30–21. Viikonloppuna satunnainen varaus.
 * Deterministinen: jokainen viikko generoidaan siemenestä ja viikon alkupäivästä, joten sama viikko
 * näyttää samalta, vaikka se olisi ensin "seuraava", sitten "kuluva" ja lopuksi "edellinen" viikko.
 */
export function demoCalendar(viikonAlku, siemen = OLETUSSIEMEN) {
  const s = siemen == null ? OLETUSSIEMEN : String(siemen);
  return [-7, 0, 7].flatMap((n) => viikonTapahtumat(addDays(viikonAlku, n), s));
}

/**
 * uusiDemoKalenteri(kalenteri, tanaan, viikonAlkuAsetus = 'maanantai') → kalenteri (sama olio, jos ajan tasalla)
 * Latausajan uusinta: demokalenteri generoidaan edelliselle, kuluvalle ja seuraavalle viikolle. Käyttäjän lisäämät
 * tapahtumat (lisatty: true, esim. "Simuloi: uusi palaveri") säilyvät näillä viikoilla; vanhat
 * demotapahtumat poistuvat. Varauksiin ja asetuksiin ei kosketa. Merkintä: generoituViikolle.
 */
export function uusiDemoKalenteri(kalenteri, tanaan, asetus = 'maanantai') {
  if (!kalenteri || typeof kalenteri !== 'object' || !tanaan) return kalenteri;
  const alku = weekStart(tanaan, asetus);
  if (kalenteri.generoituViikolle === alku) return kalenteri;
  const ensimmainen = addDays(alku, -7);
  const loppu = addDays(alku, 14);
  const demo = demoCalendar(alku);
  const idt = new Set(demo.map((t) => t.id));
  const lisatyt = (Array.isArray(kalenteri.tapahtumat) ? kalenteri.tapahtumat : [])
    .filter((t) => t && t.lisatty && !idt.has(t.id) && jasenna(t.alku) && jasenna(t.alku).pvm >= ensimmainen && jasenna(t.alku).pvm < loppu);
  return {
    ...kalenteri,
    tapahtumat: [...demo, ...lisatyt].sort((a, b) => a.alku.localeCompare(b.alku)),
    generoituViikolle: alku,
  };
}

// --- Viikon suunnittelu ---------------------------------------------------------------

function kombinaatiot(n, k) {
  const tulos = [];
  const rek = (alku, valitut) => {
    if (valitut.length === k) {
      tulos.push(valitut.slice());
      return;
    }
    for (let i = alku; i < n; i++) {
      valitut.push(i);
      rek(i + 1, valitut);
      valitut.pop();
    }
  };
  rek(0, []);
  return tulos;
}

function kestoTeksti(min) {
  return `${min} min`;
}

/**
 * planWeek(tila, viikonAlku, { nyt } = {}) →
 *   [{ pvm, alku, loppu, ohjelmaPaiva, kestoMin, perustelu, ikkuna: 'aamu'|'lounas'|'ilta'|'viikonloppu', suosikki }]
 * Ehdotus viikon treeneistä kalenterin (tila.kalenteri.tapahtumat) vapaisiin rakoihin:
 * - rakoon mahtuu treenin kesto (profiili.kesto) ja kaksi kertaa matka-aika (asetukset.matkaMin),
 *   ja treeni on salin aukioloaikana ja aikaikkunassa (aamu 6–9, lounas 11–13, ilta 16–20, viikonloppu 9–18),
 * - suosikkiajat (asetukset.suosikkiajat) menevät muiden ikkunoiden edelle,
 * - kahden saman lihasryhmän treenin väliin jää vähintään yksi lepopäivä (myös viikkoa edeltävä
 *   treeni ja tällä viikolla jo tehdyt treenit huomioidaan); tehdyt päivät vähennetään määrästä,
 * - hyväksytty viikkosuunnitelma (4h): vain sen treenipäivät (ohjelmaPaiva ja kestoMin sieltä),
 *   lajipäiville, matkapäiville ja lepopäiville ei sijoiteta salitreeniä,
 * - tavoitetapahtuma (4k): kisaviikolla yksi kevyt aktivointi (enintään 45 min), ei tapahtumapäivänä
 *   eikä sitä edeltävänä päivänä; muun jakson nimi näkyy perustelussa.
 * Treenien määrä on profiili.treenitViikossa; jos lepopäiväsääntö ei salli kaikkia, ehdotetaan niin
 * monta kuin mahtuu. `nyt` (valinnainen) rajaa pois menneet päivät ja kellonajat.
 * ohjelmaPaiva on aktiivisen ohjelman päivän nimi seuraavasta vuorossa olevasta päivästä alkaen.
 */
export function planWeek(tila, viikonAlku, { nyt } = {}) {
  const t = tila || {};
  const profiili = t.profiili || {};
  const asetukset = asetuksetOf(t);
  const historia = Array.isArray(t.historia) ? t.historia : [];
  const nytO = nytOsat(nyt);
  const ohjelma = aktiivinenOhjelma(t);
  let kesto = Number.isFinite(profiili.kesto) ? profiili.kesto : 60;
  let maara = Number.isFinite(profiili.treenitViikossa) ? profiili.treenitViikossa : 3;
  const pvmt = Array.from({ length: 7 }, (_, i) => addDays(viikonAlku, i));
  const tapahtumat = tapahtumatOf(t);

  // Jo tehdyt voimatreenit (tällä viikolla) ja viikkoa edeltävät treenit lepopäiväsääntöön.
  const tehdyt = voimapaivat(historia.filter((x) => x && (!nytO || x.pvm <= nytO.pvm)));
  const tehdytViikolla = pvmt.filter((p) => tehdyt.has(p));
  maara = Math.max(0, maara - tehdytViikolla.length);

  // Tavoitetapahtuma.
  const jakso = jaksoViikolle(profiili.tapahtuma, viikonAlku, profiili.viikonAlku);
  const kisapaiva = profiili.tapahtuma && typeof profiili.tapahtuma.pvm === 'string' ? profiili.tapahtuma.pvm : null;
  const kisaviikko = jakso && jakso.jakso === 'kisaviikko';
  if (kisaviikko) {
    maara = Math.min(maara, 1);
    kesto = Math.min(kesto, 45);
  }

  // Ehdokaspäivät.
  const suunnitelma = suunnitelmaViikolle(t, viikonAlku);
  const suunnitellut = new Map();
  if (suunnitelma) {
    for (const p of suunnitelma.paivat || []) {
      if (p && p.tyyppi === 'treeni' && pvmt.includes(p.pvm)) suunnitellut.set(p.pvm, p);
    }
    maara = Math.min(maara, [...suunnitellut.keys()].filter((p) => !tehdyt.has(p)).length);
  }
  const ehdokkaat = [];
  for (const pvm of pvmt) {
    if (tehdyt.has(pvm)) continue;
    if (nytO && pvm < nytO.pvm) continue;
    if (suunnitelma && !suunnitellut.has(pvm)) continue;
    if (kisaviikko && kisapaiva && (pvm === kisapaiva || pvm === addDays(kisapaiva, -1) || pvm > kisapaiva)) continue;
    const p = suunnitellut.get(pvm);
    const k = p && Number.isFinite(p.kestoMin) ? p.kestoMin : kesto;
    const rako = parasRako(pvm, k, {
      valit: varatutValit(pvm, tapahtumat),
      asetukset,
      minAlku: nytO && pvm === nytO.pvm ? nytO.min : null,
    });
    if (rako) ehdokkaat.push({ pvm, kesto: k, rako, suunniteltu: p || null });
  }

  // Ohjelmapäivien kierto ja lepopäiväsääntö.
  const alkuIdx = seuraavaIndeksi(ohjelma, historia, nytO ? null : viikonAlku);
  const n = ohjelma.paivat.length;
  const ohjelmaPaivaNimelta = (nimi) => ohjelma.paivat.find((p) => p.nimi === nimi) || null;
  const edeltavat = new Map([...tehdyt].filter(([p]) => p < viikonAlku || pvmt.includes(p)));

  let paras = null;
  for (let k = Math.min(maara, ehdokkaat.length); k >= 1 && !paras; k--) {
    for (const yhd of kombinaatiot(ehdokkaat.length, k)) {
      const valitut = yhd.map((i) => ehdokkaat[i]);
      const lihakset = new Map(edeltavat);
      const paivat = [];
      let ok = true;
      valitut.forEach((e, j) => {
        const paiva = (e.suunniteltu && ohjelmaPaivaNimelta(e.suunniteltu.ohjelmaPaiva)) || ohjelma.paivat[(alkuIdx + j) % n];
        const omat = paivanLihakset(paiva);
        for (const naapuri of [addDays(e.pvm, -1), addDays(e.pvm, 1)]) {
          if (lihakset.has(naapuri) && leikkaa(lihakset.get(naapuri), omat)) ok = false;
        }
        lihakset.set(e.pvm, omat);
        paivat.push(paiva);
      });
      if (!ok) continue;
      // Pisteytys: suosikkiaika painaa eniten, sitten tasainen jakauma (tehdyt mukaan lukien).
      const kaikkiPvmt = [...tehdytViikolla, ...valitut.map((e) => e.pvm)].sort();
      let sakko = valitut.reduce((s, e) => s + (e.rako.suosikki ? 0 : MUU_AIKA_SAKKO), 0);
      const ihanne = 7 / Math.max(1, kaikkiPvmt.length);
      for (let i = 1; i < kaikkiPvmt.length; i++) {
        const vali = daysBetween(kaikkiPvmt[i - 1], kaikkiPvmt[i]);
        sakko += ((vali - ihanne) ** 2) * 0.5 + (vali === 1 ? 1 : 0);
      }
      if (!paras || sakko < paras.sakko - 1e-9) paras = { sakko, valitut, paivat };
    }
  }
  if (!paras) return [];

  const kaikkiTreenit = new Set([...tehdyt.keys()]);
  return paras.valitut.map((e, j) => {
    const paiva = paras.paivat[j];
    const ikkuna = AIKAIKKUNAT[e.rako.ikkuna];
    const osat = [];
    if (e.rako.suosikki) {
      osat.push(`Treenaat mieluiten ${ikkuna.adverbi}, ja kalenterissasi on vapaata klo ${pisteKello(e.rako.alku)}–${pisteKello(e.rako.loppu)}: ${kestoTeksti(e.kesto)} treeni ja ${asetukset.matkaMin} min matka suuntaansa mahtuvat.`);
    } else {
      osat.push(`Suosikkiaikoihisi ei mahtunut treeniä tänä päivänä, mutta ${ikkuna.adverbi} on vapaata klo ${pisteKello(e.rako.alku)}–${pisteKello(e.rako.loppu)}.`);
    }
    const aiemmat = [...kaikkiTreenit, ...paras.valitut.slice(0, j).map((x) => x.pvm)].filter((p) => p < e.pvm).sort();
    const edellinen = aiemmat[aiemmat.length - 1];
    if (edellinen && daysBetween(edellinen, e.pvm) <= 7) {
      const vali = daysBetween(edellinen, e.pvm);
      osat.push(vali === 1
        ? 'Edellinen treeni kuormitti eri lihasryhmiä, joten tänään voi treenata.'
        : `Edellisestä treenistä on ${vali} päivää, joten lihakset ehtivät palautua.`);
    }
    if (e.suunniteltu) osat.push('Päivä on hyväksytyn viikkosuunnitelmasi treenipäivä.');
    if (kisaviikko) osat.push('Kisaviikko: yksi kevyt aktivointi riittää, lepää ennen tapahtumaa.');
    else if (jakso) osat.push(`${jakso.jaksoNimi}: sarjatavoite × ${String(jakso.kerroin).replace('.', ',')}.`);
    return {
      pvm: e.pvm,
      alku: aika(e.pvm, e.rako.alku),
      loppu: aika(e.pvm, e.rako.loppu),
      ohjelmaPaiva: paiva.nimi,
      kestoMin: e.kesto,
      perustelu: osat.join(' '),
      ikkuna: e.rako.ikkuna,
      suosikki: e.rako.suosikki,
    };
  });
}

/**
 * applyPlan(tila, ehdotus) → uusi tila
 * "Hyväksy ja lisää kalenteriin": ehdotuksen treenit tallentuvat kalenteri.varaukset-listaan muodossa
 * { id: 'varaus-YYYY-MM-DD-HHmm', pvm, alku, loppu, ohjelmaPaiva, kestoMin, toteutunut: false }.
 * Saman viikon (profiilin viikonAlku) toteutumattomat varaukset korvataan; toteutuneet säilyvät.
 */
export function applyPlan(tila, ehdotus) {
  const t = tila || {};
  const lista = (Array.isArray(ehdotus) ? ehdotus : []).filter((e) => e && jasenna(e.alku) && jasenna(e.loppu));
  if (!lista.length) return t;
  const asetus = viikonAlkuAsetus(t);
  const viikot = new Set(lista.map((e) => weekStart(e.pvm || jasenna(e.alku).pvm, asetus)));
  const kalenteri = t.kalenteri && typeof t.kalenteri === 'object' ? t.kalenteri : {};
  const vanhat = varauksetOf(t).filter((v) => v.toteutunut || !viikot.has(weekStart(v.pvm, asetus)));
  const uudet = lista.map((e) => {
    const pvm = e.pvm || jasenna(e.alku).pvm;
    return {
      id: `varaus-${pvm}-${e.alku.slice(11, 16).replace(':', '')}`,
      pvm,
      alku: e.alku,
      loppu: e.loppu,
      ohjelmaPaiva: e.ohjelmaPaiva || null,
      kestoMin: e.kestoMin,
      toteutunut: false,
    };
  });
  return {
    ...t,
    kalenteri: {
      ...kalenteri,
      varaukset: [...vanhat, ...uudet.filter((u) => !vanhat.some((v) => v.id === u.id))]
        .sort((a, b) => String(a.alku).localeCompare(String(b.alku))),
    },
  };
}

function tiivistysOhje(kestoMin, alkuperainenMin) {
  const liikkeita = kestoMin <= 35 ? 3 : kestoMin <= 45 ? 4 : 5;
  const sarjoja = kestoMin <= 40 ? 2 : 3;
  return {
    kestoMin,
    alkuperainenMin,
    liikkeitaEnintaan: liikkeita,
    sarjatEnintaan: sarjoja,
    ohje: `Tiivistetty ${kestoMin} min versio: ${liikkeita} liikettä isot moniniveliset ensin, enintään ${sarjoja} sarjaa per liike ja palautukset 60–90 s.`,
  };
}

/**
 * replan(tila, varausId, uusiTapahtuma, { nyt } = {}) →
 *   [{ tyyppi: 'siirto'|'tiivistys', pvm, alku, loppu, kestoMin, perustelu,
 *      tiivistetty?: { kestoMin, alkuperainenMin, liikkeitaEnintaan, sarjatEnintaan, ohje } }]
 * Uusi tapahtuma (esim. palaveri { alku, loppu, otsikko }) on varauksen päällä. Vaihtoehdot:
 * 1. siirto samalle päivälle, jos täysi kesto mahtuu suosikkiaikojen rakoon (palautetaan ainoana), muuten
 * 2. tiivistys samana päivänä suosikkiaikojen pisimpään vapaaseen rakoon, kun siihen mahtuu vähintään 30 min mutta
 *    vähemmän kuin alkuperäinen kesto (liikkeitä vähennetään ja sarjoja lyhennetään; UI rakentaa
 *    päivän rakennaPaiva-logiikalla tiivistetty.kestoMin-kestolla ja rajaa liikkeet), ja
 * 3. siirto seuraavalle sopivalle päivälle (enintään 6 päivää eteenpäin), jolla ei ole muuta treeniä
 *    ja jonka naapuripäivinä ei ole saman lihasryhmän treeniä.
 * Jos mitään näistä ei löydy, siirto samalle päivälle muuhun kuin suosikkiaikaan.
 * Muut varaukset ovat varattua aikaa. Tuntematon varausId → [].
 */
export function replan(tila, varausId, uusiTapahtuma, { nyt } = {}) {
  const t = tila || {};
  const varaukset = varauksetOf(t);
  const v = varaukset.find((x) => x.id === varausId);
  if (!v) return [];
  const asetukset = asetuksetOf(t);
  const nytO = nytOsat(nyt);
  const muut = varaukset.filter((x) => x !== v);
  const tapahtumat = [...tapahtumatOf(t), ...(uusiTapahtuma && jasenna(uusiTapahtuma.alku) && jasenna(uusiTapahtuma.loppu) ? [uusiTapahtuma] : []), ...muut];
  const kesto = Number.isFinite(v.kestoMin) ? v.kestoMin : 60;
  const minAlku = (pvm) => (nytO && pvm === nytO.pvm ? nytO.min : null);
  const vaihtoehdot = [];

  const paivanValit = varatutValit(v.pvm, tapahtumat);
  const samaSiirto = (rako) => ({
    tyyppi: 'siirto', pvm: v.pvm, alku: aika(v.pvm, rako.alku), loppu: aika(v.pvm, rako.loppu), kestoMin: kesto,
    perustelu: `Uusi aika samana päivänä: klo ${pisteKello(rako.alku)}–${pisteKello(rako.loppu)} on vapaata, joten treeni tehdään täysimittaisena.`,
  });
  const sama = parasRako(v.pvm, kesto, { valit: paivanValit, asetukset, minAlku: minAlku(v.pvm), vainSuosikit: true });
  if (sama) return [samaSiirto(sama)];

  const lyhyt = pisinRako(v.pvm, { valit: paivanValit, asetukset, minAlku: minAlku(v.pvm), vainSuosikit: true });
  if (lyhyt && lyhyt.loppu - lyhyt.alku >= TIIVISTYS_MIN) {
    const k = Math.min(lyhyt.loppu - lyhyt.alku, kesto - 5);
    const tiivistetty = tiivistysOhje(k, kesto);
    vaihtoehdot.push({
      tyyppi: 'tiivistys', pvm: v.pvm, alku: aika(v.pvm, lyhyt.alku), loppu: aika(v.pvm, lyhyt.alku + k), kestoMin: k,
      perustelu: `Samana päivänä vapaata on vain klo ${pisteKello(lyhyt.alku)}–${pisteKello(lyhyt.alku + k)}, joten tehdään tiivistetty ${k} min treeni. ${tiivistetty.ohje}`,
      tiivistetty,
    });
  }

  // Seuraava sopiva päivä.
  const ohjelma = aktiivinenOhjelma(t);
  const paiva = ohjelma.paivat.find((p) => p.nimi === v.ohjelmaPaiva) || null;
  const omat = paiva ? paivanLihakset(paiva) : new Set();
  const treenipaivat = voimapaivat(Array.isArray(t.historia) ? t.historia : []);
  for (const x of muut) {
    const p = ohjelma.paivat.find((d) => d.nimi === x.ohjelmaPaiva);
    treenipaivat.set(x.pvm, p ? paivanLihakset(p) : new Set(['?']));
  }
  for (let i = 1; i <= 6; i++) {
    const pvm = addDays(v.pvm, i);
    if (treenipaivat.has(pvm)) continue;
    const naapuri = [addDays(pvm, -1), addDays(pvm, 1)].some((p) => treenipaivat.has(p)
      && (omat.size === 0 || leikkaa(treenipaivat.get(p), omat) || treenipaivat.get(p).has('?')));
    if (naapuri) continue;
    const rako = parasRako(pvm, kesto, { valit: varatutValit(pvm, tapahtumat), asetukset, minAlku: minAlku(pvm) });
    if (!rako) continue;
    vaihtoehdot.push({
      tyyppi: 'siirto', pvm, alku: aika(pvm, rako.alku), loppu: aika(pvm, rako.loppu), kestoMin: kesto,
      perustelu: `Siirretään ${paivaTeksti(pvm)} klo ${pisteKello(rako.alku)}–${pisteKello(rako.loppu)}: täysi treeni mahtuu, ja lihakset ehtivät palautua viereisistä treeneistä.`,
    });
    break;
  }
  // Viimeinen vaihtoehto: sama päivä muuna kuin suosikkiaikana.
  if (!vaihtoehdot.length) {
    const muu = parasRako(v.pvm, kesto, { valit: paivanValit, asetukset, minAlku: minAlku(v.pvm) });
    if (muu) vaihtoehdot.push(samaSiirto(muu));
  }
  return vaihtoehdot;
}

/**
 * applyReplan(tila, varausId, uusiTapahtuma, vaihtoehto) → uusi tila
 * Lisää uuden tapahtuman kalenteriin (lisatty: true) ja päivittää varauksen valitun vaihtoehdon
 * mukaan (pvm, alku, loppu, kestoMin, siirretty: true, tiivistetty?). vaihtoehto null → vain tapahtuma lisätään.
 */
export function applyReplan(tila, varausId, uusiTapahtuma, vaihtoehto) {
  const t = tila || {};
  const kalenteri = t.kalenteri && typeof t.kalenteri === 'object' ? t.kalenteri : {};
  const tapahtumat = Array.isArray(kalenteri.tapahtumat) ? kalenteri.tapahtumat : [];
  const lisattava = uusiTapahtuma && jasenna(uusiTapahtuma.alku) && jasenna(uusiTapahtuma.loppu)
    ? [{ otsikko: 'Palaveri', ...uusiTapahtuma, id: uusiTapahtuma.id || `lisatty-${uusiTapahtuma.alku}`, lisatty: true }]
    : [];
  const varaukset = (Array.isArray(kalenteri.varaukset) ? kalenteri.varaukset : []).map((x) => {
    if (!x || x.id !== varausId || !vaihtoehto) return x;
    const uusi = { ...x, pvm: vaihtoehto.pvm, alku: vaihtoehto.alku, loppu: vaihtoehto.loppu, kestoMin: vaihtoehto.kestoMin, siirretty: true };
    if (vaihtoehto.tiivistetty) uusi.tiivistetty = vaihtoehto.tiivistetty;
    else delete uusi.tiivistetty;
    return uusi;
  });
  return {
    ...t,
    kalenteri: {
      ...kalenteri,
      tapahtumat: [...tapahtumat.filter((x) => !lisattava.some((l) => l.id === (x && x.id))), ...lisattava]
        .sort((a, b) => String(a.alku).localeCompare(String(b.alku))),
      varaukset: varaukset.slice().sort((a, b) => String(a && a.alku).localeCompare(String(b && b.alku))),
    },
  };
}

/**
 * markDone(tila, treeni) → uusi tila (sama olio, jos merkittävää varausta ei ole)
 * Kirjattu voimatreeni merkitsee saman päivän ensimmäisen toteutumattoman varauksen toteutuneeksi
 * (toteutunut: true, treeniId).
 */
export function markDone(tila, treeni) {
  const t = tila || {};
  if (!treeni || typeof treeni.pvm !== 'string' || !onVoimatreeni(treeni)) return t;
  const kalenteri = t.kalenteri && typeof t.kalenteri === 'object' ? t.kalenteri : null;
  if (!kalenteri || !Array.isArray(kalenteri.varaukset)) return t;
  const i = kalenteri.varaukset.findIndex((v) => v && v.pvm === treeni.pvm && !v.toteutunut);
  if (i < 0) return t;
  const varaukset = kalenteri.varaukset.slice();
  varaukset[i] = { ...varaukset[i], toteutunut: true, treeniId: treeni.id ?? null };
  return { ...t, kalenteri: { ...kalenteri, varaukset } };
}

/**
 * completionRate(tila, viikonAlku) → { toteutunut, suunniteltu, pros, teksti: '2/3 toteutunut' }
 * Viikon [viikonAlku, +6] varaukset; varaus on toteutunut, kun se on merkitty (markDone) tai samana
 * päivänä on kirjattu voimatreeni. Ilman varauksia pros = 0 ja teksti 'Ei varauksia'.
 */
export function completionRate(tila, viikonAlku) {
  const loppu = addDays(viikonAlku, 6);
  const viikolla = varauksetOf(tila).filter((v) => v.pvm >= viikonAlku && v.pvm <= loppu);
  const tehdyt = voimapaivat(tila && Array.isArray(tila.historia) ? tila.historia : []);
  const toteutunut = viikolla.filter((v) => v.toteutunut || tehdyt.has(v.pvm)).length;
  const suunniteltu = viikolla.length;
  return {
    toteutunut,
    suunniteltu,
    pros: suunniteltu ? Math.round((toteutunut / suunniteltu) * 100) : 0,
    teksti: suunniteltu ? `${toteutunut}/${suunniteltu} toteutunut` : 'Ei varauksia',
  };
}

/** seuraavaVaraus(tila, nyt) → seuraava toteutumaton varaus nyt-hetkestä alkaen tai null (Kodin kortti). */
export function seuraavaVaraus(tila, nyt) {
  const n = nytOsat(nyt);
  if (!n) return null;
  const raja = aika(n.pvm, n.min);
  return varauksetOf(tila)
    .filter((v) => !v.toteutunut && String(v.alku) >= raja)
    .sort((a, b) => String(a.alku).localeCompare(String(b.alku)))[0] || null;
}
