// Edistyminen (speksi 6.4, 4b ja 4b-2): välilehdet Tulokset ja Palautuminen.
// Tulokset: Treeniscore-mittari, ryhmäkortit, vertailuliikkeet, kehonkoostumus ja ennätykset.
// Palautuminen: käännettävä kehokartta ja lihaskohtainen palautumistieto.
import { getState, update } from '../store.js';
import { tanaanPvm } from '../seed.js';
import { LIIKKEET, VERTAILULIIKKEET, RYHMAT, LIHASRYHMAT, liike as haeLiike } from '../data.js';
import {
  muscleStrength, treeniscore, scoreTrend, estimatedStrength, exerciseRecords, recovery, addDays,
} from '../engine.js';
import { el, svgEl, card, sectionTitle, sheet, whyButton, segmented, formatWeight } from './ui.js';
import { bodyMap, PUOLET } from './bodymap.js';

const KG_LB = 2.20462;

const RYHMA_NIMET = { tyonnot: 'Työnnöt', vedot: 'Vedot', jalat: 'Jalat' };
const RYHMA_VARIT = { tyonnot: 'var(--push)', vedot: 'var(--pull)', jalat: 'var(--legs)' };
const TILA_NIMET = { väsynyt: 'Väsynyt', palautumassa: 'Palautumassa', palautunut: 'Palautunut' };
const TILA_LUOKKA = { väsynyt: 'is-fatigued', palautumassa: 'is-recovering', palautunut: 'is-recovered' };
const VIIKKOJA_KAAVIOSSA = 12;

// Näkymän muisti piirtojen välillä (statechange piirtää näkymän uudelleen).
let muistiTab = 'tulokset';
let muistiPuoli = null;
let muistiLihas = null;
const avoimetRyhmat = new Set();
let kaikkiEnnatykset = false;

// ---------------------------------------------------------------------------
// Apurit

function isoAlku(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function luku(n, desimaaleja = 1) {
  return Number(n).toLocaleString('fi-FI', { maximumFractionDigits: desimaaleja });
}

// Painon numero valitussa yksikössä (ilman yksikköä).
function painoLuku(kg, yksikko) {
  return yksikko === 'lb' ? luku(kg * KG_LB, 1) : luku(kg, 1);
}

function lyhytPvm(pvm) {
  const [, m, d] = pvm.split('-').map(Number);
  return `${d}.${m}.`;
}

function aikaSitten(tunnit) {
  if (!Number.isFinite(tunnit)) return '–';
  if (tunnit < 1) return 'alle tunti sitten';
  if (tunnit < 48) return `${Math.round(tunnit)} h sitten`;
  return `${Math.floor(tunnit / 24)} pv sitten`;
}

function lueTab() {
  const q = location.hash.split('?')[1] || '';
  const tab = new URLSearchParams(q).get('tab');
  if (tab === 'palautuminen' || tab === 'tulokset') return tab;
  return muistiTab;
}

function ikoni(d, { koko = 18, leveys = 2 } = {}) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true', class: 'ico' },
    ...[].concat(d).map((p) => svgEl('path', {
      d: p, fill: 'none', stroke: 'currentColor', 'stroke-width': leveys, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })));
}

