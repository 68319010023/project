---
target: LandingView.vue
total_score: 17
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Project\\src\\views\\LandingView.vue"
target_fingerprint: "sha256:609c7c69b7661746364b295f14adeec0821b17b7642eefd2516452a229bd5538"
target_path: "C:\\Project\\src\\views\\LandingView.vue"
timestamp: 2026-10-18T09-20-06Z
slug: src-views-landingview-vue
---
# Critique: src/views/LandingView.vue

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Stats show `...` then silently become `0` if `get_user_stats` fails; hash nav has no active section state |
| 2 | Match System / Real World | 3 | Thai product copy is mostly human; academic jargon (“Social Isolation”) and English kickers (Timeline, Research Paper, Coming Soon) leak a template |
| 3 | User Control and Freedom | 2 | Desktop can leave to login/register; between `sm` and `md` those exits vanish from both navbar and hamburger |
| 4 | Consistency and Standards | 2 | Neo-brutalist tokens are coherent; EN/TH labeling and the broken auth breakpoint are not |
| 5 | Error Prevention | 2 | Placeholder advisor copy (`[ชื่ออาจารย์ที่ปรึกษา]`) ships as if real; failed stats look like an empty product |
| 6 | Recognition Rather Than Recall | 3 | Nav labels and two hero CTAs are readable; the product itself is never shown |
| 7 | Flexibility and Efficiency | n/a | Persuade landing; no expert workspace to accelerate |
| 8 | Aesthetic and Minimalist Design | 2 | Hard-shadow cards have a point of view, then the page repeats the same 3-up emoji card / kicker / rounded panel rhythm |
| 9 | Error Recovery | 1 | RPC error is `console.error` only; visitors get a fake empty classroom |
| 10 | Help and Documentation | n/a | Persuade landing; no in-product help surface |
| **Total** | | **17/32** | **Acceptable (53%)** |

n/a heuristics: 7, 10. Applicable max: 32.

## Design Specificity Verdict

**LLM assessment:** This is not a generic indigo SaaS shell pasted onto an empty product. The page is authored as a ปวส. project poster: Thai Mali/Mitr type, lilac/orange/black neo-brutalist borders, offset shadows, a named maker (“by บารมี ปะวะลัง”), a research timeline, advisor, and paper. That subject is specific. The *layout grammar* is still category-interchangeable: centered hero, two CTAs, three equal stat cards, three equal problem cards, mono uppercase kickers, emoji as icons, a “Coming Soon” pill. Swap the Thai headline and this structure could sell a different school project tomorrow. The product (AI watching each student) never appears as a screenshot, flow, or artifact—only as a sentence.

**Deterministic scan:** `impeccable detect --json src/views/LandingView.vue` exited 0 with `[]` (0 findings). This is likely under-detection on a Vue SFC, not proof the page is clean. Detector did not see the template/kicker/emoji-card families visible in source.

**Visual overlays:** No reliable user-visible overlay. Browser MCP (`cursor-ide-browser`) failed to register (`Server not found`) after repeated navigate/list attempts. Fallback: source review of `LandingView.vue` plus tokens in `tailwind.config.js` / `src/style.css`. Vite was started at `http://localhost:5173/` for inspection and will be stopped after this run.

## AI-slop verdict (user question: ใช้ AI ไหม)

**Partial — yes in structure, no in material language.**

Looks authored / not default AI-SaaS:
- Neo-brutalist system (3px black borders, `shadow-offset`, orange fill CTAs, `#c4a7d6` lilac) instead of Inter + indigo gradient + glass blur
- Thai webfonts (Mali headings, Mitr body, Bai Jamjuree kickers)
- Academic IA (ปัญหา → ความเป็นมา → ที่ปรึกษา → งานวิจัย) instead of Features / Pricing / Testimonials
- Named student project footer and local logo/background assets

Looks like AI or a tutorial template:
- Eyebrow + H2 + 3 identical centered cards with emoji (😔 📉 ⏳) is the default “problem section” generation pattern
- `font-mono tracking-widest uppercase` kickers in English (`Timeline`, `Research Paper`, `Coming Soon`)
- Hero formula: big centered promise, gray subcopy, primary/secondary pill buttons, 3 stat tiles
- Decorative emoji instead of product imagery
- Unfilled template slots (`[ชื่ออาจารย์ที่ปรึกษา]`, `[ชื่อแผนก]`, `[ชื่อวิทยาลัย]`)
- Bounce hover on nav links and a floating scroll-top FAB — generic “delight” extras

Verdict to the author: **น่าจะมี AI หรือเทมเพลตช่วยวางโครง แล้วใส่ภาษาไทย/นีโอบรูทัลลงไป** ไม่ใช่หน้า Inter-purple 100% แต่ก็ยังอ่านว่า “landing ที่ generate แล้วยังไม่ finish”

## Overall Impression

