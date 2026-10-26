// Treenin ja Treeniscoren jakokortti (speksi 4k A). Kortti piirretään canvasiin 1080 × 1350 px:n
// PNG:ksi brändin väreillä, ja esikatselu näytetään alalaatikossa ennen jakoa.
//
// Rajapinta: openShareSheet({ tyyppi: 'treeni'|'treeniscore', treeni?, tila }) avaa alalaatikon.
// Kortin data tulee engine/share.js:n shareCardData-funktiosta (treeni) tai treeniscoreKortti-
// funktiosta (Treeniscore). Puhtaat apurit (treeniKortti, treeniscoreKortti, rivita,
// jasennaMuunnos, tiedostoNimi) ovat testattavissa ilman DOMia.
//
// Yksityisyys: "Näytä painot" pois → kortin malli tulee shareCardData-funktiosta ilman kilomääriä,
// eikä piirto lisää kortille yhtään lukua mallin ulkopuolelta.
import { getState } from '../store.js?v=31a36ec';
import { tanaanPvm } from '../seed.js?v=31a36ec';
import { LIIKKEET } from '../data.js?v=31a36ec';
import { shareCardData, SANAMERKKI, muscleStrength, treeniscore, scoreTrend } from '../engine.js?v=31a36ec';
import { el, svgEl, sheet, toggle } from './ui.js?v=31a36ec';
import { bodyMap } from './bodymap.js?v=31a36ec';

export const KORTTI_LEVEYS = 1080;
export const KORTTI_KORKEUS = 1350;
const M = 80; // reunus

// Kortin värit ovat kiinteät (brändi), eivät seuraa sovelluksen teemaa.
const SININEN = '#26548F';
const SININEN_TUMMA = '#14325C';
const KULTA = '#C8A42A';
const VALKOINEN = '#FFFFFF';
const HIMMEA = '#DCE4EE';
const SLATE = '#1E293B';
const RYHMA_VARI = { tyonnot: '#7FA8DE', vedot: KULTA, jalat: '#E08AA6' };
const BM_POHJA = 'rgba(255, 255, 255, 0.16)';
const BM_LEPO = 'rgba(255, 255, 255, 0.34)';
const FONTTI = '"Nunito", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const VKP = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];
const RYHMAT = [['tyonnot', 'Työnnöt'], ['vedot', 'Vedot'], ['jalat', 'Jalat']];
const TRENDI_TEKSTI = { nousu: 'nousussa', lasku: 'laskussa', tasainen: 'tasainen' };
const ALATEKSTI = 'Treenattu Personal SuperPowerilla';
// Salaman polku (sama kuin sovelluksen kuvakkeessa, viewBox 64 × 64).
const SALAMA = 'M37 6 15 36h14l-4 22 24-31H34z';

// ---------------------------------------------------------------------------
// Puhtaat apurit

function pvmTeksti(pvm) {
  const d = new Date(`${pvm}T12:00:00Z`);
  const [y, m, p] = String(pvm).split('-').map(Number);
  return `${VKP[d.getUTCDay()]} ${p}.${m}.${y}`;
}

