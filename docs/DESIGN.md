# YardFlow Design: "Night Ops"

The approved design direction. Dark first, like a terminal control room at night, with a light theme of equal quality. Rounded floating panels over a live map, one acid-lime accent for "live" and primary actions, monospace for every container number and position code.

Reference mockups were approved for four screens: Landing, Planner overview, Gate-in (tablet), Customer portal (phone). The layouts below describe them. Build every other screen in the same language.

## 1. Tokens

Implement as CSS variables on `:root` (dark, default) and `[data-theme="light"]`, consumed by Tailwind through `theme.extend.colors` with `var(--token)`. Theme follows the system setting until the user picks one with the toggle. Save the choice in `localStorage`.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#07090C` | `#F3F5F7` | Page background |
| `--surface` | `#10141A` | `#FFFFFF` | Panels and cards |
| `--surface-glass` | `rgba(14,18,23,0.85)` | `rgba(255,255,255,0.88)` | Panels floating over the map, with `backdrop-filter: blur(16px)` |
| `--surface-2` | `rgba(255,255,255,0.04)` | `#F1F3F5` | Nested tiles inside panels |
| `--border` | `rgba(255,255,255,0.08)` | `#E3E7EB` | Hairlines, panel borders |
| `--text` | `#E8EEF2` | `#0B0F14` | Primary text |
| `--text-muted` | `#8C99A3` | `#5B6772` | Labels, secondary text |
| `--accent` | `#C6F24E` | `#C6F24E` | Primary buttons, active nav pill, live dots. Text on it is always `#07090C` |
| `--accent-text` | `#C6F24E` | `#4F6B00` | Accent used as text (darker in light theme for contrast) |
| `--info` | `#8FD3FF` | `#1F6FB2` | Gate-out, vessel progress, "in yard" |
| `--warn` | `#FFC46B` | `#A55B00` | Work orders, waiting, damage |
| `--danger` | `#FF8A8A` | `#C62F2F` | Customs hold, denied, errors |
| `--soft-accent` | `rgba(198,242,78,0.12)` | `rgba(111,150,0,0.10)` | Accent tint backgrounds |
| `--soft-info`, `--soft-warn`, `--soft-danger` | same colors at 14% alpha | same colors at 10% alpha | Status chip backgrounds |

Status is never shown by color alone: every chip also has a text label (`In yard`, `Hold`, `Ready`, `Expected`, `Departed`, `Denied`, `Waiting`).

## 2. Typography

- **Sora** (300, 400, 500, 600, 700) for UI and headings. Headings use tight tracking (`-0.03em` to `-0.045em`).
- **JetBrains Mono** (400, 500) for container numbers, position codes, plates, times, PINs and all numbers in tables. Use `font-variant-numeric: tabular-nums` for numeric columns.
- Scale: 12, 13, 14, 16, 18, 22, 28, 36, 44, 64, 84 px. Body 14 px in the app, 16 to 19 px on the landing page.
- Container numbers are always displayed with the formatter: `HNFU 204571 1`. On gate screens the check digit is highlighted in `--accent-text`.

## 3. Shape, spacing, depth

- Radius: 12 px for buttons and inputs, 14 to 16 px for tiles, 20 to 22 px for panels, 999 px for pills and chips.
- Spacing on a 4 px grid. Panel padding 18 to 20 px. Gap between panels 12 to 16 px.
- No drop shadows in dark mode. Depth comes from glass panels over the map and from borders. Light mode may use one soft shadow `0 8px 24px rgba(11,15,20,0.06)` on floating panels.
- Icons: lucide-react, 16 to 20 px, stroke 1.8 to 2.

## 4. Components

