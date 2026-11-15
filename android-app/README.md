# Vodič kroz cijepljenje – Android & Web aplikacija (5 kartica)

> Jednostavna, pregledna aplikacija za roditelje u Hrvatskoj organizirana u **5 odvojenih kartica (tabova)**, uz podršku za praćenje više djece.

---

## 📱 Struktura aplikacije (5 kartica)

1. **Pregled cjepiva (`#panel-pregled`):**
   - Otvara se izravno na katalogu cjepiva (bez uvodne hero sekcije ili legende).
   - Trenutno pretraživanje i filtriranje po vrsti (`Sve`, `Obvezna`, `Dodatna`) i dobi djeteta (`Rođenje` do `Škola`).

2. **Primljena cjepiva (`#panel-iskaznica`, [`src/components/checklist.js`](src/components/checklist.js)):**
   - Roditelj najprije dodaje dijete (ime i datum rođenja). Moguće je dodati **$n$ djece** i jednim klikom prebacivati prikaz između njih.
   - Prikazuje preglednu **checklistu svih doza cjepiva** za odabrano dijete:
     - Potvrda da je cjepivo primljeno (checkbox)
     - Datum kada je cjepivo primljeno (`<input type="date">`)
     - Neobavezna napomena (`<input type="text">`)

3. **Budući termini (`#panel-buduci`, [`src/components/upcoming.js`](src/components/upcoming.js)):**
   - Prikazuje sve buduće datume kada je pojedino cjepivo na redu prema datumu rođenja odabranog djeteta.
   - **Automatsko filtriranje:** Sve doze koje su potvrđene na 2. kartici („Primljena cjepiva”) automatski se uklanjaju s popisa na 3. kartici.

4. **Česta pitanja (`#panel-pitanja`, [`src/components/faq.js`](src/components/faq.js)):**
   - Odgovori na najčešća pitanja roditelja (propušten termin, razlika obveznih i preporučenih cjepiva, kombiniranje cjepiva, temperatura, uobičajene reakcije).

5. **Info (`#panel-info`):**
   - Informacije o autoru (**Marko Božac**), motivaciji za pokretanje projekta, jamstvu privatnosti (100% lokalno na uređaju) te **Medicinska napomena** i poveznica na službeni program HZJZ-a.

---

## 🚀 Pokretanje i izgradnja

Capacitor 8 (Android target SDK 36). Potrebni: Node 22+, JDK 21, Android Studio Otter ili noviji.

```bash
cd android-app
npm ci

npm run dev            # lokalni pregled u pregledniku
npm run android:sync   # vite build + cap sync android
npm run android:open   # otvori u Android Studiju
```

Ikone i splash generiraju se iz `assets/` naredbom
`npx @capacitor/assets generate --android --iconBackgroundColor '#285F9C' --splashBackgroundColor '#F7F4EE' --splashBackgroundColorDark '#14191F'`.

## 📦 Objava (Google Play)

- CI: `.github/workflows/android.yml`. Svaki push u `android-app/` builda `.aab` (artefakt u Actions).
- Release: `git tag android-v1.0.0 && git push origin android-v1.0.0` → potpisani build i upload na *internal* track (kad postoji `PLAY_SERVICE_ACCOUNT_JSON`).
- Potpisivanje: upload ključ **nije u repou**. Lokalno se čita iz `android/keystore.properties` + `android/cjepiva-upload.jks`, u CI-ju iz secreta `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`.
- Materijali za store: [`docs/play-store.md`](docs/play-store.md).
