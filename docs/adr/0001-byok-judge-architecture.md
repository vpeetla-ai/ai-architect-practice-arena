# ADR-0001: Bring-your-own-key, dual-judge architecture

## Status

Accepted — 2026-07-05

## Context

`ai-architect-interview-playbook` (35 entries) each already encode a real, specific Staff+/
Principal grading rubric in their "What's expected at each level" sections — but the repo is
something you read, not something you practice against. The goal here is a mock-interview
practice layer: grade a real written answer against that exact rubric using an LLM judge, with
two decisions made up front that shape the whole architecture:

1. **Both OpenAI and Anthropic judge every attempt**, not one provider — their agreement (or
   disagreement) on an answer's level is itself a real, useful trust signal.
2. **Bring-your-own-key (BYOK)**, not an org-funded shared key — since this is meant to be a
   genuinely public tool ("everybody will use it"), BYOK means this org bears zero direct API
   cost regardless of usage volume, at the cost of a real responsibility: a user's key must
   never be stored, logged, or sent to our own backend.

## Decision

- **Rubrics parsed from the playbook, not re-authored.** `scripts/build_rubrics.py` parses each
  entry's real "What's expected at each level" section directly into `content/rubrics.json` —
  the judge's system prompt uses this text verbatim, so the tool can never drift from what the
  playbook itself says a good answer looks like. Phase 1 scope is a 10-question slice spanning
  `ai-system-design/`, `general-system-design/`, and `cloud-architecture/` — the three folders
  that share this exact rubric shape. `behavioral/` and `scalability-governance-tradeoffs/` use a
  genuinely different STAR/framework-based answer shape that needs its own rubric design,
  deliberately deferred rather than force-fit into this parser.
- **Judging happens entirely client-side, in the browser.** `frontend/lib/judge/` holds
  `OpenAIJudgeAdapter` and `AnthropicJudgeAdapter`, mirroring the shape of
  `aegisai-enterprise-agent-platform`'s real `LLMGateway` (one `.judge()` interface, provider-
  specific request/response handling). The backend (`backend/`) serves question and rubric
  content only — no API key of any kind is ever received by it, by construction.

## A real finding from live browser testing, not assumed

The original design assumed both providers could be called directly from the browser and
flagged OpenAI specifically as "needs live verification." A real browser test (Phase 1
end-to-end check, 2026-07-05) confirmed this assumption was wrong for one provider and right for
the other:

- **Anthropic**: the documented `anthropic-dangerous-direct-browser-access` header works exactly
  as described — a real request from the browser reached `api.anthropic.com` directly and
  returned a real (401, since a placeholder key was used) response.
- **OpenAI**: a direct browser request to `api.openai.com/v1/chat/completions` failed with a
  CORS-blocked network error (`net::ERR_FAILED`) — the preflight `OPTIONS` request succeeded,
  but the real `POST` never returned a readable response to the page. This is exactly the
  difference between an API that supports direct browser access and one that doesn't, and it
  would not have been caught without actually running the request in a real browser.

