// Päivämäärä- ja pyöristysapurit. Puhdas moduuli: ei DOMia, ei Date.now()-kutsuja.
// Päivämäärät ovat paikallisia 'YYYY-MM-DD'-merkkijonoja, ja ne käsitellään
// UTC-keskipäivänä, jotta aikavyöhykkeet ja kesäaika eivät siirrä päivää.

const PAIVA_MS = 24 * 60 * 60 * 1000;

function keskipaiva(pvm) {
  return new Date(pvm + 'T12:00:00Z');
}

function muotoile(d) {
  return d.toISOString().slice(0, 10);
}

// Palauttaa päivämäärän, joka on n päivää pvm:n jälkeen (n voi olla negatiivinen).
export function addDays(pvm, n) {
  const d = keskipaiva(pvm);
  d.setUTCDate(d.getUTCDate() + n);
  return muotoile(d);
}

// Päivien määrä a:sta b:hen (b - a). Positiivinen, kun b on a:n jälkeen.
export function daysBetween(a, b) {
  return Math.round((keskipaiva(b) - keskipaiva(a)) / PAIVA_MS);
}

// Viikon ensimmäinen päivä, johon pvm kuuluu.
export function weekStart(pvm, viikonAlku = 'maanantai') {
  const viikonpaiva = keskipaiva(pvm).getUTCDay(); // 0 = sunnuntai
  const siirto = viikonAlku === 'sunnuntai' ? viikonpaiva : (viikonpaiva + 6) % 7;
  return addDays(pvm, -siirto);
}

// Pyöristää lähimpään 2,5 kg:aan.
export function round25(kg) {
  return Math.round(kg / 2.5) * 2.5 + 0; // + 0 muuttaa -0:n nollaksi
}

// Tunnit isoA:sta isoB:hen (isoB - isoA).
export function hoursBetween(isoA, isoB) {
  return (new Date(isoB) - new Date(isoA)) / (60 * 60 * 1000);
}

// Voimatreeni kerryttää Treeniscorea, palautumista ja tavoitteita. Puuttuva tyyppi
// tulkitaan voimatreeniksi; tuodut aktiviteetit (esim. 'kävely') eivät ole voimatreenejä.
export function onVoimatreeni(treeni) {
  return !!treeni && (treeni.tyyppi == null || treeni.tyyppi === 'voima');
}

// Työsarja = mikä tahansa sarja, joka ei ole lämmittelysarja.
export function onTyosarja(sarja) {
  return !!sarja && !sarja.lammittely;
}
