// Palautuminen (speksi 4b-2). Puhdas moduuli: ei DOM-, window-, localStorage- eikä Date.now()-kutsuja.
// Aika annetaan parametrina (`nyt`: ISO-merkkijono).

import { hoursBetween, onVoimatreeni, onTyosarja } from './util.js?v=270067f';

const LIHASRYHMAT = ['rinta', 'selkä', 'olkapäät', 'hauis', 'ojentajat', 'etureidet', 'takareidet', 'pakarat', 'pohkeet', 'vatsa'];

const IKKUNA_H = 96;            // vain viimeisen 96 tunnin sarjat vaikuttavat (raja mukaan lukien)
const PAINO_PAA = 1;            // päälihasryhmän sarja
const PAINO_TOISSIJAINEN = 0.5; // toissijaisen lihasryhmän sarja

function treeninAika(treeni) {
  return treeni.aloitus || `${treeni.pvm}T18:00:00`;
}

// Palautumisaika sarjamäärästä: alle 6 → 48 h, 6–10 → 72 h, yli 10 → 96 h.
function palautumisaikaH(sarjat) {
  if (sarjat < 6) return 48;
  if (sarjat <= 10) return 72;
  return 96;
}

function tilaProsentista(pros) {
  if (pros < 50) return 'väsynyt';
  if (pros < 90) return 'palautumassa';
  return 'palautunut';
}

/**
 * recovery(liikkeet, treenit, nyt, lajiKuormat = [])
 * lajiKuormat: [{ aika: ISO, lihakset: { [lihas]: sarjaa } }]
 * → { lihakset: { [lihas]: { palautuminenPros, tila, viimeksi: ISO|null } },
 *     viimeisinTreeniTuntia: number|null, palautuneita: number }
 */
export function recovery(liikkeet, treenit, nyt, lajiKuormat = []) {
  const liikeMap = new Map((liikkeet || []).map((l) => [l.id, l]));
  const kirjanpito = {};
  for (const lihas of LIHASRYHMAT) {
    kirjanpito[lihas] = { ikkunaSarjat: 0, ikkunaMinIka: null, viimeksiIka: null, viimeksi: null };
  }

  function lisaa(lihas, maara, aika, ika) {
    const k = kirjanpito[lihas];
    if (!k || !(maara > 0)) return;
    if (k.viimeksiIka === null || ika < k.viimeksiIka) {
      k.viimeksiIka = ika;
      k.viimeksi = aika;
    }
    if (ika <= IKKUNA_H) {
      k.ikkunaSarjat += maara;
      if (k.ikkunaMinIka === null || ika < k.ikkunaMinIka) k.ikkunaMinIka = ika;
    }
  }

  let viimeisinTreeniIka = null;
  for (const treeni of treenit || []) {
    // Tuodut aktiviteetit (tyyppi muu kuin 'voima') eivät kerrytä palautumista.
    if (!onVoimatreeni(treeni)) continue;
    const aika = treeninAika(treeni);
    const ika = hoursBetween(aika, nyt);
    if (!(ika >= 0)) continue; // tuleva tai virheellinen ajankohta
    if (viimeisinTreeniIka === null || ika < viimeisinTreeniIka) viimeisinTreeniIka = ika;
    for (const tl of treeni.liikkeet || []) {
      const liike = liikeMap.get(tl.liikeId);
      if (!liike) continue;
      const tyosarjat = (tl.sarjat || []).filter(onTyosarja).length;
      if (!tyosarjat) continue;
      lisaa(liike.lihasryhma, tyosarjat * PAINO_PAA, aika, ika);
      for (const toissijainen of liike.toissijaiset || []) {
        lisaa(toissijainen, tyosarjat * PAINO_TOISSIJAINEN, aika, ika);
      }
    }
  }

  for (const kuorma of lajiKuormat || []) {
    if (!kuorma || !kuorma.aika) continue;
    const ika = hoursBetween(kuorma.aika, nyt);
    if (!(ika >= 0)) continue;
    for (const [lihas, sarjat] of Object.entries(kuorma.lihakset || {})) {
      lisaa(lihas, Number(sarjat), kuorma.aika, ika);
    }
  }

  const lihakset = {};
  let palautuneita = 0;
  for (const lihas of LIHASRYHMAT) {
    const k = kirjanpito[lihas];
    let pros = 100;
    if (k.ikkunaSarjat > 0) {
      const aikaH = palautumisaikaH(k.ikkunaSarjat);
      pros = Math.min(100, Math.round((k.ikkunaMinIka / aikaH) * 100));
    }
    const tila = tilaProsentista(pros);
    if (tila === 'palautunut') palautuneita += 1;
    lihakset[lihas] = { palautuminenPros: pros, tila, viimeksi: k.viimeksi };
  }

  return {
    lihakset,
    viimeisinTreeniTuntia: viimeisinTreeniIka === null ? null : Math.round(viimeisinTreeniIka * 10) / 10,
    palautuneita,
  };
}
