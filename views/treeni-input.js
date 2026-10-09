// Sarjan syötteiden jäsennys (speksi 7: paino ≥ 0 askelin 0,5, toistot kokonaisluku 0–100).
// Puhdas moduuli: ei DOMia, ei windowia, ei localStoragea. Testit: tests/treeni-input.test.js.

const PAINO_MAX = 1000;
const TOISTOT_MAX = 100;

function siisti(arvo) {
  if (arvo === null || arvo === undefined) return '';
  return String(arvo).trim().replace(/\s+/g, '');
}

// parseWeight('62,5') → 62.5. Pilkku ja piste käyvät desimaalierottimeksi.
// Virheellinen (tyhjä, negatiivinen, ei luku, ei 0,5:n askelin tai yli 1000) → null.
export function parseWeight(arvo) {
  const s = siisti(arvo).replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > PAINO_MAX) return null;
  if (Math.abs(n * 2 - Math.round(n * 2)) > 1e-9) return null;
  return n;
}

// parseReps('8') → 8. Virheellinen (tyhjä, desimaali, negatiivinen tai yli 100) → null.
export function parseReps(arvo) {
  const s = siisti(arvo);
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > TOISTOT_MAX) return null;
  return n;
}

// parseSet(painoTeksti, toistotTeksti) → { ok, paino, toistot, virheet: { paino, toistot } }.
// Virheellinen sarja ei kuittaudu; virheet kertovat, mitkä kentät merkitään virheellisiksi.
export function parseSet(painoTeksti, toistotTeksti) {
  const paino = parseWeight(painoTeksti);
  const toistot = parseReps(toistotTeksti);
  const virheet = { paino: paino === null, toistot: toistot === null };
  return { ok: !virheet.paino && !virheet.toistot, paino, toistot, virheet };
}
