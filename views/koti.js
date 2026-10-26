// Koti (speksi 6.1, 4d, 4h, 4k C, 4l): tervehdys, tavoitetapahtuman aikajana, tämän päivän treeni,
// kalenterikortti, viikkonauha, viikkotavoite, liiga- ja haastekortit, kuukausikooste, muistirivi,
// progressiovinkki, valmentaja-, ohjelma- ja ravintokortit.
import { getState } from '../store.js?v=19a48e7';
import { seuraavaVaraus } from '../engine/schedule.js?v=19a48e7';
import { leagueWeek } from '../engine/league.js?v=19a48e7';
import { tanaanPvm } from '../seed.js?v=19a48e7';
import { LIIKKEET } from '../data.js?v=19a48e7';
import { el, svgEl, card, sectionTitle, hexRing, whyButton, formatWeight } from './ui.js?v=19a48e7';
import { viikonTavoitteet, weeklyProgress } from '../engine/targets.js?v=19a48e7';
import { recovery } from '../engine/recovery.js?v=19a48e7';
import { suggestNextSet } from '../engine/progression.js?v=19a48e7';
import { weekStart, addDays } from '../engine/util.js?v=19a48e7';
import { eventPlan } from '../engine/event.js?v=19a48e7';
import { rakennaPaiva } from './paiva.js?v=19a48e7';
import { challengeProgress, leaderboard } from '../engine/challenges.js?v=19a48e7';
import { palkki, edistysTeksti, kisaNimi } from './yhteiso.js?v=19a48e7';
import {
  openSwapSheet, swipeRow, vihjaaPyyhkaisy, vaihtoNappi, vaihtoRivi, taydennaVaihdettu,
  tallennaPaivanVaihto, palautaPaivanVaihto, ohitetutLista, kaytetytLiikkeet, kaikkiOhitettu,
} from './vaihto.js?v=19a48e7';

// Natiivi append ei litistä taulukoita eikä ohita null-arvoja, joten ne käsitellään tässä.
function lisaa(root, ...osat) {
  root.append(...osat.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
}

const RYHMA_NIMI = { tyonnot: 'Työnnöt', vedot: 'Vedot', jalat: 'Jalat' };
const RYHMA_VARI = { tyonnot: 'var(--push)', vedot: 'var(--pull)', jalat: 'var(--legs)' };
const VIIKONPAIVAT = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];
const VIIKONPAIVAT_PITKA = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];
const VINKKI_JARJESTYS = ['double-progression', 'deload', 'recovery', 'hold', 'rir-high', 'rir-zero', 'first-time'];
const VINKKI_OTSIKKO = {
  'double-progression': 'Aika nostaa painoa',
  deload: 'Kevennyksen paikka',
  recovery: 'Anna lihaksen palautua',
  hold: 'Tavoitteena yksi toisto lisää',
  'rir-high': 'Kuorma oli kevyt',
  'rir-zero': 'Jätä toisto varalle',
  'first-time': 'Uusi liike tänään',
};

const iso = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const viikonpaiva = (pvm) => new Date(pvm + 'T12:00:00Z').getUTCDay();
const pv = (pvm) => `${Number(pvm.slice(8, 10))}.${Number(pvm.slice(5, 7))}.`;

