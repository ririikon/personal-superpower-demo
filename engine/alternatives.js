// Liikkeen vaihtoehdot ja automaattinen vaihto (speksi 4j): laitekarsinta, kipukarsinta,
// pisteytys ja suomenkielinen perustelu. Puhdas moduuli: aika ja data tulevat parametreina.

import { LIIKKEET, LAITTEET } from '../data.js?v=19a48e7';
import { onVoimatreeni, onTyosarja } from './util.js?v=19a48e7';

const MAKSIMI = 5;
const PISTEET = { lihasryhma: 50, kaava: 30, toissijainen: 5, tuttu: 10 };

// Laitteiden partitiivit perustelua varten ("ei vaadi kyykkytelinettä").
const PARTITIIVI = {
  levytanko: 'levytankoa',
  kyykkyteline: 'kyykkytelinettä',
  penkki: 'penkkiä',
  'käsipainot': 'käsipainoja',
  kahvakuulat: 'kahvakuulia',
  'jalkaprässi': 'jalkaprässiä',
  'reiden-ojennuslaite': 'reiden ojennuslaitetta',
  'reiden-koukistuslaite': 'reiden koukistuslaitetta',
  'smith-laite': 'smith-laitetta',
  'rintaprässi': 'rintaprässiä',
  soutulaite: 'soutulaitetta',
  'ylätalja': 'ylätaljaa',
  alatalja: 'alataljaa',
  'ristikkäistalja': 'ristikkäistaljaa',
  leuanvetotanko: 'leuanvetotankoa',
  dippiteline: 'dippitelinettä',
  vastuskuminauhat: 'vastuskuminauhoja',
};

// Kuormitusalueiden partitiivit ("ei kuormita polvea").
const ALUE_PARTITIIVI = {
  polvi: 'polvea',
  'alaselkä': 'alaselkää',
  'olkapää': 'olkapäätä',
  'kyynärpää': 'kyynärpäätä',
  ranne: 'rannetta',
};

const KAIKKI_LAITTEET = LAITTEET.map((l) => l.id);

function haeLiike(idTaiLiike) {
  if (idTaiLiike && typeof idTaiLiike === 'object') return idTaiLiike;
  return LIIKKEET.find((l) => l.id === idTaiLiike) || null;
}

function laitelista(laitteet) {
  return Array.isArray(laitteet) ? laitteet : KAIKKI_LAITTEET;
}

function lista(arvo) {
  if (Array.isArray(arvo)) return arvo.filter((x) => typeof x === 'string' && x);
  return typeof arvo === 'string' && arvo ? [arvo] : [];
}

/**
 * onSaatavilla(liike, laitteet) → bool
 * Tosi, jos liikkeen kaikki tarvikkeet löytyvät laitelistasta. Tyhjä tarvikelista = vain kehonpaino.
 * Puuttuva laitelista tulkitaan täydeksi kuntosaliksi.
 */
export function onSaatavilla(liike, laitteet) {
  const l = haeLiike(liike);
  if (!l) return false;
  const omat = laitelista(laitteet);
  return (l.tarvikkeet || []).every((t) => omat.includes(t));
}

// Voimassa tänään: alku ≤ tanaan ≤ loppu (puuttuva raja = avoin).
function voimassa(m, tanaan) {
  if (!m) return false;
  if (m.voimassaAlku && tanaan && m.voimassaAlku > tanaan) return false;
  if (m.voimassaLoppu && tanaan && m.voimassaLoppu < tanaan) return false;
  return true;
}

/**
 * valtettavatMuisteista(muistit, tanaan) → { valtettavat: [liikeId], kipualueet: [alue] }
 * Lukee tänään voimassa olevat valmentajan muistit, joissa on kenttä `valtettava` tai `kipualue`.
 */
export function valtettavatMuisteista(muistit, tanaan) {
  const valtettavat = [];
  const kipualueet = [];
  for (const m of Array.isArray(muistit) ? muistit : []) {
    if (!m || !voimassa(m, tanaan)) continue;
    for (const v of lista(m.valtettava)) if (!valtettavat.includes(v)) valtettavat.push(v);
    for (const a of lista(m.kipualue)) if (!kipualueet.includes(a)) kipualueet.push(a);
  }
  return { valtettavat, kipualueet };
}

// Liikkeet, joista käyttäjällä on työsarjoja historiassa (enintään nyt-päivään).
function tututLiikkeet(historia, nyt) {
  const raja = typeof nyt === 'string' && nyt ? nyt.slice(0, 10) : null;
  const tutut = new Set();
  for (const t of Array.isArray(historia) ? historia : []) {
    if (!onVoimatreeni(t)) continue;
    if (raja && typeof t.pvm === 'string' && t.pvm > raja) continue;
    for (const tl of t.liikkeet || []) {
      if (tl && (tl.sarjat || []).some(onTyosarja)) tutut.add(tl.liikeId);
    }
  }
  return tutut;
}

function luettelo(osat, sidos) {
  if (osat.length <= 1) return osat.join('');
  return `${osat.slice(0, -1).join(', ')} ${sidos} ${osat[osat.length - 1]}`;
}

function perustelu(alkup, ehdokas, { samaRyhma, samaKaava, tuttu, laitteet, kipualueet }) {
  let alku;
  if (samaRyhma && samaKaava) alku = 'Sama lihasryhmä ja liikemalli';
  else if (samaRyhma) alku = 'Sama lihasryhmä';
  else alku = `Sama liikemalli (${alkup.lihasryhma} avustajana)`;
  const osat = [alku];
  const puuttuvat = (alkup.tarvikkeet || [])
    .filter((t) => !laitteet.includes(t) && !(ehdokas.tarvikkeet || []).includes(t))
    .map((t) => PARTITIIVI[t] || t);
  if (puuttuvat.length) osat.push(`ei vaadi ${luettelo(puuttuvat, 'eikä')}`);
  const alueet = kipualueet.map((a) => ALUE_PARTITIIVI[a] || a);
  if (alueet.length) osat.push(`ei kuormita ${luettelo(alueet, 'eikä')}`);
  if (tuttu) osat.push('tuttu liike');
  return osat.join(', ');
}

