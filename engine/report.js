// Viikkoraportti valmentajalle (speksi 4k E). Puhdas moduuli: ei DOM-, window-, localStorage- eikä
// Date.now()-kutsuja. Aika annetaan parametrina (`nyt`: ISO-merkkijono).

import { addDays, weekStart, onVoimatreeni, onTyosarja } from './util.js?v=31a36ec';
import { viikonTavoitteet, weeklyProgress } from './targets.js?v=31a36ec';
import { workoutSummary } from './history.js?v=31a36ec';
import { estimatedStrength } from './score.js?v=31a36ec';
import { recovery } from './recovery.js?v=31a36ec';
import { eventPlan } from './event.js?v=31a36ec';
import { LIIKKEET, VERTAILULIIKKEET, liike as haeLiike } from '../data.js?v=31a36ec';
import { tanaanPvm } from '../seed.js?v=31a36ec';

export const RAPORTTI_TEKSTI_MAX = 1500;

const PVM_RE = /^\d{4}-\d{2}-\d{2}$/;
const RYHMA_NIMI = { tyonnot: 'Työnnöt', vedot: 'Vedot', jalat: 'Jalat' };
const ENNATYS_NIMI = {
  arvioituVoima: 'arvioitu maksimi', paino: 'raskain paino', volyymi: 'volyymi', toistot: 'eniten toistoja',
};
const SYY_TEKSTI = {
  laite: 'laite puuttui',
  varattu: 'laite varattu',
  kipu: 'kipu tai vamma',
  kayttaja: 'oma valinta',
  muu: 'muu syy',
};
const RAPORTTI_ILTA = 'T20:00:00';

// --- Muotoilu -------------------------------------------------------------------