**Fix**: `app/api/openai-proxy/route.ts` — a minimal, stateless same-origin proxy. It forwards
the caller-supplied key in the `Authorization` header on every request and returns OpenAI's
response as-is; it holds no state between requests and logs or persists nothing. Re-tested live
afterward: the same flow now reaches OpenAI's real server and returns a real, correctly-parsed
error response (confirmed with a placeholder key: `"Incorrect API key provided: sk-fake-..."`,
OpenAI's own real error text, not a synthesized one). If OpenAI ever adds direct browser CORS
support, the proxy can be removed and the adapter pointed back at `api.openai.com` directly with
no other code change — the base URL is the only thing that differs.

This keeps the BYOK security property intact for both providers: the key transits our own
server only as an unlogged, unstored per-request pass-through for OpenAI, and never touches our
server at all for Anthropic.

## Other real things found only by actually running this, not by code review

- **Node 18 cannot run this stack.** `vitest@4`'s rolldown-based test runner requires
  `node:util`'s `styleText` export (Node 20.12+/22.13+) — caught by actually running `npm test`,
  not assumed from the package's stated engine range. Pinned Node 20 via `.nvmrc` and `package.json`'s
  `engines` field.
- **React 19 is required, not just supported**, for Next.js 16's dynamic route `params` API —
  `use()` to unwrap a `Promise<params>` in a client component only exists in React 19. Caught by
  a real `tsc` failure before it ever reached the browser.
- **Question IDs contain slashes** (`ai-system-design/01-...`), so the practice route uses a
  catch-all segment (`app/practice/[...questionId]/`), not a single dynamic segment — a single
  segment silently fails to match paths containing `/`.

## Calibration status — run for real, 2026-07-05

`content/calibration/manifest.json` holds one deliberately weak and one deliberately strong
reference answer per question in the Phase 1 slice, and `frontend/scripts/runCalibration.ts` runs
both judges against the full set for real. This has now been run twice against live providers,
with a real bug found and fixed in between:

**First run: 20/40 passed, 20/20 failed identically.** Every OpenAI case failed with
`TypeError: Failed to parse URL from /api/openai-proxy` — the adapter's default base URL is a
relative path meant to resolve against a browser's same origin; Node's `fetch()` (which is what
the calibration script uses, not a browser) has no origin to resolve it against, so it throws
immediately, before ever reaching the network. CORS — the entire reason the proxy exists — is a
browser-only restriction and doesn't apply to a Node script at all. **Every Anthropic case
passed (20/20)** in this same run, a real, independent positive signal for the harness itself
that arrived before the OpenAI bug was even fixed.

**Fix**: the adapter now picks its default base per runtime context — the same-origin proxy when
`typeof window !== "undefined"` (a real browser), OpenAI's endpoint directly otherwise (Node has
no CORS restriction to route around). Re-verified live in the browser afterward with a
placeholder key to confirm no regression: the browser path still correctly routes through
`/api/openai-proxy` (confirmed via the real network log).

**Second run, after the fix: 40/40 passed.** Both judges assessed every weak reference answer as
Mid-level or Senior and every strong reference answer as Staff+ or Principal, across all 10
questions in the Phase 1 slice, using real API keys against the real OpenAI (`gpt-4.1-mini`) and
Anthropic (`claude-sonnet-4-5`) APIs. This is the pre-launch calibration gate, cleared — the
judge harness demonstrably grades in the expected direction, not just "runs without crashing."

## Deployment — live, 2026-07-05

Frontend deployed to Vercel (`ai-architect-practice-arena.vercel.app`), backend deployed to
Render (`practice-arena-api.onrender.com`), both on free tiers, matching this org's established
reference-stack convention (ADR-005 in `ai-architecture-portfolio`). Two things caught only by
deploying for real, not assumed from local testing:

- **Vercel's default Deployment Protection (SSO) blocks all public access**, including
  production. A new project defaults to gating every URL behind a Vercel-account login wall —
  exactly the wrong default for a tool meant for public use. Disabled explicitly
  (`vercel project protection disable ... --sso`) and confirmed via a real unauthenticated
  request that the site is actually reachable.
- **`vercel link` without an explicit `--project` flag creates a new project** rather than
  linking to an existing one of a different name — caught after a rename left an empty duplicate
  project behind, cleaned up before it caused confusion later.

Verified live afterward: the backend's `/health`, `/questions`, and `/questions/{id}/rubric`
endpoints all respond correctly over real HTTPS; the frontend's home and practice pages render
real content sourced from the live backend (not a cached or local fallback); and the
`/api/openai-proxy` serverless function was confirmed working in Vercel's actual production
runtime — a direct request with a placeholder key reached OpenAI's real API and returned OpenAI's
real, correctly-parsed error text, the same behavior already verified locally.

## Phase 2 — sectioned mock interview, full system-design coverage, 2026-07-05