- **Top bar** (staff app): floating row of glass pills at the top: logo pill, navigation pill (Yard, Gate, Vessels, Work orders, Customs, Reports, plus Admin for admins) with the active item filled in `--accent`, search pill (container, vessel or plate, opens results as you type), user pill with name, role and avatar initials. On tablets the navigation collapses to icons with labels on the active item.
- **Glass panel**: `--surface-glass`, 1 px `--border`, radius 20, blur 16.
- **Status chip**: height 24, pill, soft background plus solid text color.
- **Feed row**: 38 px rounded square with the event kind (`IN`, `OUT`, `DENY`, `WAIT`) in its status color, then container number in mono and one line of detail, time on the right.
- **Stack indicator**: a vertical set of bars, one per tier up to `maxTier`: filled tiers in neutral, the tier the container would take in `--accent`, empty tiers faint. Used in slot suggestions and stack details.
- **Primary button**: `--accent` background, dark text, 600 weight. Secondary: transparent with border. Destructive: `--danger` outline, filled only in confirm dialogs.
- **Inputs**: 44 px tall minimum, 48 to 56 px on the Gate tablet screens. Container number input validates live and shows `Check digit valid` or the exact error under the field.
- **Toasts** for completed actions (`Gate-in complete · B-02-05-2`) and errors that say how to fix them.
- **Empty states** name what will appear and how to create the first item.
- **Skeletons** while loading, never spinners alone.

## 5. Photos

Photos are in `apps/web/public/images/` (Unsplash License, credits in `apps/web/public/images/CREDITS.md`):

| File | Use |
|---|---|
| `night-harbor.jpg` | Landing hero background, darkened with a vertical gradient to `--bg` |
| `aerial-stacks.jpg` | Faint texture behind the Planner yard map at 12 to 18% opacity, saturation 0.5 (dark theme only) |
| `aerial-cranes.jpg` | Customer portal header on phone |
| `crane-truck.jpg` | Gate screen side panel header ("Lane 1 camera" placeholder) |
| `ship-cranes.jpg`, `crane-stacks.jpg`, `yard-lane.jpg`, `sunset-truck.jpg` | Login page side image, empty states, README |

Serve responsive sizes with `srcset` (generate 800 and 1600 wide versions at build time or commit them) and `loading="lazy"` except the landing hero.

## 6. Screens

### 6.1 Landing (public, `/`)

- Full-width hero, 810 px tall on desktop: `night-harbor.jpg` with a gradient from 55% dark at the top to solid `--bg` at the bottom.
- Floating glass top bar with logo, links (Platform, How it works, API docs, GitHub), theme toggle, `Sign in` pill in accent.
- Left: live pill "Live yard · N containers tracked right now" (real number from a public stats endpoint or the seed), headline "Every box in the yard." with a second line "Every move, live." in `--text-muted` light weight, 84 px, paragraph, buttons `Open live demo` (accent, arrow icon) and `Explore the API` (outline).
- Right: glass card "Gate feed" showing the last 3 gate events (public, anonymized plates).
- Row of 4 stat cards over the bottom of the hero: yard occupancy, gate moves today, average dwell time, gate-in time per truck.
- Bottom row: accent card "Sign in with a demo role and run a full import in 2 minutes" with the password, a card with the 4 demo accounts (click fills the login form), a card with the stack chips.
- Mobile: hero text stacks above the gate feed, stats become a 2 by 2 grid.

### 6.2 Login (`/login`)

Split screen: form on the left on `--surface`, photo on the right. Demo account buttons under the form that fill email and password. Error message inline under the form.

### 6.3 Planner overview (`/app`)

- The whole screen is the **yard map**. Dark tarmac background (`--bg`) with `aerial-stacks.jpg` as a faint texture, radial vignette at the edges.
- Blocks are drawn from their real geometry (`mapX`, `mapY`, rows, bays) as a grid of stacks, in SVG or Canvas. Each stack cell is shaded by height (4 steps of accent alpha from 20% to 100%), `--danger` if any container in it has an active hold, `--warn` outline for DG block X. Block outline glows in its status color; a label pill above each block shows code, type and occupancy percent.
- The gate is on the left edge, drawn as two lanes with small labels.
- Hover a stack: tooltip with position and top container. Click: side drawer with the stack side view (tiers with container numbers, owner, size, hold badge) and actions (move top container).
- When `yard:changed` arrives, the changed stack pulses once in accent and a callout pill appears for 6 seconds with the container number and new position.
- **Left floating column** (330 px): occupancy panel (big percent, change today, 24-bar sparkline for the last 24 hours, mini tiles for gate moves, holds, dwell), then work orders panel (open orders grouped by relocation group, each with from and to codes and a `Done` button that is only enabled for the next in sequence).
- **Right floating column** (320 px): live gate feed, then the vessel at berth with a progress bar and ETD.
- **Bottom legend bar** between the columns: stack height scale, hold, DG, and `used / total TEU`.
- Tablet: columns become a bottom sheet with tabs (Work orders, Gate feed, Vessel). Phone: staff screens are not optimized beyond readable, show a note that the Planner view is designed for desktop and tablet.

