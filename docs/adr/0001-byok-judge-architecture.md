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

## Consequences

### Positive
- Zero org-side API cost regardless of usage volume — the BYOK decision removes the entire
  budget-cap/rate-limiting problem a shared-key public tool would otherwise require.
- Judge disagreement is a real, surfaced signal (`ConsensusResult.agree`), not silently averaged
  away — a Staff+ answer that only one judge recognizes as such is more informative than a
  single blended score.
- The rubric is guaranteed to match the playbook's own text, since it's parsed, not re-authored.

### Negative
- The OpenAI proxy is a real, if minimal, server-side component — it's the one place a user's
  key transits infrastructure we operate, even though nothing is stored. This asymmetry between
  providers is disclosed plainly in the UI's key-handling notice.
- Only 10 of the playbook's 35 questions are covered in Phase 1; the other 25 (11 remaining
  `ai-system-design/` entries, 4 `general-system-design/`, 3 `cloud-architecture/`, all of
  `behavioral/` and `scalability-governance-tradeoffs/`) need either the same rubric parser
  extended, or — for the STAR/framework folders — a genuinely different rubric design.
- Calibration (40/40, see above) only covers one weak and one strong answer per question — real
  answers in practice will span a much wider range of quality and style than these two
  deliberately clear-cut reference points, so this is evidence the harness works in the direction
  intended, not proof it's accurate across the full spectrum of real, messier answers.

## References
- [ai-architect-interview-playbook](https://github.com/vpeetla-ai/ai-architect-interview-playbook) — the rubric source of truth
- [aegisai-enterprise-agent-platform's LLMGateway](https://github.com/vpeetla-ai/aegisai-enterprise-agent-platform/blob/main/services/api/src/aegisai/application/knowledge/llm_gateway.py) — the provider-seam pattern this repo's judge adapters mirror
- [agent-finops's pricing.py](https://github.com/vpeetla-ai/agent-finops/blob/main/src/agent_finops/pricing.py) — the cost-estimation formulas ported into `frontend/lib/judge/pricing.ts`
