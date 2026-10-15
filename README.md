# Vodič kroz cijepljenje i kalendar za roditelje

> Jednostavna, moderna i empatična web aplikacija koja roditeljima u Hrvatskoj omogućuje transparentan pregled **obveznih** i **preporučenih** cjepiva, uz izračun osobnog kalendara cijepljenja i automatsku pripremu upita za pedijatra.

---

## 📌 Kontekst i problem koji rješavamo

U Republici Hrvatskoj postoji zakonom propisan **Program obveznog cijepljenja** koji u potpunosti pokriva HZZO (npr. BCG, 6 u 1, pneumokok, MPR). Istodobno, stručna pedijatrijska društva i HZJZ preporučuju i **dodatna cjepiva** (poput cjepiva protiv rotavirusa, meningokoka B – *Bexsero*, vodenih kozica – *Varivax*, krpeljnog meningoencefalitisa – *FSME-Immun*, ili HPV-a).

### Glavni izazovi za roditelje:
1. **Rascjepkanost informacija:** Roditelji često saznaju za dodatna cjepiva prekasno (npr. cjepivo protiv rotavirusa smije se primijeniti isključivo u prvih 6 do 8 mjeseci života).
2. **Nejasnoća oko plaćanja i recepata:** Koja cjepiva pokriva HZZO, koja se kupuju na privatni recept u ljekarni, a koja su preporučena, ali ipak besplatna (npr. HPV)?
3. **Planiranje i komunikacija s pedijatrom:** Roditelji novorođenčadi i male djece preopterećeni su informacijama i često ne znaju kako točno formulirati upit pedijatrijskoj ordinaciji za naručivanje i nabavku cjepiva.

Aplikacija je stvorena kako bi roditelji u manje od 5 sekundi dobili točne, provjerene i vizualno jasne informacije, prilagođene točnoj dobi njihovog djeteta.

---

## ✨ Ključne funkcionalnosti

- 🛡️ **Katalog cjepiva s trenutnim pretraživanjem i filtriranjem:**
  - Pregled po dobi (rođenje, 2 mj., 4 mj., 6 mj., 12 mj., predškolska i školska dob).
  - Jasne oznake statusa: `Obvezno (HZZO)`, `Dodatno / Preporučeno` i `Preporučeno · besplatno`.
  - Sažeti opisi bolesti i koristi bez suvišnog medicinskog žargona, uz mogućnost pregleda sheme doza i napomena na klik/hover.

- 📅 **Osobni kalendar cijepljenja (Kalkulator):**
  - Unosom datuma rođenja djeteta (ili očekivanog datuma) sustav trenutačno izračunava točne okvirne datume svih cijepljenja.
  - Odabir obuhvata jednim klikom: **„Samo obavezna”** vs. **„Obvezna + preporučena”**.
  - Mogućnost izvoza nadolazećih termina u **Apple Kalendar, Google Kalendar ili Outlook (`.ics`)** s podsjetnikom 3 dana ranije.
  - **Ispiši / PDF:** Optimiziran ispis koji automatski skriva nepotrebne sučeljne elemente i ispisuje samo čist raspored s datumima.

- 💡 **Odabir mogućih cjepiva prema dobi djeteta:**
  - Sustav inteligentno prepoznaje dob djeteta (npr. 22 mjeseca) i nudi cjepiva koja se mogu primijeniti u toj dobi (npr. *vodene kozice*, *sezonska gripa*, *Bexsero*, *krpeljni meningoencefalitis*).

- ✉️ **Automatski predložak e-maila za pedijatra:**
  - Generira ljubazan, strukturiran i profesionalan nacrt e-maila za naručivanje na pregled i cijepljenje.
  - Tekst se ažurira u realnom vremenu ovisno o označenim cjepivima.
  - Sadrži gumbe za brzo kopiranje u međuspremnik i direktno otvaranje u e-mail klijentu (`mailto:`).