// Sisäinen haku: kipualueet listana, poissuljettavat liikkeet joukkona.
function haeVaihtoehdot(alkup, { laitteet, valtettavat, kipualueet, tutut, poissuljetut }) {
  const tulos = [];
  for (const l of LIIKKEET) {
    if (l.id === alkup.id || poissuljetut.has(l.id) || valtettavat.includes(l.id)) continue;
    if (!onSaatavilla(l, laitteet)) continue;
    if (kipualueet.some((a) => (l.kuormittaa || []).includes(a))) continue;
    const samaRyhma = l.lihasryhma === alkup.lihasryhma;
    const samaKaava = !!l.kaava && l.kaava === alkup.kaava;
    // Kelpaa: sama päälihasryhmä, tai sama liikemalli niin, että alkuperäisen päälihas työskentelee avustajana.
    if (!samaRyhma && !(samaKaava && (l.toissijaiset || []).includes(alkup.lihasryhma))) continue;
    const yhteiset = (l.toissijaiset || []).filter((t) => (alkup.toissijaiset || []).includes(t)).length;
    const tuttu = tutut.has(l.id);
    const pisteet = (samaRyhma ? PISTEET.lihasryhma : 0) + (samaKaava ? PISTEET.kaava : 0)
      + yhteiset * PISTEET.toissijainen + (tuttu ? PISTEET.tuttu : 0);
    tulos.push({
      liike: l,
      pisteet,
      perustelu: perustelu(alkup, l, { samaRyhma, samaKaava, tuttu, laitteet, kipualueet }),
    });
  }
  // Paras ensin; tasapisteillä LIIKKEET-järjestys (vakaa lajittelu).
  return tulos.sort((a, b) => b.pisteet - a.pisteet).slice(0, MAKSIMI);
}

/**
 * alternatives(liikeId, { laitteet, valtettavat, kipualue, kipualueet, paivanLiikkeet, historia, nyt })
 *   → [{ liike, pisteet, perustelu }]   // enintään 5, paras ensin; tyhjä, jos sopivaa ei ole
 * Pisteytys: sama päälihasryhmä +50, sama kaava +30, toissijaisten päällekkäisyys +5 per lihas,
 * historiaa käyttäjältä +10. Karsinta: tarvikkeet puuttuvat laitelistasta, välttettävät liikkeet,
 * kipualuetta kuormittavat liikkeet ja päivän ohjelmassa jo olevat liikkeet (`paivanLiikkeet`).
 * Puuttuva `laitteet` = täysi kuntosali.
 */
export function alternatives(liikeId, opts = {}) {
  const alkup = haeLiike(liikeId);
  if (!alkup) return [];
  return haeVaihtoehdot(alkup, {
    laitteet: laitelista(opts.laitteet),
    valtettavat: lista(opts.valtettavat),
    kipualueet: [...new Set([...lista(opts.kipualue), ...lista(opts.kipualueet)])],
    tutut: tututLiikkeet(opts.historia, opts.nyt),
    poissuljetut: new Set(lista(opts.paivanLiikkeet)),
  });
}

/**
 * autoSwap(paivanLiikkeet, { laitteet, valtettavat, kipualueet, historia, nyt, muutLiikkeet })
 *   → [{ alkuperainen, korvaava, syy: 'laite'|'kipu' }]
 * paivanLiikkeet: [liikeId] tai [{ liikeId }]. muutLiikkeet (valinnainen): päivän muut liikkeet,
 * joita ei vaihdeta mutta jotka eivät kelpaa korvaajiksi. Palauttaa vain vaihdettavat liikkeet päivän
 * järjestyksessä: liike, jonka tarvikkeita ei ole ('laite'), tai välttettävä liike ('kipu').
 * Korvaava valitaan alternatives-pisteytyksellä niin, ettei se kuormita kipualueita eikä ole jo
 * päivän ohjelmassa tai toisen vaihdon korvaajana. Jos sopivaa ei ole, korvaava on null.
 */
export function autoSwap(paivanLiikkeet, opts = {}) {
  const idt = (Array.isArray(paivanLiikkeet) ? paivanLiikkeet : [])
    .map((x) => (x && typeof x === 'object' ? x.liikeId : x))
    .filter((x) => typeof x === 'string');
  const laitteet = laitelista(opts.laitteet);
  const valtettavat = lista(opts.valtettavat);
  const kipualueet = lista(opts.kipualueet);
  const tutut = tututLiikkeet(opts.historia, opts.nyt);
  const poissuljetut = new Set([...idt, ...lista(opts.muutLiikkeet)]);
  const tulos = [];
  for (const id of idt) {
    const alkup = haeLiike(id);
    if (!alkup) continue;
    let syy = null;
    if (!onSaatavilla(alkup, laitteet)) syy = 'laite';
    else if (valtettavat.includes(id)) syy = 'kipu';
    if (!syy) continue;
    const [paras] = haeVaihtoehdot(alkup, { laitteet, valtettavat, kipualueet, tutut, poissuljetut });
    const korvaava = paras ? paras.liike.id : null;
    if (korvaava) poissuljetut.add(korvaava);
    tulos.push({ alkuperainen: id, korvaava, syy });
  }
  return tulos;
}
