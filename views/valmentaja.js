// Valmentaja (speksi 4h): käsikirjoitettu chat, joka kytkeytyy sovelluksen oikeaan tilaan.
// Lähetys: käyttäjän kupla tallentuu heti chat-kenttään, "Mietin…" näkyy 0,8–1,5 s ja
// vastaus kirjoittuu esiin max(40, pituus / 6) merkkiä sekunnissa eli enintään noin 6 s
// (napautus ohittaa). Kun vastaus on
// kokonaan näkyvissä, chat, uudet muistit ja poistettavat muistit viedään tilaan yhdellä
// update()-kutsulla.
//
// omaPaivitys: reititin ei piirrä näkymää uudelleen statechange-tapahtumasta, joten
// syöttökentän kohdistus säilyy. Näkymä piirtää viestilistan itse ja purkaa kuuntelijan
// ja ajastimet siivousfunktiossa.

import { getState, update } from '../store.js';
import { LIIKKEET, OHJELMAT } from '../data.js';
import { buildReply, ESIMERKKISIRUT } from '../coach.js';
import { tanaanPvm } from '../seed.js';
import { el, svgEl } from './ui.js';
import { avaaMuistit } from './profiili.js';

export const omaPaivitys = true;

const MAX_VIESTIT = 20;
const MERKKIA_SEKUNNISSA = 40; // vähimmäisnopeus
const MAX_KIRJOITUS_S = 6; // nopeus = max(40, pituus / 6) merkkiä sekunnissa
const TIKKI_MS = 50;
const MIETIN_MIN_MS = 800;
const MIETIN_MAX_MS = 1500;

const VKP = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const RYHMA_NIMI = { tyonnot: 'Työntöjen', vedot: 'Vetojen', jalat: 'Jalkojen' };

let laskuri = 0;
function uusiId() {
  laskuri += 1;
  return `viesti-${Date.now().toString(36)}-${laskuri}`;
}

function rajaa(chat) {
  return chat.length > MAX_VIESTIT ? chat.slice(chat.length - MAX_VIESTIT) : chat;
}

function etunimi(profiili) {
  const nimi = String((profiili && profiili.nimi) || '').trim() || 'Demokäyttäjä';
  return nimi.split(/\s+/)[0];
}