function luku(n, desimaalit = 1) {
  if (!Number.isFinite(n)) return '–';
  const pyor = Math.round(n * 10 ** desimaalit) / 10 ** desimaalit;
  const [koko, osa] = String(Math.abs(pyor)).split('.');
  const tuhannet = koko.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${pyor < 0 ? '−' : ''}${tuhannet}${osa ? `,${osa}` : ''}`;
}

function valiTeksti(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  if (ya === yb && ma === mb) return `${da}.–${db}.${mb}.${yb}`;
  if (ya === yb) return `${da}.${ma}.–${db}.${mb}.${yb}`;
  return `${da}.${ma}.${ya}–${db}.${mb}.${yb}`;
}

function kestoTeksti(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const loput = m % 60;
  return loput ? `${h} h ${loput} min` : `${h} h`;
}

function luettelo(osat) {
  if (osat.length <= 1) return osat.join('');
  return `${osat.slice(0, -1).join(', ')} ja ${osat[osat.length - 1]}`;
}

function liikeNimi(id) {
  const l = haeLiike(id);
  return l ? l.nimi : id;
}

// --- Osat -------------------------------------------------------------------------

function treeniRivi(t, historia) {
  const voima = onVoimatreeni(t);
  const yv = voima ? workoutSummary(t, LIIKKEET, historia) : null;
  const sarjat = voima
    ? (t.liikkeet || []).reduce((n, tl) => n + (tl.sarjat || []).filter(onTyosarja).length, 0)
    : 0;
  return {
    id: t.id ?? null,
    pvm: t.pvm,
    tyyppi: voima ? 'voima' : t.tyyppi,
    nimi: voima ? (t.paivaNimi || yv.otsikko) : (t.nimi || 'Aktiviteetti'),
    kestoMin: Number.isFinite(t.kestoS) ? Math.round(t.kestoS / 60) : 0,
    sarjat,
    volyymi: yv ? yv.volyymi : 0,
    liikkeita: yv ? yv.liikkeita : 0,
    lihakset: yv ? yv.lihakset.map((x) => x.lihas) : [],
  };
}

function vaihdotJaOhitukset(viikon, tila, alku, loppu) {
  const tulos = [];
  const muistit = Array.isArray(tila.muistit) ? tila.muistit : [];
  const kipuMuisti = (liikeId) => muistit.find((m) => m && m.valtettava === liikeId);
  const syyTeksti = (syy, alkuperainen) => {
    if (syy === 'kipu') {
      const m = kipuMuisti(alkuperainen);
      if (m && m.teksti) return m.teksti;
    }
    return SYY_TEKSTI[syy] || SYY_TEKSTI.muu;
  };
  const nahty = new Set();
  for (const t of viikon) {
    if (!onVoimatreeni(t)) continue;
    for (const tl of t.liikkeet || []) {
      const v = tl && tl.vaihdettu;
      if (!v || !v.alkuperainen) continue;
      nahty.add(`${t.pvm}|${v.alkuperainen}`);
      tulos.push({
        pvm: t.pvm, toiminto: 'vaihdettu', liikeId: v.alkuperainen, nimi: liikeNimi(v.alkuperainen),
        korvaavaId: tl.liikeId, korvaavaNimi: liikeNimi(tl.liikeId), syy: v.syy || 'muu', syyTeksti: syyTeksti(v.syy, v.alkuperainen),
      });
    }
  }
  const paivanVaihdot = tila.paivanVaihdot && typeof tila.paivanVaihdot === 'object' ? tila.paivanVaihdot : {};
  for (const pvm of Object.keys(paivanVaihdot).sort()) {
    if (pvm < alku || pvm > loppu) continue;
    const vaihdot = paivanVaihdot[pvm] || {};
    for (const [alkuperainen, korvaava] of Object.entries(vaihdot)) {
      if (nahty.has(`${pvm}|${alkuperainen}`)) continue;
      const kipu = kipuMuisti(alkuperainen);
      const syy = kipu ? 'kipu' : 'kayttaja';
      tulos.push(korvaava
        ? { pvm, toiminto: 'vaihdettu', liikeId: alkuperainen, nimi: liikeNimi(alkuperainen),
          korvaavaId: korvaava, korvaavaNimi: liikeNimi(korvaava), syy, syyTeksti: syyTeksti(syy, alkuperainen) }
        : { pvm, toiminto: 'ohitettu', liikeId: alkuperainen, nimi: liikeNimi(alkuperainen),
          korvaavaId: null, korvaavaNimi: null, syy, syyTeksti: syyTeksti(syy, alkuperainen) });
    }
  }
  const kipumuistit = muistit
    .filter((m) => m && (m.kipualue || m.valtettava)
      && (!m.voimassaAlku || m.voimassaAlku <= loppu) && (!m.voimassaLoppu || m.voimassaLoppu >= alku))
    .map((m) => ({ id: m.id ?? null, teksti: m.teksti || '', kipualue: m.kipualue || null, valtettava: m.valtettava || null }));
  return { lista: tulos.sort((a, b) => (a.pvm < b.pvm ? -1 : a.pvm > b.pvm ? 1 : 0)), kipumuistit };
}

function palautumisOsa(historia, aika, viikonVoima) {
  const r = recovery(LIIKKEET, historia, aika);
  const vasyneet = Object.entries(r.lihakset).filter(([, x]) => x.tila === 'väsynyt').map(([k]) => k);
  const palautumassa = Object.entries(r.lihakset).filter(([, x]) => x.tila === 'palautumassa').map(([k]) => k);
  const huomiot = [];
  if (vasyneet.length) huomiot.push(`Väsyneet lihakset viikon lopussa: ${luettelo(vasyneet)}.`);
  const sarjat = viikonVoima.flatMap((t) => (t.liikkeet || []).flatMap((tl) => (tl.sarjat || []).filter(onTyosarja)));
  const rirArvot = sarjat.filter((s) => Number.isFinite(s.rir));
  const nollat = rirArvot.filter((s) => s.rir === 0).length;
  const rirNollaPros = rirArvot.length ? Math.round((nollat / rirArvot.length) * 100) : 0;
  if (rirArvot.length && rirNollaPros >= 50) {
    huomiot.push(`${rirNollaPros} % sarjoista tehtiin uupumukseen asti (RIR 0), mikä pidentää palautumista.`);
  }
  if (!huomiot.length) huomiot.push('Ei huomioitavaa, palautuminen ja kuormitus kunnossa.');
  return { vasyneet, palautumassa, rirNollaPros, huomiot };
}

function tapahtumaOsa(tapahtuma, alku, loppu, tanaan, viikonAlku) {
  if (!tapahtuma || typeof tapahtuma !== 'object') return null;
  let viite = loppu < tanaan ? loppu : tanaan;
  if (viite < alku) viite = alku;
  const plan = eventPlan(tapahtuma, viite, { viikonAlku }) || eventPlan(tapahtuma, alku, { viikonAlku });
  if (!plan || !plan.nykyinen) return null;
  const v = plan.viikot.find((x) => x.alku === alku) || plan.nykyinen;
  return {
    tyyppi: plan.tapahtuma.tyyppi,
    nimi: plan.tapahtuma.nimi,
    otsikko: plan.otsikko,
    pvm: plan.tapahtuma.pvm,
    divisioona: plan.tapahtuma.divisioona,
    jakso: v.jakso,
    jaksoNimi: v.jaksoNimi,
    kerroin: v.kerroin,
    kevennysviikko: v.kevennysviikko,
    painopiste: v.painopiste,
    viikkojaJaljella: plan.viikot.length - 1 - v.indeksi,
  };
}

function rajaa(teksti, max) {
  if (teksti.length <= max) return teksti;
  return `${teksti.slice(0, max - 1).trimEnd()}…`;
}

function tekstiyhteenveto(r) {
  const rivit = [];
  rivit.push(`Viikkoraportti ${valiTeksti(r.viikonAlku, r.viikonLoppu)} · ${r.kayttaja}`);
  const y = r.yhteenveto;
  const muut = y.aktiviteetteja
    ? ` ja ${y.aktiviteetteja === 1 ? '1 muu aktiviteetti' : `${y.aktiviteetteja} muuta aktiviteettia`}`
    : '';
  const voimaTeksti = y.voimatreeneja === 1 ? '1 voimatreeni' : `${y.voimatreeneja} voimatreeniä`;
  rivit.push(`Treenit: ${voimaTeksti}${muut}, yhteensä ${kestoTeksti(y.kestoMin)}, ${y.sarjat} työsarjaa.`);
  const st = r.sarjatavoitteet;
  rivit.push(`Sarjatavoitteet: ${st.kokonaisPros} % (${st.ryhmat.map((g) => `${g.nimi.toLowerCase()} ${g.pros} %`).join(', ')}).`);
  if (r.ennatykset.length) {
    const ens = r.ennatykset.slice(0, 3).map((e) => `${e.nimi} ${ENNATYS_NIMI[e.tyyppi] || e.tyyppi} ${luku(e.arvo)} ${e.yksikko}`);
    const lisa = r.ennatykset.length > 3 ? ` ja ${r.ennatykset.length - 3} muuta` : '';
    rivit.push(`Ennätykset (${r.ennatykset.length}): ${ens.join('; ')}${lisa}.`);
  } else {
    rivit.push('Ennätykset: ei uusia tällä viikolla.');
  }
  const voimat = r.voimanMuutos.filter((v) => v.muutosPros != null);
  if (voimat.length) {
    rivit.push(`Arvioitu voima: ${voimat.map((v) => `${v.nimi} ${luku(v.nyt)} ${v.yksikko} (${v.muutosPros >= 0 ? '+' : ''}${luku(v.muutosPros)} %)`).join(', ')}.`);
  }
  rivit.push(`Palautuminen: ${r.palautuminen.huomiot.join(' ')}`);
  if (r.vaihdetut.length) {
    const osat = r.vaihdetut.slice(0, 4).map((v) => (v.toiminto === 'ohitettu'
      ? `${v.nimi} ohitettu (${v.syyTeksti})`
      : `${v.nimi} → ${v.korvaavaNimi} (${v.syyTeksti})`));
    rivit.push(`Vaihdot ja ohitukset: ${osat.join('; ')}${r.vaihdetut.length > 4 ? ` ja ${r.vaihdetut.length - 4} muuta` : ''}.`);
  }
  if (r.tapahtuma) {
    const t = r.tapahtuma;
    rivit.push(`Tavoite: ${t.otsikko}, ${t.jaksoNimi.toLowerCase()}${t.kevennysviikko ? ' (kevennysviikko)' : ''}, ${t.viikkojaJaljella} viikkoa jäljellä. ${t.painopiste}`);
  }
  const kommentti = r.kommentti.trim();
  const runko = rivit.join('\n');
  const loppu = '\n— Personal SuperPower';
  if (kommentti) {
    const tila = RAPORTTI_TEKSTI_MAX - runko.length - loppu.length - '\nKommentti: '.length;
    if (tila > 20) return rajaa(`${runko}\nKommentti: ${rajaa(kommentti, tila)}${loppu}`, RAPORTTI_TEKSTI_MAX);
  }
  return rajaa(`${runko}${loppu}`, RAPORTTI_TEKSTI_MAX);
}

// --- Julkinen funktio ---------------------------------------------------------------

/**
 * weeklyReport(tila, viikonAlku, nyt) → {
 *   viikonAlku, viikonLoppu, otsikko, kayttaja, valmentaja: { nimi, email } | null,
 *   treenit: [{ id, pvm, tyyppi, nimi, kestoMin, sarjat, volyymi, liikkeita, lihakset }],
 *   yhteenveto: { voimatreeneja, aktiviteetteja, kestoMin, sarjat, volyymi, aktiivisetPaivat },
 *   sarjatavoitteet: { kokonaisPros, muokattu, ryhmat: [{ ryhma, nimi, tehty, tavoite, jaljella, pros }],
 *                      lihakset: [{ lihas, tehty, tavoite, jaljella }] },
 *   ennatykset: [{ pvm, liikeId, nimi, tyyppi, arvo, aiempi, yksikko }],
 *   voimanMuutos: [{ liikeId, nimi, ennen, nyt, muutos, muutosPros, yksikko }]   (vertailuliikkeet),
 *   palautuminen: { vasyneet, palautumassa, rirNollaPros, huomiot: [teksti] },
 *   vaihdetut: [{ pvm, toiminto: 'vaihdettu'|'ohitettu', liikeId, nimi, korvaavaId, korvaavaNimi, syy, syyTeksti }],
 *   kipumuistit: [{ id, teksti, kipualue, valtettava }],
 *   kommentti, tapahtuma: { tyyppi, nimi, otsikko, pvm, divisioona, jakso, jaksoNimi, kerroin,
 *                           kevennysviikko, painopiste, viikkojaJaljella } | null,
 *   edellinen, seuraava (null, jos seuraava viikko on tulevaisuudessa), tekstiyhteenveto }
 * viikonAlku: mikä tahansa viikon päivä 'YYYY-MM-DD' (normalisoidaan profiilin viikonalkuun);
 * puuttuva → tämä viikko. Vain nyt-päivään mennessä tehdyt merkinnät lasketaan.
 * tekstiyhteenveto: suomenkielinen jako- ja sähköpostiteksti, enintään 1 500 merkkiä.
 */
export function weeklyReport(tila, viikonAlku, nyt) {
  const t = tila || {};
  const profiili = t.profiili || {};
  const asetus = profiili.viikonAlku || 'maanantai';
  const tanaan = tanaanPvm(nyt);
  const pyydetty = typeof viikonAlku === 'string' && PVM_RE.test(viikonAlku.slice(0, 10)) ? viikonAlku.slice(0, 10) : tanaan;
  const alku = weekStart(pyydetty, asetus);
  const loppu = addDays(alku, 6);
  const historia = (Array.isArray(t.historia) ? t.historia : [])
    .filter((x) => x && typeof x.pvm === 'string' && x.pvm <= tanaan);
  const viikon = historia
    .filter((x) => x.pvm >= alku && x.pvm <= loppu)
    .slice()
    .sort((a, b) => (a.pvm !== b.pvm ? (a.pvm < b.pvm ? -1 : 1) : String(a.aloitus || '').localeCompare(String(b.aloitus || ''))));
  const viikonVoima = viikon.filter(onVoimatreeni);

  const treenit = viikon.map((x) => treeniRivi(x, historia));
  const yhteenveto = {
    voimatreeneja: viikonVoima.length,
    aktiviteetteja: viikon.length - viikonVoima.length,
    kestoMin: treenit.reduce((s, x) => s + x.kestoMin, 0),
    sarjat: treenit.reduce((s, x) => s + x.sarjat, 0),
    volyymi: treenit.reduce((s, x) => s + x.volyymi, 0),
    aktiivisetPaivat: new Set(viikon.map((x) => x.pvm)).size,
  };

  // Sama laskenta kuin Kodissa ja Tavoitteissa (viikonTavoitteet): jakso vain, kun tapahtuman
  // kerroin on voimassa viikolla (ei ennen asetuspäivää eikä tapahtuman jälkeen).
  const { tavoitteet, suunnitelma, jakso } = viikonTavoitteet(t, alku);
  const tapahtumaTiedot = jakso ? tapahtumaOsa(profiili.tapahtuma, alku, loppu, tanaan, asetus) : null;
  const tapahtuma = tapahtumaTiedot
    ? { ...tapahtumaTiedot, jakso: jakso.jakso, jaksoNimi: jakso.jaksoNimi, kerroin: jakso.kerroin, kevennysviikko: jakso.kevennysviikko }
    : null;
  const edistys = weeklyProgress(historia, LIIKKEET, tavoitteet, alku);
  const sarjatavoitteet = {
    kokonaisPros: edistys.kokonaisPros,
    muokattu: !!(suunnitelma && suunnitelma.sarjatavoiteKertoimet) || !!(tapahtuma && tapahtuma.kerroin !== 1),
    ryhmat: Object.entries(edistys.ryhmat).map(([ryhma, g]) => ({ ryhma, nimi: RYHMA_NIMI[ryhma] || ryhma, ...g })),
    lihakset: Object.entries(edistys.lihakset).map(([lihas, m]) => ({ lihas, ...m })),
  };

  const ennatykset = viikonVoima.flatMap((x) => workoutSummary(x, LIIKKEET, historia).ennatykset
    .map((e) => ({ pvm: x.pvm, ...e })));

  const loppuRaja = loppu < tanaan ? loppu : tanaan;
  const voimanMuutos = [];
  for (const id of VERTAILULIIKKEET) {
    const l = haeLiike(id);
    if (!l) continue;
    const ennen = estimatedStrength(l, historia, addDays(alku, -1));
    const nytArvo = estimatedStrength(l, historia, loppuRaja);
    if (!nytArvo) continue;
    const muutos = ennen ? Math.round((nytArvo.arvo - ennen.arvo) * 10) / 10 : null;
    voimanMuutos.push({
      liikeId: id,
      nimi: l.nimi,
      ennen: ennen ? ennen.arvo : null,
      nyt: nytArvo.arvo,
      muutos,
      muutosPros: ennen && ennen.arvo > 0 ? Math.round(((nytArvo.arvo - ennen.arvo) / ennen.arvo) * 1000) / 10 : null,
      yksikko: nytArvo.yksikko,
    });
  }

  const aika = loppu < tanaan ? `${loppu}${RAPORTTI_ILTA}` : nyt;
  const palautuminen = palautumisOsa(historia, aika, viikonVoima);
  const { lista: vaihdetut, kipumuistit } = vaihdotJaOhitukset(viikon, t, alku, loppu);
  const kommentit = t.raporttiKommentit && typeof t.raporttiKommentit === 'object' ? t.raporttiKommentit : {};
  const kommentti = typeof kommentit[alku] === 'string' ? kommentit[alku] : '';
  const valmentaja = profiili.valmentaja && typeof profiili.valmentaja === 'object'
    ? { nimi: profiili.valmentaja.nimi || '', email: profiili.valmentaja.email || '' }
    : null;
  const kayttaja = (typeof profiili.nimi === 'string' && profiili.nimi.trim()) || 'Demokäyttäjä';
  const seuraava = addDays(alku, 7);

  const raportti = {
    viikonAlku: alku,
    viikonLoppu: loppu,
    otsikko: `Viikkoraportti ${valiTeksti(alku, loppu)}`,
    kayttaja,
    valmentaja,
    treenit,
    yhteenveto,
    sarjatavoitteet,
    ennatykset,
    voimanMuutos,
    palautuminen,
    vaihdetut,
    kipumuistit,
    kommentti,
    tapahtuma,
    edellinen: addDays(alku, -7),
    seuraava: seuraava <= weekStart(tanaan, asetus) ? seuraava : null,
  };
  raportti.tekstiyhteenveto = tekstiyhteenveto(raportti);
  return raportti;
}
