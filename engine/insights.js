// Treenin jälkeiset oivallukset (speksi 4g, muistit ja viikkosuunnitelma 4h).
// Puhdas moduuli: ei DOM-, window-, localStorage- eikä Date.now()-kutsuja.

import { addDays, daysBetween, weekStart, hoursBetween, onVoimatreeni, onTyosarja } from './util.js';
import { e1rm, detectStall } from './progression.js';
import { recovery } from './recovery.js';
import { weeklyTargets, weeklyProgress, RYHMAT_T } from './targets.js';
import { workoutSummary } from './history.js';

const MAX_EDISTYS = 3;
const MAX_HUOMIO = 2;
const PALAUTUNUT_PROS = 90;
const MAX_ODOTUS_H = 240;
const LAJISANAT = ['padel', 'tennis', 'sulkapallo', 'juoksu', 'golf'];
// Demon oletus: lajipäivä kuormittaa näitä lihaksia 4 sarjan verran (padelin arvio, speksi 4h).
const LAJIKUORMA = { etureidet: 4, pohkeet: 4, olkapäät: 4 };
const NOSTOSYYT = ['double-progression', 'rir-high'];
const VIIKONPAIVAT = ['sunnuntaina', 'maanantaina', 'tiistaina', 'keskiviikkona', 'torstaina', 'perjantaina', 'lauantaina'];
const RYHMANIMET = { tyonnot: 'Työnnöt', vedot: 'Vedot', jalat: 'Jalat' };
const ENNATYSJARJESTYS = ['arvioituVoima', 'paino', 'volyymi', 'toistot'];

// --- Muotoilu --------------------------------------------------------------

function luku(n, desimaalit = 1) {
  const k = 10 ** desimaalit;
  const pyor = Math.round(n * k) / k;
  const [koko, des] = String(Math.abs(pyor)).split('.');
  const ryhmitelty = koko.length > 4 ? koko.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : koko;
  return (pyor < 0 ? '−' : '') + ryhmitelty + (des ? ',' + des : '');
}

