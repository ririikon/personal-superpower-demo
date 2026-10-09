// Kehokartta (speksi 6.4 ja 4e): oma, tyylitelty SVG-ihmishahmo etu- ja takapuolelta.
// Lihasalueet vastaavat datan lihasryhmiä (LIHASRYHMAT). Värit tulevat CSS-tokeneista
// (luokat .bm-*, ks. styles.css osio T10).
//
// bodyMap({ puoli, tilat, koko, onSelect, valittu }) → SVGElement
//   puoli:   'etu' | 'taka' | 'molemmat' (pienen version oletus 'molemmat', ison 'etu')
//   tilat:   { [lihas]: 'väsynyt' | 'palautumassa' | 'palautunut' | 'treenattu' }
//   koko:    'iso' (klikattava) | 'pieni' (aikajanan kuvake, vain korostetut lihakset värillä)
//   onSelect(lihas): kutsutaan, kun lihasaluetta napautetaan (vain iso versio)
//   valittu: lihasryhmä, joka saa valintareunuksen
import { svgEl } from './ui.js?v=270067f';

const LEVEYS = 200; // peilaus x = 200 - x

function rr(x, y, w, h, r) {
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}`
    + `h-${w - 2 * r}a${r} ${r} 0 0 1 -${r} -${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r} -${r}z`;
}

// Vasemman puoliskon muodot (katsojan vasen); oikea puolisko peilataan.
// keski: true = muoto piirretään kerran peilaamatta.
const PAA = { tag: 'ellipse', cx: 100, cy: 30, rx: 17, ry: 21, keski: true };
const KAULA = { d: 'M91 48 L109 48 L111 62 L89 62 Z', keski: true };
const KYYNARVARSI = 'M39 157 C35 170 31 186 29 201 L40 203 C44 189 49 174 52 157 Z';
const KASI = { tag: 'ellipse', cx: 34, cy: 213, rx: 6, ry: 10 };
const OLKAVARSI = 'M46 108 C41 116 38 128 38 140 C38 148 41 153 46 153 C52 151 56 141 57 129 C58 119 56 111 51 106 Z';

const ETU = {
  pohja: [
    PAA, KAULA,
    { d: KYYNARVARSI }, KASI,
    { d: 'M72 178 C78 182 86 186 97 188 L97 206 C88 200 78 193 70 187 Z' },
    { tag: 'ellipse', cx: 80, cy: 296, rx: 9, ry: 7 },
    { d: 'M79 305 C77 330 78 358 81 380 L90 380 C92 352 92 326 88 305 Z' },
    { d: 'M80 384 L92 384 C96 392 98 398 94 402 L78 402 C76 396 77 390 80 384 Z' },
  ],
  lihakset: {
    olkapäät: ['M84 63 C72 61 58 64 50 74 C45 81 44 92 46 103 C52 99 58 93 62 86 C66 78 72 70 84 63 Z'],
    rinta: ['M97 67 L97 108 C88 113 76 112 68 106 C64 99 63 91 65 85 C69 76 78 68 97 67 Z'],
    hauis: [OLKAVARSI],
    vatsa: [
      rr(86, 114, 11, 18, 4), rr(86, 135, 11, 18, 4), rr(86, 156, 11, 22, 4),
      'M70 112 C76 115 80 117 83 118 L83 172 C78 168 74 160 72 150 C70 138 69 124 70 112 Z',
    ],
    etureidet: ['M70 190 C64 212 62 242 66 270 C69 282 77 288 86 286 C93 266 97 236 97 210 C90 202 80 196 70 190 Z'],
    pohkeet: ['M69 304 C64 320 64 342 69 362 L75 363 C73 342 73 322 76 305 Z'],
  },
};

const TAKA = {
  pohja: [
    PAA, KAULA,
    { d: KYYNARVARSI }, KASI,
    { tag: 'ellipse', cx: 82, cy: 296, rx: 9, ry: 6 },
    { d: 'M78 358 L77 382 L89 382 L88 358 Z' },
    { d: 'M77 385 L91 385 C93 392 93 398 90 402 L78 402 C75 397 75 391 77 385 Z' },
  ],
  lihakset: {
    selkä: [
      'M97 50 C94 58 87 62 74 66 C80 76 90 92 97 112 Z',
      'M68 84 C65 102 66 126 72 150 C80 162 89 168 97 170 L97 120 C90 108 80 96 68 84 Z',
      'M86 173 L97 175 L97 187 L82 185 C83 181 84 177 86 173 Z',
    ],
    olkapäät: ['M72 64 C62 63 52 67 48 76 C44 84 44 94 46 102 C52 98 58 92 62 85 C65 77 68 70 72 64 Z'],
    ojentajat: [OLKAVARSI],
    pakarat: ['M97 190 C86 188 73 191 69 203 C66 216 72 229 85 231 C93 231 97 225 97 216 Z'],
    takareidet: ['M70 235 C66 252 67 272 73 287 L95 287 C97 270 97 250 93 235 C86 232 77 232 70 235 Z'],
    pohkeet: ['M72 302 C66 318 66 338 74 354 C80 360 88 358 91 348 C94 332 92 314 88 302 C82 298 77 298 72 302 Z'],
  },
};

// Millä puolella kukin lihasryhmä näkyy (näkymät käyttävät oletuspuolen valintaan).
export const PUOLET = {
  etu: Object.keys(ETU.lihakset),
  taka: Object.keys(TAKA.lihakset),
};

const TILALUOKKA = {
  väsynyt: 'is-fatigued',
  palautumassa: 'is-recovering',
  palautunut: 'is-recovered',
  treenattu: 'is-hit',
};

const TILATEKSTI = {
  väsynyt: 'väsynyt',
  palautumassa: 'palautumassa',
  palautunut: 'palautunut',
  treenattu: 'treenattu',
};

function isoAlku(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const PEILI = `matrix(-1 0 0 1 ${LEVEYS} 0)`;

function muoto(osa, peilaa) {
  const attrs = osa.tag === 'ellipse'
    ? { cx: osa.cx, cy: osa.cy, rx: osa.rx, ry: osa.ry }
    : { d: osa.d };
  if (peilaa) attrs.transform = PEILI;
  return svgEl(osa.tag || 'path', attrs);
}

function kaksoset(osa) {
  return osa.keski ? [muoto(osa, false)] : [muoto(osa, false), muoto(osa, true)];
}

function hahmo(maaritys, { tilat, iso, onSelect, valittu, puoliNimi }) {
  const g = svgEl('g', { class: 'bm-figure' });
  g.append(svgEl('g', { class: 'bm-base' }, ...maaritys.pohja.flatMap(kaksoset)));
  for (const [lihas, polut] of Object.entries(maaritys.lihakset)) {
    const tila = tilat[lihas];
    const korostettu = tila === 'väsynyt' || tila === 'palautumassa' || tila === 'treenattu' || tila === true;
    let luokka = 'bm-muscle';
    if (iso) luokka += ` ${TILALUOKKA[tila] || 'is-recovered'}`;
    else luokka += korostettu ? ` ${tila === 'palautumassa' ? 'is-recovering' : 'is-hit'}` : ' is-idle';
    if (iso && valittu === lihas) luokka += ' is-selected';
    const attrs = { class: luokka, dataset: { lihas } };
    if (iso && onSelect) {
      Object.assign(attrs, {
        role: 'button',
        tabindex: '0',
        'aria-label': `${isoAlku(lihas)} (${puoliNimi}): ${TILATEKSTI[tila] || 'palautunut'}`,
        'aria-pressed': String(valittu === lihas),
        onClick: (e) => { e.stopPropagation(); onSelect(lihas); },
        onKeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(lihas);
          }
        },
      });
    }
    g.append(svgEl('g', attrs, ...polut.flatMap((d) => [muoto({ d }, false), muoto({ d }, true)])));
  }
  return g;
}

export function bodyMap({ puoli, tilat = {}, koko = 'iso', onSelect, valittu } = {}) {
  const iso = koko !== 'pieni';
  const p = puoli || (iso ? 'etu' : 'molemmat');
  const t = tilat || {};

  if (p === 'molemmat') {
    const svg = svgEl('svg', {
      class: `bodymap bodymap-${iso ? 'iso' : 'pieni'} bodymap-both`,
      viewBox: '24 4 312 402',
      'aria-hidden': iso ? null : 'true',
      role: iso ? 'group' : null,
      'aria-label': iso ? 'Kehokartta' : null,
      focusable: 'false',
    });
    svg.append(hahmo(ETU, { tilat: t, iso, onSelect, valittu, puoliNimi: 'etupuoli' }));
    const taka = hahmo(TAKA, { tilat: t, iso, onSelect, valittu, puoliNimi: 'takapuoli' });
    taka.setAttribute('transform', 'translate(160 0)');
    svg.append(taka);
    return svg;
  }

  const etu = p !== 'taka';
  const svg = svgEl('svg', {
    class: `bodymap bodymap-${iso ? 'iso' : 'pieni'}`,
    viewBox: '24 4 152 402',
    role: iso ? 'group' : null,
    'aria-label': iso ? `Kehokartta, ${etu ? 'etupuoli' : 'takapuoli'}` : null,
    'aria-hidden': iso ? null : 'true',
    focusable: 'false',
  });
  svg.append(hahmo(etu ? ETU : TAKA, { tilat: t, iso, onSelect, valittu, puoliNimi: etu ? 'etupuoli' : 'takapuoli' }));
  return svg;
}