### 6.4 Gate (tablet first, `/app/gate`)

- Top bar: back button, "Gate-in · Lane N" or "Gate-out · Lane N", lane switcher, and a step pill row (Truck, Container, Inspection, Slot, Confirm) with done steps muted and active steps in accent.
- Left panel 380 px: `crane-truck.jpg` header with a "Lane N camera" chip, the container number big in mono with the check digit highlighted, `ISO 6346 check digit valid`, a 2 by 2 grid of check tiles (PIN, truck plate, driver, time slot) each with a check icon, then type, owner, vessel.
- Right, top: damage inspection with a top-view container diagram and a button on each side (Front, Back, Left, Right, plus Top and Floor below), damage code pills (Dent, Hole, Rust, Broken, Missing), "No damage" toggle, note field.
- Right, bottom: three slot suggestion cards side by side (best match outlined in accent), each with position code, score, stack indicator and reasons. Full-width confirm button 58 px tall: "Confirm gate-in to B-02-05-2 and print EIR".
- **Gate-out** uses the same frame. The right side shows the 4 checks as large rows with pass or fail and the reason. If relocations are needed it shows "Waiting for N relocations" with a live list, then enables "Complete gate-out".
- All touch targets at least 48 px.

### 6.5 Other staff screens

Same top bar and glass panels on `--bg`, content in `--surface` panels:

- **Vessels**: list of visits as cards (name, voyage, status chip, ETA or ATA, progress). Detail with two tabs, Discharge and Load, as tables with status, and a side panel to confirm the selected item with slot suggestions.
- **Work orders**: grouped list, filters by status.
- **Customs** (Admin): table of containers with active holds, place hold dialog with reason, release button with confirm.
- **Billing** (Admin): invoices table with status chips, mark paid, PDF.
- **Reports**: KPI tiles and the three charts. Charts use `--accent` for gate-in, `--info` for gate-out, muted grid lines, tooltips on hover.
- **Admin**: users, companies, blocks, tariffs, time slot capacity (week grid), audit log with filters and CSV export.

### 6.6 Customer portal (phone first, `/portal`)

- Header 330 px: `aerial-cranes.jpg` with a gradient to `--bg`, company avatar, company name, greeting "Good afternoon, Lea", notification bell with unread dot.
- Big count of containers with chips: in yard, on hold, expected.
- Alert card for any active customs hold in `--soft-danger` with a shield icon.
- Container cards: number in mono, status chip, size, day count and invoice state, position.
- Sticky primary button "Book a pickup slot".
- Floating bottom navigation pill with 4 items (Boxes, Slots, Alerts, Invoices), active item filled in accent.
- **Booking flow**: bottom sheet with date chips for the next days, time slot grid with remaining capacity (full slots disabled), truck plate and driver fields, invoice summary, confirm button. After booking, a PIN reveal screen with the 6 digits in large mono, copy button, and the note that the PIN is shown once.
- On desktop the portal is centered at 480 px wide with the same components.

## 7. Motion

- Only functional motion: stack pulse on change (600 ms), new feed rows slide in 8 px and fade (200 ms), panels fade in on route change (150 ms).
- Respect `prefers-reduced-motion`: disable pulses and slides.

## 8. Accessibility

- Contrast at least 4.5:1 for text in both themes.
- Every icon-only button has an `aria-label`.
- Focus rings: 2 px `--accent` outline with 2 px offset.
- The yard map has a keyboard accessible alternative: a table view toggle listing blocks and stacks.