function isoAlku(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function lista(sanat) {
  if (sanat.length <= 1) return sanat.join('');
  return sanat.slice(0, -1).join(', ') + ' ja ' + sanat[sanat.length - 1];
}

// --- Aika ------------------------------------------------------------------

function tanaanNyt(nyt) {
  return String(nyt).slice(0, 10);
}

// Kellonaika tunteina merkkijonosta (ei aikavyöhykemuunnosta, jotta päivä pysyy samana kuin nyt-merkkijonossa).
function kellonaikaH(nyt) {
  const m = /T(\d{2}):(\d{2})/.exec(String(nyt));
  return m ? Number(m[1]) + Number(m[2]) / 60 : 12;
}

function lisaaTunteja(iso, h) {
  return new Date(Date.parse(iso) + h * 3600000).toISOString();
}

/**
 * Ajankohdan teksti: sama päivä → "N h päästä" (0 h → "heti"), seuraava päivä → "huomenna",
 * 2–6 päivän päästä viikonpäivä ("lauantaina"), muuten "N h päästä".
 */
function ajankohtaTeksti(nyt, tunteja) {
  const tanaan = tanaanNyt(nyt);
  const paivaero = Math.floor((kellonaikaH(nyt) + tunteja) / 24);
  const pvm = addDays(tanaan, paivaero);
  let teksti;
  if (paivaero <= 0) teksti = tunteja <= 0 ? 'heti' : `${tunteja} h päästä`;
  else if (paivaero === 1) teksti = 'huomenna';
  else if (paivaero <= 6) teksti = VIIKONPAIVAT[new Date(pvm + 'T12:00:00Z').getUTCDay()];
  else teksti = `${tunteja} h päästä`;
  return { teksti, pvm, tunteja };
}

// --- Data-apurit -----------------------------------------------------------

function tyoSarjat(sarjat) {
  return (sarjat || []).filter(
    (s) => onTyosarja(s) && Number.isFinite(s.paino) && Number.isFinite(s.toistot) && s.toistot > 0,
  );
}

function vertaaAika(a, b) {
  if (a.pvm !== b.pvm) return a.pvm < b.pvm ? -1 : 1;
  const aa = a.aloitus || '';
  const bb = b.aloitus || '';
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}

// Liikkeen aiemmat kerrat aikajärjestyksessä: [{ pvm, sarjat }] (vain kerrat, joissa työsarjoja).
function liikkeenKerrat(liikeId, treenit) {
  const tulos = [];
  for (const t of (treenit || []).filter(onVoimatreeni).slice().sort(vertaaAika)) {
    const sarjat = [];
    for (const tl of t.liikkeet || []) if (tl.liikeId === liikeId) sarjat.push(...tyoSarjat(tl.sarjat));
    if (sarjat.length) tulos.push({ pvm: t.pvm, sarjat });
  }
  return tulos;
}

// Kerran paras mittari: e1RM, tai paras toistomäärä, jos kaikki painot ovat 0 (kehonpaino).
function parasMittari(sarjat, kehonpaino) {
  const kaikkiNolla = sarjat.every((s) => s.paino === 0);
  if (kehonpaino || kaikkiNolla) return { arvo: Math.max(...sarjat.map((s) => s.toistot)), yksikko: 'toistoa' };
  return { arvo: Math.max(...sarjat.map((s) => e1rm(s.paino, s.toistot))), yksikko: 'kg' };
}

function treeninLiikkeet(treeni) {
  const ids = [];
  for (const tl of (treeni && treeni.liikkeet) || []) {
    if (!ids.includes(tl.liikeId) && tyoSarjat(tl.sarjat).length) ids.push(tl.liikeId);
  }
  return ids;
}

function voimassa(muisti, tanaan) {
  if (!muisti) return false;
  if (muisti.voimassaAlku && muisti.voimassaAlku > tanaan) return false;
  if (muisti.voimassaLoppu && muisti.voimassaLoppu < tanaan) return false;
  return true;
}

function lajiMuisti(muistit, tanaan) {
  return (muistit || []).find((m) => voimassa(m, tanaan)
    && LAJISANAT.some((s) => String(m.teksti || '').toLowerCase().includes(s))) || null;
}

// Viikkosuunnitelma, joka koskee tanaan-päivää (hyväksyy myös listan).
function voimassaOlevaSuunnitelma(viikkosuunnitelma, tanaan) {
  const ehdokkaat = Array.isArray(viikkosuunnitelma) ? viikkosuunnitelma : [viikkosuunnitelma];
  return ehdokkaat.find((s) => s && (!s.viikonAlku
    || (s.viikonAlku <= tanaan && tanaan < addDays(s.viikonAlku, 7)))) || null;
}

// Menneet (tai toteutuneiksi kirjatut) lajipäivät palautumisen kuormiksi.
function lajiKuormat(suunnitelma, tanaan) {
  if (!suunnitelma) return [];
  return (suunnitelma.paivat || [])
    .filter((p) => p && p.tyyppi === 'laji' && p.pvm && (p.pvm < tanaan || (p.toteutunut && p.pvm <= tanaan)))
    .map((p) => ({ aika: `${p.pvm}T18:00:00`, lihakset: { ...LAJIKUORMA } }));
}

// Seuraava ohjelmapäivä: treeni.paivaNimi:n jälkeinen päivä (kiertävä). Jos päivää ei
// tunnisteta, käytetään historian viimeisintä saman ohjelman päivää; muuten ohjelman 1. päivä.
function seuraavaPaiva(ohjelma, treeni, historia) {
  const paivat = (ohjelma && ohjelma.paivat) || [];
  if (!paivat.length) return null;
  const indeksi = (nimi) => paivat.findIndex((p) => p.nimi === nimi);
  let i = treeni ? indeksi(treeni.paivaNimi) : -1;
  if (i < 0) {
    const aiemmat = (historia || [])
      .filter((t) => t && t.paivaNimi && (!t.ohjelmaId || t.ohjelmaId === ohjelma.id))
      .slice().sort(vertaaAika);
    for (let k = aiemmat.length - 1; k >= 0 && i < 0; k--) i = indeksi(aiemmat[k].paivaNimi);
  }
  return paivat[(i + 1) % paivat.length];
}

function paivanLihakset(paiva, lmap) {
  const lihakset = [];
  for (const r of (paiva && paiva.liikkeet) || []) {
    const l = lmap.get(r.liikeId);
    if (l && l.lihasryhma && !lihakset.includes(l.lihasryhma)) lihakset.push(l.lihasryhma);
  }
  return lihakset;
}

// Tunnit nyt-hetkestä siihen, kun kaikki annetut lihakset ovat vähintään 90 %:ssa.
function tunnitPalautumiseen(lihakset, liikkeet, treenit, nyt, kuormat) {
  if (!lihakset.length) return 0;
  for (let h = 0; h <= MAX_ODOTUS_H; h++) {
    const r = recovery(liikkeet, treenit, lisaaTunteja(nyt, h), kuormat);
    if (lihakset.every((l) => !r.lihakset[l] || r.lihakset[l].palautuminenPros >= PALAUTUNUT_PROS)) return h;
  }
  return MAX_ODOTUS_H;
}

function kortti(tyyppi, prioriteetti, otsikko, teksti, miksi, lisa = {}) {
  return { tyyppi, otsikko, teksti, miksi, prioriteetti, ...lisa };
}

// --- Edistys-säännöt ---------------------------------------------------------

function ennatysTeksti(e) {
  const kg = (n) => `${luku(n)} kg`;
  switch (e.tyyppi) {
    case 'arvioituVoima':
      return e.yksikko === 'toistoa'
        ? `${e.nimi}: uusi ennätys ${luku(e.arvo)} toistoa (+${luku(e.arvo - e.aiempi)})`
        : `${e.nimi}: uusi arvioitu maksimi ${kg(e.arvo)} (+${kg(e.arvo - e.aiempi)})`;
    case 'paino':
      return `${e.nimi}: raskain paino ${kg(e.arvo)} (+${kg(e.arvo - e.aiempi)})`;
    case 'volyymi':
      return `${e.nimi}: uusi volyymiennätys ${luku(e.arvo, 0)} kg (+${luku(e.arvo - e.aiempi, 0)} kg)`;
    default:
      return `${e.nimi}: eniten toistoja yhdessä sarjassa, ${e.arvo} (+${e.arvo - e.aiempi})`;
  }
}

function saantoEnnatys(yhteenveto) {
  const ennatykset = yhteenveto.ennatykset.slice().sort(
    (a, b) => ENNATYSJARJESTYS.indexOf(a.tyyppi) - ENNATYSJARJESTYS.indexOf(b.tyyppi),
  );
  if (!ennatykset.length) return null;
  const paras = ennatykset[0];
  const muut = ennatykset.length - 1;
  return kortti('edistys', 1,
    ennatykset.length > 1 ? `${ennatykset.length} uutta ennätystä` : 'Uusi ennätys',
    `${ennatysTeksti(paras)}.` + (muut > 0 ? ` Lisäksi ${muut} muuta ennätystä tässä treenissä.` : ''),
    `Ennätys syntyy, kun tämän treenin tulos ylittää liikkeen aiemman parhaan (arvioitu maksimi, raskain paino, ` +
    `volyymi tai toistot). Aiempi paras: ${paras.yksikko === 'kg' ? `${luku(paras.aiempi)} kg` : `${luku(paras.aiempi)} toistoa`}, ` +
    `nyt ${paras.yksikko === 'kg' ? `${luku(paras.arvo)} kg` : `${luku(paras.arvo)} toistoa`}.`,
    { liikeId: paras.liikeId });
}

function saantoVoimaNousi(treeni, historia, lmap, ennatysLiikkeet) {
  let paras = null;
  for (const id of treeninLiikkeet(treeni)) {
    const l = lmap.get(id);
    if ((l && l.valine === 'kehonpaino') || ennatysLiikkeet.has(id)) continue;
    const kerrat = liikkeenKerrat(id, historia);
    if (!kerrat.length) continue;
    const nytSarjat = liikkeenKerrat(id, [treeni])[0];
    if (!nytSarjat) continue;
    const ennen = parasMittari(kerrat[kerrat.length - 1].sarjat, false);
    const nyt = parasMittari(nytSarjat.sarjat, false);
    if (ennen.yksikko !== 'kg' || nyt.yksikko !== 'kg' || !(ennen.arvo > 0)) continue;
    const muutos = (nyt.arvo - ennen.arvo) / ennen.arvo;
    if (muutos > 0.01 && (!paras || muutos > paras.muutos)) {
      paras = { id, nimi: (l && l.nimi) || id, muutos, ennen: ennen.arvo, nyt: nyt.arvo, pvm: kerrat[kerrat.length - 1].pvm };
    }
  }
  if (!paras) return null;
  const pros = Math.round(paras.muutos * 100);
  return kortti('edistys', 2, 'Arvioitu voima nousi',
    `${paras.nimi} +${pros} % edelliskertaan: arvioitu maksimi ${luku(paras.ennen)} kg → ${luku(paras.nyt)} kg.`,
    'Arvioitu maksimi (e1RM) lasketaan parhaasta sarjasta painon ja toistojen perusteella. ' +
    `Yli 1 %:n nousu edelliskertaan (${paras.pvm}) kertoo, että progressiivinen ylikuormitus toimii.`,
    { liikeId: paras.id });
}

function saantoVolyymi(treeni, historia, liikkeet, yhteenveto) {
  if (!treeni.paivaNimi) return null;
  const edelliset = (historia || [])
    .filter((t) => onVoimatreeni(t) && t.paivaNimi === treeni.paivaNimi
      && (!treeni.ohjelmaId || !t.ohjelmaId || t.ohjelmaId === treeni.ohjelmaId))
    .slice().sort(vertaaAika);
  const edellinen = edelliset[edelliset.length - 1];
  if (!edellinen) return null;
  const ennen = workoutSummary(edellinen, liikkeet, []).volyymi;
  const nyt = yhteenveto.volyymi;
  if (!(ennen > 0) || !((nyt - ennen) / ennen > 0.05)) return null;
  const pros = Math.round(((nyt - ennen) / ennen) * 100);
  return kortti('edistys', 3, 'Volyymi kasvoi',
    `${treeni.paivaNimi}: volyymi ${luku(nyt, 0)} kg, +${pros} % edelliskertaan (${luku(ennen, 0)} kg).`,
    'Volyymi (sarjat × toistot × paino) on yksi lihaskasvun tärkeimmistä ajureista. ' +
    `Vertailu tehdään saman ohjelmapäivän edelliseen kertaan (${edellinen.pvm}), ja kasvun raja on yli 5 %.`);
}

function saantoEhdotukset(treeni) {
  const nostot = (treeni.ehdotukset || []).filter(
    (e) => e && e.hyvaksytty === true && e.ehdotus && NOSTOSYYT.includes(e.ehdotus.syy),
  );
  const onnistuneet = nostot.filter((e) => {
    const tl = (treeni.liikkeet || []).find((l) => l.liikeId === e.liikeId);
    const s = tl && (tl.sarjat || [])[e.sarjaIndeksi];
    return !!s && Number.isFinite(s.toistot) && s.toistot >= e.ehdotus.toistot;
  });
  if (onnistuneet.length < 2) return null;
  return kortti('edistys', 4, 'Ehdotukset toimivat',
    `Hyväksyit ${nostot.length} painonnostoehdotusta, ja ${onnistuneet.length} sarjassa yllit tavoitetoistoihin.`,
    'Kaksoisprogressio ja RIR-autoregulaatio nostavat painoa vasta, kun edellinen kuorma on hallussa. ' +
    `Kun nostettu paino menee tavoitetoistoilla läpi (tässä ${onnistuneet.length}/${nostot.length}), nousu oli oikean kokoinen.`);
}

function saantoJumiPurkautui(treeni, historia, lmap) {
  for (const id of treeninLiikkeet(treeni)) {
    const kerrat = liikkeenKerrat(id, historia);
    if (!detectStall(kerrat)) continue;
    const l = lmap.get(id);
    const kp = !!l && l.valine === 'kehonpaino';
    const ikkuna = kerrat.slice(-3);
    const kaikkiNolla = ikkuna.every((k) => k.sarjat.every((s) => s.paino === 0));
    const aiempi = Math.max(...ikkuna.map((k) => parasMittari(k.sarjat, kp || kaikkiNolla).arvo));
    const nyt = parasMittari(liikkeenKerrat(id, [treeni])[0].sarjat, kp || kaikkiNolla);
    if (nyt.arvo > aiempi + 1e-9) {
      const nimi = (l && l.nimi) || id;
      const yks = nyt.yksikko === 'kg' ? ' kg' : ' toistoa';
      return kortti('edistys', 5, 'Jumi purkautui',
        `${nimi} ylitti jumivaiheen parhaan: ${luku(aiempi)}${yks} → ${luku(nyt.arvo)}${yks}.`,
        'Liike oli jumissa: paras arvioitu maksimi ei noussut kolmeen kertaan. ' +
        'Nyt tulos ylitti noiden kertojen parhaan, joten kehitys on taas käynnissä.',
        { liikeId: id });
    }
  }
  return null;
}

// --- Huomio-säännöt ----------------------------------------------------------

function saantoPalautuminenJalkeen(konteksti) {
  const { seuraava, seuraavanLihakset, jalkeen, liikkeet, treenitJalkeen, nyt, kuormat } = konteksti;
  if (!seuraava) return null;
  const vasyneet = seuraavanLihakset.filter((l) => jalkeen.lihakset[l] && jalkeen.lihakset[l].tila === 'väsynyt');
  if (!vasyneet.length) return null;
  const ajat = vasyneet.map((l) => ({ l, h: tunnitPalautumiseen([l], liikkeet, treenitJalkeen, nyt, kuormat) }))
    .sort((a, b) => b.h - a.h);
  const pahin = ajat[0];
  const aika = ajankohtaTeksti(nyt, pahin.h);
  // Iso alkukirjain vain lauseen alussa: "Takareidet, selkä ja pohkeet palautuvat".
  const nimet = isoAlku(lista(vasyneet));
  const monta = vasyneet.length > 1;
  return kortti('huomio', 1, 'Palautuminen',
    `${nimet} ${monta ? 'palautuvat' : 'palautuu'} noin ${pahin.h} tunnissa. ` +
    `Seuraava treeni (${seuraava.nimi}) kuormittaa ${monta ? 'niitä' : 'sitä'}, joten jos treenaat ennen palautumista ` +
    `(${aika.teksti}), harkitse ylävartalopäivää tai kevyempää versiota.`,
    'Lihas on väsynyt, kun palautumista on alle 50 %. Palautumisaika riippuu sarjamäärästä: alle 6 sarjaa 48 h, ' +
    `6–10 sarjaa 72 h ja yli 10 sarjaa 96 h. ${isoAlku(pahin.l)}: nyt ${jalkeen.lihakset[pahin.l].palautuminenPros} %, ` +
    `90 %:iin noin ${pahin.h} h:ssa.`);
}

function saantoPalautuminenEnnen(treeni, historia, liikkeet, lmap, kuormat) {
  if (!treeni.aloitus) return null;
  const ennen = recovery(liikkeet, historia, treeni.aloitus, kuormat);
  const lihakset = [];
  for (const id of treeninLiikkeet(treeni)) {
    const l = lmap.get(id);
    if (l && l.lihasryhma && !lihakset.includes(l.lihasryhma)) lihakset.push(l.lihasryhma);
  }
  const vasyneet = lihakset.filter((l) => ennen.lihakset[l] && ennen.lihakset[l].tila === 'väsynyt');
  if (!vasyneet.length) return null;
  const kuvaus = vasyneet.map((l) => `${l} ${ennen.lihakset[l].palautuminenPros} %`).join(', ');
  return kortti('huomio', 2, 'Treenasit väsyneenä',
    `${isoAlku(lista(vasyneet))} ${vasyneet.length > 1 ? 'olivat' : 'oli'} vielä väsynyt treenin alkaessa (${kuvaus}). ` +
    'Väsyneenä tehty treeni kehittää vähemmän ja pidentää palautumista.',
    'Palautumistila lasketaan treenin aloitushetkellä edellisten 96 tunnin sarjoista. ' +
    'Alle 50 % palautunut lihas on väsynyt, ja silloin painoa ei kannata nostaa.');
}

function saantoKuormitus(treeni) {
  const sarjat = [];
  for (const tl of treeni.liikkeet || []) sarjat.push(...tyoSarjat(tl.sarjat));
  if (!sarjat.length) return null;
  const nollat = sarjat.filter((s) => s.rir === 0).length;
  if (nollat * 2 < sarjat.length) return null;
  return kortti('huomio', 3, 'Kuormitus liian kova',
    `${nollat}/${sarjat.length} sarjaa meni uupumukseen asti (RIR 0). Tavoittele ensi kerralla RIR 1–2.`,
    'Toistuva uupumukseen asti treenaaminen pidentää palautumista mutta ei juuri lisää kehitystä. ' +
    `Raja on puolet työsarjoista RIR 0:lla; tässä treenissä ${Math.round((nollat / sarjat.length) * 100)} %.`);
}

function saantoJumiJatkuu(treeni, historia, lmap) {
  for (const id of treeninLiikkeet(treeni)) {
    const kerrat = liikkeenKerrat(id, [...historia, treeni]);
    if (!detectStall(kerrat)) continue;
    const nimi = (lmap.get(id) && lmap.get(id).nimi) || id;
    return kortti('huomio', 4, 'Jumi jatkuu',
      `${nimi}: paras arvioitu maksimi ei ole noussut kolmeen kertaan. Seuraavalla kerralla ehdotetaan kevennystä.`,
      'Kun kolmen viimeisimmän kerran paras e1RM ei nouse, kehitys on jumissa. ' +
      'Kevennys (noin −10 % painoa, toistot haarukan alapäähän) antaa keholle aikaa palautua.',
      { liikeId: id });
  }
  return null;
}

function saantoTavoiteJaljessa(konteksti) {
  const { tanaan, viikonAlkuPvm, edistyminen, muistit } = konteksti;
  const jaljellaPv = daysBetween(tanaan, addDays(viikonAlkuPvm, 7)) - 1;
  if (jaljellaPv > 2) return null;
  const laji = lajiMuisti(muistit, tanaan);
  const jaljessa = Object.keys(RYHMAT_T)
    .filter((r) => !(laji && r === 'jalat'))
    .filter((r) => edistyminen.ryhmat[r] && edistyminen.ryhmat[r].tavoite > 0 && edistyminen.ryhmat[r].pros < 50)
    .sort((a, b) => edistyminen.ryhmat[a].pros - edistyminen.ryhmat[b].pros);
  if (!jaljessa.length) return null;
  const r = jaljessa[0];
  const g = edistyminen.ryhmat[r];
  return kortti('huomio', 5, 'Viikkotavoite jäljessä',
    `${RYHMANIMET[r]}: ${g.tehty}/${g.tavoite} sarjaa (${g.pros} %), ja viikkoa on jäljellä ${jaljellaPv} pv. ` +
    `Tavoitteesta puuttuu ${g.jaljella} sarjaa.`,
    'Viikkovolyymi eli työsarjojen määrä lihasryhmää kohden on keskeinen edistymisen ajuri. ' +
    'Huomautus tulee, kun viikkoa on jäljellä enintään 2 päivää ja ryhmä on alle 50 %:ssa tavoitteesta.' +
    (laji ? ' Lajimuistin takia jalkojen volyymista ei huomauteta.' : ''),
    { ryhma: r });
}

function saantoOhitetut(treeni) {
  const ohitetut = (treeni.ehdotukset || []).filter((e) => e && e.hyvaksytty === false).length;
  if (ohitetut < 3) return null;
  return kortti('huomio', 6, 'Ehdotuksia ohitettiin',
    `Ohitit ${ohitetut} ehdotusta. Onko syynä kipu tai jokin rajoite? Ne voi pian merkitä profiiliin (tulossa).`,
    'Ehdotukset perustuvat historiaasi ja tavoitteeseesi. Jos ohitat vähintään 3 ehdotusta, ' +
    'taustalla on usein syy, jonka valmentaja voi huomioida.');
}

// --- Seuraavaksi ---------------------------------------------------------------

function seuraavaksiKortti(konteksti) {
  const { seuraava, seuraavanLihakset, liikkeet, treenitJalkeen, nyt, kuormat, edistyminen, lmap, treeni } = konteksti;
  let lihakset = seuraavanLihakset;
  if (!seuraava) {
    lihakset = [];
    for (const id of treeninLiikkeet(treeni)) {
      const l = lmap.get(id);
      if (l && l.lihasryhma && !lihakset.includes(l.lihasryhma)) lihakset.push(l.lihasryhma);
    }
  }
  const h = tunnitPalautumiseen(lihakset, liikkeet, treenitJalkeen, nyt, kuormat);
  const aika = ajankohtaTeksti(nyt, h);
  const nimi = seuraava ? seuraava.nimi : 'Seuraava treeni';

  let jaljessaTeksti = '';
  if (seuraava && edistyminen) {
    const jaljessa = Object.keys(RYHMAT_T)
      .filter((r) => edistyminen.ryhmat[r] && edistyminen.ryhmat[r].jaljella > 0
        && RYHMAT_T[r].some((l) => seuraavanLihakset.includes(l)))
      .sort((a, b) => edistyminen.ryhmat[a].pros - edistyminen.ryhmat[b].pros);
    if (jaljessa.length) {
      const r = jaljessa[0];
      jaljessaTeksti = ` Se kerryttää myös jäljessä olevaa tavoitetta: ${RYHMANIMET[r].toLowerCase()},${edistyminen.ryhmat[r].jaljella} sarjaa jäljellä.`;
    }
  }

  const teksti = h === 0
    ? `${nimi}: päälihasryhmät ovat jo palautuneet, joten voit treenata heti.${jaljessaTeksti}`
    : `${nimi}: aikaisintaan ${aika.teksti}.${jaljessaTeksti}`;
  const lihasTeksti = lihakset.length ? lista(lihakset) : 'lihasryhmät';
  return kortti('seuraavaksi', 1, seuraava ? `Seuraavaksi: ${nimi}` : 'Seuraavaksi',
    teksti,
    `Ajankohta on hetki, jolloin seuraavan treenin päälihasryhmät (${lihasTeksti}) ovat vähintään 90 %:ssa ` +
    `palautumisesta: noin ${h} h päästä. Palautumisaika riippuu sarjamäärästä (48, 72 tai 96 h), ja arvot ovat demon oletuksia.`,
    { ohjelmaPaiva: seuraava ? seuraava.nimi : null, ajankohta: { teksti: aika.teksti, pvm: aika.pvm, tunteja: h, aika: lisaaTunteja(nyt, h) } });
}

// --- Julkinen funktio --------------------------------------------------------

/**
 * workoutInsights({ treeni, historia, liikkeet, profiili, ohjelma, muistit, viikkosuunnitelma, nyt })
 *   → [{ tyyppi: 'edistys'|'huomio'|'seuraavaksi', otsikko, teksti, miksi, prioriteetti, ... }]
 * Järjestys: edistys (enintään 3), huomio (enintään 2, tai yksi "Ei huomioitavaa" -kortti
 * kentällä eiHuomioitavaa: true), seuraavaksi (aina täsmälleen 1). Pienempi prioriteetti = tärkeämpi.
 * Tyhjällä historialla (ei aiempia voimatreenejä) palautetaan vain "seuraavaksi".
 */
export function workoutInsights({
  treeni = null,
  historia = [],
  liikkeet = [],
  profiili = {},
  ohjelma = null,
  muistit = [],
  viikkosuunnitelma = null,
  nyt,
} = {}) {
  const hist = (historia || []).filter((t) => t && (!treeni || (t !== treeni && (treeni.id == null || t.id !== treeni.id))));
  const lmap = new Map((liikkeet || []).map((l) => [l.id, l]));
  const p = profiili || {};
  const tanaan = tanaanNyt(nyt);
  const viikonAlkuPvm = weekStart(tanaan, p.viikonAlku || 'maanantai');
  const suunnitelma = voimassaOlevaSuunnitelma(viikkosuunnitelma, tanaan);
  const kuormat = lajiKuormat(suunnitelma, tanaan);

  const treenitJalkeen = treeni ? [...hist, treeni] : hist;
  // Palautumiseen vaikuttavat vain viimeiset 96 h; vanhat treenit karsitaan laskennan nopeuttamiseksi.
  const tuoreet = treenitJalkeen.filter((t) => {
    const aika = t.aloitus || `${t.pvm}T18:00:00`;
    return hoursBetween(aika, nyt) <= 24 * 5;
  });
  const jalkeen = recovery(liikkeet, tuoreet, nyt, kuormat);
  const tavoitteet = weeklyTargets(p, suunnitelma);
  const edistyminen = weeklyProgress(treenitJalkeen, liikkeet, tavoitteet, viikonAlkuPvm);
  const seuraava = seuraavaPaiva(ohjelma, treeni, hist);
  const konteksti = {
    treeni, seuraava, seuraavanLihakset: paivanLihakset(seuraava, lmap), jalkeen, liikkeet, lmap,
    treenitJalkeen: tuoreet, nyt, kuormat, tanaan, viikonAlkuPvm, edistyminen, muistit,
  };

  const seuraavaksi = seuraavaksiKortti(konteksti);
  const tyhjaHistoria = !hist.some(onVoimatreeni);
  if (!treeni || tyhjaHistoria) return [seuraavaksi];

  const edistys = [];
  const huomio = [];
  if (onVoimatreeni(treeni)) {
    const yhteenveto = workoutSummary(treeni, liikkeet, hist, p.kehonpaino);
    const ennatysLiikkeet = new Set(
      yhteenveto.ennatykset.filter((e) => e.tyyppi === 'arvioituVoima').map((e) => e.liikeId),
    );
    edistys.push(
      saantoEnnatys(yhteenveto),
      saantoVoimaNousi(treeni, hist, lmap, ennatysLiikkeet),
      saantoVolyymi(treeni, hist, liikkeet, yhteenveto),
      saantoEhdotukset(treeni),
      saantoJumiPurkautui(treeni, hist, lmap),
    );
    huomio.push(
      saantoPalautuminenJalkeen(konteksti),
      saantoPalautuminenEnnen(treeni, hist, liikkeet, lmap, kuormat),
      saantoKuormitus(treeni),
      saantoJumiJatkuu(treeni, hist, lmap),
    );
  }
  huomio.push(saantoTavoiteJaljessa(konteksti), saantoOhitetut(treeni));

  const valitse = (kortit, max) => kortit.filter(Boolean).sort((a, b) => a.prioriteetti - b.prioriteetti).slice(0, max);
  const edistysValitut = valitse(edistys, MAX_EDISTYS);
  let huomioValitut = valitse(huomio, MAX_HUOMIO);
  if (!huomioValitut.length) {
    huomioValitut = [kortti('huomio', 99, 'Ei huomioitavaa',
      'Ei huomioitavaa, palautuminen ja kuormitus kunnossa.',
      'Mikään huomiosäännöistä (palautuminen, kuormitus, jumiutuminen, viikkotavoite, ohitetut ehdotukset) ei lauennut.',
      { eiHuomioitavaa: true })];
  }
  return [...edistysValitut, ...huomioValitut, seuraavaksi];
}
