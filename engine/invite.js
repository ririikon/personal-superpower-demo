// Kaverikutsu on haaste (speksi 4k B): kutsulinkin koodaus, kutsuhaasteen luonti ja kutsupalkkio.
// Puhdas moduuli: ei DOM-, window-, localStorage- eikä Date.now()-kutsuja. Aika annetaan parametrina.
// Poikkeus: createInvite lisää kutsun id:hen satunnaisosan (crypto.getRandomValues), jotta eri
// kutsujien samana päivänä luomat kutsut eivät törmää.
//
// Kutsulinkki: `<demo-url>#/kutsu?d=<base64url(JSON)>`. JSON:ssa on vain kutsujan nimi,
// kaksintaistelun parametrit ja kutsujan lähtötaso, ei muita henkilötietoja.

import { addDays } from './util.js?v=19a48e7';
import { baseline } from './challenges.js?v=19a48e7';
import { LIIKKEET } from '../data.js?v=19a48e7';
import { tanaanPvm } from '../seed.js?v=19a48e7';

export const KUTSU_VERSIO = 1;
export const KUTSU_MITTARIT = ['treenit', 'volyymi', 'sarjat', 'aktiivisetPaivat'];
export const KUTSU_KESTOT = [7, 14];
export const KUTSU_NIMI_MAX = 40;
export const KUTSU_PISTEET = 100;
export const KUTSU_MERKKI = 'treenikaveri';
export const KUTSU_TILAT = ['lähetetty', 'hyväksytty', 'treenannut'];

const LAHTOTASO_MAX = 10000000;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const PVM_RE = /^\d{4}-\d{2}-\d{2}$/;
const MITTARI_NIMI = {
  treenit: 'treenikisa', volyymi: 'volyymikisa', sarjat: 'sarjakisa', aktiivisetPaivat: 'aktiivisuuskisa',
};
// Kutsujan väri kaverilistassa (tunnistettava, ei törmää seedin kavereihin).
const KUTSUJA_VARI = '#1971C2';
// Demo: simuloidun kaverin nimi kutsujan näkymässä.
const SIMULOITU_KAVERI = 'Sanna';

// --- base64url (UTF-8) --------------------------------------------------------

function base64urlKoodaa(teksti) {
  const tavut = new TextEncoder().encode(teksti);
  let bin = '';
  for (const b of tavut) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlPura(koodi) {
  if (typeof koodi !== 'string' || !/^[A-Za-z0-9_-]+$/.test(koodi)) return null;
  const b64 = koodi.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (koodi.length % 4)) % 4);
  try {
    const bin = atob(b64);
    const tavut = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(tavut);
  } catch {
    return null;
  }
}

// --- Validointi -----------------------------------------------------------------