function chevronIkoni() {
  return svgEl('svg', { class: 'chevron', viewBox: '0 0 8 14', width: 8, height: 14, 'aria-hidden': 'true' },
    svgEl('path', { d: 'M1.5 1.5 6.5 7l-5 5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

// Trendimerkki: keltainen nuoli ylös tai alas, tasaisella harmaa viiva.
function trendiMerkki(suunta) {
  if (suunta === 'nousu' || suunta === 'lasku') {
    const ylos = suunta === 'nousu';
    return el('span', { class: `trend-badge is-${suunta}`, role: 'img', 'aria-label': ylos ? 'Trendi: nousussa' : 'Trendi: laskussa' },
      svgEl('svg', { viewBox: '0 0 12 12', width: 12, height: 12, 'aria-hidden': 'true' },
        svgEl('path', { d: ylos ? 'M6 2 10.5 9.5h-9z' : 'M6 10 1.5 2.5h9z', fill: 'currentColor' })));
  }
  return el('span', { class: 'trend-badge is-flat', role: 'img', 'aria-label': 'Trendi: tasainen' },
    svgEl('svg', { viewBox: '0 0 12 12', width: 12, height: 12, 'aria-hidden': 'true' },
      svgEl('path', { d: 'M2.5 6h7', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round' })));
}

function osioOtsikko(teksti, ...lisat) {
  return el('div', { class: 'sec-head' }, sectionTitle(teksti), ...lisat);
}

// ---------------------------------------------------------------------------
// Treeniscore

const SCORE_SELITYS = 'Treeniscore kertoo voimatasosi yhdellä luvulla. Jokaiselle lihasryhmälle lasketaan '
  + 'lihasvoima (mVoima) asteikolla 0–100: liikkeen arvioitu maksimi suhteutetaan viitetasoon, joka on '
  + 'liikekohtainen kerroin kertaa kehonpainosi. 50 tarkoittaa viitetasoa ja 100 sen kaksinkertaista.\n\n'
  + 'Työnnöt, vedot ja jalat ovat lihastensa keskiarvoja, ja Treeniscore on näiden kolmen keskiarvo. '
  + 'Luku avautuu, kun jokaiselle lihasryhmälle on kirjattu vähintään 6 sarjaa kuuden viikon aikana.\n\n'
  + 'Trendi vertaa lukua neljän viikon takaiseen. Jos liikettä ei ole tehty yli kahteen viikkoon, arvio laskee '
  + 'hieman joka viikko (enintään 10 %) ja palaa ennalleen, kun treenaat taas.\n\n'
  + 'Viitetasot ovat demon oletuksia.';

function mittari(arvo) {
  const n = Number.isFinite(arvo) ? Math.max(0, Math.min(100, arvo)) : 0;
  const wrap = el('div', {
    class: `ts-gauge${Number.isFinite(arvo) ? '' : ' is-locked'}`,
    role: 'img',
    'aria-label': Number.isFinite(arvo) ? `Treeniscore ${arvo} / 100` : 'Treeniscore lukittu',
  });
  for (let i = 0; i < 10; i++) {
    const osuus = Math.max(0, Math.min(1, (n - i * 10) / 10));
    wrap.append(el('span', { class: 'ts-bar', 'aria-hidden': 'true' },
      osuus > 0 ? el('span', { class: 'ts-fill', style: `width:${Math.round(osuus * 100)}%` }) : null));
  }
  return wrap;
}

function scoreKortti(ts, trendi) {
  const info = whyButton(SCORE_SELITYS);
  info.replaceChildren(el('span', { class: 'ts-info-icon', 'aria-hidden': 'true' }, 'i'));
  info.classList.add('ts-info');
  info.setAttribute('aria-label', 'Mikä Treeniscore on?');

  const otsake = el('div', { class: 'ts-head' }, el('span', { class: 'ts-label' }, 'Treeniscore'), info);

  if (ts.kokonais !== null) {
    return el('div', { class: 'card ts-card' },
      otsake,
      el('div', { class: 'ts-value-row' },
        el('span', { class: 'ts-number' }, String(ts.kokonais)),
        trendiMerkki(trendi.suunta),
        el('span', { class: 'ts-scale muted' }, '/ 100')),
      mittari(ts.kokonais),
      el('p', { class: 'ts-sub muted small' }, '50 = viitetaso. Kolmen lihasryhmän voima keskimäärin.'));
  }

  const avattu = 9 - ts.puuttuvat.length;
  return el('div', { class: 'card ts-card' },
    otsake,
    el('div', { class: 'ts-locked' },
      el('span', { class: 'ts-lock' }, ikoni(['M7 11V8a5 5 0 0 1 10 0v3', 'M5.5 11h13v9.5h-13z'], { koko: 22 })),
      el('p', { class: 'ts-locked-text' }, 'Treenaa kaikkia lihasryhmiä avataksesi Treeniscoren')),
    mittari(null),
    el('div', { class: 'ts-progress' },
      el('div', { class: 'ts-progress-row small' },
        el('span', null, 'Avattu'),
        el('span', { class: 'muted' }, `${avattu}/9 lihasryhmää`)),
      el('div', { class: 'meter' }, el('span', { style: `width:${Math.round((avattu / 9) * 100)}%` }))),
    el('p', { class: 'small muted ts-missing-title' }, 'Puuttuvat lihasryhmät'),
    el('div', { class: 'chips' }, ...ts.puuttuvat.map((l) => el('span', { class: 'chip chip-static' }, isoAlku(l)))));
}

// ---------------------------------------------------------------------------
// Ryhmäkortit

function ryhmaKortti(ryhma, arvo, trendi, mNyt) {
  const auki = avoimetRyhmat.has(ryhma);
  const runko = el('div', { class: 'grp-body', hidden: !auki },
    ...RYHMAT[ryhma].map((lihas) => {
      const m = mNyt[lihas] || { arvo: null, sarjoja: 0, lukittu: true };
      const oikea = m.lukittu
        ? el('span', { class: 'grp-locked small' },
          ikoni(['M7 11V8a5 5 0 0 1 10 0v3', 'M5.5 11h13v9.5h-13z'], { koko: 14 }),
          `Lukittu · ${Math.min(m.sarjoja, 6)}/6 sarjaa`)
        : el('span', { class: 'grp-mval' },
          el('span', { class: 'meter meter-sm' }, el('span', { style: `width:${m.arvo ?? 0}%;background:${RYHMA_VARIT[ryhma]}` })),
          el('b', null, m.arvo === null ? '–' : String(m.arvo)));
      return el('div', { class: 'grp-row' }, el('span', { class: 'grp-mname' }, isoAlku(lihas)), oikea);
    }));
  const nappi = el('button', {
    class: 'grp-head',
    type: 'button',
    'aria-expanded': String(auki),
    onClick: () => {
      const uusi = runko.hidden;
      runko.hidden = !uusi;
      nappi.setAttribute('aria-expanded', String(uusi));
      if (uusi) avoimetRyhmat.add(ryhma);
      else avoimetRyhmat.delete(ryhma);
    },
  },
  el('span', { class: 'grp-dot', style: `background:${RYHMA_VARIT[ryhma]}`, 'aria-hidden': 'true' }),
  el('span', { class: 'grp-name' }, RYHMA_NIMET[ryhma]),
  arvo === null
    ? el('span', { class: 'grp-value is-locked' }, 'Lukittu')
    : el('span', { class: 'grp-value' }, el('b', null, String(arvo)), el('small', null, 'mVOIMA')),
  arvo === null ? null : trendiMerkki(trendi.suunta),
  el('span', { class: 'grp-chev', 'aria-hidden': 'true' }, chevronIkoni()));
  return el('div', { class: 'grp-card' }, nappi, runko);
}

// ---------------------------------------------------------------------------
// Vertailuliikkeet

function viivakaavio(pisteet) {
  const W = 300;
  const H = 120;
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const svg = svgEl('svg', { class: 'cmp-chart', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  const arvot = pisteet.map((p) => p.arvo);
  let min = Math.min(...arvot);
  let max = Math.max(...arvot);
  if (max - min < 1e-6) { min -= 1; max += 1; }
  const vara = (max - min) * 0.15;
  min -= vara;
  max += vara;
  const x = (i) => pad.l + (pisteet.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (pisteet.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  for (let k = 0; k <= 2; k++) {
    const gy = pad.t + (k / 2) * (H - pad.t - pad.b);
    svg.append(svgEl('line', { class: 'cmp-grid', x1: pad.l, x2: W - pad.r, y1: gy, y2: gy }));
  }
  if (pisteet.length > 1) {
    const d = pisteet.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.arvo).toFixed(1)}`).join(' ');
    svg.append(svgEl('path', { class: 'cmp-line', d }));
  }
  pisteet.forEach((p, i) => {
    const viimeinen = i === pisteet.length - 1;
    svg.append(svgEl('circle', { class: viimeinen ? 'cmp-dot is-last' : 'cmp-dot', cx: x(i).toFixed(1), cy: y(p.arvo).toFixed(1), r: viimeinen ? 4.5 : 3 }));
  });
  const alaY = H - 6;
  svg.append(svgEl('text', { class: 'cmp-axis', x: pad.l, y: alaY, 'text-anchor': 'start' }, lyhytPvm(pisteet[0].pvm)));
  if (pisteet.length > 1) {
    svg.append(svgEl('text', { class: 'cmp-axis', x: W - pad.r, y: alaY, 'text-anchor': 'end' }, lyhytPvm(pisteet[pisteet.length - 1].pvm)));
  }
  return svg;
}

function vertailuKortti(liike, historia, tanaan, yksikko) {
  const nyt = estimatedStrength(liike, historia, tanaan);
  const kp = liike.valine === 'kehonpaino';
  const pisteet = [];
  for (let i = VIIKKOJA_KAAVIOSSA - 1; i >= 0; i--) {
    const pvm = addDays(tanaan, -7 * i);
    const e = estimatedStrength(liike, historia, pvm);
    if (e) pisteet.push({ pvm, arvo: kp ? e.arvo : (yksikko === 'lb' ? e.arvo * KG_LB : e.arvo) });
  }
  const nimi = el('h3', { class: 'cmp-name' }, liike.nimi);
  if (!nyt) {
    return el('article', { class: 'card cmp-card is-empty' },
      nimi,
      el('div', { class: 'cmp-big' }, el('span', { class: 'cmp-num' }, '–')),
      el('p', { class: 'muted small cmp-empty' }, 'Ei vielä tuloksia. Kun teet liikkeen treenissä, arvio ilmestyy tänne.'));
  }
  const yksTeksti = kp ? 'toistoa yhdessä sarjassa' : `${yksikko === 'lb' ? 'lb' : 'kg'} yhdellä toistolla`;
  const numero = kp ? luku(nyt.arvo, 0) : painoLuku(nyt.arvo, yksikko);
  let muutos = null;
  if (pisteet.length > 1) {
    const ero = pisteet[pisteet.length - 1].arvo - pisteet[0].arvo;
    const viikkoja = Math.round((Date.parse(pisteet[pisteet.length - 1].pvm) - Date.parse(pisteet[0].pvm)) / (7 * 864e5));
    const merkki = ero > 0.05 ? '+' : ero < -0.05 ? '−' : '±';
    muutos = el('span', { class: `cmp-delta${ero > 0.05 ? ' is-up' : ero < -0.05 ? ' is-down' : ''}` },
      `${merkki}${luku(Math.abs(ero), kp ? 0 : 1)} ${kp ? 'toistoa' : (yksikko === 'lb' ? 'lb' : 'kg')} · ${viikkoja} vk`);
  }
  return el('article', { class: 'card cmp-card' },
    el('div', { class: 'cmp-top' }, nimi, muutos),
    el('div', { class: 'cmp-big' },
      el('span', { class: 'cmp-num' }, numero),
      el('span', { class: 'cmp-unit' }, yksTeksti)),
    viivakaavio(pisteet),
    el('p', { class: 'cmp-foot muted small' },
      `Viimeksi ${lyhytPvm(nyt.viimeksi)}`,
      nyt.vahennysPros > 0 ? ` · taukovähennys −${nyt.vahennysPros} %` : ''));
}

// ---------------------------------------------------------------------------
// Kehonkoostumus

function painoKaavio(lista) {
  const W = 300;
  const H = 56;
  const svg = svgEl('svg', { class: 'bw-chart', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  if (lista.length < 2) return svg;
  const arvot = lista.map((p) => p.kg);
  let min = Math.min(...arvot);
  let max = Math.max(...arvot);
  if (max - min < 0.5) { min -= 0.5; max += 0.5; }
  const x = (i) => 4 + (i / (lista.length - 1)) * (W - 8);
  const y = (v) => 6 + (1 - (v - min) / (max - min)) * (H - 12);
  const d = lista.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ');
  svg.append(svgEl('path', { class: 'bw-area', d: `${d} L${x(lista.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z` }));
  svg.append(svgEl('path', { class: 'bw-line', d }));
  const viim = lista[lista.length - 1];
  svg.append(svgEl('circle', { class: 'bw-dot', cx: x(lista.length - 1).toFixed(1), cy: y(viim.kg).toFixed(1), r: 4 }));
  return svg;
}

function avaaPunnitus(state, tanaan) {
  const yksikko = state.profiili.yksikko === 'lb' ? 'lb' : 'kg';
  const lista = (state.kehonpainoHistoria || []).slice().sort((a, b) => (a.pvm < b.pvm ? -1 : 1));
  const oletusKg = lista.length ? lista[lista.length - 1].kg : state.profiili.kehonpaino;
  const oletus = Number.isFinite(oletusKg)
    ? (yksikko === 'lb' ? (oletusKg * KG_LB).toFixed(1) : String(oletusKg)).replace('.', ',')
    : '';
  const syote = el('input', {
    class: 'bw-input',
    id: 'bw-input',
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    value: oletus,
    'aria-describedby': 'bw-virhe',
  });
  const virhe = el('p', { class: 'bw-error small', id: 'bw-virhe', role: 'alert' });
  let laatikko = null;
  const tallenna = (e) => {
    e.preventDefault();
    const raaka = String(syote.value).trim().replace(',', '.');
    const n = Number(raaka);
    const kg = yksikko === 'lb' ? n / KG_LB : n;
    if (raaka === '' || !Number.isFinite(n) || kg < 30 || kg > 300) {
      syote.setAttribute('aria-invalid', 'true');
      virhe.textContent = yksikko === 'lb' ? 'Anna paino väliltä 66–661 lb.' : 'Anna paino väliltä 30–300 kg.';
      return;
    }
    const pyor = Math.round(kg * 10) / 10;
    if (laatikko) laatikko.close();
    update((s) => {
      const h = (s.kehonpainoHistoria || []).filter((p) => p.pvm !== tanaan);
      h.push({ pvm: tanaan, kg: pyor });
      h.sort((a, b) => (a.pvm < b.pvm ? -1 : a.pvm > b.pvm ? 1 : 0));
      s.kehonpainoHistoria = h;
      s.profiili.kehonpaino = pyor;
    });
  };
  const lomake = el('form', { class: 'bw-form', onSubmit: tallenna, novalidate: true },
    el('h2', { class: 'sheet-title' }, 'Lisää punnitus'),
    el('p', { class: 'muted small' }, `Tänään ${lyhytPvm(tanaan)}. Viimeisin paino päivittää myös profiilisi kehonpainon, jota Treeniscore käyttää.`),
    el('label', { class: 'bw-label', for: 'bw-input' }, `Paino (${yksikko})`),
    el('div', { class: 'bw-field' }, syote, el('span', { class: 'bw-suffix', 'aria-hidden': 'true' }, yksikko)),
    virhe,
    el('button', { class: 'btn btn-primary', type: 'submit' }, 'Tallenna'));
  laatikko = sheet(lomake);
  setTimeout(() => { if (syote.isConnected) syote.focus({ preventScroll: true }); }, 50);
}

function painoKortti(state, tanaan) {
  const yksikko = state.profiili.yksikko === 'lb' ? 'lb' : 'kg';
  const lista = (state.kehonpainoHistoria || []).slice().sort((a, b) => (a.pvm < b.pvm ? -1 : 1));
  const viim = lista[lista.length - 1];
  const kg = viim ? viim.kg : state.profiili.kehonpaino;
  const alku = addDays(tanaan, -56);
  const kaavioon = lista.filter((p) => p.pvm >= alku);
  let muutos = null;
  if (kaavioon.length > 1) {
    const ero = kaavioon[kaavioon.length - 1].kg - kaavioon[0].kg;
    const naytto = yksikko === 'lb' ? ero * KG_LB : ero;
    muutos = el('span', { class: 'bw-delta muted small' },
      `${naytto > 0.05 ? '+' : naytto < -0.05 ? '−' : '±'}${luku(Math.abs(naytto), 1)} ${yksikko} 8 viikossa`);
  }
  return el('div', { class: 'card bw-card' },
    el('div', { class: 'bw-top' },
      el('div', null,
        el('p', { class: 'bw-label-top' }, 'Kehonpaino'),
        el('div', { class: 'bw-value' },
          el('span', { class: 'bw-num' }, Number.isFinite(kg) ? painoLuku(kg, yksikko) : '–'),
          el('span', { class: 'bw-unit' }, yksikko)),
        el('p', { class: 'muted small' }, viim ? `Punnittu ${lyhytPvm(viim.pvm)}` : 'Profiilin arvo, ei punnituksia'),
        muutos),
      el('button', { class: 'bw-add', type: 'button', 'aria-label': 'Lisää punnitus', onClick: () => avaaPunnitus(getState(), tanaan) },
        ikoni('M12 5v14M5 12h14', { koko: 22, leveys: 2.4 }))),
    painoKaavio(kaavioon));
}

function tulossaKortit() {
  const rivit = [
    ['Rasvaprosentti', 'Kehon koostumus ajan mittaan'],
    ['Kehon mitat', 'Vyötärö, rinta, käsivarret ja reidet'],
    ['Perusaineenvaihdunta', 'Arvio lepokulutuksesta'],
  ];
  return el('div', { class: 'list soon-list' },
    ...rivit.map(([otsikko, kuvaus]) => el('div', { class: 'row soon-row' },
      el('span', { class: 'row-title' }, otsikko, el('span', { class: 'soon-desc muted small' }, kuvaus)),
      el('span', { class: 'soon-pill' }, 'Tulossa'))));
}

// ---------------------------------------------------------------------------
// Ennätykset

const ENNATYS_NIMET = {
  arvioituVoima: 'Arvioitu maksimi',
  paino: 'Raskain paino',
  volyymi: 'Volyymi yhdessä treenissä',
  toistot: 'Eniten toistoja sarjassa',
};

function ennatysArvo(tyyppi, arvo, liike, yksikko) {
  if (tyyppi === 'toistot' || (tyyppi === 'arvioituVoima' && liike.valine === 'kehonpaino')) return `${luku(arvo, 0)} toistoa`;
  if (tyyppi === 'volyymi') {
    const v = yksikko === 'lb' ? arvo * KG_LB : arvo;
    return `${Math.round(v).toLocaleString('fi-FI')} ${yksikko}`;
  }
  return formatWeight(arvo, yksikko);
}

function avaaEnnatykset(liike, rec, yksikko) {
  const rivit = Object.keys(ENNATYS_NIMET)
    .filter((k) => rec[k])
    .map((k) => el('div', { class: 'row' },
      el('span', { class: 'row-title' }, ENNATYS_NIMET[k], el('span', { class: 'soon-desc muted small' }, lyhytPvm(rec[k].pvm))),
      el('span', { class: 'row-value rec-value' }, ennatysArvo(k, rec[k].arvo, liike, yksikko))));
  sheet(el('div', null,
    el('h2', { class: 'sheet-title' }, liike.nimi),
    el('div', { class: 'list' }, ...rivit),
    el('p', { class: 'muted small rec-note' }, 'Arvioitu maksimi lasketaan parhaasta sarjasta (paino × toistot). Käsipainoliikkeiden volyymissa paino lasketaan kahdesti.')));
}

function ennatysLista(historia, yksikko) {
  const kaikki = LIIKKEET
    .map((l) => ({ liike: l, rec: exerciseRecords(l.id, historia, l) }))
    .filter((x) => x.rec.arvioituVoima)
    .sort((a, b) => (a.rec.arvioituVoima.pvm < b.rec.arvioituVoima.pvm ? 1 : a.rec.arvioituVoima.pvm > b.rec.arvioituVoima.pvm ? -1 : 0));
  if (!kaikki.length) {
    return card(el('p', { class: 'muted' }, 'Ennätykset ilmestyvät tänne ensimmäisen treenin jälkeen.'));
  }
  const naytettavat = kaikkiEnnatykset ? kaikki : kaikki.slice(0, 5);
  const lista = el('div', { class: 'list rec-list' },
    ...naytettavat.map(({ liike, rec }) => {
      const kp = liike.valine === 'kehonpaino';
      const arvo = kp ? `${luku(rec.arvioituVoima.arvo, 0)} toistoa` : formatWeight(rec.arvioituVoima.arvo, yksikko);
      return el('button', { class: 'row rec-row', type: 'button', onClick: () => avaaEnnatykset(liike, rec, yksikko) },
        el('span', { class: 'rec-icon', 'aria-hidden': 'true' }, pokaali()),
        el('span', { class: 'row-title' }, liike.nimi,
          el('span', { class: 'soon-desc muted small' }, `${kp ? 'Eniten toistoja' : 'Arvioitu maksimi'} · ${lyhytPvm(rec.arvioituVoima.pvm)}`)),
        el('span', { class: 'row-value rec-value' }, arvo),
        chevronIkoni());
    }));
  const osat = [lista];
  if (kaikki.length > 5) {
    osat.push(el('button', {
      class: 'btn btn-ghost rec-more',
      type: 'button',
      onClick: (e) => {
        kaikkiEnnatykset = !kaikkiEnnatykset;
        const uusi = ennatysLista(historia, yksikko);
        e.currentTarget.closest('.rec-wrap').replaceWith(uusi);
      },
    }, kaikkiEnnatykset ? 'Näytä vähemmän' : `Näytä kaikki (${kaikki.length})`));
  }
  return el('div', { class: 'rec-wrap' }, ...osat);
}

function pokaali() {
  return ikoni(['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8.5 20h7'], { koko: 18 });
}

// ---------------------------------------------------------------------------
// Tulokset-välilehti

function tulokset(state, tanaan) {
  const historia = state.historia || [];
  const kp = state.profiili.kehonpaino;
  const yksikko = state.profiili.yksikko === 'lb' ? 'lb' : 'kg';
  const valimuisti = new Map();
  const ms = (pvm) => {
    if (!valimuisti.has(pvm)) valimuisti.set(pvm, muscleStrength(LIIKKEET, historia, kp, pvm));
    return valimuisti.get(pvm);
  };
  const mNyt = ms(tanaan);
  const ts = treeniscore(mNyt);
  const trendi = (avain) => scoreTrend((pvm) => treeniscore(ms(pvm))[avain], tanaan);

  const ryhmaSelitys = 'Ryhmän luku on sen lihasten lihasvoiman (mVoima) keskiarvo. 50 vastaa viitetasoa. '
    + 'Lihasryhmä avautuu, kun sille on kirjattu vähintään 6 sarjaa kuuden viikon aikana.\n\n'
    + 'Keltainen nuoli kertoo suunnan neljän viikon takaiseen verrattuna. Viitetasot ovat demon oletuksia.';

  const vertailut = el('div', { class: 'cmp-scroller', role: 'region', 'aria-label': 'Vertailuliikkeet, pyyhkäise', tabindex: '0' },
    ...VERTAILULIIKKEET.map((id) => haeLiike(id)).filter(Boolean).map((l) => vertailuKortti(l, historia, tanaan, yksikko)));

  const painoSelitys = 'Treeniscore suhteuttaa voiman kehonpainoon, joten viimeisin punnitus päivittää profiilisi '
    + 'kehonpainon. Rasvaprosentti, mitat ja perusaineenvaihdunta tulevat myöhemmin.';

  return el('div', { class: 'prog-results' },
    scoreKortti(ts, trendi('kokonais')),
    osioOtsikko('Ryhmät', whyButton(ryhmaSelitys)),
    el('div', { class: 'grp-list' },
      ...Object.keys(RYHMAT).map((r) => ryhmaKortti(r, ts[r], trendi(r), mNyt))),
    osioOtsikko('Vertailuliikkeet'),
    vertailut,
    osioOtsikko('Kehonkoostumus', whyButton(painoSelitys)),
    painoKortti(state, tanaan),
    tulossaKortit(),
    osioOtsikko('Ennätykset'),
    ennatysLista(historia, yksikko));
}

// ---------------------------------------------------------------------------
// Palautuminen-välilehti

const PALAUTUMIS_SELITYS = 'Palautuminen lasketaan viimeisen 96 tunnin sarjoista. Kun lihas on liikkeen päälihasryhmä, '
  + 'sarja painaa 1, ja kun se avustaa, sarja painaa 0,5.\n\n'
  + 'Suurempi volyymi vaatii pidemmän palautumisen: alle 6 sarjaa palautuu 48 tunnissa, 6–10 sarjaa 72 tunnissa ja '
  + 'sitä suurempi määrä 96 tunnissa. Alle 50 % on väsynyt, 50–89 % palautumassa ja vähintään 90 % palautunut.\n\n'
  + 'Arvot ovat demon oletuksia. Tuotteessa tekoäly personoi ne sinun palautumisesi mukaan. '
  + 'Tuodut kävelyt ja pyöräilyt eivät kuormita palautumista.';

function avaaPalautuneet(r) {
  const jarjestys = { väsynyt: 0, palautumassa: 1, palautunut: 2 };
  const rivit = LIHASRYHMAT
    .map((l) => ({ lihas: l, ...r.lihakset[l] }))
    .sort((a, b) => jarjestys[a.tila] - jarjestys[b.tila] || a.palautuminenPros - b.palautuminenPros);
  sheet(el('div', null,
    el('h2', { class: 'sheet-title' }, 'Lihasten palautuminen'),
    el('p', { class: 'muted small' }, `${r.palautuneita}/10 lihasryhmää on palautunut.`),
    el('div', { class: 'list rcv-list' },
      ...rivit.map((x) => el('div', { class: 'row' },
        el('span', { class: `rcv-dot ${TILA_LUOKKA[x.tila]}`, 'aria-hidden': 'true' }),
        el('span', { class: 'row-title' }, isoAlku(x.lihas),
          el('span', { class: 'soon-desc muted small' }, TILA_NIMET[x.tila])),
        el('span', { class: 'row-value rcv-pros' }, `${x.palautuminenPros} %`))))));
}

function oletusPuoli(r) {
  const kuormitettu = (l) => r.lihakset[l] && r.lihakset[l].tila !== 'palautunut';
  const etu = PUOLET.etu.filter(kuormitettu).length;
  const taka = PUOLET.taka.filter(kuormitettu).length;
  return taka > etu ? 'taka' : 'etu';
}

function palautuminen(state, nyt) {
  const historia = state.historia || [];
  const r = recovery(LIIKKEET, historia, nyt);
  if (!muistiPuoli) muistiPuoli = oletusPuoli(r);
  if (muistiLihas && !LIHASRYHMAT.includes(muistiLihas)) muistiLihas = null;
  const nytMs = Date.parse(nyt);

  const tilat = Object.fromEntries(LIHASRYHMAT.map((l) => [l, r.lihakset[l].tila]));

  const yla = el('div', { class: 'rcv-stats' },
    el('div', { class: 'rcv-stat' },
      el('span', { class: 'rcv-stat-label' }, 'Viimeisin treeni'),
      el('span', { class: 'rcv-stat-value' }, r.viimeisinTreeniTuntia === null ? 'Ei vielä' : aikaSitten(r.viimeisinTreeniTuntia))),
    el('button', { class: 'rcv-stat rcv-stat-btn', type: 'button', onClick: () => avaaPalautuneet(r), 'aria-label': `Palautuneet lihakset ${r.palautuneita}, avaa lista` },
      el('span', { class: 'rcv-stat-label' }, 'Palautuneet lihakset'),
      el('span', { class: 'rcv-stat-value' }, String(r.palautuneita), chevronIkoni())));

  const karttaPaikka = el('div', { class: 'rcv-map' });
  const tieto = el('div', { class: 'rcv-info', 'aria-live': 'polite' });

  function piirraTieto() {
    tieto.replaceChildren();
    if (!muistiLihas) {
      tieto.append(el('p', { class: 'muted small rcv-hint' }, 'Napauta lihasta nähdäksesi sen palautumisen.'));
      return;
    }
    const x = r.lihakset[muistiLihas];
    const tunnit = x.viimeksi ? (nytMs - Date.parse(x.viimeksi)) / 36e5 : null;
    tieto.append(
      el('div', { class: 'rcv-info-head' },
        el('h3', { class: 'rcv-info-title' }, isoAlku(muistiLihas)),
        el('span', { class: `rcv-pill ${TILA_LUOKKA[x.tila]}` }, TILA_NIMET[x.tila])),
      el('div', { class: 'rcv-info-row' },
        el('span', { class: 'rcv-info-pros' }, `${x.palautuminenPros} %`),
        el('span', { class: 'muted small' }, 'palautunut')),
      el('div', { class: 'meter rcv-meter' }, el('span', { class: TILA_LUOKKA[x.tila], style: `width:${x.palautuminenPros}%` })),
      el('p', { class: 'muted small' }, tunnit === null
        ? 'Ei kuormitusta kirjatuista treeneistä.'
        : `Viimeksi kuormitettu ${aikaSitten(tunnit)}.`));
  }

  function piirraKartta() {
    karttaPaikka.replaceChildren(bodyMap({
      puoli: muistiPuoli,
      tilat,
      koko: 'iso',
      valittu: muistiLihas,
      onSelect: (lihas) => {
        muistiLihas = muistiLihas === lihas ? null : lihas;
        piirraKartta();
        piirraTieto();
      },
    }));
  }

  const kaanto = segmented({
    vaihtoehdot: [{ arvo: 'etu', teksti: 'Etupuoli' }, { arvo: 'taka', teksti: 'Takapuoli' }],
    arvo: muistiPuoli,
    label: 'Kehokartan puoli',
    onChange: (v) => {
      muistiPuoli = v;
      piirraKartta();
    },
  });

  piirraKartta();
  piirraTieto();

  const selite = el('div', { class: 'rcv-legend small' },
    ...['väsynyt', 'palautumassa', 'palautunut'].map((t) => el('span', { class: 'rcv-legend-item' },
      el('span', { class: `rcv-dot ${TILA_LUOKKA[t]}`, 'aria-hidden': 'true' }), TILA_NIMET[t])));

  return el('div', { class: 'prog-recovery' },
    yla,
    el('div', { class: 'card rcv-card' },
      el('div', { class: 'rcv-card-top' }, kaanto, whyButton(PALAUTUMIS_SELITYS)),
      karttaPaikka,
      selite,
      tieto));
}

// ---------------------------------------------------------------------------

export function render(root) {
  let tab = lueTab();
  muistiTab = tab;
  const sisalto = el('div', { class: 'prog-content' });

  const piirra = () => {
    const state = getState();
    const nyt = new Date().toISOString();
    const tanaan = tanaanPvm(nyt);
    sisalto.replaceChildren(tab === 'palautuminen' ? palautuminen(state, nyt) : tulokset(state, tanaan));
  };

  const valitsin = segmented({
    vaihtoehdot: [{ arvo: 'tulokset', teksti: 'Tulokset' }, { arvo: 'palautuminen', teksti: 'Palautuminen' }],
    arvo: tab,
    label: 'Edistymisen näkymä',
    onChange: (v) => {
      tab = v;
      muistiTab = v;
      try {
        history.replaceState(history.state, '', v === 'palautuminen' ? '#/edistyminen?tab=palautuminen' : '#/edistyminen');
      } catch {
        // replaceState voi olla estetty (esim. sandbox); muisti riittää
      }
      piirra();
    },
  });
  valitsin.classList.add('prog-tabs');

  root.append(
    el('h1', { class: 'page-title' }, 'Edistyminen'),
    valitsin,
    sisalto,
  );
  piirra();
}