The page has more personality than most student SaaS clones, then wastes it on an unfinished thesis outline. The single biggest opportunity is to **show the classroom and the AI**, and to **delete or finish every placeholder**, so the first screen persuades a student or teacher instead of documenting a capstone.

## What's Working

1. **A real visual system.** Offset shadows, thick borders, Mali/Mitr, orange-on-black CTAs — this is a designed kit, not Tailwind defaults.
2. **Clear primary action on desktop.** “เริ่มใช้งาน” vs “ดูรายละเอียด” is the right split; the promise “ไม่ทิ้งใครไว้ข้างหลัง” is memorable.
3. **Honest project framing.** Timeline and “พัฒนาโดยนักศึกษา 1 คน” are more trustworthy than fake social proof — if placeholders did not undermine them.

## Priority Issues

### [P1] Advisor and research sections ship as unfinished templates
- **Why it matters:** `[ชื่ออาจารย์ที่ปรึกษา]` and “Coming Soon” tell visitors the site is not ready. Trust dies before Register.
- **Fix:** Real name/photo/department, or remove the section until you have it. If the paper is not downloadable, do not give it a full-width card.
- **Suggested command:** `/impeccable clarify LandingView.vue`

### [P1] The landing argues a thesis, not a product
- **Why it matters:** Hero claims AI cares for each student; the rest is problem %, project months, advisor, paper. No UI, no student/teacher split, no “what happens after สมัคร”.
- **Fix:** One real classroom screenshot or a 3-step “ครูเห็นใครหลุด / AI เตือน / นักเรียนได้งาน” immediately under the hero. Move timeline/paper below the fold or to a research subpage.
- **Suggested command:** `/impeccable distill LandingView.vue`

### [P1] Login/register disappear between ~640px and 768px
- **Why it matters:** Auth is `hidden md:flex` in the bar and `sm:hidden` inside the hamburger. Tablet-width users get a menu with no way in.
- **Fix:** Put both auth links in the hamburger for all `md:hidden` viewports (`flex` not `sm:hidden`).
- **Suggested command:** `/impeccable adapt LandingView.vue`

### [P1] Live stats lie when the API fails
- **Why it matters:** On RPC error the code returns early; counts stay `null` in theory, but a later empty payload becomes `0`. Empty/zero stats on a marketing hero read as “nobody uses this.”
- **Fix:** Hide the stat row until data is real, or show a non-numeric fallback (“กำลังนับผู้ใช้”) — never a silent 0.
- **Suggested command:** `/impeccable harden LandingView.vue`

### [P2] Section rhythm and emoji cards read as generated
- **Why it matters:** Equal 3-up cards, English kickers, and emoji icons flatten the brutalist identity into a template.
- **Fix:** One asymmetric problem statement with a cited source, not three identical tiles. Thai kickers. Replace emoji with a still from the app.
- **Suggested command:** `/impeccable quieter LandingView.vue`

## Cognitive load

Failed checklist: **Single focus** (product vs capstone poster); **Visual hierarchy** (every section same width/weight after hero); **Progressive disclosure** (research timeline before anyone sees the product).  
3 failures = **moderate**. Hero decisions are ≤4 options; the page-level decision “what is this?” is overloaded.

## Emotional journey

Peak: the headline and the dark “💡 เพราะปัญหานี้” band. Valley: fake advisor name. End: tiny footer. Peak-end fails — visitors leave on incompleteness, not on the promise.

## Persona red flags

**Jordan (first-timer):** Does not know whether Register is for นักเรียน or ครู. “Social Isolation” and English “Coming Soon” do not explain the product. Advisor looks like a form that was never filled.

**Riley (stress tester):** Breaks stats by failing `get_user_stats` (console only). Finds template brackets still in production. Citation footnote does not clearly map onto 72% / 1:40 / 45%. Hash links to `#problem` while the visitor still does not know what the app looks like.

**Casey (mobile):** Hamburger is 36×36 (`w-9 h-9`), under 44pt. Three stat columns at 10px type. Auth missing in the sm–md band. Primary CTA sits in the upper half over a photo, not in the thumb zone. Scroll-top FAB (56px) is the only comfortable hit target and appears after 500px.

## Minor observations

- Hamburger uses ☰/✕ with no `aria-label`.
- `totalCount` duplicates student+teacher.
- `v-reveal` / `nav-link-bounce` / floating ArrowUp add motion without changing meaning.
- Hero `text-outline` (white fill + dark stroke) on `bg.png` is a contrast gamble.
- `HeroSection.vue` exists in the repo but this view inlines its own hero.
- Timeline is a project diary, not a user story.
- Footer year 2569 vs timeline 2568 is fine if intentional; still looks like leftover copy.

## Questions to consider

- If this URL is for a committee, keep timeline/advisor; if it is for users, cut them.
- Would one screenshot of a struggling student in the teacher view outperform three emoji statistics?
- What would a confident version look like with zero placeholders and zero “Coming Soon”?
