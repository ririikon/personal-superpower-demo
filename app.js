// Sovelluksen kuori: hash-reititin, alanavigaatio, kelluva treenipainike ja teema.
//
// NÄKYMÄSOPIMUS (kaikki views/*.js noudattavat tätä):
// 1. Näkymä vie funktion `render(root, params)`. root on tyhjennetty <main id="view">,
//    params sisältää reitin parametrit (esim. {id}) ja hashin ?query-arvot.
// 2. render voi palauttaa siivousfunktion tai promisen, joka ratkeaa siivousfunktioksi
//    (muu paluuarvo = ei siivousta). Siivous purkaa näkymän omat kuuntelijat, ajastimet yms.
// 3. Reititin kutsuu edellisen näkymän siivouksen aina ennen seuraavaa piirtoa: reitin
//    vaihtuessa (myös pelkän parametrin vaihtuessa) ja ennen statechange-uudelleenpiirtoa.
//    Siivousfunktion virhe kirjataan konsoliin eikä estä seuraavaa piirtoa.
// 4. Jos reitti vaihtuu (tai näkymä piirretään uudelleen) ennen kuin asynkroninen render
//    ratkeaa, sen tulos ohitetaan: palautettua siivousfunktiota ei tallenneta, vaan se
//    kutsutaan heti, ja hylätty promise vain kirjataan konsoliin. Asynkronisen näkymän
//    ei pidä kirjoittaa rootiin await-kohdan jälkeen tarkistamatta root.isConnected-tilaa.
// 5. Jos näkymämoduuli vie `export const omaPaivitys = true`, reititin EI piirrä sitä
//    uudelleen statechange-tapahtumasta. Näkymä kuuntelee 'statechange'-tapahtumaa itse
//    ja poistaa kuuntelijan siivousfunktiossaan (käyttö: treeni, valmentaja; syötteen
//    kohdistus säilyy). Teema, kelluva painike ja aloitusohjaus päivitetään silti.
// 6. Ilman lippua näkymä piirretään statechange-tapahtumasta uudelleen (siivous ensin),
//    ja vierityskohta säilyy. Useat peräkkäiset update()-kutsut yhdistetään yhdeksi piirroksi.
// 7. Reitin vaihtuessa root saa kohdistuksen (preventScroll) ja sivu vieritetään alkuun.
import { getState } from './store.js';
import { el, card } from './views/ui.js';
import * as koti from './views/koti.js';
import * as valmentaja from './views/valmentaja.js';
import * as edistyminen from './views/edistyminen.js';
import * as historia from './views/historia.js';
import * as liikkeet from './views/liikkeet.js';
import * as tavoitteet from './views/tavoitteet.js';
import * as ohjelmat from './views/ohjelmat.js';
import * as profiili from './views/profiili.js';
import * as aloitus from './views/aloitus.js';
import * as treeni from './views/treeni.js';

// tab: korostettava alanavigaation kohta; fab: näytetäänkö "Aloita treeni".
// Kodissa ei ole kelluvaa Aloita-painiketta: treenikortissa on oma painike, ja kelluva
// painike peitti viikkonauhan. "Jatka treeniä" näkyy silti kaikilla reiteillä paitsi treenissä.
const ROUTES = [
  { name: 'koti', re: /^koti$/, view: koti, tab: 'koti' },
  { name: 'valmentaja', re: /^valmentaja$/, view: valmentaja, tab: 'valmentaja' },
  { name: 'edistyminen', re: /^edistyminen$/, view: edistyminen, tab: 'edistyminen' },
  { name: 'historia', re: /^historia$/, view: historia, tab: 'historia', fab: true },
  { name: 'historia-treeni', re: /^historia\/([^/]+)$/, keys: ['id'], view: historia, tab: 'historia' },
  { name: 'liikkeet', re: /^liikkeet$/, view: liikkeet, tab: 'liikkeet' },
  { name: 'liike', re: /^liike\/([^/]+)$/, keys: ['id'], view: liikkeet, tab: 'liikkeet' },
  { name: 'tavoitteet', re: /^tavoitteet$/, view: tavoitteet, tab: 'koti' },
  { name: 'ohjelmat', re: /^ohjelmat$/, view: ohjelmat, tab: 'koti' },
  { name: 'profiili', re: /^profiili$/, view: profiili, tab: 'koti' },
  { name: 'aloitus', re: /^aloitus$/, view: aloitus, tab: null, hideNav: true },
  { name: 'treeni', re: /^treeni$/, view: treeni, tab: null },
];

const root = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const fab = document.getElementById('fab');
const fabText = fab.querySelector('.fab-text');
const themeMeta = document.querySelector('meta[name="theme-color"]');

let current = null; // { route, params, hash }
let cleanup = null; // nykyisen näkymän siivousfunktio
let renderToken = 0; // kasvaa jokaisella siivouksella; vanhentuneet async-piirrot tunnistetaan tästä
let renderScheduled = false;

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// '#/liike/penkki?x=1' → { route, params: { id: 'penkki', x: '1' } }
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const qIndex = raw.indexOf('?');
  const path = (qIndex >= 0 ? raw.slice(0, qIndex) : raw).replace(/\/+$/, '');
  const query = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
  for (const route of ROUTES) {
    const m = path.match(route.re);
    if (!m) continue;
    const params = {};
    (route.keys || []).forEach((key, i) => { params[key] = decode(m[i + 1]); });
    new URLSearchParams(query).forEach((v, k) => { if (!(k in params)) params[k] = v; });
    return { route, params };
  }
  return null;
}