function rajaa(pros) {
  const n = Number(pros);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

// Haasteen arvo-osa share.js:n tekstistä ("Lokakuun 12 treeniä 10/12" → "10/12").
function haasteArvo(h) {
  const t = String(h.teksti || '');
  const nimi = String(h.nimi || '');
  return nimi && t.startsWith(nimi) ? t.slice(nimi.length).replace(/^[:\s]+/, '') : t;
}

/**
 * treeniKortti(data) → kortin malli tai null. data = shareCardData(...).
 * { tyyppi: 'treeni', pvm, pvmTeksti, otsikko, luvut: [{ nimi, arvo }] (3), kohokohdat: [{ tyyppi, teksti }] (≤ 2),
 *   haaste: { nimi, arvo, pros, suoritettu } | null, lihakset: [lihas], alateksti, jakoteksti }
 * Malli sisältää kaikki kortille piirrettävät tekstit, joten painot piilossa siinä ei ole kilomääriä.
 */
export function treeniKortti(data) {
  if (!data) return null;
  const h = data.haaste;
  return {
    tyyppi: 'treeni',
    pvm: data.pvm,
    pvmTeksti: data.pvmTeksti,
    otsikko: data.otsikko,
    luvut: (data.avainluvut || []).slice(0, 3).map((a) => ({ nimi: a.nimi, arvo: a.teksti })),
    kohokohdat: (data.kohokohdat || []).slice(0, 2).map((k) => ({ tyyppi: k.tyyppi, teksti: k.teksti })),
    haaste: h ? { nimi: h.nimi, arvo: haasteArvo(h), pros: rajaa(h.pros), suoritettu: !!h.suoritettu } : null,
    lihakset: (data.lihakset || []).map((l) => l.lihas).filter(Boolean),
    alateksti: ALATEKSTI,
    jakoteksti: data.jakoteksti,
  };
}

/**
 * treeniscoreKortti(tila, tanaan) → kortin malli tai null (Treeniscore lukittu).
 * { tyyppi: 'treeniscore', pvm, pvmTeksti, arvo, trendi: 'nousu'|'lasku'|'tasainen',
 *   ryhmat: [{ avain, nimi, arvo }], alateksti, jakoteksti }
 */
export function treeniscoreKortti(tila, tanaan) {
  const t = tila || {};
  if (typeof tanaan !== 'string') return null;
  const historia = Array.isArray(t.historia) ? t.historia : [];
  const kp = t.profiili ? t.profiili.kehonpaino : undefined;
  const muisti = new Map();
  const ms = (pvm) => {
    if (!muisti.has(pvm)) muisti.set(pvm, muscleStrength(LIIKKEET, historia, kp, pvm));
    return muisti.get(pvm);
  };
  const ts = treeniscore(ms(tanaan));
  if (ts.kokonais === null) return null;
  const trendi = scoreTrend((pvm) => treeniscore(ms(pvm)).kokonais, tanaan).suunta;
  const ryhmat = RYHMAT.map(([avain, nimi]) => ({ avain, nimi, arvo: ts[avain] }));
  const pt = pvmTeksti(tanaan);
  return {
    tyyppi: 'treeniscore',
    pvm: tanaan,
    pvmTeksti: pt,
    arvo: ts.kokonais,
    trendi,
    ryhmat,
    alateksti: ALATEKSTI,
    jakoteksti: [
      `${SANAMERKKI} · ${pt}`,
      `Treeniscore ${ts.kokonais}/100 (${TRENDI_TEKSTI[trendi] || 'tasainen'})`,
      ryhmat.map((r) => `${r.nimi} ${r.arvo ?? '–'}`).join(' · '),
    ].join('\n'),
  };
}

/** tiedostoNimi(malli) → esim. 'superpower-treeni-2026-10-26.png'. */
export function tiedostoNimi(malli) {
  const tyyppi = malli && malli.tyyppi === 'treeniscore' ? 'treeniscore' : 'treeni';
  const pvm = malli && /^\d{4}-\d{2}-\d{2}$/.test(String(malli.pvm)) ? malli.pvm : 'kortti';
  return `superpower-${tyyppi}-${pvm}.png`;
}

/**
 * rivita(teksti, maxLeveys, mittaa, maxRivit = Infinity) → [rivi]
 * Rivittää sanoittain; mittaa(teksti) → leveys. Liian pitkä sana katkaistaan merkeittäin.
 * Jos rivejä tulisi enemmän kuin maxRivit, viimeinen rivi lyhennetään ja päättyy merkkiin '…'.
 */
export function rivita(teksti, maxLeveys, mittaa, maxRivit = Infinity) {
  const sanat = String(teksti ?? '').split(/\s+/).filter(Boolean);
  const rivit = [];
  let rivi = '';
  const lisaaSana = (sana) => {
    if (mittaa(sana) <= maxLeveys) return [sana];
    const osat = [];
    let osa = '';
    for (const merkki of sana) {
      if (osa && mittaa(osa + merkki) > maxLeveys) {
        osat.push(osa);
        osa = merkki;
      } else {
        osa += merkki;
      }
    }
    if (osa) osat.push(osa);
    return osat;
  };
  for (const sana of sanat) {
    const ehdokas = rivi ? `${rivi} ${sana}` : sana;
    if (mittaa(ehdokas) <= maxLeveys) {
      rivi = ehdokas;
      continue;
    }
    if (rivi) rivit.push(rivi);
    const osat = lisaaSana(sana);
    rivit.push(...osat.slice(0, -1));
    rivi = osat[osat.length - 1] || '';
  }
  if (rivi) rivit.push(rivi);
  if (rivit.length <= maxRivit) return rivit;
  const jaljella = rivit.slice(0, Math.max(1, maxRivit));
  let viimeinen = `${jaljella[jaljella.length - 1]}…`;
  while (viimeinen.length > 1 && mittaa(viimeinen) > maxLeveys) viimeinen = `${viimeinen.slice(0, -2).trimEnd()}…`;
  jaljella[jaljella.length - 1] = viimeinen;
  return jaljella;
}

/** jasennaMuunnos('translate(160 0)' | 'matrix(a b c d e f)') → [a, b, c, d, e, f] tai null. */
export function jasennaMuunnos(teksti) {
  const s = String(teksti || '');
  let m = s.match(/translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)/);
  if (m) return [1, 0, 0, 1, Number(m[1]), Number(m[2] || 0)];
  m = s.match(/matrix\(([^)]+)\)/);
  if (m) {
    const v = m[1].trim().split(/[\s,]+/).map(Number);
    if (v.length === 6 && v.every(Number.isFinite)) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Canvas-piirto

function fontti(paino, koko, kursiivi = false) {
  return `${kursiivi ? 'italic ' : ''}${paino} ${koko}px ${FONTTI}`;
}

function pyorea(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Pienentää fonttia, kunnes teksti mahtuu leveyteen. Palauttaa käytetyn koon.
function sovita(ctx, teksti, maxW, paino, koko, minKoko, kursiivi = false) {
  let k = koko;
  ctx.font = fontti(paino, k, kursiivi);
  while (k > minKoko && ctx.measureText(teksti).width > maxW) {
    k -= 2;
    ctx.font = fontti(paino, k, kursiivi);
  }
  return k;
}

function vali(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

// Yläpalkki: salamamerkki ja sanamerkki PERSONAL (sininen) SUPERPOWER (kulta) valkoisella pohjalla.
function piirraYlapalkki(ctx) {
  ctx.fillStyle = VALKOINEN;
  ctx.fillRect(0, 0, KORTTI_LEVEYS, 176);
  const koko = 80;
  const x = M;
  const y = 48;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(koko / 64, koko / 64);
  pyorea(ctx, 0, 0, 64, 64, 14);
  ctx.fillStyle = SININEN;
  ctx.fill();
  ctx.fillStyle = KULTA;
  ctx.fill(new Path2D(SALAMA));
  ctx.restore();

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  vali(ctx, 3);
  ctx.font = fontti(800, 50, true);
  const eka = 'PERSONAL ';
  const tx = x + koko + 26;
  ctx.fillStyle = SININEN;
  ctx.fillText(eka, tx, y + 58);
  const leveys = ctx.measureText(eka).width;
  ctx.fillStyle = KULTA;
  ctx.fillText('SUPERPOWER', tx + leveys, y + 58);
  vali(ctx, 0);
}

function piirraTausta(ctx) {
  const g = ctx.createLinearGradient(0, 176, 0, KORTTI_KORKEUS);
  g.addColorStop(0, SININEN);
  g.addColorStop(1, SININEN_TUMMA);
  ctx.fillStyle = g;
  ctx.fillRect(0, 176, KORTTI_LEVEYS, KORTTI_KORKEUS - 176);
  // Haalea iso salama oikeassa yläkulmassa.
  ctx.save();
  ctx.translate(KORTTI_LEVEYS - 360, 150);
  ctx.scale(7, 7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fill(new Path2D(SALAMA));
  ctx.restore();
  ctx.fillStyle = KULTA;
  ctx.fillRect(0, 176, KORTTI_LEVEYS, 8);
}

function piirraAlaosa(ctx, teksti) {
  const y = KORTTI_KORKEUS - 70;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(M, y - 52, KORTTI_LEVEYS - 2 * M, 2);
  ctx.font = fontti(700, 28);
  ctx.fillStyle = HIMMEA;
  ctx.textAlign = 'left';
  ctx.fillText(teksti, M, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = KULTA;
  ctx.font = fontti(800, 28, true);
  ctx.fillText('#superpower', KORTTI_LEVEYS - M, y);
  ctx.textAlign = 'left';
}

function osioOtsikko(ctx, teksti, x, y) {
  ctx.font = fontti(800, 26);
  vali(ctx, 4);
  ctx.fillStyle = KULTA;
  ctx.fillText(teksti.toUpperCase(), x, y);
  vali(ctx, 0);
}

// Kehokartta canvasiin: bodyMap-SVG:n muodot piirretään Path2D:nä (ei kuvan latausta, ei tainttia).
function piirraKehokartta(ctx, lihakset, x, y, korkeus) {
  const tilat = Object.fromEntries(lihakset.map((l) => [l, 'treenattu']));
  const svg = bodyMap({ puoli: 'molemmat', koko: 'pieni', tilat });
  const [vx, vy, vw, vh] = String(svg.getAttribute('viewBox')).split(/\s+/).map(Number);
  const s = korkeus / vh;
  ctx.save();
  ctx.translate(x - vx * s, y - vy * s);
  ctx.scale(s, s);
  for (const n of svg.querySelectorAll('path, ellipse')) {
    const lihas = n.closest('.bm-muscle');
    ctx.fillStyle = !lihas ? BM_POHJA : lihas.classList.contains('is-idle') ? BM_LEPO : KULTA;
    ctx.save();
    const ketju = [];
    for (let e = n; e && e !== svg; e = e.parentNode) {
      const m = e.getAttribute ? jasennaMuunnos(e.getAttribute('transform')) : null;
      if (m) ketju.unshift(m);
    }
    for (const m of ketju) ctx.transform(...m);
    if (n.tagName.toLowerCase() === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(Number(n.getAttribute('cx')), Number(n.getAttribute('cy')),
        Number(n.getAttribute('rx')), Number(n.getAttribute('ry')), 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fill(new Path2D(n.getAttribute('d')));
    }
    ctx.restore();
  }
  ctx.restore();
  return vw * s;
}

function piirraTreeni(ctx, m) {
  const W = KORTTI_LEVEYS;
  const H = KORTTI_KORKEUS;
  ctx.clearRect(0, 0, W, H);
  piirraYlapalkki(ctx);
  piirraTausta(ctx);
  const mittaa = (t) => ctx.measureText(t).width;
  const leveys = W - 2 * M;

  // Päivä ja treenin nimi
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = fontti(700, 36);
  ctx.fillStyle = HIMMEA;
  ctx.fillText(m.pvmTeksti, M, 262);
  ctx.font = fontti(800, 84, true);
  const otsikkoRivit = rivita(m.otsikko, leveys, mittaa, 2);
  let y = 352;
  ctx.fillStyle = VALKOINEN;
  for (const r of otsikkoRivit) {
    ctx.fillText(r, M, y);
    y += 92;
  }
  y -= 92;

  // Kolme avainlukua
  const ruutuY = y + 50;
  const ruutuK = 196;
  const rako = 28;
  const ruutuL = (leveys - 2 * rako) / 3;
  m.luvut.forEach((l, i) => {
    const rx = M + i * (ruutuL + rako);
    pyorea(ctx, rx, ruutuY, ruutuL, ruutuK, 28);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.fill();
    ctx.font = fontti(700, 30);
    ctx.fillStyle = HIMMEA;
    ctx.fillText(l.nimi, rx + 28, ruutuY + 60);
    sovita(ctx, l.arvo, ruutuL - 56, 800, 66, 34);
    ctx.fillStyle = KULTA;
    ctx.fillText(l.arvo, rx + 28, ruutuY + 150);
  });

  // Haaste alareunaan
  const alaRaja = H - 160;
  let haasteY = alaRaja;
  if (m.haaste) {
    ctx.font = fontti(700, 34);
    const nimiRivit = rivita(m.haaste.nimi, leveys - 260, mittaa, 1);
    const korkeus = 40 + 50 + 30 + 40;
    haasteY = alaRaja - korkeus;
    osioOtsikko(ctx, m.haaste.suoritettu ? 'Haaste suoritettu' : 'Haaste', M, haasteY + 26);
    ctx.font = fontti(700, 34);
    ctx.fillStyle = VALKOINEN;
    ctx.fillText(nimiRivit[0] || '', M, haasteY + 82);
    ctx.textAlign = 'right';
    sovita(ctx, m.haaste.arvo, 240, 800, 40, 26);
    ctx.fillStyle = KULTA;
    ctx.fillText(m.haaste.arvo, W - M, haasteY + 82);
    ctx.textAlign = 'left';
    const palkkiY = haasteY + 110;
    pyorea(ctx, M, palkkiY, leveys, 26, 13);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fill();
    const taytto = (leveys * m.haaste.pros) / 100;
    if (taytto > 0) {
      pyorea(ctx, M, palkkiY, Math.max(26, taytto), 26, 13);
      ctx.fillStyle = KULTA;
      ctx.fill();
    }
    haasteY -= 30;
  }

  // Kohokohdat (vasen) ja kehokartta (oikea)
  const alku = ruutuY + ruutuK + 64;
  const tila = haasteY - alku;
  const naytaKartta = m.lihakset.length > 0 && tila > 160;
  const karttaK = naytaKartta ? Math.min(420, tila - 40) : 0;
  const karttaL = karttaK * (312 / 402);
  const vasenL = naytaKartta ? leveys - karttaL - 40 : leveys;
  if (naytaKartta) {
    const kx = W - M - karttaL;
    piirraKehokartta(ctx, m.lihakset, kx, alku - 20, karttaK);
    ctx.font = fontti(700, 24);
    ctx.fillStyle = HIMMEA;
    ctx.textAlign = 'center';
    ctx.fillText('Treenatut lihakset', kx + karttaL / 2, alku - 20 + karttaK + 34);
    ctx.textAlign = 'left';
  }
  if (m.kohokohdat.length) {
    osioOtsikko(ctx, 'Kohokohdat', M, alku);
    let ky = alku + 34;
    for (const k of m.kohokohdat) {
      ctx.font = fontti(700, 34);
      const tekstiL = vasenL - 76;
      const rivit = rivita(k.teksti, tekstiL, mittaa, 3);
      if (ky + rivit.length * 44 > haasteY) break;
      ctx.beginPath();
      ctx.arc(M + 26, ky + 30, 26, 0, Math.PI * 2);
      ctx.fillStyle = KULTA;
      ctx.fill();
      ctx.fillStyle = SLATE;
      ctx.font = fontti(800, 28);
      ctx.textAlign = 'center';
      ctx.fillText(k.tyyppi === 'ennatys' ? '★' : '↑', M + 26, ky + 40);
      ctx.textAlign = 'left';
      ctx.font = fontti(700, 34);
      ctx.fillStyle = VALKOINEN;
      rivit.forEach((r, i) => ctx.fillText(r, M + 76, ky + 42 + i * 44));
      ky += rivit.length * 44 + 30;
    }
  }

  piirraAlaosa(ctx, m.alateksti);
}

function piirraScore(ctx, m) {
  const W = KORTTI_LEVEYS;
  const H = KORTTI_KORKEUS;
  ctx.clearRect(0, 0, W, H);
  piirraYlapalkki(ctx);
  piirraTausta(ctx);
  const leveys = W - 2 * M;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  osioOtsikko(ctx, 'Treeniscore', M, 280);
  ctx.font = fontti(700, 36);
  ctx.fillStyle = HIMMEA;
  ctx.fillText(m.pvmTeksti, M, 334);

  // Iso luku, asteikko ja trendi
  const luku = String(m.arvo);
  ctx.font = fontti(800, 300);
  ctx.fillStyle = VALKOINEN;
  ctx.fillText(luku, M - 10, 630);
  const lukuL = ctx.measureText(luku).width;
  ctx.font = fontti(800, 64);
  ctx.fillStyle = HIMMEA;
  ctx.fillText('/ 100', M + lukuL + 10, 630);
  const trendi = TRENDI_TEKSTI[m.trendi] || 'tasainen';
  const nuoli = m.trendi === 'nousu' ? '▲ ' : m.trendi === 'lasku' ? '▼ ' : '– ';
  const pilleri = `${nuoli}${trendi.charAt(0).toUpperCase()}${trendi.slice(1)}`;
  ctx.font = fontti(800, 32);
  const pL = ctx.measureText(pilleri).width + 48;
  pyorea(ctx, M + lukuL + 10, 412, pL, 60, 30);
  ctx.fillStyle = m.trendi === 'nousu' ? KULTA : 'rgba(255, 255, 255, 0.16)';
  ctx.fill();
  ctx.fillStyle = m.trendi === 'nousu' ? SLATE : VALKOINEN;
  ctx.fillText(pilleri, M + lukuL + 34, 453);

  // 10-palainen mittari
  const rako = 14;
  const palaL = (leveys - 9 * rako) / 10;
  const palaY = 700;
  const palaK = 56;
  const n = Math.max(0, Math.min(100, m.arvo));
  for (let i = 0; i < 10; i++) {
    const px = M + i * (palaL + rako);
    pyorea(ctx, px, palaY, palaL, palaK, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fill();
    const osuus = Math.max(0, Math.min(1, (n - i * 10) / 10));
    if (osuus > 0) {
      ctx.save();
      pyorea(ctx, px, palaY, palaL, palaK, 14);
      ctx.clip();
      ctx.fillStyle = KULTA;
      ctx.fillRect(px, palaY, palaL * osuus, palaK);
      ctx.restore();
    }
  }
  ctx.font = fontti(700, 26);
  ctx.fillStyle = HIMMEA;
  ctx.fillText('0', M, palaY + palaK + 44);
  ctx.textAlign = 'center';
  ctx.fillText('50 = viitetaso', M + leveys / 2, palaY + palaK + 44);
  ctx.textAlign = 'right';
  ctx.fillText('100', W - M, palaY + palaK + 44);
  ctx.textAlign = 'left';

  // Ryhmien luvut
  const ruutuY = 880;
  const ruutuK = 250;
  const rRako = 28;
  const ruutuL = (leveys - 2 * rRako) / 3;
  m.ryhmat.forEach((r, i) => {
    const rx = M + i * (ruutuL + rRako);
    pyorea(ctx, rx, ruutuY, ruutuL, ruutuK, 28);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rx + 40, ruutuY + 52, 11, 0, Math.PI * 2);
    ctx.fillStyle = RYHMA_VARI[r.avain] || KULTA;
    ctx.fill();
    ctx.font = fontti(700, 32);
    ctx.fillStyle = HIMMEA;
    ctx.fillText(r.nimi, rx + 62, ruutuY + 63);
    ctx.font = fontti(800, 116);
    ctx.fillStyle = VALKOINEN;
    ctx.fillText(r.arvo === null || r.arvo === undefined ? '–' : String(r.arvo), rx + 28, ruutuY + 196);
    ctx.font = fontti(800, 22);
    vali(ctx, 3);
    ctx.fillStyle = KULTA;
    ctx.fillText('MVOIMA', rx + 30, ruutuY + 230);
    vali(ctx, 0);
  });

  ctx.font = fontti(600, 28);
  ctx.fillStyle = HIMMEA;
  ctx.fillText('Kolmen lihasryhmän voima keskimäärin.', M, 1190);

  piirraAlaosa(ctx, m.alateksti);
}

// ---------------------------------------------------------------------------
// Fontit, leikepöytä ja ilmoitus

let fonttiLupaus = null;

// Odottaa Nunito-fontin (ja document.fonts.ready) ennen piirtoa; enintään 3 s, jottei offline-tila jumita.
function fontitValmiina() {
  if (!fonttiLupaus) {
    const lataus = (async () => {
      try {
        if (typeof document === 'undefined' || !document.fonts) return;
        await Promise.all(['800 60px Nunito', 'italic 800 60px Nunito', '700 30px Nunito', '600 30px Nunito']
          .map((f) => document.fonts.load(f).catch(() => null)));
        await document.fonts.ready;
      } catch {
        // Fontteja ei saatu: piirretään varafontilla.
      }
    })();
    fonttiLupaus = Promise.race([lataus, new Promise((r) => setTimeout(r, 3000))]);
  }
  return fonttiLupaus;
}

let ilmoitusAjastin = null;
// Lyhyt ilmoitus näytön alareunaan (sama ulkoasu kuin Yhteisön .yh-toast).
export function jakoIlmoitus(teksti) {
  const vanha = document.querySelector('.yh-toast');
  if (vanha) vanha.remove();
  clearTimeout(ilmoitusAjastin);
  const t = el('div', { class: 'yh-toast', role: 'status', 'aria-live': 'polite' }, teksti);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('is-visible'));
  ilmoitusAjastin = setTimeout(() => {
    t.classList.remove('is-visible');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

/** kopioiLeikepoydalle(teksti) → Promise<boolean>. Clipboard API, varalla execCommand('copy'). */
export function kopioiLeikepoydalle(teksti) {
  const vara = () => {
    try {
      const alue = document.createElement('textarea');
      alue.value = teksti;
      alue.setAttribute('readonly', '');
      alue.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
      document.body.append(alue);
      alue.select();
      const ok = document.execCommand && document.execCommand('copy');
      alue.remove();
      return !!ok;
    } catch {
      return false;
    }
  };
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(teksti).then(() => true, () => vara());
    }
  } catch {
    // Leikepöytä ei ole käytettävissä: kokeillaan varatapaa.
  }
  return Promise.resolve(vara());
}

export function jakoIkoni(koko = 18) {
  return svgEl('svg', { viewBox: '0 0 24 24', width: koko, height: koko, 'aria-hidden': 'true', class: 'jk-ico' },
    ...['M12 3.5v11', 'M7.5 8 12 3.5 16.5 8', 'M5 12.5v6a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-6'].map((d) => svgEl('path', {
      d, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })));
}

function tiedostoJakoTuettu() {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') return false;
    return navigator.canShare({ files: [new File([new Uint8Array([0])], 'testi.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Alalaatikko

/**
 * openShareSheet({ tyyppi: 'treeni'|'treeniscore', treeni?, tila }) → { close } | null
 * Treeni: kytkimet "Näytä painot" ja "Näytä haaste" (jälkimmäinen vain, jos haaste on).
 * Treeniscore: ei kytkimiä (kortissa ei ole kiloja eikä haastetta).
 * Painikkeet: Jaa (vain kun laite tukee tiedostojakoa), Tallenna kuva ja Kopioi teksti.
 */
export function openShareSheet({ tyyppi = 'treeni', treeni = null, tila } = {}) {
  const t = tila || getState() || {};
  const score = tyyppi === 'treeniscore';
  let naytaPainot = true;
  let naytaHaaste = true;

  const malli = () => (score
    ? treeniscoreKortti(t, tanaanPvm(new Date().toISOString()))
    : treeniKortti(shareCardData(treeni, t, { naytaPainot, naytaHaaste })));
  let nyky = malli();
  if (!nyky) return null;
  const haasteOn = !score && !!nyky.haaste;

  const canvas = el('canvas', { class: 'jk-canvas', width: KORTTI_LEVEYS, height: KORTTI_KORKEUS, role: 'img', 'aria-label': 'Jakokortin esikatselu' });
  const kehys = el('div', { class: 'jk-preview is-loading' }, canvas);
  let kuva = null; // valmis PNG-blob (Jaa tarvitsee sen heti käyttäjän eleessä)
  let piirtoNro = 0;

  async function piirra() {
    const nro = ++piirtoNro;
    kuva = null;
    nyky = malli();
    kehys.classList.add('is-loading');
    await fontitValmiina();
    if (nro !== piirtoNro || !nyky) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (score) piirraScore(ctx, nyky);
    else piirraTreeni(ctx, nyky);
    canvas.setAttribute('aria-label', `Jakokortti: ${String(nyky.jakoteksti || '').replace(/\n/g, '. ')}`);
    kehys.classList.remove('is-loading');
    try {
      canvas.toBlob((b) => { if (nro === piirtoNro) kuva = b; }, 'image/png');
    } catch (err) {
      console.error(err);
    }
  }

  function kytkin(otsikko, ali, arvo, onChange) {
    return el('div', { class: 'row jk-toggle' },
      el('span', { class: 'row-title' }, otsikko, el('span', { class: 'jk-toggle-sub' }, ali)),
      toggle({ arvo, label: otsikko, onChange }));
  }

  const kytkimet = score ? null : el('div', { class: 'jk-toggles' },
    kytkin('Näytä painot', 'Pois: vain prosentit ja ennätysten määrä', naytaPainot, (v) => { naytaPainot = v; piirra(); }),
    haasteOn ? kytkin('Näytä haaste', 'Liitetyn haasteen eteneminen kortissa', naytaHaaste, (v) => { naytaHaaste = v; piirra(); }) : null);

  function tallennaKuva() {
    const tee = (b) => {
      if (!b) {
        jakoIlmoitus('Kuvan luonti ei onnistunut');
        return;
      }
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = tiedostoNimi(nyky);
      a.hidden = true;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      jakoIlmoitus('Kuva tallennettu ✓');
    };
    if (kuva) tee(kuva);
    else {
      try {
        canvas.toBlob(tee, 'image/png');
      } catch {
        tee(null);
      }
    }
  }

  function jaa() {
    if (!kuva) {
      jakoIlmoitus('Kuva on vielä tekeillä, yritä hetken päästä');
      return;
    }
    try {
      const tiedosto = new File([kuva], tiedostoNimi(nyky), { type: 'image/png' });
      if (!navigator.canShare || !navigator.canShare({ files: [tiedosto] })) {
        jakoIlmoitus('Laite ei tue kuvan jakamista. Tallenna kuva tai kopioi teksti.');
        return;
      }
      navigator.share({ files: [tiedosto], text: nyky.jakoteksti }).catch((err) => {
        if (err && err.name === 'AbortError') return;
        jakoIlmoitus('Jakaminen ei onnistunut');
      });
    } catch {
      jakoIlmoitus('Jakaminen ei onnistunut');
    }
  }

  function kopioiTeksti() {
    kopioiLeikepoydalle(nyky.jakoteksti).then((ok) => jakoIlmoitus(ok ? 'Teksti kopioitu ✓' : 'Kopiointi ei onnistunut'));
  }

  const toiminnot = el('div', { class: 'jk-actions' },
    tiedostoJakoTuettu()
      ? el('button', { class: 'btn btn-primary jk-share', type: 'button', onClick: jaa }, jakoIkoni(20), 'Jaa')
      : null,
    el('div', { class: 'jk-actions-row' },
      el('button', { class: 'btn jk-save', type: 'button', onClick: tallennaKuva }, 'Tallenna kuva'),
      el('button', { class: 'btn jk-copy', type: 'button', onClick: kopioiTeksti }, 'Kopioi teksti')));

  const sisalto = el('div', { class: 'jk-sheet' },
    el('h2', { class: 'sheet-title' }, score ? 'Jaa Treeniscore' : 'Jaa treeni'),
    kehys,
    kytkimet,
    toiminnot,
    el('p', { class: 'muted small jk-note' }, 'Kortti tehdään laitteellasi. Mitään ei lähetetä ennen kuin jaat sen itse.'));

  const laatikko = sheet(sisalto);
  piirra();
  return laatikko;
}
