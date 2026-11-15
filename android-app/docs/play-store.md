# Objava na Google Playu – Vodič za cijepljenje

Paket: `hr.cjepivavodic.app` · Target SDK 36 (Capacitor 8) · Kontakt: marko@markobozac.com

## 1. Što trebaš napraviti sam (jednokratno)

1. **Play Console račun** – <https://play.google.com/console/signup> (25 USD, provjera identiteta).
   Osobni račun otvoren nakon 13. 11. 2023. mora prije produkcije proći **zatvoreno testiranje: 12 testera, 14 dana zaredom**. Organizacijski račun (D-U-N-S) je izuzet.
2. **GitHub secrets** – vrijednosti su u `GITHUB-SECRETS-cjepiva.txt` na Macu (mapa `Cijepiva`).
   Repo → Settings → Secrets and variables → Actions → *New repository secret*:
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`.
   Nakon toga datoteku obriši; `cjepiva-upload.jks` i lozinku spremi u password manager (bez njih ne možeš objaviti ažuriranje, osim uz reset upload ključa kod Googlea).
3. **Prvi upload ručno** – Play Console → *Create app* → Testing → *Closed testing* → nova verzija → upload `.aab` iz GitHub Actions artefakta (potpisan nakon koraka 2). Uključi **Play App Signing** (zadano).
4. **Service account za automatski upload** (nakon što aplikacija postoji u Consoleu):
   - Google Cloud Console → novi projekt → *APIs & Services* → uključi **Google Play Android Developer API**.
   - *IAM & Admin → Service accounts* → novi račun → *Keys → Add key → JSON*.
   - Play Console → *Users and permissions* → *Invite new users* → e-mail service accounta → dozvole za ovu aplikaciju: *Release apps to testing tracks* (+ *Release to production* ako želiš).
   - Sadržaj JSON-a spremi kao GitHub secret `PLAY_SERVICE_ACCOUNT_JSON`.
   - Kad Google prvi put odobri aplikaciju, dodaj repo **variable** `PLAY_RELEASE_STATUS=completed` (do tada upload ide kao *draft*).

## Cijena: plaćena aplikacija (2 €)

- Aplikacija se kreira kao **Paid** od prvog dana. Besplatna aplikacija se kasnije **ne može** pretvoriti u plaćenu (obrnuto može).
- Cijena: **1,99 €** (EU cijene na Playu uključuju PDV). Približan neto po prodaji u HR: 1,99 € − 25 % PDV-a ≈ 1,59 € − 15 % naknade Googlea ≈ **1,35 €**.
- Preduvjeti: **payments profile** u Play Consoleu (bankovni račun, porezni podaci) i deklaracija **trader statusa = trader** (prodaja). Kao trader, ime, adresa, e-mail i telefon prikazuju se javno na stranici aplikacije.
- Zatvoreno testiranje plaćene aplikacije: testeri je **moraju kupiti** (besplatno je samo interno testiranje, koje se ne broji u 12/14). Rješenje: promo kodovi (Play Console → Promotions) ili povrat novca nakon kupnje.
- Prihod od prodaje oporezuje se u Hrvatskoj – provjeri s računovođom (obrt ili drugi dohodak).

## 2. Izdavanje nove verzije

```bash
git tag android-v1.0.1
git push origin android-v1.0.1
```

CI builda potpisani `.aab` (versionCode = broj builda + 100, versionName iz taga) i šalje ga na **internal** track. Za drugi track: Actions → *Android build & Play upload* → *Run workflow* → odaberi track i označi *Upload*.

## 3. Store listing (hrvatski)

**Naziv aplikacije** (max 30): `Vodič za cijepljenje`

**Kratki opis** (max 80):
`Kalendar cjepiva za dijete: obvezna i preporučena cjepiva, termini i evidencija.`

**Puni opis**:

> Vodič za cijepljenje pomaže roditeljima u Hrvatskoj da na jednom mjestu imaju pregled svih cjepiva za dijete – od rođenja do škole.
>
> **Pregled cjepiva** – sva obvezna cjepiva iz Programa obveznog cijepljenja (HZZO) i dodatna, preporučena cjepiva (npr. rotavirus, meningokok B, vodene kozice, krpeljni meningoencefalitis, HPV). Pretraživanje i filtriranje po dobi i vrsti, jasne oznake što je obvezno i besplatno, a što se kupuje na recept.
>
> **Primljena cjepiva** – dodajte jedno ili više djece i vodite digitalnu evidenciju primljenih doza s datumom i napomenom.
>
> **Budući termini** – aplikacija prema datumu rođenja izračunava okvirne datume sljedećih cijepljenja i skriva ono što je već primljeno. Termine možete jednim dodirom spremiti u kalendar.
>
> **Česta pitanja** – kratki, razumljivi odgovori: propušten termin, kombiniranje cjepiva, temperatura i uobičajene reakcije nakon cijepljenja.
>
> **Privatnost na prvom mjestu** – imena, datumi rođenja i evidencija cijepljenja spremaju se isključivo na vašem uređaju. Nema registracije, nema oglasa.
>
> Napomena: aplikacija je informativnog karaktera i ne zamjenjuje savjet pedijatra ili liječnika školske medicine. Sadržaj se temelji na javno dostupnom programu cijepljenja HZJZ-a.

**Kategorija:** Parenting (Roditeljstvo) · **Oznake:** cijepljenje, dijete, kalendar
**Kontakt e-mail:** marko@markobozac.com · **Web:** https://markobozac.com/cjepiva/
**Pravila privatnosti:** https://markobozac.com/cjepiva/privacy-policy.html
(datoteka je u `public/privacy-policy.html` web verzije – objavi novi build na hosting prije slanja na review)

**Grafika** (`android-app/store/`): `icon-512.png`, `feature-graphic.png` (1024×500), `screenshots/1–5` (1080×1920).

## 4. App content (Policy → App content)

| Odjeljak | Odgovor |
|---|---|
| Privacy policy | URL iz gornjeg odjeljka |
| Ads | Ne sadrži oglase |
| Pricing | Paid, 1,99 € |
| App access | Sve funkcije dostupne bez prijave |
| Target audience | 18+ (roditelji). **Nije** namijenjena djeci – izbjegava Families policy |
| Content rating (IARC) | Kategorija *Reference, News or Educational*; sve odgovore „Ne“ → očekivano PEGI 3 / Everyone |
| News app | Ne |
| Health apps | Označi *Health & fitness → ostalo: informacije o cijepljenju / medicinska referenca*; aplikacija nije medicinski uređaj i ne daje dijagnoze |
| Government app | Ne (nije službena aplikacija HZJZ-a) |
| Financial features | Ne |

### Data safety

- **Prikuplja li aplikacija podatke?** Da, samo Google Analytics 4 (stream *Cjepiva Android app*, `G-45TBDCX4KY`) i samo nakon pristanka korisnika.
- **App activity → App interactions**: prikuplja se, nije dijeljeno, svrha *Analytics*, nije obavezno: uključuje se tek nakon pristanka pri prvom pokretanju, a može se isključiti u kartici Info.
- **Device or other IDs**: prikuplja se (GA instance ID), svrha *Analytics*, nije obavezno.
- Podaci o djeci (ime, datum rođenja, doze) **ostaju na uređaju** → ne prijavljuju se kao prikupljeni.
- Podaci su šifrirani u prijenosu: Da.
- Korisnik može zatražiti brisanje: Da – brisanjem podataka aplikacije; za analitiku e-mailom.

## 5. Napomene

- Podaci o cjepivima (`src/data/vaccines.json`, `faq.json`) preuzeti su s web verzije (program 2025.–2027. + RSV). Kad mijenjaš sadržaj, mijenjaj ga na oba mjesta ili ih spoji u jedan izvor.
- Analitika je opt-in kao na webu: prije pristanka aplikacija ne šalje ništa (fontovi su lokalni, GA se ne učitava).
- Testiraj na stvarnom uređaju s Androidom 15/16 (edge-to-edge: status i navigacijska traka).