Phase 1 treated an answer as one flat textarea and covered 10 of the playbook's questions. Asked
for the real, proper mock-interview experience, this phase (a) breaks the answer into the same
sections the playbook itself uses (originally five: Requirements, Core Entities, API/Interface,
High-Level Design, Deep Dives — later aligned to six with Data Flow; see amendment below),
(b) extends coverage to all 26 questions in the three folders that share
this shape (`ai-system-design/` 13, `general-system-design/` 7, `cloud-architecture/` 6) — the
remaining 9 (`behavioral/` 5, `scalability-governance-tradeoffs/` 4) are still deliberately
deferred, being STAR- and framework-shaped rather than system-design-shaped, and (c) gives each
judge a High-Level Design input that accepts a live-rendered Mermaid diagram (the primary path —
rendered client-side via the `mermaid` package, sent to judges as raw text since it's already
structured) plus an optional image URL (Excalidraw exports, screenshots — shown inline, sent as a
real vision input when the provider accepts it, with a text-only fallback if it doesn't).

**Parser extension**: `scripts/build_rubrics.py` now extracts `core_entities_summary`,
`api_interface_summary`, `high_level_design_summary`, `reference_mermaid` (the model answer's own
diagram, parsed from its fenced ```mermaid``` block), and `deep_dives_summary` (all `## Deep dive
N: ...` sections concatenated — count and titles vary 2-4 per entry, matched by heading pattern,
not a fixed string). Re-run against all 26 questions with zero parse failures — same
fail-loud-on-any-gap discipline as Phase 1's original 10.

**Judge restructuring**: `JudgeVerdict` still assesses one overall level, but now returns
per-section `{strengths, improvements}` instead of one flat comment. A new
`content-consistency.test.ts` cross-checks every rubric has a matching calibration case and vice
versa, and that every `question_id` resolves to a real file under the playbook submodule — this
caught the expected (since-fixed) coverage gap mid-rewrite.

**Calibration — run for real against live OpenAI + Anthropic, 104 cases (26 questions × weak/
strong × 2 providers): 102/104 passed on the first run.** Two real failures, each diagnosed and
fixed rather than dismissed:

1. `[anthropic] ai-system-design/05-content-moderation-safety-system (strong): expected
   ~principal, got senior` — a genuine content gap, not a judge-strictness or harness bug. The
   calibration "strong" answer covered the Staff+ criteria (redaction-vs-grounding trade-off
   named explicitly, risk categories routed differently) but omitted the specific
   Principal-differentiating mechanism this rubric entry actually defines: fail-open/fail-closed
   as a *per-category* design decision (not a global policy), and the human review experience
   designed as a first-class part of the system, not an implementation detail. **Fixed** by adding
   both points to that entry's `strong_answer.deep_dives` in `content/calibration/manifest.json`.
2. `[anthropic] cloud-architecture/05-security-and-compliance-architecture-for-ai-systems (weak):
   TypeError: fetch failed` — a transient network-level failure, not a content or code defect (it
   occurred mid-run, on an otherwise unremarkable weak-answer case, with no retry logic in the
   harness at the time). **Fixed** by adding a single retry to `runCalibration.ts`, scoped to
   network-level error patterns only (`fetch failed`, `ECONNRESET`, `ETIMEDOUT`) — a real judge
   error (bad key, 4xx) still surfaces immediately rather than being retried into a false pass.

Both fixes are applied and unit/type-check clean, but **a full live rerun to confirm 104/104
has not yet happened as of this writing** — BYOK means this repo's own tooling never holds a
user's API key, so re-confirming requires the user to run `npm run calibrate` again with their
own keys. This is disclosed here rather than assumed resolved.

**Image-vision-input path: still genuinely unverified.** Neither the original 10-question nor the
new 16-question calibration cases exercise `high_level_design_image_url` (calibration answers use
the Mermaid path only), so the vision-input code path in `openaiAdapter.ts`/`anthropicAdapter.ts`
— including the "NEEDS LIVE VERIFICATION" Anthropic URL-source question flagged in Phase 1 — has
not been exercised against a live provider with a real image. It only got a real (non-provider)
browser check: the image URL field renders an inline `<img>` preview correctly. Whether the
providers actually accept it as a vision input, or silently fall back to text-only, remains
unconfirmed pending a real answer submission with an image URL against live providers.

Local browser verification before redeploying (2026-07-05): all 26 questions load with real
section content from the backend; the Mermaid textarea renders a real SVG via `mermaid.render()`
on typed input; the image-URL field renders a real inline preview; no console errors; the
"Grade my answer" button correctly stays disabled with no answer text and no keys entered.

**A real finding from redeploying, not assumed**: `vercel --prod` creates a new production
deployment and updates the project's default git-based domain, but does **not** automatically
move a previously-set custom short alias (`ai-architect-practice-arena.vercel.app`) onto the new
deployment — that alias stayed pinned to the prior build until re-pointed explicitly with
`vercel alias set <new-deployment-url> ai-architect-practice-arena.vercel.app`. Caught only
because a real request to the canonical URL after redeploying still served the old, flat Phase 1
UI; fixed by re-aliasing and confirmed via a fresh request afterward.

**Follow-up UI pass, same day**: the sectioned single-column page was hard to navigate between
questions and buried the keys/results below a long form. Restructured into a three-pane layout —
`app/practice/layout.tsx` (new) renders a persistent left sidebar listing all 26 questions
(grouped by category, active question highlighted via a small client component,
`lib/QuestionNavLink.tsx`, comparing `usePathname()`), the practice page's center column keeps
the five answer sections, and a new sticky right rail holds the API key inputs, the "Grade my
answer" button, and the judge results — so switching questions, entering keys, and reading
results no longer requires scrolling past a full page of textareas. Verified live in the browser:
clicking between questions in the sidebar re-renders the center column via Next.js client-side
navigation (RSC fetch, not a full page reload) while the sidebar and right rail persist; the
active-question highlight matches the real URL after the async transition completes; the layout
collapses to a single stacked column below 900px for mobile.

**Second follow-up, same day: single persistent screen.** The sidebar living only in
`app/practice/layout.tsx` meant the home page (`/`) and a practice page (`/practice/[id]`) were
still two visually different screens — landing on `/` showed a full-page list of question cards
with no sidebar, then navigating to a question replaced the whole screen with the three-pane
layout. Moved the sidebar into the root `app/layout.tsx` (now an async server component fetching
questions once for every route) so it's present from the very first paint; deleted
`app/practice/layout.tsx` entirely; simplified `app/page.tsx` to a short welcome message shown in
the shared content area (the question list already lives in the sidebar, so the home page no
longer duplicates it). Removed the now-dead `.question-card` CSS rule. Verified live: `/` renders
with the sidebar already visible, clicking any question swaps in that question's form and right
rail without a screen-level jump, and the active-highlight/URL/header-text all agree after the
transition settles.

## Phase 3 — behavioral (STAR) + trade-offs (reasoning framework), 2026-07-06

Extends coverage from 26 to all 35 playbook questions by adding two new rubric formats for the
9 questions Phase 2 deliberately deferred: `behavioral/` (5 STAR write-ups) and
`scalability-governance-tradeoffs/` (4 reasoning-framework questions).

**A real content gap found before any code was written.** Neither category had the
"what's expected at each level" section every system-design question has — grepped both folders
for the pattern and found zero real matches. Grading against criteria that don't exist yet would
mean inventing them only in this app's build script, breaking the "rubric parsed from the
playbook, not re-authored" property this ADR and ADR-018 both rely on. Fixed upstream first: a
separate commit to `ai-architect-interview-playbook` (submodule bumped here afterward) added a
real level-criteria section to all 9 entries, plus a new generic, reusable "question, as it might
actually be asked" section to the 5 behavioral entries specifically — a STAR write-up is Venkat's
own real case (Lucid Motors, Volvo), so a practicing user has no way to answer it literally
without inventing fake company facts; the generic prompt lets them answer with their own real
experience against the same underlying competency, with the real case shown only as a labeled
illustrative example.

**A second real asymmetry, found by reading all 4 trade-offs entries in full before designing the
parser.** All 4 share `## The question, as it might actually be asked` and `## The framework`
(same heading text), but the content between them isn't uniform — entry 01 has two different
sub-sections than entries 02/03, and entry 04 has an extra section the other 3 don't. `_extract_
between()` (new, in `build_rubrics.py`) handles this positionally — everything between two known
anchor headings, sub-headings preserved — rather than forcing a fake shared structure the way the
existing `Deep dive N:` extractor matches a real shared prefix.

**Format-aware, not format-specific.** `Rubric`/`Answer` became discriminated unions
(`system_design | behavioral | tradeoff`) rather than three separate code paths: one
`buildJudgePrompt()` branches into three prompt builders sharing one JSON contract shape;
`normalizeSections()` takes the section-key list as a parameter instead of a hardcoded constant;
the two judge adapters needed zero changes to their model-calling logic (`buildJudgePrompt` now
returns `imageUrl` alongside `system`/`user` so adapters never need to know which answer shape
they're holding). The practice page's sidebar and right rail (keys, Grade button, results) are
fully shared across all three formats — only the center-column form branches per format.

**Calibration — run for real against live OpenAI + Anthropic, all 35 questions (140 cases):
139/140 passed, confirmed twice across two independent full runs.** All 18 new cases for the 9
Phase 3 questions passed cleanly both times — including the "strong" answers, which were
deliberately written with different concrete scenarios than each entry's own illustrative case
(a support-ticket-triage story instead of Lucid Motors', an e-commerce/payments story instead of
Volvo's), a real test of whether the judge actually grades the underlying competency rather than
recognizing a paraphrase of the reference example. The one failure, reproduced identically in both
runs, was in an already-shipped Phase 2 question
(`[anthropic] ai-system-design/04-feature-store-finetuning-data-pipeline (strong)`):
`SyntaxError: Expected ',' or ']' after array element in JSON at position 3946`. Diagnosed as a
real gap, not a fluke — Anthropic's Messages API has no strict JSON-mode like OpenAI's
`response_format`, so it can occasionally emit technically invalid JSON (most likely an unescaped
quote inside a strengths/improvements array element). **Fixed**: `anthropicAdapter.judge()` now
retries the call once when the response has no parseable JSON text block, via a new
`parseAnthropicResponse()` helper that returns `null` instead of throwing so the caller can decide
to retry — the same "one resample is cheap, don't fail the whole call over a recoverable issue"
pattern already used for the image-vision-input fallback. OpenAI needs no equivalent fix, since
its `response_format: json_object` already guarantees syntactically valid JSON at the API level.
**This specific fix has not yet been reconfirmed with a third live run** — disclosed here rather
than assumed resolved, the same discipline Phase 2's documentation followed.

Verified live after redeploying: `practice-arena-api.onrender.com/questions` returns all 35
questions with the correct per-category counts (13/6/7/5/4); a sample rubric fetch for one
behavioral and one tradeoff question returns the new fields correctly; the production frontend's
sidebar lists all 35 questions across 5 categories including the 2 new ones; both new formats'
practice pages return 200; the OpenAI proxy still works correctly in production.

## Consequences

### Positive
- Zero org-side API cost regardless of usage volume — the BYOK decision removes the entire
  budget-cap/rate-limiting problem a shared-key public tool would otherwise require.
- Judge disagreement is a real, surfaced signal (`ConsensusResult.agree`), not silently averaged
  away — a Staff+ answer that only one judge recognizes as such is more informative than a
  single blended score.
- The rubric is guaranteed to match the playbook's own text, since it's parsed, not re-authored —
  including the new behavioral/trade-offs level-criteria and generic prompts, authored upstream
  rather than invented in this app.
- All 35 of the playbook's questions now share one mock-interview experience — sectioned
  system-design forms, full STAR practice for behavioral, and framework-plus-example for
  trade-offs — with per-section feedback from both judges, not just a flat level and comment.

### Negative
- The OpenAI proxy is a real, if minimal, server-side component — it's the one place a user's
  key transits infrastructure we operate, even though nothing is stored. This asymmetry between
  providers is disclosed plainly in the UI's key-handling notice.
- Calibration only covers one weak and one strong answer per question; real answers in practice
  will span a much wider range of quality and style than these two deliberately clear-cut
  reference points, so this is evidence the harness works in the direction intended, not proof
  it's accurate across the full spectrum of real, messier answers.
- The image-vision-input path is implemented with a graceful text-only fallback but has no live
  confirmation yet that either provider actually accepts it as a real visual input.
- The anthropicAdapter malformed-JSON retry fix (above) has not yet been reconfirmed with a fresh
  live run — the one failure it targets was reproduced twice before the fix, not yet re-tested
  after it.

## Amendment — Hello Interview six-step Data Flow, 2026-07-10

The playbook aligned all 26 system-design entries to Hello Interview's six-step shape by
inserting **Data Flow** between API/Interface and High-level design (sequence of how data moves;
HLD remains component architecture for functional requirements; deep dives target NFRs). Practice
Arena followed: `data_flow_summary` in the rubric parser, a sixth graded section in types /
judge prompts / practice UI (optional sequence Mermaid), and `data_flow` fields on all 26
system-design calibration weak/strong answers. Playbook submodule pinned to the six-step commit.

## References
- [ai-architect-interview-playbook](https://github.com/vpeetla-ai/ai-architect-interview-playbook) — the rubric source of truth
- [aegisai-enterprise-agent-platform's LLMGateway](https://github.com/vpeetla-ai/aegisai-enterprise-agent-platform/blob/main/services/api/src/aegisai/application/knowledge/llm_gateway.py) — the provider-seam pattern this repo's judge adapters mirror
- [agent-finops's pricing.py](https://github.com/vpeetla-ai/agent-finops/blob/main/src/agent_finops/pricing.py) — the cost-estimation formulas ported into `frontend/lib/judge/pricing.ts`
