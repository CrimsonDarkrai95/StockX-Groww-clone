### Overview

Build a full-stack web application/Frontend called StockX with a polished, modern frontend inspired by the **Groww website** aesthetic (clean whites, minimal shadows, confident typography, smooth transitions, trustworthy financial-app feel). The backend exposes REST endpoints documented in the attached reference file — integrate all `GET/[function]` endpoints listed there.

---

### Tech Stack

**Frontend (General UI)**
- Framework of your choice (React recommended for component reuse)
- Styling inspired by Groww: white backgrounds, green/purple accent palette, Inter-style sans-serif font, card-based layouts, subtle hover states, no heavy gradients

**Frontend (Globe/Map Module only)**
- Vanilla TypeScript
- Vite (build tool)
- `globe.gl` + Three.js
- `deck.gl` + MapLibre GL
- Reference implementation: https://github.com/koala73/worldmonitor

**Backend**
- Integrate all `GET/[function name]` endpoints from the attached API reference document

---

### Pages & Flow

#### 1. Landing / Get Started Page
- **No login required** — fully public
- Communicates what the app does in a concise, visual way (think hero section + 2–3 feature highlights)
- Groww-inspired layout: bold headline, subheadline, clear CTA button ("Get Started" or "Explore")
- Top-right corner: **Login** button (navigates to Auth page)
- No forms, no data fetching on this page
- And if they want to view something like stocks or others, They need to register/login First in order to initiate any further process
-Basically What I wanted was There should be a starting loading page. (Get started with real time stock values and live analytics)

-Then It uses the similar Disappearing text like Google antigravity's official Page. ( I have also attached a test frontend to refer)

-Basically it says ABC text.. then there is a backspace effect and DEF... [Backspace all the letters/ words] And then GHI.. Etc. ( 5-6 sentences like this) (refer to antigravity-frontend.html for this)
-Note that Any GET/ function or function that is going to be accessed will be done **ONLY AFTER LOGIN/REGISTERATION COMPLETION** if user tries to trigger any such event, then redirect to login/registeration and make sure that is complete.
-No globe, nothing internal should be shown at the start page. everything else should be accessed only after register/login is complete. 

this was the Starting Loading page.

#### 2. Auth Page (top-right Login button triggers this)
- Full register/login flow on a single page with tab or toggle switching:
  - **Register** — for new users (name, email, password, confirm password)
  - **Login** — for existing users (email, password)
- Standard UX: inline validation, error messages near fields, loading state on submit button
- After successful login/register → redirect to the Dashboard (Globe view)

#### 3. Main Dashboard — Globe View (post-auth)
- Full interactive 3D globe built with the WorldMonitor stack (Vanilla TS + Vite + globe.gl + Three.js + deck.gl + MapLibre GL)
- Globe behaviour:
  - **Passive auto-rotation** when idle
  - **Cursor-draggable** — user can grab and rotate manually
  - Smooth transition between passive and manual control
- Globe displays live/fetched data from all `GET/[function name]` endpoints in the attached doc
- Data should be visualised meaningfully on the globe (arcs, points, heatmap layers, or markers — based on what the endpoint returns)
- Reference the attached file's existing globe code as the base implementation; extend it with the API data layers on top
Then after the User completes registeration and Login, they are redirected to a Large globe. The globe is constantly Spinning. And the globe should cover all the Major Stock exchanges. (Whichever I already have in my Backend)

And when they click on the exchange, it redirects them directly to thepage.

But it should always happen properly Accoridng to the order of GET/ Function.

--Like Example

1) Register -> Login-> Refresh Token

2) Wallet-> Balance -> Deposit/withdraw

3) view Stocks -> Individual Stock Detail

4) Portfolio for the User

5) other GET/ Functions



---

### Design Guidelines (Groww-inspired)

- **Color palette:** White base, `#00b386` (Groww green) or a close equivalent as primary accent, secondary purple (`#5367ff` range) for highlights
- **Typography:** Clean sans-serif (Inter or system-ui), 16px base, 1.5 line-height, strong weight contrast between headings and body
- **Cards:** White background, 1px light border (`#e8e8e8`), subtle `box-shadow`, 8–12px border-radius
- **Buttons:** Solid filled primary CTA, ghost/outline secondary, 44px min height, smooth hover transition (150–200ms)
- **Navigation:** Top navbar with logo left, nav links center or right, Login/profile top-right
- **No heavy gradients, no neon, no dark backgrounds on main surfaces**
- **Spacing:** 8px grid system throughout

---

### Functional Requirements

- Integrate **every** `GET/[function name]` endpoint from the attached API reference — none should be skipped
- Auth state must persist (localStorage or cookie-based session) so refreshing the page keeps the user logged in
- Globe data layers should update or load on mount after login
- All API errors should surface gracefully (toast or inline message — no silent failures)

---

### Constraints & Notes

- Do **not** modify the globe's core rendering logic from the reference repo — extend it only
- Do **not** add a login wall to the Landing page — it must remain fully public
- The Register/Login UI must handle both flows (new user + returning user) without separate routes if possible (toggle approach preferred)
- Attach the reference file's existing globe code as the starting point for the Map module; treat it as the base layer

Based on the Instructions.md and the Prompt (Doc 1) Take The other 2 files as reference for frontend
Worldmonitor one contains the globe/necessary components but it is not fully ready.(Refer to worldmonitor for globe components.)
the Antigravity one is quite useful to use for the "getting Started" page which I originally thought of.

edit: Globe Should Display all the Possible ( or the 7 Major Stock Exchanges like NASDAQ,NYSE etc) 
And It should be interactive. I.e: If the stocks are clicked ( from the globe), then the user is directed towards it to view Stock Details.
SO basically they would be able to see most of the stocks just by spinning the globe itself.

And if they want to manually search for the EXchanges, there is always the form validation-Dropdown menu/ UI that is mentioned in the Document for that type of particular Architecture, implying that the Data is going to be shown.

here is a Color THeme guide to be followed when Creating
You can “groww‑ify” your StockX palette by:
* Keeping your background / surface very dark (`#0b0e14` / `#111620`) as you already have.
* Using `#5076ee` as your main accent instead of or alongside your current `#0090ff` for buttons, highlights, and progress bars.
* Keeping text as `#c9d1e0`‑like (light gray on dark) and muted as `#556070`, which is already in the same spirit as Groww’s contrast usage.colorswall
So: Groww’s exact theme isn’t officially published in a single public spec, but its real‑app and asset‑based palette centers on `#5076ee` as the hero, with light grays/whites in light mode and dark‑grays in dark mode.
My web-programming Course for which I am creating this application currently teaches [Html,CSS,Javascript,NodeJS,AngularJS,Form Validation,DOM] This is just for context. Do NOT increase complexity of the application. (Along with this the TechSTack for rendering the GLobe is always included) [Dont use Next.js-Increases Complexity for no reason]