function isoAlku(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function pvmLyhyt(pvm) {
  const [, m, d] = String(pvm).split('-').map(Number);
  return `${d}.${m}.`;
}

function viikonpaiva(pvm) {
  return VKP[new Date(pvm + 'T12:00:00Z').getUTCDay()];
}

function konteksti(s, nyt) {
  return {
    tanaan: tanaanPvm(nyt),
    nyt,
    profiili: s.profiili,
    ohjelma: OHJELMAT.find((o) => o.id === s.aktiivinenOhjelmaId) || OHJELMAT[0],
    historia: s.historia || [],
    liikkeet: LIIKKEET,
    muistit: s.muistit || [],
    viikkosuunnitelmat: s.viikkosuunnitelmat || [],
  };
}

// ---------------------------------------------------------------------------
// Tekstin muotoilu: kappaleet erotetaan "\n\n":llä, listakohdat alkavat "• ".
// Kaikki teksti lisätään tekstisolmuina (el() käyttää textContent-vastinetta).

function muotoile(teksti) {
  const lohkot = [];
  for (const kappale of String(teksti).split('\n\n')) {
    let ul = null;
    let pRivit = [];
    const tyhjennaP = () => {
      if (pRivit.length) lohkot.push(el('p', null, pRivit.join(' ')));
      pRivit = [];
    };
    for (const rivi of kappale.split('\n')) {
      if (rivi === '') continue;
      if (rivi.startsWith('•')) {
        tyhjennaP();
        if (!ul) {
          ul = el('ul', { class: 'chat-ul' });
          lohkot.push(ul);
        }
        ul.append(el('li', null, rivi.replace(/^•\s?/, '')));
      } else {
        ul = null;
        pRivit.push(rivi);
      }
    }
    tyhjennaP();
  }
  return lohkot;
}

// ---------------------------------------------------------------------------
// Kuvakkeet

function ikoni(d, koko = 18, leveys = 1.9) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true', class: 'chat-icon' },
    svgEl('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': leveys, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

const IKONIT = {
  kipina: 'M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9zM18.5 15.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z',
  treeni: 'M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11',
  laji: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM4 9.5c4 1 12 1 16 0M4 14.5c4-1 12-1 16 0',
  lepo: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  matka: 'M4 8.5h16v11H4zM9 8.5V5.5h6v3M4 13h16',
  muisti: 'M9 18.5h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
  laheta: 'M5 12h13M12.5 5.5 19 12l-6.5 6.5',
  uusi: 'M12 5v14M5 12h14',
};

// ---------------------------------------------------------------------------
// Ehdotuskortti

function paivanTeksti(p) {
  if (p.tyyppi === 'treeni') return { otsikko: `Salitreeni${p.ohjelmaPaiva ? ` · ${p.ohjelmaPaiva}` : ''}`, huomio: p.huomio || null };
  if (p.tyyppi === 'laji') return { otsikko: isoAlku(p.laji || 'Laji'), huomio: null };
  if (p.tyyppi === 'matka') return { otsikko: `Matkatreeni${p.kestoMin ? ` ${p.kestoMin} min` : ''}`, huomio: p.huomio || null };
  const matkalla = /^Matkapäivä/.test(p.huomio || '');
  return { otsikko: matkalla ? 'Lepo · matkapäivä' : 'Lepo', huomio: null };
}

function ehdotusKortti(viesti, toiminnot) {
  const e = viesti.ehdotus;
  const paivat = Array.isArray(e.paivat) ? e.paivat : [];
  const loppu = paivat.length ? paivat[paivat.length - 1].pvm : e.viikonAlku;
  const tila = viesti.ehdotusTila || 'odottaa';
  const kertoimet = Object.entries(e.sarjatavoiteKertoimet || {})
    .filter(([, k]) => Number.isFinite(k) && k !== 1)
    .map(([ryhma, k]) => `${RYHMA_NIMI[ryhma] || isoAlku(ryhma)} sarjatavoite × ${String(k).replace('.', ',')}`);

  let alaosa;
  if (tila === 'kaytossa') {
    alaosa = el('div', { class: 'plan-status is-ok', role: 'status' }, 'Käytössä ✓');
  } else if (tila === 'hylatty') {
    alaosa = el('div', { class: 'plan-status', role: 'status' }, 'Hylätty');
  } else {
    alaosa = el('div', { class: 'plan-actions' },
      el('button', { class: 'btn btn-primary plan-accept', type: 'button', onClick: () => toiminnot.hyvaksy(viesti) }, 'Ota käyttöön'),
      el('button', { class: 'btn plan-reject', type: 'button', onClick: () => toiminnot.hylkaa(viesti) }, 'Hylkää'));
  }

  return el('div', { class: `plan-card${tila !== 'odottaa' ? ` is-${tila}` : ''}` },
    el('div', { class: 'plan-head' },
      el('span', { class: 'plan-kicker' }, 'Viikkoehdotus'),
      el('span', { class: 'plan-range' }, `${pvmLyhyt(e.viikonAlku)}–${pvmLyhyt(loppu)}`)),
    el('ul', { class: 'plan-days' },
      ...paivat.map((p) => {
        const t = paivanTeksti(p);
        return el('li', { class: `plan-day plan-${p.tyyppi}` },
          el('span', { class: 'plan-day-icon' }, ikoni(IKONIT[p.tyyppi] || IKONIT.lepo, 16)),
          el('span', { class: 'plan-day-date' }, `${viikonpaiva(p.pvm)} ${pvmLyhyt(p.pvm)}`),
          el('span', { class: 'plan-day-text' },
            el('span', { class: 'plan-day-title' }, t.otsikko),
            t.huomio ? el('span', { class: 'plan-day-note' }, t.huomio) : null));
      })),
    kertoimet.length ? el('p', { class: 'plan-factor' }, kertoimet.join(' · ')) : null,
    e.perustelu ? el('p', { class: 'plan-why' }, e.perustelu) : null,
    alaosa);
}

// ---------------------------------------------------------------------------
// Näkymä

export function render(root) {
  let pending = null; // { id, vastaus, vaihe: 'mietin'|'kirjoittaa', naytetty, ajastin, runko }
  let raf = 0;

  const uusiNappi = el('button', { class: 'chat-new', type: 'button', onClick: () => uusiKeskustelu() },
    ikoni(IKONIT.uusi, 16, 2.2), 'Uusi keskustelu');
  const lista = el('div', { class: 'chat-list' });
  const pendingSlot = el('div', { class: 'chat-pending' });
  const ketju = el('div', { class: 'chat-thread', role: 'log', 'aria-live': 'polite', 'aria-label': 'Keskustelu valmentajan kanssa' },
    lista, pendingSlot);
  const syote = el('input', {
    class: 'chat-input',
    type: 'text',
    placeholder: 'Kysy valmentajalta…',
    'aria-label': 'Viesti valmentajalle',
    autocomplete: 'off',
    enterkeyhint: 'send',
    maxlength: 500,
  });
  const lahetaNappi = el('button', { class: 'chat-send', type: 'submit', 'aria-label': 'Lähetä', disabled: true },
    ikoni(IKONIT.laheta, 20, 2.4));
  const lomake = el('form', { class: 'chat-composer', onSubmit: (e) => { e.preventDefault(); laheta(syote.value); } },
    syote, lahetaNappi);

  syote.addEventListener('input', () => { lahetaNappi.disabled = !syote.value.trim(); });

  // Napautus keskustelussa ohittaa kirjoittamisen (painikkeet ja linkit toimivat normaalisti).
  ketju.addEventListener('click', (e) => {
    if (!pending) return;
    if (e.target.closest('button, a, input')) return;
    valmis();
  });

  root.append(
    el('header', { class: 'chat-head' },
      el('div', { class: 'chat-head-row' },
        el('h1', { class: 'page-title chat-title' }, 'Valmentaja'),
        uusiNappi),
      el('span', { class: 'demo-badge' }, 'Demo: esimerkkivastaukset')),
    ketju,
    lomake,
  );

  function lahella() {
    const doc = document.documentElement;
    return window.innerHeight + window.scrollY >= doc.scrollHeight - 160;
  }

  function vieritaAlas(pakota) {
    if (!pakota && !lahella()) return;
    window.scrollTo(0, document.documentElement.scrollHeight);
  }

  function paivitaYlaosa() {
    const chat = getState().chat || [];
    uusiNappi.disabled = !chat.length && !pending;
  }

  function tyhjaTila() {
    const s = getState();
    return el('div', { class: 'chat-empty' },
      el('div', { class: 'chat-avatar chat-avatar-lg', 'aria-hidden': 'true' }, ikoni(IKONIT.kipina, 30, 1.8)),
      el('h2', { class: 'title chat-hello' }, `Hei ${etunimi(s.profiili)}!`),
      el('p', { class: 'muted chat-intro' }, 'Olen valmentajasi. Kerro tulevasta viikosta, vaivasta tai kiireestä, niin sovitan treenit siihen. Muistan tärkeät asiat seuraavaankin keskusteluun.'),
      el('p', { class: 'section-title chat-try' }, 'Kokeile esimerkiksi'),
      el('div', { class: 'chat-suggestions' },
        ...ESIMERKKISIRUT.map((t) => el('button', { class: 'chat-suggestion', type: 'button', onClick: () => laheta(t) }, t))));
  }

  function valmentajanKupla(sisalto, { lisaluokka = '' } = {}) {
    return el('div', { class: 'chat-msg chat-msg-coach' },
      el('div', { class: 'chat-avatar', 'aria-hidden': 'true' }, ikoni(IKONIT.kipina, 16, 2)),
      el('div', { class: `bubble bubble-coach${lisaluokka}` }, ...sisalto));
  }

  const toiminnot = {
    hyvaksy(viesti) {
      const ehdotus = structuredClone(viesti.ehdotus);
      update((s) => {
        s.viikkosuunnitelmat = [
          ...(s.viikkosuunnitelmat || []).filter((v) => v && v.viikonAlku !== ehdotus.viikonAlku),
          ehdotus,
        ];
        const v = (s.chat || []).find((x) => x.id === viesti.id);
        if (v) v.ehdotusTila = 'kaytossa';
      });
    },
    hylkaa(viesti) {
      update((s) => {
        const v = (s.chat || []).find((x) => x.id === viesti.id);
        if (v) v.ehdotusTila = 'hylatty';
      });
    },
  };

  function piirraLista() {
    const chat = getState().chat || [];
    if (!chat.length && !pending) {
      lista.replaceChildren(tyhjaTila());
      return;
    }
    let viimeinenValmentaja = -1;
    chat.forEach((v, i) => { if (v.rooli === 'valmentaja') viimeinenValmentaja = i; });
    lista.replaceChildren(...chat.map((v, i) => {
      if (v.rooli !== 'valmentaja') {
        return el('div', { class: 'chat-msg chat-msg-user' }, el('div', { class: 'bubble bubble-user' }, v.teksti));
      }
      const muistit = Array.isArray(v.muistit) ? v.muistit : [];
      const sirut = i === viimeinenValmentaja && !pending && Array.isArray(v.sirut) ? v.sirut : [];
      return el('div', { class: 'chat-turn' },
        valmentajanKupla(muotoile(v.teksti)),
        muistit.length
          ? el('div', { class: 'chat-attach' }, ...muistit.map((m) => el('button', {
            class: 'chip chat-memory-chip', type: 'button', onClick: () => avaaMuistit(),
          }, ikoni(IKONIT.muisti, 16), el('span', null, `Muistin: ${m.teksti}`))))
          : null,
        v.ehdotus ? el('div', { class: 'chat-attach' }, ehdotusKortti(v, toiminnot)) : null,
        sirut.length
          ? el('div', { class: 'chips chat-followups' }, ...sirut.map((t) => el('button', {
            class: 'chip', type: 'button', onClick: () => laheta(t),
          }, t)))
          : null);
    }));
  }

  function piirraPending() {
    if (!pending) {
      pendingSlot.replaceChildren();
      return;
    }
    if (pending.vaihe === 'mietin') {
      pendingSlot.replaceChildren(valmentajanKupla([
        el('span', { class: 'thinking', 'aria-label': 'Mietin…' },
          'Mietin', el('span', { class: 'thinking-dots', 'aria-hidden': 'true' }, el('i', null, '.'), el('i', null, '.'), el('i', null, '.'))),
      ], { lisaluokka: ' is-thinking' }));
      return;
    }
    if (!pending.runko) {
      pending.runko = el('div', { class: 'typing-body' });
      pendingSlot.replaceChildren(
        valmentajanKupla([pending.runko], { lisaluokka: ' is-typing' }),
        el('p', { class: 'chat-skip-hint' }, 'Napauta näyttääksesi koko vastauksen'));
    }
    const lohkot = muotoile(pending.vastaus.teksti.slice(0, pending.naytetty));
    const kursori = el('span', { class: 'typing-caret', 'aria-hidden': 'true' });
    if (lohkot.length) {
      const viimeinen = lohkot[lohkot.length - 1];
      (viimeinen.tagName === 'UL' ? viimeinen.lastChild : viimeinen).append(kursori);
    } else {
      lohkot.push(kursori);
    }
    pending.runko.replaceChildren(...lohkot);
  }

  function pysaytaAjastin(p) {
    if (!p) return;
    clearTimeout(p.ajastin);
    clearInterval(p.ajastin);
    p.ajastin = null;
  }

  function aloitaKirjoitus() {
    if (!pending) return;
    pending.vaihe = 'kirjoittaa';
    pending.naytetty = 0;
    // Pitkät vastaukset kirjoittuvat nopeammin, jotta mikään ei kestä yli noin 6 sekuntia.
    const nopeus = Math.max(MERKKIA_SEKUNNISSA, pending.vastaus.teksti.length / MAX_KIRJOITUS_S);
    const askel = Math.max(1, Math.round((nopeus * TIKKI_MS) / 1000));
    piirraPending();
    pending.ajastin = setInterval(() => {
      if (!pending) return;
      pending.naytetty += askel;
      if (pending.naytetty >= pending.vastaus.teksti.length) {
        valmis();
        return;
      }
      piirraPending();
      vieritaAlas(false);
    }, TIKKI_MS);
  }

  // Vastaus kokonaan näkyviin ja tilaan yhdellä update()-kutsulla.
  function valmis() {
    if (!pending) return;
    const p = pending;
    pysaytaAjastin(p);
    pending = null;
    const v = p.vastaus;
    const uudet = Array.isArray(v.muistit) ? v.muistit : [];
    const pois = new Set(Array.isArray(v.poistettavat) ? v.poistettavat : []);
    const viesti = {
      id: p.id,
      rooli: 'valmentaja',
      teksti: v.teksti,
      aika: new Date().toISOString(),
      muistit: uudet.map((m) => ({ id: m.id, teksti: m.teksti })),
      ehdotus: v.ehdotus || null,
      ehdotusTila: v.ehdotus ? 'odottaa' : null,
      sirut: Array.isArray(v.sirut) ? v.sirut : [],
    };
    pendingSlot.replaceChildren();
    update((s) => {
      s.chat = rajaa([...(s.chat || []), viesti]);
      s.muistit = [...(s.muistit || []).filter((m) => m && !pois.has(m.id)), ...uudet];
    });
    vieritaAlas(false);
  }

  function laheta(raaka) {
    const teksti = String(raaka || '').trim();
    if (!teksti) return;
    if (pending) valmis(); // edellinen vastaus viimeistellään heti
    syote.value = '';
    lahetaNappi.disabled = true;

    const nyt = new Date().toISOString();
    update((s) => {
      s.chat = rajaa([...(s.chat || []), { id: uusiId(), rooli: 'kayttaja', teksti, aika: nyt }]);
    });
    const vastaus = buildReply(teksti, konteksti(getState(), nyt));
    pending = { id: uusiId(), vastaus, vaihe: 'mietin', naytetty: 0, ajastin: null, runko: null };
    piirraLista(); // jatkosirut piiloon odotuksen ajaksi
    piirraPending();
    paivitaYlaosa();
    vieritaAlas(true);
    const viive = MIETIN_MIN_MS + Math.round(Math.random() * (MIETIN_MAX_MS - MIETIN_MIN_MS));
    pending.ajastin = setTimeout(aloitaKirjoitus, viive);
  }

  function uusiKeskustelu() {
    if (pending) {
      pysaytaAjastin(pending);
      pending = null;
      pendingSlot.replaceChildren();
    }
    update((s) => { s.chat = []; });
    syote.focus({ preventScroll: true });
  }

  const onState = () => {
    piirraLista();
    paivitaYlaosa();
  };
  window.addEventListener('statechange', onState);

  // Sivu suljetaan tai sovellus siirtyy taustalle kesken kirjoituksen: vastaus tallennetaan
  // kokonaisena heti (ajastimet eivät välttämättä enää ehdi ajaa).
  const onPagehide = () => { if (pending) valmis(); };
  const onVisibility = () => { if (document.visibilityState === 'hidden' && pending) valmis(); };
  window.addEventListener('pagehide', onPagehide);
  document.addEventListener('visibilitychange', onVisibility);

  piirraLista();
  paivitaYlaosa();
  // Reititin vierittää sivun alkuun piirron jälkeen; keskustelu avataan viimeisimmästä viestistä.
  raf = requestAnimationFrame(() => {
    raf = 0;
    if ((getState().chat || []).length) vieritaAlas(true);
  });

  return () => {
    window.removeEventListener('statechange', onState);
    window.removeEventListener('pagehide', onPagehide);
    document.removeEventListener('visibilitychange', onVisibility);
    if (raf) cancelAnimationFrame(raf);
    // Kesken jäänyt vastaus tallennetaan kokonaisena, jotta keskustelu ei jää ilman vastausta.
    if (pending) valmis();
  };
}
