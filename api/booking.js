// /api/booking.js — Vercel serverless funkcia
// Prijme žiadosť o rezerváciu z formulára a pošle ju majiteľovi e-mailom
// cez Gmail (SMTP, knižnica nodemailer).
//
// NASTAVENIE (jednorazovo):
//   1. Na Gmail účte, z ktorého sa bude odosielať, zapni dvojfaktorové
//      overenie (Google účet → Zabezpečenie → Dvojfázové overenie).
//   2. Vytvor "App Password" (Google účet → Zabezpečenie → Heslá aplikácií)
//      — vyber napr. "Mail" / "Iné" a skopíruj 16-miestne heslo.
//   3. Vo Vercel (Settings → Environment Variables) nastav:
//        GMAIL_USER  = tvojadresa@gmail.com   (z ktorej sa posiela)
//        GMAIL_PASS  = <16-miestne app password, bez medzier>
//        OWNER_EMAIL = majitel@... (kam majú chodiť žiadosti — môže byť rovnaká
//                      adresa ako GMAIL_USER)
//
// Bez nastavených premenných beží funkcia v demo režime (žiadosť sa len
// zaloguje na serveri a používateľovi sa zobrazí úspech) — to je zámerne,
// aby nasadenie bez konfigurácie nepadalo, ale treba to nastaviť pred
// reálnym používaním, inak žiadosti majiteľovi nikam nedôjdu.
//
// OCHRANA PROTI SPAMU / ZNEUŽITIU:
//   - honeypot pole "website" — skryté pre ľudí, bot ho zvyčajne vyplní
//   - jednoduchý rate limit podľa IP (best-effort, v pamäti funkcie)
//   - serverová validácia dátumov, e-mailu a rozsahu hostí
//   - rezervovať sa dá len najviac MAX_MONTHS_AHEAD mesiacov dopredu

import nodemailer from 'nodemailer';

const MAX_MONTHS_AHEAD = 3;

// Best-effort rate limiting — funguje spoľahlivo len v rámci jednej "teplej"
// inštancie funkcie (Vercel môže bežať viac inštancií súčasne a po čase ich
// reštartovať, čím sa tento limit vynuluje). Aj tak zastaví jednoduché boty,
// ktoré strieľajú veľa požiadaviek za sebou z jednej IP.
const hits = new Map(); // ip -> [timestamps]
const WINDOW_MS = 10 * 60 * 1000; // 10 minút
const MAX_REQUESTS = 5; // max 5 žiadostí z jednej IP za 10 minút

function isRateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  // priebežné čistenie, nech mapa nerastie donekonečna
  if (hits.size > 5000) hits.clear();
  return arr.length > MAX_REQUESTS;
}

function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z').getTime());
}

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Odstráni znaky nového riadku, ktoré by sa dali zneužiť na e-mail header injection,
// a orezze príliš dlhý vstup.
function clean(s, maxLen = 500) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\r\n]+/g, ' ').trim().slice(0, maxLen);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Príliš veľa žiadostí. Skúste to prosím o chvíľu neskôr.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Honeypot — ak je toto pole vyplnené, ide takmer isto o bota.
  // Tvárime sa, že žiadosť prebehla úspešne, aby bot nezískal spätnú väzbu.
  if (body.website) {
    return res.status(200).json({ ok: true, message: 'Žiadosť odoslaná.' });
  }

  const checkin = body.checkin;
  const checkout = body.checkout;
  const name = clean(body.name, 100);
  const phone = clean(body.phone, 30);
  const email = body.email ? clean(body.email, 150) : '';
  const note = clean(body.note, 800);
  const adults = Number(body.adults);
  const children = Number(body.children) || 0;
  const nights = Number(body.nights);
  const price = Number(body.price) || 0;

  if (!isValidDateStr(checkin) || !isValidDateStr(checkout)) {
    return res.status(400).json({ error: 'Neplatný termín.' });
  }
  if (!name || !phone) {
    return res.status(400).json({ error: 'Chýbajú povinné údaje.' });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Neplatný e-mail.' });
  }
  if (!Number.isFinite(adults) || adults < 1 || adults + children > 7) {
    return res.status(400).json({ error: 'Neplatný počet hostí.' });
  }

  const ci = new Date(checkin + 'T00:00:00Z');
  const co = new Date(checkout + 'T00:00:00Z');
  if (co <= ci) {
    return res.status(400).json({ error: 'Dátum odchodu musí byť po dátume príchodu.' });
  }
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setUTCMonth(maxDate.getUTCMonth() + MAX_MONTHS_AHEAD);
  if (ci < today) {
    return res.status(400).json({ error: 'Termín príchodu je v minulosti.' });
  }
  if (ci > maxDate) {
    return res.status(400).json({ error: `Rezervovať sa dá najviac ${MAX_MONTHS_AHEAD} mesiace dopredu.` });
  }

  const summary = `
Nová žiadosť o rezerváciu — Apartmán PaVla

Termín: ${checkin} → ${checkout} (${nights || Math.round((co - ci) / 864e5)} nocí)
Hostia: ${adults} dospelí, ${children} deti
Orientačná cena: ${price} €
Meno: ${name}
Telefón: ${phone}
E-mail: ${email || '—'}
Poznámka: ${note || '—'}
`.trim();

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_PASS = process.env.GMAIL_PASS;
  // Zatiaľ defaultná adresa, kým nebude nastavená OWNER_EMAIL premenná vo Vercel.
  const OWNER = process.env.OWNER_EMAIL || GMAIL_USER || 'peto.kusovsky@gmail.com';

  if (!GMAIL_USER || !GMAIL_PASS || !OWNER) {
    console.log('[DEMO booking]', summary);
    return res.status(200).json({ ok: true, demo: true, message: 'Žiadosť prijatá (demo režim — e-mail nie je nastavený).' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });

    await transporter.sendMail({
      from: `Apartmán PaVla <${GMAIL_USER}>`,
      to: OWNER,
      replyTo: email || undefined,
      subject: `Rezervácia Apartmán PaVla · ${checkin} → ${checkout}`,
      text: summary,
    });

    return res.status(200).json({ ok: true, message: 'Žiadosť odoslaná majiteľovi.' });
  } catch (e) {
    return res.status(500).json({ error: 'Mail sa nepodarilo odoslať', detail: e.message });
  }
}
