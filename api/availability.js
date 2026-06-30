// /api/availability.js — Vercel serverless funkcia
// Číta obsadené termíny z Google Sheetu, ktorý majiteľ spravuje sám.
//
// AKO TO NASTAVIŤ (jednorazovo):
//   1. Vytvor Google Sheet s 2 stĺpcami: "Od" a "Do" (formát dátumu RRRR-MM-DD).
//      Každý riadok = jeden obsadený rozsah (deň príchodu → deň odchodu).
//      Príklad:
//        Od           Do
//        2026-07-10   2026-07-13
//        2026-08-01   2026-08-05
//   2. V Google Sheets: Súbor → Zdieľať → Publikovať na webe →
//      vyber daný hárok → formát "Hodnoty oddelené čiarkou (.csv)" → Publikovať.
//   3. Skopíruj vygenerovaný odkaz (končí na .../pub?...&output=csv) a vlož ho
//      nižšie do premennej SHEET_CSV_URL, alebo ho nastav vo Vercel ako
//      environment variable AVAILABILITY_SHEET_URL (odporúčané).
//
// Majiteľ potom termíny spravuje priamo v tabuľke — žiadny zásah do kódu
// ani nový deploy nie je potrebný, zmeny sa prejavia do pár minút.

const SHEET_CSV_URL = process.env.AVAILABILITY_SHEET_URL || '';

function parseCsv(text) {
  // Jednoduchý CSV parser — stačí pre dvojstĺpcovú tabuľku bez čiarok v hodnotách.
  return text
    .split(/\r?\n/)
    .map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
    .filter(row => row.length >= 2 && row[0]);
}

function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

function expandRange(from, to) {
  const days = [];
  let d = new Date(from);
  const end = new Date(to);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  if (!SHEET_CSV_URL) {
    // Sheet ešte nie je nastavený — vrátime prázdny zoznam, nech kalendár
    // funguje (všetko voľné) namiesto pádu celej stránky.
    return res.status(200).json({ busyDays: [], demo: true, message: 'AVAILABILITY_SHEET_URL nie je nastavená.' });
  }

  try {
    const r = await fetch(SHEET_CSV_URL);
    if (!r.ok) throw new Error(`Sheet fetch failed: ${r.status}`);
    const text = await r.text();
    const rows = parseCsv(text);

    const busySet = new Set();
    for (const row of rows) {
      const [from, to] = row;
      if (isValidDate(from) && isValidDate(to)) {
        expandRange(from, to).forEach(d => busySet.add(d));
      }
    }

    return res.status(200).json({ busyDays: [...busySet].sort() });
  } catch (e) {
    return res.status(502).json({ busyDays: [], error: 'Obsadenosť sa nepodarilo načítať', detail: e.message });
  }
}
