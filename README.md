# NEKIO — landing oldal (validációs MVP)

Kétnyelvű (EN/HU), mobilbarát, **build nélküli** statikus oldal: sima HTML, CSS és JavaScript, ezért közvetlenül GitHub Pages-en hostolható.

> **Állapot:** az oldal kész, de az **űrlapok nem élesek**, amíg be nem állítod és ki nem próbálod a tárolást (lásd 3. pont). Alapállapotban az űrlap őszintén jelzi, hogy „nincs bekötve”, és nem mond semmit sikeresnek.

## Mappaszerkezet

```
index.html            főoldal (szekciók + a két űrlap párbeszédablakként)
privacy.html          adatkezelési tájékoztató (EN + HU, TERVEZET, helyőrzőkkel)
favicon.ico
assets/
  css/style.css       teljes stíluslap (színek: :root változók)
  js/config.js        EGYETLEN beállítófájl: tárolás, kapcsolati e-mail, analitika
  js/i18n-data.js     MINDEN szöveg angolul és magyarul
  js/app.js           nyelvváltó, mobil menü, eseménymérés
  js/submit.js        a beküldés célja (csere egy helyen)
  js/forms.js         ablakok, validáció, állapotok
  img/                logók, ikonok, közösségi megosztási kép (og-image.png)
  fonts/              Inter (saját tárhelyről, nincs külső betöltés)
supabase/schema.sql   adatbázis-séma (csak beszúrás jogosultsággal)
tools/check-i18n.js   EN/HU szövegek szinkronjának ellenőrzése
.nojekyll
```

## 1. Helyi futtatás

```bash
cd nekio-site
python3 -m http.server 8000      # vagy: npx serve
# böngészőben: http://localhost:8000
node tools/check-i18n.js         # szövegek ellenőrzése (opcionális)
```

Hasznos linkek: `/?lang=hu` (magyar nyelvű megnyitás), `/#candidate-form` és `/#employer-form` (az űrlap azonnal megnyílik).

## 2. Hostolás GitHub Pages-en (ingyenes csomag)

1. Hozz létre egy **nyilvános** repót (az ingyenes GitHub-csomagon a Pages csak nyilvános repóból működik). A repóban csak publikus dolgok vannak; a beküldött adatok **nem** kerülnek a repóba.
2. Töltsd fel a `nekio-site` mappa **tartalmát** a repó gyökerébe, majd:
   ```bash
   git init && git add . && git commit -m "NEKIO landing page"
   git branch -M main
   git remote add origin https://github.com/<felhasznalo>/<repo>.git
   git push -u origin main
   ```
3. GitHub → **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, mappa = `/ (root)`. Pár perc múlva él az `https://<felhasznalo>.github.io/<repo>/` címen.
4. **Saját domain (nekio.hu):** Settings → Pages → *Custom domain* → `nekio.hu` → Save, majd jelöld be az **Enforce HTTPS** opciót. A DNS-nél (a GitHub aktuális dokumentációja szerint ellenőrizd az IP-ket):
   - apex (`nekio.hu`): négy `A` rekord → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www`: `CNAME` → `<felhasznalo>.github.io`
5. A GitHub Pages egy egyedi domaint kezel; a **nekio.app**-ot a regisztrátornál állítsd átirányításra a nekio.hu-ra.
6. Ha a végleges cím nem `https://nekio.hu/`, cseréld ki az `index.html` és `privacy.html` fejlécében a `canonical`, `og:url`, `og:image`, `twitter:image` és a JSON-LD címeit (keresd: `nekio.hu`), valamint a `siteUrl`-t a `config.js`-ben. A közösségi előnézeti képnek **abszolút** címen kell lennie.

> Fontos: GitHub Pages-en a futásidejű titkos kulcsok nem védhetők. Ezért a rendszer úgy készült, hogy a böngészőbe csak **publikus** kulcs kerül, ami kizárólag beszúrásra jogosít (lásd lent). Soha ne tegyél a repóba `service_role` vagy más privát kulcsot.

## 3. Az űrlapok élesítése (kötelező indulás előtt)

Ajánlott, legegyszerűbb megoldás: **Supabase** (ingyenes csomag, EU régió).

1. Hozz létre projektet a supabase.com-on, régiónak válassz **EU-t** (pl. Frankfurt).
2. *SQL Editor → New query* → másold be a `supabase/schema.sql` tartalmát → *Run*. Ez létrehozza a két táblát, és a nyilvános kulcsnak **csak beszúrási** jogot ad (olvasni, módosítani, törölni nem tud).
3. *Project Settings → API*: másold ki a **Project URL**-t és a **publikus (anon / publishable)** kulcsot. A `service_role` kulcsot **ne** használd az oldalon.
4. `assets/js/config.js`:
   ```js
   submission: {
     provider: 'supabase',
     supabase: { url: 'https://XXXX.supabase.co', anonKey: '<publikus kulcs>', ... }
   }
   ```
5. **Próbáld ki éles körülmények között**, mielőtt valódi emberek töltik ki:
   - töltsd ki mindkét űrlapot (EN és HU nyelven is), majd nézd meg a sorokat a *Table Editor*ben;
   - ellenőrizd, hogy a publikus kulccsal **nem** olvasható vissza semmi: `curl "<URL>/rest/v1/research_candidates?select=*" -H "apikey: <anon kulcs>"` → üres lista vagy hiba, de nem adat;
   - küldd be kétszer ugyanazt (hálózati hiba után újrapróbálás): a második nem hoz létre duplikált sort;
   - állítsd be, hogy értesítést kapj az új beküldésekről (Supabase *Database Webhooks* vagy egy hetente ellenőrzött nézet), különben a jelentkezők megvárakoztatása a legnagyobb kockázat.