function kelvollinenPvm(p) {
  if (typeof p !== 'string' || !PVM_RE.test(p)) return false;
  const d = new Date(`${p}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === p;
}

// Unicoden ohjausmerkit (\p{Cc}) ja muotoilumerkit (\p{Cf}, esim. U+202E suunnanvaihto) pois nimestä
// ennen pituustarkistusta, jotta linkillä ei voi kääntää tai piilottaa tekstiä näkymässä.
const OHJAUSMERKIT_RE = /[\p{Cc}\p{Cf}]/gu;
function puhdistaNimi(nimi) {
  return typeof nimi === 'string' ? nimi.replace(OHJAUSMERKIT_RE, '').trim() : '';
}

// Lyhyt tiiviste (FNV-1a, base36) kutsun tunnisteeseen.
function tiiviste(teksti) {
  let h = 0x811c9dc5;
  for (let i = 0; i < teksti.length; i++) {
    h ^= teksti.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}

// Satunnaisosa kutsun tunnisteeseen: crypto.getRandomValues (selain ja Node), varalla Math.random.
function satunnaisosa() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (c && typeof c.getRandomValues === 'function') {
    const tavut = c.getRandomValues(new Uint8Array(6));
    return Array.from(tavut, (b) => (b % 36).toString(36)).join('');
  }
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

/**
 * normalizeInvite(obj) → { v, id?, nimi, mittari, kesto, lahtotaso, luotu? } | null
 * Rajat: nimi 1–40 merkkiä (ohjausmerkit poistettuna ja trimmattuna), mittari KUTSU_MITTARIT-listasta, kesto 7 tai 14 päivää,
 * lahtotaso äärellinen luku 0–10 000 000 (pyöristetään 1 desimaaliin). id (valinnainen) on
 * [A-Za-z0-9_-]{1,40} ja luotu (valinnainen) 'YYYY-MM-DD'. Muut kentät pudotetaan.
 */
export function normalizeInvite(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  if (obj.v != null && obj.v !== KUTSU_VERSIO) return null;
  const nimi = puhdistaNimi(obj.nimi);
  if (!nimi || [...nimi].length > KUTSU_NIMI_MAX) return null;
  if (!KUTSU_MITTARIT.includes(obj.mittari)) return null;
  if (!KUTSU_KESTOT.includes(obj.kesto)) return null;
  const lahtotaso = obj.lahtotaso == null ? 0 : obj.lahtotaso;
  if (typeof lahtotaso !== 'number' || !Number.isFinite(lahtotaso) || lahtotaso < 0 || lahtotaso > LAHTOTASO_MAX) return null;
  const tulos = { v: KUTSU_VERSIO, nimi, mittari: obj.mittari, kesto: obj.kesto, lahtotaso: Math.round(lahtotaso * 10) / 10 };
  if (obj.id != null) {
    if (typeof obj.id !== 'string' || !ID_RE.test(obj.id)) return null;
    tulos.id = obj.id;
  }
  if (obj.luotu != null) {
    if (!kelvollinenPvm(obj.luotu)) return null;
    tulos.luotu = obj.luotu;
  }
  return tulos;
}

/** encodeInvite(obj) → base64url-merkkijono (JSON) tai null, jos kentät eivät ole sallittuja. */
export function encodeInvite(obj) {
  const n = normalizeInvite(obj);
  return n ? base64urlKoodaa(JSON.stringify(n)) : null;
}

/**
 * decodeInvite(str) → normalisoitu kutsu (kuten normalizeInvite) tai null.
 * Hyväksyy pelkän koodin, `d=`-parametrin tai koko linkin ("…#/kutsu?d=…").
 * Virheellinen base64url, JSON tai kenttä → null.
 */
export function decodeInvite(str) {
  if (typeof str !== 'string') return null;
  let koodi = str.trim();
  const m = koodi.match(/[?&#]d=([^&#\s]*)/) || koodi.match(/^d=([^&#\s]*)/);
  if (m) koodi = m[1];
  if (!koodi || koodi.length > 2000) return null;
  const json = base64urlPura(koodi);
  if (json == null) return null;
  try {
    return normalizeInvite(JSON.parse(json));
  } catch {
    return null;
  }
}

/** inviteLink(kutsu, pohjaUrl = '') → `${pohjaUrl}#/kutsu?d=<koodi>` tai null. */
export function inviteLink(kutsu, pohjaUrl = '') {
  const koodi = encodeInvite(kutsu);
  return koodi ? `${String(pohjaUrl || '').replace(/#.*$/, '')}#/kutsu?d=${koodi}` : null;
}

function kestoTeksti(kesto) {
  return kesto === 7 ? '1 viikon' : '2 viikon';
}

/** inviteTitle(kutsu) → esim. "Riku haastaa sinut: 2 viikon volyymikisa, tasapainotettu". */
export function inviteTitle(kutsu) {
  const k = normalizeInvite(kutsu);
  if (!k) return null;
  return `${k.nimi} haastaa sinut: ${kestoTeksti(k.kesto)} ${MITTARI_NIMI[k.mittari]}, tasapainotettu`;
}

// --- Kutsujan puoli -------------------------------------------------------------

/**
 * createInvite(tila, { mittari, kesto }, nyt) → { kutsu, data, koodi, polku } | null
 * Kutsujan "Kutsu kaveri": kutsu tilaan (yhteiso.kutsut) muodossa
 * { id, luotu, mittari, kesto, tila: 'lähetetty' } sekä linkin data (nimi, parametrit ja kutsujan
 * lähtötaso vastaavan pituiselta jaksolta neljän edellisen viikon ajalta). Ei muuta tilaa.
 */
export function createInvite(tila, { mittari, kesto } = {}, nyt) {
  const t = tila || {};
  const tanaan = tanaanPvm(nyt);
  const yhteiso = t.yhteiso || {};
  const kutsut = Array.isArray(yhteiso.kutsut) ? yhteiso.kutsut : [];
  const nimi = (t.profiili && puhdistaNimi(t.profiili.nimi)) || 'Demokäyttäjä';
  // Tunniste on yksilöllinen myös eri kutsujien välillä: päivä, kutsujan nimen tiiviste ja satunnaisosa
  // (eri laitteilla luodut kutsut eivät tiedä toisistaan, joten pelkkä järjestysnumero törmäisi).
  let id;
  do {
    id = `kutsu-${tanaan.replace(/-/g, '')}-${tiiviste(nimi)}-${satunnaisosa()}`;
  } while (kutsut.some((k) => k && k.id === id));
  const historia = Array.isArray(t.historia) ? t.historia : [];
  const lahtotaso = KUTSU_MITTARIT.includes(mittari) && KUTSU_KESTOT.includes(kesto)
    ? baseline(mittari, historia, tanaan, addDays(tanaan, kesto - 1), {
      liikkeet: LIIKKEET, profiili: t.profiili || {}, viikkosuunnitelmat: t.viikkosuunnitelmat || [],
    })
    : 0;
  const data = normalizeInvite({ id, nimi: [...nimi].slice(0, KUTSU_NIMI_MAX).join(''), mittari, kesto, lahtotaso, luotu: tanaan });
  if (!data) return null;
  const koodi = encodeInvite(data);
  return {
    kutsu: { id, luotu: tanaan, mittari, kesto, tila: 'lähetetty' },
    data,
    koodi,
    polku: `#/kutsu?d=${koodi}`,
  };
}

/**
 * simulateInviteStep(tila, kutsuId, nyt) → { tila, kutsu, palkkio } (demo-simulointi)
 * Kutsujan "Simuloi: kaveri hyväksyi ja treenasi": kutsu etenee tilaan 'treenannut' (kaveriNimi
 * täytetään), ja inviteReward antaa palkkion. Palauttaa uuden tilan; alkuperäistä ei muuteta.
 * Tuntematon kutsu → { tila (ennallaan), kutsu: null, palkkio: null }.
 */
export function simulateInviteStep(tila, kutsuId, nyt) {
  const kopio = structuredClone(tila || {});
  const kutsut = kopio.yhteiso && Array.isArray(kopio.yhteiso.kutsut) ? kopio.yhteiso.kutsut : [];
  const kutsu = kutsut.find((k) => k && k.id === kutsuId);
  if (!kutsu) return { tila: kopio, kutsu: null, palkkio: null };
  kutsu.tila = 'treenannut';
  if (!kutsu.kaveriNimi) kutsu.kaveriNimi = SIMULOITU_KAVERI;
  const palkkio = inviteReward(kopio, nyt);
  const paivitetty = palkkio.tila.yhteiso.kutsut.find((k) => k && k.id === kutsuId);
  return { tila: palkkio.tila, kutsu: paivitetty, palkkio };
}

// --- Vastaanottajan puoli ---------------------------------------------------------

function nimikirjaimet(nimi) {
  const osat = String(nimi).trim().split(/\s+/).filter(Boolean);
  const kirj = osat.slice(0, 2).map((o) => [...o][0].toUpperCase()).join('');
  return kirj || '?';
}

/**
 * createInviteChallenge(kutsu, tanaan) → { haaste, kaveri } | null
 * Vastaanottajan "Hyväksy haaste": tasapainotettu kaksintaistelu yhteiso.haasteet-listaan ja kutsuja
 * yhteiso.kaverit-listaan (lähtötaso viikkoarvona, jotta leaderboard ja friendProgress toimivat).
 * haaste = { id: kutsun id ('kutsu-…', ei tuplaetuliitettä), tyyppi: 'kaveri', nimi, kuvaus, mittari, tavoite: null, alku: tanaan,
 *   loppu: tanaan + kesto − 1, osallistujat: [kaveri.id], tasapainotus: true, palkinto: { pisteet: 100 },
 *   liittynyt: true, luoja: 'kutsu', kutsu: { id, nimi, lahtotaso } }.
 * Virheellinen kutsu tai päivämäärä → null.
 */
export function createInviteChallenge(kutsu, tanaan) {
  const k = normalizeInvite(kutsu);
  const t = typeof tanaan === 'string' ? tanaan.slice(0, 10) : null;
  if (!k || !kelvollinenPvm(t)) return null;
  // Kutsun id on jo muotoa 'kutsu-…', joten haasteen id ei saa tuplaetuliitettä. Vanha linkki ilman
  // id:tä saa tunnisteen kutsun sisällön tiivisteestä.
  const tunniste = k.id || `kutsu-${tiiviste(JSON.stringify([k.nimi, k.mittari, k.kesto, k.luotu || '', k.lahtotaso]))}`;
  const ydin = tunniste.replace(/^kutsu-/, '');
  const kaveriId = `kutsuja-${ydin}`;
  const kaveri = {
    id: kaveriId,
    nimi: k.nimi,
    nimikirjaimet: nimikirjaimet(k.nimi),
    vari: KUTSUJA_VARI,
    taso: 1,
    pisteet: 100,
    profiili: 'keskitaso',
    lahtotasot: { [k.mittari]: Math.round(((k.lahtotaso * 7) / k.kesto) * 10) / 10 },
    kutsuja: true,
  };
  const haaste = {
    id: `kutsu-${ydin}`,
    tyyppi: 'kaveri',
    nimi: `${k.nimi}: ${kestoTeksti(k.kesto)} ${MITTARI_NIMI[k.mittari]}`,
    kuvaus: `${k.nimi} haastoi sinut kaksintaisteluun. Tasapainotus vertaa kumpaakin omaan lähtötasoonsa, joten voit voittaa vaikka olisit aloittelija.`,
    mittari: k.mittari,
    tavoite: null,
    alku: t,
    loppu: addDays(t, k.kesto - 1),
    osallistujat: [kaveriId],
    tasapainotus: true,
    palkinto: { pisteet: KUTSU_PISTEET },
    liittynyt: true,
    luoja: 'kutsu',
    kutsu: { id: tunniste, nimi: k.nimi, lahtotaso: k.lahtotaso },
  };
  return { haaste, kaveri };
}

// --- Palkkio ---------------------------------------------------------------------

/**
 * inviteReward(tila, nyt) → { tila, annettu: bool, palkitut: [id], pisteet, merkki: bool }
 * Palkkio annetaan vain kerran kutakin kutsua kohden:
 * - kutsujan kutsu (yhteiso.kutsut), jonka tila on 'treenannut' eikä sitä ole palkittu,
 * - vastaanottajan kutsuhaaste (haaste.kutsu), kun haasteen alun jälkeen on tehty voimatreeni.
 * Palkittu kutsu saa kentän `palkittu: pvm` (kutsu tai haaste.kutsu). Merkki "Treenikaveri" lisätään
 * yhteiso.ansaitutMerkit-listaan, jos sitä ei vielä ole; +100 pistettä per palkittu kutsu luetaan
 * funktiolla inviteBonusPoints. Palauttaa uuden tilan; alkuperäistä ei muuteta. Toinen kutsu samalla
 * tilalla palauttaa annettu: false eikä muuta mitään.
 */
export function inviteReward(tila, nyt) {
  const kopio = structuredClone(tila || {});
  const pvm = nyt ? tanaanPvm(nyt) : null;
  const yhteiso = kopio.yhteiso && typeof kopio.yhteiso === 'object' ? kopio.yhteiso : null;
  if (!yhteiso) return { tila: kopio, annettu: false, palkitut: [], pisteet: 0, merkki: false };
  const historia = Array.isArray(kopio.historia) ? kopio.historia : [];
  const palkitut = [];
  const pvmt = [];

  for (const k of Array.isArray(yhteiso.kutsut) ? yhteiso.kutsut : []) {
    if (!k || k.palkittu || k.tila !== 'treenannut') continue;
    k.palkittu = pvm || k.luotu || null;
    palkitut.push(k.id);
    if (k.palkittu) pvmt.push(k.palkittu);
  }
  for (const h of Array.isArray(yhteiso.haasteet) ? yhteiso.haasteet : []) {
    if (!h || !h.kutsu || h.kutsu.palkittu || !h.liittynyt) continue;
    const eka = historia
      .filter((t) => t && (t.tyyppi == null || t.tyyppi === 'voima') && typeof t.pvm === 'string'
        && t.pvm >= h.alku && (!pvm || t.pvm <= pvm))
      .map((t) => t.pvm)
      .sort()[0];
    if (!eka) continue;
    h.kutsu.palkittu = eka;
    palkitut.push(h.id);
    pvmt.push(eka);
  }

  if (!palkitut.length) return { tila: kopio, annettu: false, palkitut: [], pisteet: 0, merkki: false };
  const merkit = Array.isArray(yhteiso.ansaitutMerkit) ? yhteiso.ansaitutMerkit : [];
  let merkki = false;
  const merkkiPvm = pvmt.sort()[0] || pvm;
  if (!merkit.some((m) => m && m.id === KUTSU_MERKKI) && merkkiPvm) {
    yhteiso.ansaitutMerkit = [...merkit, { id: KUTSU_MERKKI, pvm: merkkiPvm }];
    merkki = true;
  }
  return { tila: kopio, annettu: true, palkitut, pisteet: palkitut.length * KUTSU_PISTEET, merkki };
}

/** inviteBonusPoints(tila) → kutsupalkkioiden pisteet (100 per palkittu kutsu). */
export function inviteBonusPoints(tila) {
  const yhteiso = (tila && tila.yhteiso) || {};
  const kutsut = (Array.isArray(yhteiso.kutsut) ? yhteiso.kutsut : []).filter((k) => k && k.palkittu).length;
  const haasteet = (Array.isArray(yhteiso.haasteet) ? yhteiso.haasteet : []).filter((h) => h && h.kutsu && h.kutsu.palkittu).length;
  return (kutsut + haasteet) * KUTSU_PISTEET;
}
