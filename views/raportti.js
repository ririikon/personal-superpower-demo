// Viikkoraportti valmentajalle (speksi 4k E): #/raportti?viikko=YYYY-MM-DD (puuttuva = kuluva viikko).
// Osiot tulevat weeklyReport-funktiosta: treenit ja kesto, sarjatavoitteiden toteuma ryhmittäin,
// ennätykset ja arvioidun voiman muutos, palautuminen, vaihdetut ja ohitetut liikkeet, tapahtuman jakso
// ja käyttäjän kommentti (tallentuu raporttiKommentit[viikonAlku]). Toiminnot: "Jaa valmentajalle"
// (Web Share tai mailto-luonnos, jonka käyttäjä lähettää itse), "Tulosta / PDF" ja viikon vaihto.
//
// omaPaivitys: kommentin tallennus ei piirrä näkymää uudelleen (kohdistus ja kirjoitus säilyvät).
// Muut tilan muutokset piirtävät näkymän uudelleen tässä moduulissa.
import { getState, update } from '../store.js?v=31a36ec';
import { weeklyReport } from '../engine/report.js?v=31a36ec';
import { el, card, sectionTitle } from './ui.js?v=31a36ec';

export const omaPaivitys = true;

const PVM_RE = /^\d{4}-\d{2}-\d{2}$/;
const KOMMENTTI_MAX = 600;
const TALLENNUS_VIIVE_MS = 400;
const VKP = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const RYHMA_VARI = { tyonnot: 'var(--push)', vedot: 'var(--pull)', jalat: 'var(--legs)' };
const ENNATYS_NIMI = {
  arvioituVoima: 'arvioitu maksimi', paino: 'raskain paino', volyymi: 'volyymi', toistot: 'eniten toistoja',
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function luku(n, desimaalit = 1) {
  if (!Number.isFinite(n)) return '–';
  const p = Math.round(n * 10 ** desimaalit) / 10 ** desimaalit;
  return p.toLocaleString('fi-FI', { maximumFractionDigits: desimaalit });
}

function pvmLyhyt(pvm) {
  const [, m, d] = String(pvm).split('-').map(Number);
  return `${d}.${m}.`;
}

function paivaTeksti(pvm) {
  return `${VKP[new Date(`${pvm}T12:00:00Z`).getUTCDay()]} ${pvmLyhyt(pvm)}`;
}

function valiTeksti(a, b) {
  const [ya] = a.split('-').map(Number);
  const [yb] = b.split('-').map(Number);
  return ya === yb ? `${pvmLyhyt(a)}–${pvmLyhyt(b)}${yb}` : `${pvmLyhyt(a)}${ya}–${pvmLyhyt(b)}${yb}`;
}

function kestoTeksti(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

// Sähköpostiohjelmat ja selaimet katkaisevat pitkiä mailto-linkkejä, joten rungon koodattu pituus rajataan.
export const MAILTO_RUNKO_MAX = 1800;
export const MAILTO_KATKAISU = '… (koko raportti sovelluksessa)';

/**
 * mailtoRunko(teksti, max = MAILTO_RUNKO_MAX) → URL-koodattu runko, enintään max merkkiä.
 * Liian pitkä runko katkaistaan rivin rajalta, ja loppuun lisätään rivi
 * "… (koko raportti sovelluksessa)". Jos jo ensimmäinen rivi on liian pitkä, se katkaistaan merkeittäin.
 */
export function mailtoRunko(teksti, max = MAILTO_RUNKO_MAX) {
  const koko = String(teksti || '');
  if (encodeURIComponent(koko).length <= max) return encodeURIComponent(koko);
  const loppu = `\n${MAILTO_KATKAISU}`;
  const mahtuu = (s) => encodeURIComponent(s + loppu).length <= max;
  const rivit = koko.split('\n');
  let runko = '';
  for (const rivi of rivit) {
    const ehdokas = runko ? `${runko}\n${rivi}` : rivi;
    if (!mahtuu(ehdokas)) break;
    runko = ehdokas;
  }
  if (!runko) {
    // Ensimmäinen rivi ei mahdu: katkaistaan merkeittäin (koodipisteittäin, jotta ääkköset säilyvät ehjinä).
    for (const merkki of rivit[0]) {
      if (!mahtuu(runko + merkki)) break;
      runko += merkki;
    }
  }
  return encodeURIComponent(runko + loppu);
}

/**
 * raporttiMailto(raportti) → 'mailto:…?subject=…&body=…'
 * Vastaanottaja on valmentajan sähköposti (jos kelvollinen), otsikko raportin otsikko ja käyttäjän nimi,
 * runko tekstiyhteenveto. Otsikko ja runko URL-koodataan (encodeURIComponent); rungon koodattu pituus on
 * enintään MAILTO_RUNKO_MAX (1 800) merkkiä (mailtoRunko).
 */
export function raporttiMailto(r) {
  const email = r && r.valmentaja && EMAIL_RE.test(String(r.valmentaja.email || '').trim())
    ? String(r.valmentaja.email).trim() : '';
  const osoite = encodeURIComponent(email).replace(/%40/g, '@');
  const otsikko = `${r.otsikko} · ${r.kayttaja}`;
  return `mailto:${osoite}?subject=${encodeURIComponent(otsikko)}&body=${mailtoRunko(r.tekstiyhteenveto)}`;
}

function viikkoParametri(params) {
  const v = params && typeof params.viikko === 'string' ? params.viikko.slice(0, 10) : '';
  return PVM_RE.test(v) ? v : undefined;
}

// --- Osiot ----------------------------------------------------------------------

function tilasto(otsikko, arvo) {
  return el('div', { class: 'rp-stat' }, el('span', { class: 'rp-stat-val' }, arvo), el('span', { class: 'rp-stat-lbl' }, otsikko));
}

function treenitOsio(r) {
  const y = r.yhteenveto;
  return [
    sectionTitle('Treenit'),
    card(
      el('div', { class: 'rp-stats' },
        tilasto('voimatreeniä', String(y.voimatreeneja)),
        tilasto('kesto', kestoTeksti(y.kestoMin)),
        tilasto('työsarjaa', String(y.sarjat))),
      y.aktiviteetteja ? el('p', { class: 'muted small rp-sub' }, `Lisäksi ${y.aktiviteetteja} ${y.aktiviteetteja === 1 ? 'muu aktiviteetti' : 'muuta aktiviteettia'}. Volyymi ${luku(y.volyymi, 0)} kg.`)
        : el('p', { class: 'muted small rp-sub' }, `Volyymi ${luku(y.volyymi, 0)} kg · ${y.aktiivisetPaivat} aktiivista päivää.`),
      r.treenit.length
        ? el('ul', { class: 'rp-list' }, ...r.treenit.map((t) => el('li', { class: 'rp-row' },
          el('span', { class: 'rp-row-date' }, paivaTeksti(t.pvm)),
          el('span', { class: 'rp-row-main' }, t.nimi),
          el('span', { class: 'rp-row-val' }, [t.kestoMin ? `${t.kestoMin} min` : null, t.sarjat ? `${t.sarjat} sarjaa` : null].filter(Boolean).join(' · ') || '–'))))
        : el('p', { class: 'muted rp-empty' }, 'Ei treenejä tällä viikolla.')),
  ];
}

function tavoitteetOsio(r) {
  const st = r.sarjatavoitteet;
  return [
    sectionTitle('Sarjatavoitteet'),
    card(
      el('div', { class: 'rp-goal-head' },
        el('span', { class: 'rp-goal-pct' }, `${st.kokonaisPros} %`),
        el('span', { class: 'muted small' }, st.muokattu ? 'Viikon tavoite muokattu (suunnitelma tai jakso)' : 'Viikon työsarjat tavoitteesta')),
      ...st.ryhmat.map((g) => el('div', { class: 'rp-bar-row' },
        el('div', { class: 'rp-bar-label' },
          el('span', null, g.nimi),
          el('span', { class: 'muted' }, `${g.tehty}/${g.tavoite} · ${g.pros} %`)),
        el('div', { class: 'rp-bar', role: 'img', 'aria-label': `${g.nimi} ${g.pros} %` },
          el('span', { class: 'rp-bar-fill', style: `width:${Math.max(0, Math.min(100, g.pros))}%;background:${RYHMA_VARI[g.ryhma] || 'var(--accent)'}` }))))),
  ];
}

function voimaOsio(r, yksikko) {
  const muunna = (arvo, y) => (y === 'kg' && yksikko === 'lb' ? `${luku(arvo * 2.20462)} lb` : `${luku(arvo)} ${y}`);
  return [
    sectionTitle('Ennätykset ja voima'),
    card(
      r.ennatykset.length
        ? el('ul', { class: 'rp-list' }, ...r.ennatykset.map((e) => el('li', { class: 'rp-row' },
          el('span', { class: 'rp-row-date' }, paivaTeksti(e.pvm)),
          el('span', { class: 'rp-row-main' }, `${e.nimi} · ${ENNATYS_NIMI[e.tyyppi] || e.tyyppi}`),
          el('span', { class: 'rp-row-val rp-pr' }, muunna(e.arvo, e.yksikko)))))
        : el('p', { class: 'muted rp-empty' }, 'Ei uusia ennätyksiä tällä viikolla.'),
      r.voimanMuutos.length
        ? [el('p', { class: 'rp-subtitle' }, 'Arvioitu voima vertailuliikkeissä'),
          el('ul', { class: 'rp-list' }, ...r.voimanMuutos.map((v) => el('li', { class: 'rp-row' },
            el('span', { class: 'rp-row-main' }, v.nimi),
            el('span', { class: 'rp-row-val' }, muunna(v.nyt, v.yksikko),
              v.muutosPros != null
                ? el('span', { class: `rp-delta${v.muutosPros > 0 ? ' is-up' : v.muutosPros < 0 ? ' is-down' : ''}` },
                  ` ${v.muutosPros > 0 ? '+' : ''}${luku(v.muutosPros)} %`)
                : null))))]
        : null),
  ];
}

function palautumisOsio(r) {
  return [
    sectionTitle('Palautuminen'),
    card(el('ul', { class: 'rp-notes' }, ...r.palautuminen.huomiot.map((h) => el('li', null, h)))),
  ];
}

function vaihdotOsio(r) {
  if (!r.vaihdetut.length && !r.kipumuistit.length) {
    return [sectionTitle('Vaihdot ja ohitukset'), card(el('p', { class: 'muted rp-empty' }, 'Ei vaihdettuja tai ohitettuja liikkeitä.'))];
  }
  return [
    sectionTitle('Vaihdot ja ohitukset'),
    card(
      r.vaihdetut.length
        ? el('ul', { class: 'rp-list' }, ...r.vaihdetut.map((v) => el('li', { class: 'rp-row' },
          el('span', { class: 'rp-row-date' }, paivaTeksti(v.pvm)),
          el('span', { class: 'rp-row-main' }, v.toiminto === 'ohitettu' ? `${v.nimi} ohitettu` : `${v.nimi} → ${v.korvaavaNimi}`,
            el('span', { class: 'rp-row-sub' }, v.syyTeksti)))))
        : null,
      r.kipumuistit.length
        ? [el('p', { class: 'rp-subtitle' }, 'Kipumuistit'),
          el('ul', { class: 'rp-notes' }, ...r.kipumuistit.map((m) => el('li', null, m.teksti || m.kipualue || m.valtettava)))]
        : null),
  ];
}

function tapahtumaOsio(r) {
  if (!r.tapahtuma) return null;
  const t = r.tapahtuma;
  return [
    sectionTitle('Tavoitetapahtuma'),
    card(
      el('p', { class: 'rp-event-title' }, t.otsikko),
      el('p', { class: 'muted small' }, `${t.jaksoNimi}${t.kevennysviikko ? ' · kevennysviikko' : ''} · sarjatavoite × ${t.kerroin.toFixed(1).replace('.', ',')} · ${t.viikkojaJaljella} ${t.viikkojaJaljella === 1 ? 'viikko' : 'viikkoa'} jäljellä`),
      el('p', { class: 'rp-event-focus' }, t.painopiste)),
  ];
}

// --- Näkymä ---------------------------------------------------------------------

export function render(root, params = {}) {
  const viikko = viikkoParametri(params);
  let ajastin = null;
  let omaTallennus = false;
  let alku = null;

  function tallennaKommentti(teksti) {
    clearTimeout(ajastin);
    ajastin = null;
    if (!alku) return;
    const arvo = String(teksti || '').slice(0, KOMMENTTI_MAX);
    const s = getState() || {};
    const nyky = s.raporttiKommentit && typeof s.raporttiKommentit[alku] === 'string' ? s.raporttiKommentit[alku] : '';
    if (nyky === arvo.trim() || nyky === arvo) return;
    omaTallennus = true;
    update((st) => {
      const kommentit = st.raporttiKommentit && typeof st.raporttiKommentit === 'object' && !Array.isArray(st.raporttiKommentit)
        ? { ...st.raporttiKommentit } : {};
      if (arvo.trim()) kommentit[alku] = arvo;
      else delete kommentit[alku];
      st.raporttiKommentit = kommentit;
    });
  }

  let kentta = null;
  let mailLinkki = null;

  function tuoreRaportti() {
    if (kentta) tallennaKommentti(kentta.value);
    return weeklyReport(getState() || {}, viikko, new Date().toISOString());
  }

  function paivitaMailto() {
    if (!mailLinkki) return;
    const r = weeklyReport(getState() || {}, viikko, new Date().toISOString());
    mailLinkki.setAttribute('href', raporttiMailto(r));
  }

  async function jaa() {
    const r = tuoreRaportti();
    paivitaMailto();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${r.otsikko} · ${r.kayttaja}`, text: r.tekstiyhteenveto });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // käyttäjä perui jaon
      }
    }
    location.href = raporttiMailto(r);
  }

  function tulosta() {
    tuoreRaportti();
    window.print();
  }

  function piirra() {
    const state = getState() || {};
    const profiili = state.profiili || {};
    const yksikko = profiili.yksikko === 'lb' ? 'lb' : 'kg';
    const r = weeklyReport(state, viikko, new Date().toISOString());
    alku = r.viikonAlku;
    const valmentaja = r.valmentaja && (r.valmentaja.nimi || r.valmentaja.email) ? r.valmentaja : null;

    kentta = el('textarea', {
      class: 'input rp-comment', rows: 4, maxlength: KOMMENTTI_MAX,
      placeholder: 'Esim. olkapää tuntui penkissä, ensi viikolla vain kaksi treeniä.',
      'aria-label': 'Kommentti valmentajalle', value: r.kommentti,
      onInput: (e) => {
        clearTimeout(ajastin);
        const arvo = e.target.value;
        tulostusKommentti.textContent = arvo;
        ajastin = setTimeout(() => { tallennaKommentti(arvo); paivitaMailto(); }, TALLENNUS_VIIVE_MS);
      },
      onChange: (e) => { tallennaKommentti(e.target.value); paivitaMailto(); },
    });
    const tulostusKommentti = el('p', { class: 'rp-comment-print' }, r.kommentti);
    mailLinkki = el('a', { class: 'btn rp-mail', href: raporttiMailto(r) }, 'Sähköpostiluonnos');

    root.replaceChildren(el('div', { class: 'rp' },
      el('a', { class: 't8-back rp-back', href: '#/profiili' }, '‹ Profiili'),
      el('h1', { class: 'page-title rp-title' }, `Viikkoraportti valmentajalle · ${r.kayttaja}`),
      el('p', { class: 'muted rp-meta' },
        valmentaja ? `Valmentaja: ${[valmentaja.nimi, valmentaja.email].filter(Boolean).join(' · ')}` : 'Valmentajaa ei ole asetettu. ',
        valmentaja ? null : el('a', { href: '#/profiili' }, 'Lisää valmentaja')),
      el('nav', { class: 'rp-nav', 'aria-label': 'Viikko' },
        el('a', { class: 'btn rp-nav-btn', href: `#/raportti?viikko=${r.edellinen}`, 'aria-label': 'Edellinen viikko' }, '‹ Edellinen'),
        el('span', { class: 'rp-week' }, valiTeksti(r.viikonAlku, r.viikonLoppu)),
        r.seuraava
          ? el('a', { class: 'btn rp-nav-btn', href: `#/raportti?viikko=${r.seuraava}`, 'aria-label': 'Seuraava viikko' }, 'Seuraava ›')
          : el('span', { class: 'btn rp-nav-btn is-disabled', 'aria-disabled': 'true' }, 'Seuraava ›')),
      treenitOsio(r),
      tavoitteetOsio(r),
      voimaOsio(r, yksikko),
      palautumisOsio(r),
      vaihdotOsio(r),
      tapahtumaOsio(r),
      sectionTitle('Kommentti valmentajalle'),
      card(kentta, tulostusKommentti, el('p', { class: 'muted small rp-comment-help' }, 'Tallentuu tämän viikon raporttiin.')),
      el('div', { class: 'rp-actions' },
        el('button', { class: 'btn btn-primary', type: 'button', onClick: () => { jaa(); } }, 'Jaa valmentajalle'),
        el('div', { class: 'rp-actions-row' },
          mailLinkki,
          el('button', { class: 'btn', type: 'button', onClick: tulosta }, 'Tulosta / PDF')),
        el('p', { class: 'muted small rp-share-note' }, 'Jako avaa puhelimen jakovalikon tai sähköpostiluonnoksen. Lähetät viestin itse.')),
      el('div', { class: 'note rp-product' }, 'Tuotteessa valmentaja näkee asiakkaidensa raportit omassa näkymässään.')));
  }

  const onState = () => {
    if (omaTallennus) {
      omaTallennus = false;
      return;
    }
    const y = window.scrollY;
    piirra();
    window.scrollTo(0, y);
  };
  window.addEventListener('statechange', onState);
  piirra();

  return () => {
    window.removeEventListener('statechange', onState);
    if (ajastin && kentta) tallennaKommentti(kentta.value);
    clearTimeout(ajastin);
  };
}
