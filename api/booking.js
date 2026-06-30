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

import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const { checkin, checkout, nights, adults, children, price, name, phone, email, note } = body || {};
  if (!checkin || !checkout || !name || !phone) return res.status(400).json({ error: 'Chýbajú povinné údaje' });

  const summary = `
Nová žiadosť o rezerváciu — Apartmán PaVla

Termín: ${checkin} → ${checkout} (${nights} nocí)
Hostia: ${adults} dospelí, ${children || 0} deti
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