Alternatíva: hosztolt űrlapszolgáltatás (Formspree, Web3Forms stb.): `provider: 'endpoint'`, majd a `config.js`-ben add meg a két űrlap URL-jét (és ha kell, az `extraFields`-ben a publikus kulcsot). A szolgáltatót a `privacy.html`-ben is fel kell tüntetni adatfeldolgozóként.

Spamvédelem: rejtett csapdamező (honeypot) és minimális kitöltési idő van beépítve. Ha ez kevésnek bizonyul, az következő lépés egy Cloudflare Turnstile + kis szerveroldali köztes réteg (ehhez már nem elég a tiszta statikus oldal).

## 4. Adatvédelem (GDPR) — indulás előtt

- A `privacy.html` **tervezet**, jogi felülvizsgálat nélkül. Töltsd ki az összes sárgával kiemelt `[helyőrzőt]` (adatkezelő neve, székhely, cégjegyzékszám, kapcsolattartó e-mail, tárhely- és adatfeldolgozó szolgáltatók, megőrzési idő, EU-n kívüli továbbítás), majd **jogásszal nézesd át**, és csak ezután töröld a sárga „Draft” sávot.
- Állítsd be a `contactEmail`-t a `config.js`-ben: ez kerül a láblécbe és az adatvédelmi oldalra (amíg üres, a lábléc „Kapcsolat” linkje a kutatás szekcióra mutat).
- A hozzájárulási jelölőnégyzet **nincs előre bepipálva**, és csak a kutatásra vonatkozik (marketing-hozzájárulás nincs összekötve vele). A beküldéssel a hozzájárulás időpontja és a `consentVersion` is eltárolódik; ha érdemben módosítod a tájékoztatót vagy a hozzájárulási szöveget, növeld a `consentVersion`-t.
- Az oldal nem használ sütit; a nyelvválasztás a böngésző helyi tárolójában marad. Analitika alapból **ki van kapcsolva**.
- Töröld a megőrzési idő lejártakor és kérésre az adatokat (a `schema.sql` alján vannak kész lekérdezések).

## 5. Mérés (analitika)

Alapból semmi sem töltődik be és semmi sem megy ki. A kódban már vannak eseményhívások, amelyek **nem tartalmaznak személyes adatot** (csak a CTA helye és az igen/nem/talán válasz):

| Esemény | Mikor |
|---|---|
| `candidate_cta_click` (`placement`: hero, card, research, final) | álláskeresői gombra kattintás |
| `employer_cta_click` (`placement`: …) | munkáltatói gombra kattintás |
| `candidate_form_open` / `candidate_form_start` / `candidate_form_submit` | űrlap megnyitása / első gépelés / sikeres beküldés |
| `employer_form_open` / `employer_form_start` / `employer_form_submit` | ugyanez a munkáltatói űrlapra |
| `candidate_interview_willing` (`answer`: yes/no) | sikeres beküldés után: interjúra való hajlandóság |
| `employer_pilot_interest` (`answer`: yes/no/maybe) | sikeres beküldés után: pilot-érdeklődés |
| `*_form_error` (`reason`) | beküldési hiba |

Bekapcsolás: `config.js` → `analytics.provider: 'plausible'` és `plausibleDomain: 'nekio.hu'` (cookie nélküli, EU-ban is használható szolgáltatás; fiókot neked kell létrehozni). Kapcsold be a „custom events” és az események `props` mezőit a Plausible-ben, hogy a `placement` és `answer` értékek látszódjanak. Bekapcsolás előtt egyeztess jogásszal és írd be a `privacy.html` „Analitika” pontjába. A valódi sikermutatók: **beszélgetésre kész jelöltek**, **valós pozíciót megbeszélni kész munkáltatók**, **pilotra nyitott munkáltatók** (ezek az adatbázisban is megvannak: `interview_willing = 'yes'`, `pilot_interest in ('yes','maybe')`).

LinkedIn-kampányhoz használj UTM-es linket, pl. `https://nekio.hu/?utm_source=linkedin&utm_medium=company-page&utm_campaign=research-okt`; ezek a címkék minden beküldéssel együtt tárolódnak (személyes adat nélkül).

## 6. Szövegek és megjelenés módosítása

- Szövegek: `assets/js/i18n-data.js` (EN és HU egymás mellett). Az angol alapszöveg az `index.html`-ben is szerepel; módosítás után futtasd: `node tools/check-i18n.js`.
- Színek, betűméretek, térközök: a `assets/css/style.css` tetején lévő `:root` változók.
- Űrlapmezők: az `index.html` két `<dialog>` blokkja, és ha új mezőt veszel fel, add hozzá a `forms.js` `fields` listájához és a `supabase/schema.sql` megfelelő táblájához.

## 7. Ismert korlátok

- **Közösségi előnézet (LinkedIn):** a robotok nem futtatnak JavaScriptet, ezért a megosztási cím és leírás angol; a kép kétnyelvű. Ha külön magyar előnézet kell, készíts egy másolatot `hu/index.html` néven magyar `<title>`/`og:` adatokkal. Frissítsd az előnézetet a LinkedIn Post Inspectorral, ha módosítottad.
- **Logók:** a megadott PNG-ket használja (kisebb méretekre előkészítve, a sötét háttérhez átlátszó fehér változat készült belőlük). Az ikon/favicon tiszta vektorként újra lett rajzolva (`assets/img/icon.svg`). Amint van valódi vektoros logó, cseréld le a PNG-ket SVG-re (`wordmark-*.png`, `logo-*.png`).
- **Biztonsági fejlécek** (pl. CSP) GitHub Pages-en nem állíthatók.
- A Supabase-beküldést ebben a környezetben nem tudtam éles projekttel kipróbálni; a 3. pont próbái szükségesek.