- 🔒 **Privatnost roditelja:**
  - Svi izračuni i podaci (datum rođenja, ime djeteta) obrađuju se **isključivo lokalno u pregledniku**.
  - Nema prikupljanja osobnih podataka. Google Analytics učitava se **tek nakon privole** posjetitelja (traka za privolu, „Postavke kolačića” u podnožju); bez privole nema kolačića ni vanjskih zahtjeva (fontovi su lokalni).
  - U analitiku nikad ne odlaze datum rođenja, ime djeteta ni tekst e-maila – samo anonimni parametri (npr. ID cjepiva, dobna skupina).

- 🌓 **Dizajniran za roditelje:**
  - Umirujuća, nježna paleta boja u skladu s WCAG 2.1 AA kontrastom.
  - Automatska podrška za **svijetlu (Light)** i **tamnu (Dark)** temu prema postavkama sustava.
  - Potpuno responzivan (više od 80% posjeta roditelja dolazi s mobilnih uređaja).

---

## 🛠️ Tehnološki stog (Tech Stack)

- **Frontend:** Vanilla JavaScript (ES Modules) – lagan, munjevit rad bez suvišnih ovisnosti.
- **Stilovi:** Moderni modularni CSS (CSS varijable, clamp tipografija, container queries, CSS grid).
- **Alat za izgradnju:** [Vite](https://vitejs.dev/)
- **Kalendar & izvoz:** Custom generator iCalendar RFC 5545 (`.ics`) standarda.
- **Analitika:** Google Analytics 4 uz privolu (`src/lib/analytics.js`), Measurement ID u `.env` (`VITE_GA_ID`). Popis događaja u [`docs/analytics.md`](docs/analytics.md).
- **Fontovi:** lokalno hostani (Fontsource) – bez poziva prema Google Fonts.
- **SEO & Meta:** Open Graph protokoli, Twitter Cards, Schema.org JSON-LD (`WebSite`, `WebApplication`, `FAQPage`), canonical, generirani `sitemap.xml` i `robots.txt`.

---

## 🚀 Pokretanje i lokalni razvoj

```bash
# 1. Kloniranje repozitorija
git clone https://github.com/markobozac/cjepiva.git
cd cjepiva

# 2. Instalacija ovisnosti
npm install

# 3. Pokretanje lokalnog poslužitelja za razvoj
npm run dev

# 4. Izgradnja produkcijske verzije
npm run build

# 5. Lokalni pregled produkcijske verzije
npm run preview
```

---

## 🌐 Objava (Deployment)

Trenutna adresa: **https://markobozac.com/cjepiva/** (privremeno, unutar WordPress stranice na cPanel hostingu).

Build koristi relativne putanje (`base: './'`), pa radi iz bilo koje mape. Javna adresa (canonical, Open Graph slike, `sitemap.xml`, `robots.txt`) postavlja se jednom varijablom:

```bash
# zadano: https://markobozac.com/cjepiva/
npm run build

# nova domena
SITE_URL=https://nova-domena.hr/ npm run build
```

**Objava na cPanel:**
1. `npm run deploy:zip` → nastaje `cjepiva-dist.zip`
2. cPanel → File Manager → `public_html/markobozac/cjepiva/` → Upload → Extract (prepiši postojeće datoteke)

`dist/.htaccess` postavlja dugo keširanje za hashirane JS/CSS datoteke i `no-cache` za `index.html`, tako da se nova verzija vidi odmah.

**GitHub Pages:** `.github/workflows/deploy.yml` na svaki push na `main` gradi i objavljuje aplikaciju na GitHub Pages (Settings → Pages → Source: *GitHub Actions*). Pull requestovi se samo grade, bez objave.

---

## ⚖️ Medicinska ograda (Disclaimer)

Ova web stranica služi isključivo u informativne i edukativne svrhe te **ne predstavlja medicinski savjet niti zamjenjuje pregled liječnika**. Odluke o cijepljenju roditelji donose u dogovoru s nadležnim izabranim pedijatrom ili školskim liječnikom.

---

## 📄 Licenca

Ovaj projekt otvorenog je koda pod [MIT licencom](LICENSE).
