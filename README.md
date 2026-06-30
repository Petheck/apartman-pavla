# Apartmán PaVla — web + rezervácia

Web pre Apartmán PaVla (Moravany nad Váhom, lokalita Striebornica).
Prírodný vidiecky štýl. Pripravený na nasadenie na **Vercel**.

## Štruktúra

```
/index.html           — hlavná stránka (showcase)
/rezervacia.html       — kalendár + dopytový formulár
/images/               — fotky
/api/booking.js        — pošle žiadosť o rezerváciu majiteľovi mailom (Gmail SMTP)
/api/availability.js   — číta obsadené termíny z Google Sheetu, ktorý spravuje majiteľ
```

## Ako to funguje (v skratke)

1. **Obsadenosť termínov** spravuje majiteľ sám, v Google Sheete — žiadny zásah
   do kódu. Web si pri každom načítaní stránky `rezervacia.html` stiahne aktuálne
   dáta zo Sheetu cez `/api/availability`.
2. Keď zákazník vyplní a odošle rezervačný formulár, `/api/booking.js` pošle
   majiteľovi e-mail s detailmi žiadosti (cez Gmail). Rezervácia sama o sebe sa
   tým **nepotvrdí** — majiteľ kontaktuje zákazníka a po dohode si sám pridá
   nový riadok do Google Sheetu, čím sa termín v kalendári zobrazí ako obsadený.

Toto funguje len po nasadení na Vercel a po nastavení premenných nižšie —
bez nich web beží v "demo" režime (formulár niečo predstiera, ale nič reálne
neodošle ani nenačíta).

**Aktuálny stav:** kým nie sú nastavené `GMAIL_USER` / `GMAIL_PASS` vo Vercel,
žiadosti chodia (v demo režime sa len logujú) na predvolenú adresu
`peto.kusovsky@gmail.com` — toto je dočasné, nastav `OWNER_EMAIL`
podľa potreby.

## Nasadenie na Vercel

1. Nahraj obsah priečinka do GitHub repozitára.
2. Na vercel.com → New Project → importuj repo → Framework Preset: **Other** → Deploy.
3. Po prvom nasadení nastav premenné prostredia (pozri nižšie), potom over
   funkčnosť cez **Redeploy**.

---

## 1. Nastavenie obsadenosti (Google Sheet)

Toto robí jedenkrát ten, kto web nastavuje (môže to byť aj sám Vladimír,
keď bude mať návod).

1. Vytvor nový **Google Sheet** (sheets.google.com → Prázdny hárok).
2. Do prvého riadku (hlavička) napíš `Od` a `Do` (stĺpce A a B).
3. Do ďalších riadkov potom majiteľ zapisuje obsadené termíny, jeden riadok
   = jeden pobyt, formát dátumu **RRRR-MM-DD**:

   | Od           | Do           |
   |--------------|--------------|
   | 2026-07-10   | 2026-07-13   |
   | 2026-08-01   | 2026-08-05   |

   ("Od" = deň príchodu, "Do" = deň odchodu — presne tak, ako to zadáva
   zákazník v kalendári.)

4. **Súbor → Zdieľať → Publikovať na webe.**
5. Vyber konkrétny hárok (nie celý dokument) a formát **"Hodnoty oddelené
   čiarkou (.csv)"**, potom klikni **Publikovať**.
6. Skopíruj vygenerovaný odkaz — bude vyzerať podobne ako:
   `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv`
7. Tento odkaz vlož vo Vercel ako premennú prostredia `AVAILABILITY_SHEET_URL`
   (pozri tabuľku nižšie).

Po tomto nastavení majiteľ už nikdy nepotrebuje nič na webe meniť — len
pridáva/upravuje riadky v Google Sheete a kalendár sa do pár minút aktualizuje
(dáta sa krátko cachujú, preto zmena nie je vidieť úplne okamžite).

## 2. Nastavenie odosielania e-mailov (Gmail)

1. Na Gmail účte, z ktorého sa budú posielať notifikácie, zapni
   **dvojfázové overenie** (Google účet → Zabezpečenie → Dvojfázové overenie).
2. Tam isto vytvor **App Password** (Heslá aplikácií) — zvoľ napr. "Mail" /
   "Iné (vlastný názov)" a skopíruj vygenerované 16-miestne heslo.
3. Vo Vercel nastav premenné `GMAIL_USER` a `GMAIL_PASS` (pozri tabuľku nižšie).

Použiť môžeš buď priamo Vladimírov Gmail, alebo akýkoľvek iný Gmail účet —
adresa, na ktorú žiadosti chodia (`OWNER_EMAIL`), môže byť iná než tá, z ktorej
sa odosielajú.

## Premenné prostredia (Vercel → Settings → Environment Variables)

| Premenná                | Na čo slúži                                                        |
|--------------------------|---------------------------------------------------------------------|
| `AVAILABILITY_SHEET_URL` | Odkaz na publikovaný Google Sheet (CSV) s obsadenými termínmi      |
| `GMAIL_USER`             | Gmail adresa, z ktorej sa posielajú e-maily                        |
| `GMAIL_PASS`             | 16-miestne App Password z Google účtu (nie bežné heslo!)           |
| `OWNER_EMAIL`            | Adresa majiteľa, kam majú chodiť žiadosti (zatiaľ: peto.kusovsky@gmail.com) |

Po zmene premenných treba spraviť **Redeploy**, aby sa prejavili.

## Cena

Logika ceny je v `rezervacia.html`:
- `PRICE_BASE = 50` € / noc (1–2 osoby)
- `PRICE_EXTRA = 15` € / noc za každú ďalšiu osobu od 3.
- `MIN_NIGHTS = 2` — minimálna dĺžka pobytu.

## Údaje na doplnenie / kontrola

- Telefón: +421 948 047 399 (Vladimír Duran) — doplnené
- Adresa: Nádbrežná 3/10, Moravany nad Váhom — doplnené
- E-mail majiteľa — dočasne peto.kusovsky@gmail.com, doplniť finálnu do `OWNER_EMAIL`
- Pozn.: Google Maps embed je z odkazu, ktorý ukazuje "Apartmán PaVla" —
  over s klientom, či je to správny názov/poloha.