function applyTheme(state) {
  const teema = state && state.asetukset ? state.asetukset.teema : null;
  const light = teema === 'vaalea' || teema === 'light';
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  if (themeMeta) themeMeta.setAttribute('content', light ? '#f3f4f8' : '#181a26');
}

function mmss(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function startTime(kaynnissa) {
  const a = kaynnissa.aloitus;
  if (typeof a === 'number') return a;
  const t = Date.parse(a);
  return Number.isFinite(t) ? t : null;
}

function updateFab() {
  const state = getState();
  const route = current ? current.route : null;
  const k = state ? state.kaynnissa : null;
  let text = null;
  let running = false;

  if (route && !route.hideNav) {
    if (k && route.name !== 'treeni') {
      const t0 = k.aloitus !== undefined && k.aloitus !== null ? startTime(k) : null;
      // Yli 4 h auki ollut treeni on jäänyt kesken: ei juoksevaa kelloa (treeninäkymä kysyy tallennusta).
      text = t0 !== null && Date.now() - t0 <= treeni.KESKEN_RAJA_MS
        ? `Jatka treeniä · ${mmss(Date.now() - t0)}` : 'Jatka treeniä';
      running = true;
    } else if (!k && route.fab) {
      text = 'Aloita treeni';
    }
  }

  if (text === null) {
    fab.hidden = true;
    return;
  }
  if (fabText.textContent !== text) fabText.textContent = text;
  fab.classList.toggle('is-running', running);
  fab.hidden = false;
}

function updateChrome() {
  const route = current.route;
  document.body.classList.toggle('no-nav', !!route.hideNav);
  tabbar.hidden = !!route.hideNav;
  for (const tab of tabbar.querySelectorAll('.tab')) {
    const active = tab.dataset.tab === route.tab;
    tab.classList.toggle('is-active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  updateFab();
}

function renderError(err) {
  console.error(err);
  root.replaceChildren(
    el('h1', { class: 'page-title' }, 'Hups'),
    card(el('p', null, 'Näkymää ei voitu näyttää.'), el('a', { class: 'btn btn-primary', href: '#/koti' }, 'Takaisin kotiin')),
  );
}

function safeCleanup(fn) {
  try {
    fn();
  } catch (err) {
    console.error(err);
  }
}

// Kutsuu nykyisen näkymän siivouksen (jos on) ja mitätöi keskeneräiset asynkroniset piirrot.
function runCleanup() {
  renderToken += 1;
  const fn = cleanup;
  cleanup = null;
  if (fn) safeCleanup(fn);
}

// Piirtää current-näkymän puhtaaseen rootiin. Edellinen siivous ajetaan ensin.
function renderCurrent() {
  runCleanup();
  const token = renderToken;
  root.replaceChildren();
  let result;
  try {
    result = current.route.view.render(root, current.params);
  } catch (err) {
    renderError(err);
    return;
  }
  if (typeof result === 'function') {
    cleanup = result;
  } else if (result && typeof result.then === 'function') {
    result.then(
      (fn) => {
        if (typeof fn !== 'function') return;
        if (token === renderToken) cleanup = fn;
        else safeCleanup(fn); // vanhentunut piirto: tulos ohitetaan, kuuntelijat puretaan heti
      },
      (err) => {
        if (token === renderToken) renderError(err);
        else console.error(err);
      },
    );
  }
}

// Reitin vaihto (hashchange tai käynnistys).
function navigate() {
  const state = getState();
  applyTheme(state);

  const hit = parseHash();
  if (!hit) {
    location.replace('#/koti');
    return;
  }
  if (state && !state.onboardattu && hit.route.name !== 'aloitus') {
    location.replace('#/aloitus');
    return;
  }
  // Aloitusohjaus on jo tehty (esim. Takaisin-painike): ei avata sitä uudelleen.
  // Nollaa demo asettaa onboardattu = false, joten ohjaus toimii silti.
  if (state && state.onboardattu && hit.route.name === 'aloitus') {
    location.replace('#/koti');
    return;
  }

  current = { ...hit, hash: location.hash };
  renderCurrent();
  updateChrome();
  root.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// Tilan muutos: sama reitti, vieritys säilyy. omaPaivitys-näkymiä ei piirretä uudelleen.
function onStateChange() {
  if (!current) return;
  const state = getState();
  applyTheme(state);
  if (state && !state.onboardattu && current.route.name !== 'aloitus') {
    location.replace('#/aloitus');
    return;
  }
  if (!current.route.view.omaPaivitys) {
    const y = window.scrollY;
    renderCurrent();
    window.scrollTo(0, y);
  }
  updateChrome();
}

window.addEventListener('hashchange', navigate);
window.addEventListener('statechange', () => {
  if (renderScheduled) return;
  renderScheduled = true;
  queueMicrotask(() => {
    renderScheduled = false;
    onStateChange();
  });
});

setInterval(() => { if (current) updateFab(); }, 1000);

navigate();