function ikoni(d, koko = 22) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true', class: 't8-ico' },
    svgEl('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function chevron() {
  return svgEl('svg', { class: 'chevron', viewBox: '0 0 8 14', width: 8, height: 14, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M1.5 1.5 6.5 7l-5 5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

// Suunnitelma, jonka päivät osuvat viikkoon [alku, alku + 7).
function suunnitelmaViikolle(suunnitelmat, alku) {
  const loppu = addDays(alku, 7);
  return suunnitelmat.find((s) => s && s.viikonAlku === alku)
    || suunnitelmat.find((s) => s && (s.paivat || []).some((p) => p.pvm >= alku && p.pvm < loppu))
    || null;
}

function voimassa(m, tanaan) {
  return m && (!m.voimassaAlku || m.voimassaAlku <= tanaan) && (!m.voimassaLoppu || tanaan <= m.voimassaLoppu);
}

// --- Osiot -----------------------------------------------------------------

function ylarivi(profiili, tanaan) {
  const nimi = (profiili.nimi || '').trim() || 'Demokäyttäjä';
  const tunti = new Date().getHours();
  const tervehdys = tunti < 10 ? 'Huomenta' : tunti < 17 ? 'Hei' : 'Iltaa';
  const nimikirjain = nimi.charAt(0).toUpperCase();
  return el('header', { class: 't8-home-head' },
    el('div', { class: 't8-home-greet' },
      el('div', { class: 't8-eyebrow' }, `${VIIKONPAIVAT_PITKA[viikonpaiva(tanaan)]} ${pv(tanaan)}`),
      el('h1', { class: 'page-title t8-home-title' }, `${tervehdys}, ${nimi}`)),
    el('a', { class: 't8-avatar', href: '#/profiili', 'aria-label': 'Profiili ja asetukset' }, nimikirjain));
}

// Tuleva muisti: alkaa myöhemmin kuin tänään (esim. valmentajan ensi viikon reissumuisti).
function tuleva(m, tanaan) {
  return m && m.voimassaAlku && m.voimassaAlku > tanaan;
}

function muistirivi(m, tulossa) {
  return el('a', { class: `t8-memory${tulossa ? ' t8-memory-tulossa' : ''}`, href: '#/valmentaja' },
    el('span', { class: 't8-memory-ico' }, ikoni('M12 3.5a6 6 0 0 0-3.5 10.9V17h7v-2.6A6 6 0 0 0 12 3.5zM9.5 20.5h5', 16)),
    el('span', { class: 't8-memory-text' }, m.teksti),
    tulossa
      ? el('span', { class: 't8-memory-tag' }, 'Tulossa', el('span', { class: 't8-memory-date' }, ` ${pv(m.voimassaAlku)}`))
      : el('span', { class: 't8-memory-tag' }, m.tyyppi === 'pysyvä' ? 'Muisti' : 'Voimassa'));
}

function muistirivit(muistit, tanaan) {
  const lista = muistit.filter((m) => voimassa(m, tanaan) && m.teksti);
  lista.sort((a, b) => (a.tyyppi === 'tilapäinen' ? 0 : 1) - (b.tyyppi === 'tilapäinen' ? 0 : 1));
  const tulevat = muistit.filter((m) => tuleva(m, tanaan) && m.teksti)
    .sort((a, b) => String(a.voimassaAlku).localeCompare(String(b.voimassaAlku)));
  if (!lista.length && !tulevat.length) return null;
  return el('div', { class: 't8-memory-list' },
    lista.slice(0, 2).map((m) => muistirivi(m, false)),
    tulevat.slice(0, 2).map((m) => muistirivi(m, true)));
}

// --- Tavoitetapahtuma (speksi 4k C) -------------------------------------------

const JAKSO_LUOKKA = { perus: 'is-perus', kovennus: 'is-kovennus', kevennys: 'is-kevennys', kisaviikko: 'is-kisa' };
const YKSIKKO_LYHYT = { kcal: 'kcal', osuutta: 'osuutta', toistoa: '' };

const kerroinTeksti = (k) => (Number.isFinite(k) ? k.toFixed(1).replace('.', ',') : '1,0');
const kmTeksti = (km) => String(Math.round(km * 10) / 10).replace('.', ',');

function paiviaTeksti(n) {
  if (n === 0) return 'Tänään!';
  if (n === 1) return 'Huomenna';
  return `${n} päivää`;
}

// Aikajanakortti: otsikko ja päivät jäljellä, viikot jaksojen väreinä (nykyinen korostettuna),
// selite ja tämän viikon painopiste sekä sarjatavoitteen kerroin.
function tapahtumaKortti(plan) {
  const v = plan.nykyinen;
  const viikot = plan.viikot.map((w) => el('span', {
    class: `ev-week ${JAKSO_LUOKKA[w.jakso]}${w.kevennysviikko ? ' is-deload' : ''}${w.indeksi === v.indeksi ? ' is-current' : ''}`,
    title: `${w.jaksoNimi}${w.kevennysviikko ? ' (kevennysviikko)' : ''}`,
  }));
  const selite = plan.jaksot.map((j) => el('span', { class: `ev-legend-item${j.jakso === v.jakso ? ' is-current' : ''}` },
    el('span', { class: `ev-legend-dot ${JAKSO_LUOKKA[j.jakso]}`, 'aria-hidden': 'true' }),
    `${j.nimi} ${j.viikkoja} vk`));
  const viikkoja = plan.viikkojaJaljella === 0 ? 'kisaviikko' : `${plan.viikkojaJaljella} ${plan.viikkojaJaljella === 1 ? 'viikko' : 'viikkoa'}`;
  return el('a', { class: 'card ev-card', href: '#/profiili?tapahtuma=1', 'aria-label': `Tavoitetapahtuma ${plan.otsikko}, ${paiviaTeksti(plan.paiviaJaljella)}. Muokkaa.` },
    el('div', { class: 'ev-card-head' },
      el('div', { class: 'ev-card-titles' },
        el('span', { class: 't8-eyebrow t8-eyebrow-accent' }, 'Tavoitetapahtuma'),
        el('span', { class: 'ev-card-title' }, `${plan.otsikko} – ${viikkoja}`)),
      el('span', { class: 'ev-days' }, paiviaTeksti(plan.paiviaJaljella))),
    el('div', {
      class: 'ev-band', role: 'img',
      'aria-label': `Jaksot: ${plan.jaksot.map((j) => `${j.nimi} ${j.viikkoja} viikkoa`).join(', ')}. Nyt: ${v.jaksoNimi}, viikko ${v.indeksi + 1}/${plan.viikot.length}.`,
    }, viikot),
    el('div', { class: 'ev-legend', 'aria-hidden': 'true' }, selite),
    el('div', { class: 'ev-now' },
      el('div', { class: 'ev-now-head' },
        el('span', { class: 'ev-now-title' }, `Tämä viikko: ${v.jaksoNimi}${v.kevennysviikko ? ' · kevennysviikko' : ''}`),
        el('span', { class: 'ev-factor' }, `Sarjatavoite × ${kerroinTeksti(v.kerroin)}`)),
      el('p', { class: 'ev-focus' }, v.painopiste)));
}

function tapahtumaKehotus() {
  return el('a', { class: 'card t8-link-card ev-prompt', href: '#/profiili?tapahtuma=1' },
    el('span', { class: 't8-link-ico' }, ikoni('M5 21V4.5M5 4.5h11l-2 3.5 2 3.5H5', 20)),
    el('div', { class: 't8-link-body' },
      el('div', { class: 't8-eyebrow' }, 'Tavoite'),
      el('div', { class: 't8-link-title' }, 'Aseta tavoitetapahtuma'),
      el('div', { class: 't8-link-sub' }, 'Esim. HYROX tai juoksukisa. Treenit jaksotetaan päivää kohti.')),
    chevron());
}

// Tämän päivän treenin rivin sarjateksti: juoksu kestona ja matkana, HYROX-asema yksikön kanssa.
function riviSarjat(r) {
  if (r.tyyppi === 'kesto') {
    const km = Number.isFinite(r.tavoite.matkaKm) && r.tavoite.matkaKm > 0 ? ` · ${kmTeksti(r.tavoite.matkaKm)} km` : '';
    return `${r.tavoite.kestoMin} min${km}`;
  }
  const t = r.tavoite;
  const haarukka = t.toistoMin === t.toistoMax ? `${t.toistoMin}` : `${t.toistoMin}–${t.toistoMax}`;
  const yksikko = YKSIKKO_LYHYT[r.liike.toistoYksikko || r.toistoYksikko] || '';
  return `${t.sarjat} × ${haarukka}${yksikko ? ` ${yksikko}` : ''}`;
}

function tapahtumaMerkki(p) {
  const tyyppi = p.tapahtuma && p.tapahtuma.tyyppi;
  return el('span', { class: 'ev-badge' }, tyyppi === 'hyrox' ? 'HYROX' : 'Tavoite');
}

// Liikkeen vaihto (speksi 4j): pyyhkäisy tai ⇄-painike avaa vaihtolaatikon; vaihto tallentuu
// päivän vaihtoihin (paivanVaihdot). Käynnissä olevan treenin aikana Kodin lista on vain luku.
// Tapahtuman rivit (HYROX-asemat ja juoksu, speksi 4k C) korostetaan merkillä; niitä ei vaihdeta
// Kodissa, koska päivän vaihdot koskevat ohjelman liikkeitä.
function treeniLista({ p, state, tanaan, kaynnissa, vihjeet }) {
  // Vaihtoehdoista karsitaan sekä nykyiset että vaihdettujen rivien alkuperäiset liikkeet.
  const paivanLiikkeet = kaytetytLiikkeet(p.rivit);
  const rivit = p.rivit.map((r, i) => {
    if (r.tapahtuma) {
      return el('li', { class: 'vx-li' }, el('div', { class: `t8-today-item ev-today${r.tyyppi === 'kesto' ? ' is-run' : ''}` },
        el('span', { class: 't8-today-num' }, String(i + 1)),
        el('span', { class: 't8-today-main' },
          el('span', { class: 't8-today-name' }, r.liike.nimi, ' ', tapahtumaMerkki(p))),
        el('span', { class: 't8-today-sets' }, riviSarjat(r))));
    }
    const alkuperainen = r.vaihdettu ? r.vaihdettu.alkuperainen : r.liikeId;
    const vaihdettu = taydennaVaihdettu(r.vaihdettu, state, tanaan);
    const avaa = () => openSwapSheet({
      liikeId: r.liikeId, pvm: tanaan, konteksti: 'koti', paivanLiikkeet, laitteet: p.laitteet,
      onValittu: (korvaava, tieto) => tallennaPaivanVaihto(tanaan, alkuperainen, korvaava, tieto),
    });
    const merkki = vaihtoRivi({
      vaihdettu, liike: r.liike, laitteet: p.laitteet, eiVaihtoehtoa: r.eiVaihtoehtoa,
      onPalauta: !kaynnissa && vaihdettu && vaihdettu.syy === 'kayttaja' ? () => palautaPaivanVaihto(tanaan, alkuperainen, p.rivit) : null,
    });
    const rivi = el('div', { class: `t8-today-item${r.eiVaihtoehtoa ? ' is-skip' : ''}` },
      el('span', { class: 't8-today-num' }, String(i + 1)),
      el('span', { class: 't8-today-main' },
        el('span', { class: 't8-today-name' }, r.liike.nimi),
        merkki),
      el('span', { class: 't8-today-sets' }, riviSarjat(r)),
      kaynnissa ? null : vaihtoNappi(r.liike.nimi, avaa, `koti:${alkuperainen}`));
    if (kaynnissa) return el('li', { class: 'vx-li' }, rivi);
    const kaare = swipeRow(rivi, avaa);
    if (i === 0) vihjeet.push(vihjaaPyyhkaisy(kaare));
    return el('li', { class: 'vx-li' }, kaare);
  });
  return [
    el('ol', { class: 't8-today-list' }, rivit),
    kaynnissa ? null : ohitetutLista({ state, pvm: tanaan, ohjelmassa: p.paiva.liikkeet.map((x) => x.liikeId), rivit: p.rivit }),
  ];
}

// p = rakennaPaiva(): samat liikkeet, sarjat, toistot ja kesto kuin Treenin aloituksessa.
function treeniKortti({ p, state, tanaan, historia, kaynnissa, suunnitelmaTanaan, vihjeet }) {
  const { ohjelma, paiva } = p;
  const treenattuTanaan = historia.some((t) => t.pvm === tanaan && (t.tyyppi == null || t.tyyppi === 'voima'));
  const otsikko = treenattuTanaan ? 'Seuraava treeni' : 'Tämän päivän treeni';
  const lista = treeniLista({ p, state, tanaan, kaynnissa, vihjeet });
  let suunnitelmaHuomio = null;
  if (suunnitelmaTanaan && suunnitelmaTanaan.tyyppi && suunnitelmaTanaan.tyyppi !== 'treeni') {
    const teksti = suunnitelmaTanaan.tyyppi === 'laji'
      ? `Suunnitelmassa tänään: ${iso(suunnitelmaTanaan.laji || 'laji')}`
      : suunnitelmaTanaan.tyyppi === 'matka' ? 'Suunnitelmassa tänään: matkapäivä' : 'Suunnitelmassa tänään: lepo';
    suunnitelmaHuomio = el('div', { class: 't8-today-plan' }, teksti);
  }
  return el('section', { class: 'card t8-hero' },
    el('div', { class: 't8-hero-top' },
      el('span', { class: 't8-eyebrow t8-eyebrow-accent' }, otsikko),
      treenattuTanaan ? el('span', { class: 't8-pill t8-pill-ok' }, 'Tänään treenattu') : null),
    el('h2', { class: 't8-hero-title' }, paiva.nimi),
    el('div', { class: 't8-hero-meta' },
      el('span', null, ohjelma.nimi),
      el('span', { class: 't8-dot-sep', 'aria-hidden': 'true' }, '·'),
      el('span', null, `${p.rivit.length} liikettä`),
      el('span', { class: 't8-dot-sep', 'aria-hidden': 'true' }, '·'),
      el('span', null, `noin ${Number.isFinite(p.kokonaisMin) ? p.kokonaisMin : p.arvioMin} min`)),
    suunnitelmaHuomio,
    lista,
    // Kaikki liikkeet ohitettu (tai ilman vaihtoehtoa): ei Aloita-painiketta, vaan palautus.
    !kaynnissa && !p.rivit.some((r) => !r.eiVaihtoehtoa)
      ? kaikkiOhitettu({ state, pvm: tanaan, rivit: p.rivit })
      : el('a', { class: 'btn btn-primary t8-hero-btn', href: '#/treeni' },
        svgEl('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true' }, svgEl('path', { d: 'M8 5.5v13l10.5-6.5z', fill: 'currentColor' })),
        kaynnissa ? 'Jatka treeniä' : 'Aloita treeni'));
}

function viikkonauha({ otsikko, alku, tanaan, historia, suunnitelma, oikea }) {
  const solut = [];
  for (let i = 0; i < 7; i += 1) {
    const pvm = addDays(alku, i);
    const merkinnat = historia.filter((t) => t.pvm === pvm);
    const voima = merkinnat.some((t) => t.tyyppi == null || t.tyyppi === 'voima');
    const tuotu = !voima && merkinnat.length > 0;
    const sp = suunnitelma ? (suunnitelma.paivat || []).find((p) => p.pvm === pvm) : null;
    let alle = null;
    if (sp && sp.tyyppi === 'laji') alle = el('span', { class: 't8-week-tag t8-week-tag-laji' }, iso(sp.laji || 'Laji'));
    else if (sp && sp.tyyppi === 'matka') alle = el('span', { class: 't8-week-tag' }, 'Matka');
    let piste = null;
    if (voima) piste = el('span', { class: 't8-week-dot' });
    else if (tuotu) piste = el('span', { class: 't8-week-dot t8-week-dot-tuotu' });
    else if (sp && sp.tyyppi === 'treeni' && pvm >= tanaan) piste = el('span', { class: 't8-week-dot t8-week-dot-plan' });
    const tila = [voima ? 'treeni' : tuotu ? 'aktiviteetti' : '', sp && sp.tyyppi === 'laji' ? iso(sp.laji || 'laji') : '', sp && sp.tyyppi === 'matka' ? 'matka' : '']
      .filter(Boolean).join(', ');
    solut.push(el('div', {
      class: `t8-week-day${pvm === tanaan ? ' is-today' : ''}${pvm < tanaan ? ' is-past' : ''}`,
      'aria-label': `${VIIKONPAIVAT_PITKA[viikonpaiva(pvm)]} ${pv(pvm)}${tila ? ': ' + tila : ''}`,
      role: 'listitem',
    },
    el('span', { class: 't8-week-wd', 'aria-hidden': 'true' }, VIIKONPAIVAT[viikonpaiva(pvm)]),
    el('span', { class: 't8-week-num', 'aria-hidden': 'true' }, String(Number(pvm.slice(8, 10)))),
    el('span', { class: 't8-week-mark', 'aria-hidden': 'true' }, piste, alle)));
  }
  return el('section', { class: 'card t8-week' },
    el('div', { class: 't8-card-head' },
      el('span', { class: 't8-card-head-title' }, otsikko),
      oikea ? el('span', { class: 't8-card-head-value' }, oikea) : null),
    el('div', { class: 't8-week-grid', role: 'list' }, solut));
}

function tavoiteKortti(edistys, muokattu, jakso) {
  const ryhmat = Object.entries(edistys.ryhmat);
  const jaljessa = ryhmat
    .filter(([, r]) => r.tavoite > 0 && r.pros < 100)
    .sort((a, b) => a[1].pros - b[1].pros || b[1].jaljella - a[1].jaljella)[0];
  const ali = jaljessa
    ? `${RYHMA_NIMI[jaljessa[0]]}: ${jaljessa[1].jaljella} sarjaa jäljellä`
    : 'Kaikki ryhmät tavoitteessa';
  return el('a', { class: 'card t8-goal-card', href: '#/tavoitteet' },
    hexRing({
      segmentit: ['tyonnot', 'vedot', 'jalat'].map((k) => ({ pros: edistys.ryhmat[k].pros, vari: RYHMA_VARI[k] })),
      koko: 84,
    }),
    el('div', { class: 't8-goal-body' },
      el('div', { class: 't8-eyebrow' }, [
        'Viikkotavoite',
        muokattu ? ' · muokattu' : '',
        jakso ? ` · ${jakso.jaksoNimi.toLowerCase()} × ${kerroinTeksti(jakso.kerroin)}` : '',
      ].join('')),
      el('div', { class: 't8-goal-pct' }, String(edistys.kokonaisPros), el('span', { class: 't8-goal-pct-unit' }, ' %')),
      el('div', { class: 't8-goal-sub' }, ali)),
    chevron());
}

// Haasteet (speksi 4i): lähimpänä maalia oleva liitetty haaste ja oma sija aktiivisessa kaverihaasteessa.
function haasteetKortti(state, nyt) {
  const haasteet = (state.yhteiso && Array.isArray(state.yhteiso.haasteet) ? state.yhteiso.haasteet : [])
    .filter((h) => h && h.liittynyt);
  const aktiiviset = haasteet.map((h) => ({ h, p: challengeProgress(h, state, nyt) }))
    .filter((x) => x.p.alkanut && !x.p.paattynyt);
  if (!aktiiviset.length) {
    return el('a', { class: 'card t8-link-card', href: '#/yhteiso' },
      el('span', { class: 't8-link-ico' }, ikoni('M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M15.5 4.6a3.5 3.5 0 0 1 0 6.8M17.5 13.8a6.5 6.5 0 0 1 4 6.2', 20)),
      el('div', { class: 't8-link-body' },
        el('div', { class: 't8-eyebrow' }, 'Haasteet'),
        el('div', { class: 't8-link-title' }, 'Liity haasteeseen'),
        el('div', { class: 't8-link-sub' }, 'Kisaa kavereiden kanssa ja kerää merkkejä.')),
      chevron());
  }
  const tavoitteelliset = aktiiviset.filter((x) => x.h.tyyppi !== 'kaveri');
  const kesken = tavoitteelliset.filter((x) => !x.p.suoritettu);
  const lahin = (kesken.length ? kesken : tavoitteelliset).slice().sort((a, b) => b.p.pros - a.p.pros)[0] || null;
  const kaveri = aktiiviset.find((x) => x.h.tyyppi === 'kaveri');
  let sija = null;
  if (kaveri) {
    const lauta = leaderboard(kaveri.h, state, nyt, { tasapainotettu: !!kaveri.h.tasapainotus });
    const oma = lauta.find((r) => r.kayttaja);
    if (oma) sija = { teksti: `${kisaNimi(kaveri.h)}: ${oma.sija}./${lauta.length}`, karki: oma.sija === 1, tasap: !!kaveri.h.tasapainotus };
  }
  return el('a', { class: 'card yh-home', href: '#/yhteiso' },
    el('div', { class: 'yh-home-head' },
      el('span', { class: 't8-eyebrow t8-eyebrow-accent' }, 'Haasteet'),
      el('span', { class: 'yh-home-count' }, `${aktiiviset.length} käynnissä`),
      chevron()),
    lahin ? el('div', { class: 'yh-home-row' },
      el('span', { class: 'yh-home-name' }, lahin.h.nimi),
      el('span', { class: 'yh-home-value' }, lahin.p.suoritettu ? '✓' : edistysTeksti(lahin.h.mittari, lahin.p.arvo, lahin.p.tavoite))) : null,
    lahin ? palkki(lahin.p.pros, { valmis: lahin.p.suoritettu, label: `${lahin.h.nimi}: ${lahin.p.pros} %` }) : null,
    sija ? el('div', { class: `yh-home-rank${sija.karki ? ' is-first' : ''}` },
      ikoni('M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7', 16),
      el('span', null, sija.teksti),
      sija.tasap ? el('span', { class: 'yh-home-rank-sub' }, 'tasapainotettu') : null) : null);
}

// --- Kalenteri, liiga ja kuukausikooste (speksi 4l) -----------------------------------

const VKP_LYHYT = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const KUUKAUSI_SI = ['Tammikuusi', 'Helmikuusi', 'Maaliskuusi', 'Huhtikuusi', 'Toukokuusi', 'Kesäkuusi',
  'Heinäkuusi', 'Elokuusi', 'Syyskuusi', 'Lokakuusi', 'Marraskuusi', 'Joulukuusi'];

/**
 * kalenteriKorttiTiedot(state, nyt) → { varaus, teksti: 'Seuraava treeni: to 17.30 · Päivä B (kalenterissa)' } | null
 * Seuraava toteutumaton treenivaraus (seuraavaVaraus). Ilman varausta null ("Suunnittele viikkosi").
 */
export function kalenteriKorttiTiedot(state, nyt) {
  const v = seuraavaVaraus(state, nyt);
  if (!v) return null;
  const m = /T(\d{2}):(\d{2})/.exec(String(v.alku));
  const klo = m ? `${Number(m[1])}.${m[2]}` : '';
  const vkp = VKP_LYHYT[viikonpaiva(v.pvm)];
  return { varaus: v, teksti: `Seuraava treeni: ${vkp} ${klo}${v.ohjelmaPaiva ? ` · ${v.ohjelmaPaiva}` : ''} (kalenterissa)` };
}

/**
 * liigaAlue(viikko) → 'Nousualue' | 'Turvassa' | 'Putoamisalue'
 * Sijat 1–5 nousualueella ja 16–20 putoamisalueella. Ylimmästä tasosta ei nousta eikä alimmasta pudota,
 * ja käytössä oleva putkisuoja estää pudotuksen, joten silloin käyttäjä on turvassa.
 */
export function liigaAlue(viikko) {
  const sija = viikko && viikko.omaSija;
  if (!Number.isFinite(sija)) return null;
  if (sija <= viikko.nousuRaja && !viikko.ylinTaso) return 'Nousualue';
  if (sija >= viikko.putoamisRaja && !viikko.alinTaso && !viikko.suojaKaytossa) return 'Putoamisalue';
  return 'Turvassa';
}

const TASO_NIMI = { pronssi: 'Pronssi', hopea: 'Hopea', kulta: 'Kulta', platina: 'Platina', superpower: 'SuperPower' };
const TASO_INE = { pronssi: 'Pronssissa', hopea: 'Hopeassa', kulta: 'Kullassa', platina: 'Platinassa', superpower: 'SuperPowerissa' };
const TASO_ILL = { pronssi: 'Pronssiin', hopea: 'Hopeaan', kulta: 'Kultaan', platina: 'Platinaan', superpower: 'SuperPoweriin' };

/**
 * liigaTulosKortti(rivi) → { tyyppi: 'nousu'|'pysyi'|'putosi', otsikko, ali, alue } | null
 * Kodin "viikko vaihtui" -kortti liiga.odottavaTulos-rivistä ({ taso, uusiTaso, sija, pisteet, tulos,
 * suojattu, simuloitu? }). Esim. 'Nousit Kulta-liigaan! 🎉', 'Pysyit Hopeassa' tai
 * 'Putosit Pronssiin – uusi viikko, uusi mahdollisuus'.
 */
export function liigaTulosKortti(rivi) {
  if (!rivi || typeof rivi !== 'object') return null;
  const taso = TASO_NIMI[rivi.uusiTaso] ? rivi.uusiTaso : (TASO_NIMI[rivi.taso] ? rivi.taso : 'pronssi');
  let tyyppi = 'pysyi';
  let otsikko = rivi.suojattu ? `Putkisuoja piti sinut ${TASO_INE[taso]}` : `Pysyit ${TASO_INE[taso]}`;
  let alue = 'Pysyit';
  if (rivi.tulos === 'nousu') {
    tyyppi = 'nousu';
    otsikko = `Nousit ${TASO_NIMI[taso]}-liigaan! 🎉`;
    alue = 'Nousu';
  } else if (rivi.tulos === 'putosi') {
    tyyppi = 'putosi';
    otsikko = `Putosit ${TASO_ILL[taso]} – uusi viikko, uusi mahdollisuus`;
    alue = 'Pudotus';
  }
  const osat = ['Viikko vaihtui'];
  if (Number.isFinite(rivi.sija)) osat.push(`sija ${rivi.sija}.`);
  if (Number.isFinite(rivi.pisteet)) osat.push(`${rivi.pisteet} pistettä`);
  if (rivi.simuloitu) osat.push('demo');
  return { tyyppi, otsikko, ali: `${osat.join(' · ')} – katso tulos`, alue };
}

/**
 * koosteKorttiTiedot(state, tanaan) → { kk: 'YYYY-MM', otsikko: 'Syyskuusi on valmis', ali, nahty, href }
 * Demossa kortti näkyy aina edellisestä kuukaudesta; nähdyllä kuukaudella ali = 'Katso uudelleen'.
 */
export function koosteKorttiTiedot(state, tanaan) {
  const [y, m] = String(tanaan).split('-').map(Number);
  const ey = m === 1 ? y - 1 : y;
  const em = m === 1 ? 12 : m - 1;
  const kk = `${ey}-${String(em).padStart(2, '0')}`;
  const nahty = !!(state && state.koosteetNahty && state.koosteetNahty[kk]);
  return {
    kk,
    otsikko: `${KUUKAUSI_SI[em - 1]} on valmis`,
    ali: nahty ? 'Katso uudelleen' : 'Katso Treenikuukautesi',
    nahty,
    href: `#/kooste?kk=${kk}`,
  };
}

function kalenteriKortti(state, nyt) {
  const tieto = kalenteriKorttiTiedot(state, nyt);
  const ico = el('span', { class: 't8-link-ico' }, ikoni('M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4M8 14.5h3', 20));
  if (!tieto) {
    return el('a', { class: 'card t8-link-card kal-home', href: '#/kalenteri' },
      ico,
      el('div', { class: 't8-link-body' },
        el('div', { class: 't8-eyebrow' }, 'Kalenteri'),
        el('div', { class: 't8-link-title' }, 'Suunnittele viikkosi kalenteriin'),
        el('div', { class: 't8-link-sub' }, 'Valmentaja etsii kalenteristasi vapaat raot treeneille.')),
      chevron());
  }
  return el('a', { class: 'card t8-link-card kal-home is-booked', href: '#/kalenteri' },
    ico,
    el('div', { class: 't8-link-body' },
      el('div', { class: 't8-eyebrow t8-eyebrow-accent' }, 'Kalenteri'),
      el('div', { class: 't8-link-title kal-home-title' }, tieto.teksti),
      el('div', { class: 't8-link-sub' }, `${tieto.varaus.kestoMin} min${tieto.varaus.tiivistetty ? ' · tiivistetty' : ''}${tieto.varaus.siirretty ? ' · siirretty' : ''}`)),
    chevron());
}

function liigaKortti(state, nyt) {
  // Viikko vaihtui: tulos odottaa näyttämistä. Kortti avaa Liiga-välilehden, jossa koko ruudun
  // näkymä näytetään ja tulos tyhjennetään.
  const tulos = liigaTulosKortti(state && state.liiga && state.liiga.odottavaTulos);
  if (tulos) {
    const luokka = tulos.tyyppi === 'nousu' ? 'is-up' : tulos.tyyppi === 'putosi' ? 'is-down' : 'is-safe';
    return el('a', {
      class: `card t8-link-card lg-home lg-home-result is-${tulos.tyyppi}`, href: '#/yhteiso?tab=liiga',
      'aria-label': `${tulos.otsikko} ${tulos.ali}. Avaa liiga.`,
    },
    el('span', { class: 't8-link-ico' }, ikoni('M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7', 20)),
    el('div', { class: 't8-link-body' },
      el('div', { class: 'lg-home-row' },
        el('span', { class: 't8-eyebrow t8-eyebrow-accent' }, 'Treeniliiga'),
        el('span', { class: `lg-home-zone ${luokka}` }, tulos.alue)),
      el('div', { class: 't8-link-title' }, tulos.otsikko),
      el('div', { class: 't8-link-sub' }, tulos.ali)),
    chevron());
  }
  let viikko = null;
  try {
    viikko = leagueWeek(state, nyt);
  } catch (err) {
    console.error(err);
    return null;
  }
  const ico = el('span', { class: 't8-link-ico' }, ikoni('M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7', 20));
  if (!viikko.osallistuu || !Number.isFinite(viikko.omaSija)) {
    return el('a', { class: 'card t8-link-card', href: '#/yhteiso?tab=liiga' },
      ico,
      el('div', { class: 't8-link-body' },
        el('div', { class: 't8-eyebrow' }, 'Treeniliiga'),
        el('div', { class: 't8-link-title' }, 'Et osallistu liigaan'),
        el('div', { class: 't8-link-sub' }, 'Viikkoliigan voi ottaa käyttöön Profiilissa.')),
      chevron());
  }
  const alue = liigaAlue(viikko);
  const luokka = alue === 'Nousualue' ? 'is-up' : alue === 'Putoamisalue' ? 'is-down' : 'is-safe';
  const pisteet = viikko.omatPisteet ? viikko.omatPisteet.yhteensa : 0;
  const [, lm, ld] = viikko.loppuu.split('-').map(Number);
  return el('a', {
    class: 'card t8-link-card lg-home', href: '#/yhteiso?tab=liiga',
    'aria-label': `Treeniliiga ${viikko.tasoNimi}: sija ${viikko.omaSija}/${viikko.sijoitukset.length}, ${alue.toLowerCase()}. Avaa liiga.`,
  },
  ico,
  el('div', { class: 't8-link-body' },
    el('div', { class: 't8-eyebrow t8-eyebrow-accent' }, `Treeniliiga · ${viikko.tasoNimi}`),
    el('div', { class: 'lg-home-row' },
      el('span', { class: 't8-link-title' }, `Sija ${viikko.omaSija}/${viikko.sijoitukset.length}`),
      el('span', { class: `lg-home-zone ${luokka}` }, alue)),
    el('div', { class: 't8-link-sub' }, `${pisteet} pistettä · viikko päättyy ${VKP_LYHYT[viikonpaiva(viikko.loppuu)]} ${ld}.${lm}.${viikko.suojaKaytossa ? ' · putkisuoja käytössä' : ''}`)),
  chevron());
}

function koosteKortti(state, tanaan) {
  const t = koosteKorttiTiedot(state, tanaan);
  return el('a', { class: `card t8-link-card rc-home${t.nahty ? ' is-seen' : ''}`, href: t.href },
    el('span', { class: 't8-link-ico rc-home-ico' }, ikoni('M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z', 20)),
    el('div', { class: 't8-link-body' },
      el('div', { class: 't8-eyebrow t8-eyebrow-accent' }, 'Treenikuukautesi'),
      el('div', { class: 't8-link-title' }, t.otsikko),
      el('div', { class: 't8-link-sub' }, t.ali)),
    chevron());
}

function liikekirjastoKortti() {
  return el('a', { class: 'card t8-link-card', href: '#/liikkeet' },
    el('span', { class: 't8-link-ico' }, ikoni('M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11', 20)),
    el('div', { class: 't8-link-body' },
      el('div', { class: 't8-eyebrow' }, 'Liikekirjasto'),
      el('div', { class: 't8-link-title' }, 'Kaikki liikkeet'),
      el('div', { class: 't8-link-sub' }, `${LIIKKEET.length} liikettä ohjeineen ja omine ennätyksineen`)),
    chevron());
}

function vinkkiKortti({ p, historia, profiili, palautuminen }) {
  const ehdotukset = [];
  for (const r of p.rivit) {
    if (r.tapahtuma || r.tyyppi === 'kesto') continue; // HYROX-asemat ja juoksu eivät saa painovinkkiä
    const l = r.liike;
    const kerrat = [];
    for (const t of historia) {
      for (const tl of t.liikkeet || []) {
        if (tl.liikeId === l.id) kerrat.push({ pvm: t.pvm, tyyppi: t.tyyppi, sarjat: tl.sarjat || [] });
      }
    }
    try {
      const e = suggestNextSet({
        liike: l,
        tavoite: r.tavoite,
        edellisetKerrat: kerrat,
        tamanKerranSarjat: [],
        kokemus: profiili.kokemus || 'keskitaso',
        lihasTila: palautuminen && palautuminen.lihakset[l.lihasryhma] ? palautuminen.lihakset[l.lihasryhma].tila : undefined,
      });
      if (e) ehdotukset.push({ l, e });
    } catch (err) {
      console.error(err);
    }
  }
  if (!ehdotukset.length) return null;
  // Ensisijaisesti painoliikkeet (ohjelman järjestyksessä pääliikkeet ensin), sitten syyn mukaan.
  const sija = (x) => {
    const i = VINKKI_JARJESTYS.indexOf(x.e.syy);
    return (i < 0 ? 99 : i) + (x.l.valine === 'kehonpaino' ? 50 : 0);
  };
  const { l, e } = ehdotukset.slice().sort((a, b) => sija(a) - sija(b))[0];
  const yksikko = profiili.yksikko || 'kg';
  const kehonpaino = l.valine === 'kehonpaino';
  const arvo = kehonpaino && !e.paino
    ? `${e.toistot} toistoa`
    : `${kehonpaino ? '+' : ''}${formatWeight(e.paino, yksikko)} × ${e.toistot}`;
  const miksi = e.miksi || '';
  const piste = miksi.indexOf('. ');
  const ensimmainenLause = piste > 0 ? miksi.slice(0, piste + 1) : miksi;
  return el('section', { class: 'card t8-tip' },
    el('div', { class: 't8-tip-head' },
      el('span', { class: 't8-tip-ico' }, ikoni('M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z', 18)),
      el('span', { class: 't8-eyebrow t8-eyebrow-accent' }, 'Progressiovinkki')),
    el('h3', { class: 't8-tip-title' }, VINKKI_OTSIKKO[e.syy] || 'Seuraava askel'),
    el('div', { class: 't8-tip-main' },
      el('span', { class: 't8-tip-ex' }, l.nimi),
      el('span', { class: 't8-tip-val' }, arvo)),
    el('p', { class: 't8-tip-text' }, ensimmainenLause),
    el('div', { class: 't8-tip-foot' },
      whyButton(e.miksi),
      el('span', { class: 't8-tip-note' }, 'Tuotteessa tekoäly personoi nämä säännöt.')));
}

function valmentajaKortti() {
  return el('a', { class: 'card t8-coach', href: '#/valmentaja' },
    el('div', { class: 't8-coach-row' },
      el('span', { class: 't8-coach-ico' }, ikoni('M20.5 11.5a8 8 0 0 1-11.7 7.1L3.5 20l1.4-4.9A8 8 0 1 1 20.5 11.5zM12.5 7.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z', 22)),
      el('div', { class: 't8-coach-body' },
        el('div', { class: 't8-coach-title' }, 'Kysy valmentajalta'),
        el('div', { class: 't8-coach-sub' }, 'Reissu, kipu tai kiire? Valmentaja sovittaa viikkosi ja muistaa sen.')),
      chevron()),
    el('div', { class: 't8-coach-bubble' }, '”Ensi viikolla olen reissussa ja pelaan 3 kertaa padelia”'));
}

function ohjelmaKortti(ohjelma) {
  return el('a', { class: 'card t8-link-card', href: '#/ohjelmat' },
    el('span', { class: 't8-link-ico' }, ikoni('M4 6.5h16M4 12h16M4 17.5h10', 20)),
    el('div', { class: 't8-link-body' },
      el('div', { class: 't8-eyebrow' }, 'Ohjelmasi'),
      el('div', { class: 't8-link-title' }, ohjelma.nimi),
      el('div', { class: 't8-link-sub' }, `${ohjelma.paivat.length} treenipäivää · taso: ${ohjelma.tasot}`)),
    chevron());
}

function ravintoKortti() {
  return el('section', { class: 'card t8-soon' },
    el('span', { class: 't8-link-ico t8-soon-ico' }, ikoni('M7 3.5v7.5a2.5 2.5 0 0 0 5 0V3.5M9.5 3.5v17M17 20.5V3.5c-2 1-3 3.5-3 6.5v3h3', 20)),
    el('div', { class: 't8-link-body' },
      el('div', { class: 't8-soon-head' },
        el('span', { class: 't8-link-title' }, 'Ravinto'),
        el('span', { class: 't8-pill' }, 'Tulossa')),
      el('div', { class: 't8-link-sub' }, 'Proteiinitavoite ja ateriat treeniesi tueksi.')));
}

// --- Näkymä ----------------------------------------------------------------

export function render(root) {
  const state = getState() || {};
  const profiili = state.profiili || {};
  const historia = (state.historia || []).filter(Boolean);
  const suunnitelmat = state.viikkosuunnitelmat || [];
  const tanaan = tanaanPvm(new Date().toISOString());
  const viikonAlku = profiili.viikonAlku === 'sunnuntai' ? 'sunnuntai' : 'maanantai';
  const alku = weekStart(tanaan, viikonAlku);
  const ensiAlku = addDays(alku, 7);
  // Sama päivän rakennus kuin Treenin aloituksessa (ohjelmapäivä ohjelmaId:n mukaan, välineet, kesto).
  const p = rakennaPaiva(state, new Date().toISOString());
  const ohjelma = p.ohjelma;

  const tamaSuunnitelma = suunnitelmaViikolle(suunnitelmat, alku);
  const ensiSuunnitelma = suunnitelmaViikolle(suunnitelmat, ensiAlku);
  const suunnitelmaTanaan = tamaSuunnitelma ? (tamaSuunnitelma.paivat || []).find((p) => p.pvm === tanaan) : null;

  // Sarjatavoitteet viikon suunnitelmalla ja tavoitetapahtuman jakson kertoimella (speksi 4d, 4k C).
  const { tavoitteet, jakso: tavoiteJakso } = viikonTavoitteet(state, alku, { suunnitelma: tamaSuunnitelma });
  const edistys = weeklyProgress(historia, LIIKKEET, tavoitteet, alku);

  let palautuminen = null;
  try {
    palautuminen = recovery(LIIKKEET, historia, new Date().toISOString());
  } catch (err) {
    console.error(err);
  }

  const loppu = addDays(alku, 7);
  const paivia = new Set(historia.filter((t) => t.pvm >= alku && t.pvm < loppu).map((t) => t.pvm)).size;
  const tavoitePaivat = Number.isFinite(profiili.treenitViikossa) ? profiili.treenitViikossa : 3;

  let tapahtumaPlan = null;
  try {
    tapahtumaPlan = profiili.tapahtuma ? eventPlan(profiili.tapahtuma, tanaan, { viikonAlku }) : null;
  } catch (err) {
    console.error(err);
  }

  const nyt = new Date().toISOString();
  const vihjeet = [];
  // Järjestys: tavoitetapahtuma ja tämän päivän treeni ylimpänä, sitten viikko (kalenteri, viikkonauha,
  // viikkotavoite, liiga ja haasteet) ja lopuksi kuukausikooste, valmentaja ja muut kortit.
  lisaa(root,
    ylarivi(profiili, tanaan),
    tapahtumaPlan && tapahtumaPlan.nykyinen ? tapahtumaKortti(tapahtumaPlan) : null,
    muistirivit(state.muistit || [], tanaan),
    treeniKortti({ p, state, tanaan, historia, kaynnissa: !!state.kaynnissa, suunnitelmaTanaan, vihjeet }),
    sectionTitle('Tämä viikko'),
    kalenteriKortti(state, nyt),
    viikkonauha({
      otsikko: tamaSuunnitelma ? 'Viikkosi · muokattu' : 'Viikkosi',
      alku, tanaan, historia, suunnitelma: tamaSuunnitelma,
      oikea: `${paivia} / ${tavoitePaivat} päivää`,
    }),
    ensiSuunnitelma && ensiSuunnitelma !== tamaSuunnitelma
      ? viikkonauha({ otsikko: 'Ensi viikko · suunnitelma', alku: ensiAlku, tanaan, historia, suunnitelma: ensiSuunnitelma, oikea: `${pv(ensiAlku)}–${pv(addDays(ensiAlku, 6))}` })
      : null,
    tavoiteKortti(edistys, !!tamaSuunnitelma, tavoiteJakso),
    liigaKortti(state, nyt),
    haasteetKortti(state, nyt),
    sectionTitle('Sinulle'),
    koosteKortti(state, tanaan),
    valmentajaKortti(),
    tapahtumaPlan && tapahtumaPlan.nykyinen ? null : tapahtumaKehotus(),
    vinkkiKortti({ p, historia, profiili, palautuminen }),
    ohjelmaKortti(ohjelma),
    liikekirjastoKortti(),
    ravintoKortti(),
  );
  return () => vihjeet.forEach((peru) => peru());
}
