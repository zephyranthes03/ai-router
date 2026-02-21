# ProofRoute AI — 0G Labs Submission: Best Use of AI Inference or Fine Tuning (0G Compute)

## Requirements Mapping (Explicit)

### 1) Integrate 0G Compute (mainnet or testnet) for inference and/or fine-tuning

- **Integrated:** 0G Compute **inference** path is implemented and used in routing workflow.
- **Endpoint wiring:** `zero_g_base_url` is configurable; default is `https://api.0g.ai/v1` in this repo.
- **Current scope:** Inference is in scope for this submission (`and/or` requirement satisfied).
- **Not claimed:** Fine-tuning workflow is not claimed in this version.

### 2) Demonstrate AI output in application workflow (not a single prompt)

0G output is consumed as structured routing signals in the app pipeline:

`user input -> 0G inference classification -> adaptive provider selection -> x402 payment-gated request -> response -> usage/proof flow`

This is an end-to-end workflow where 0G output changes provider/tier behavior, not a standalone prompt demo.

### 3) Provide a working demo + reproducible setup instructions

Repro steps are documented and runnable:

1. Run gateway:
   `cd server && npm install && npm run dev`
2. Run frontend:
   `cd client/frontend && npm install && npm run dev`
3. Run Python backend:
   `cd client && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && DEV=1 python main.py`
4. In Dashboard, enable `0G Compute Inference` and set:
   - `zero_g_api_key`
   - `zero_g_base_url` (default: `https://api.0g.ai/v1`)
   - `zero_g_model` (default: `meta-llama/Meta-Llama-3.1-8B-Instruct`)
5. Send identical prompts with 0G off/on and compare:
   - `/analyze` `zero_g` field
   - selected provider/reasoning

### 4) Clearly document model/task used and why

- **Model:** `meta-llama/Meta-Llama-3.1-8B-Instruct` (configurable)
- **Task:** Routing classification (not final answer generation)
  - `domain`
  - `complexity`
  - `requires_web_search`
  - `requires_thinking`
  - `confidence`
- **Why this task:** It directly improves quality-per-dollar in adaptive orchestration while preserving deterministic fallback behavior.

## Problem

Most multi-provider AI gateways still rely on static rules. That causes avoidable trade-offs:

- Overpaying for simple prompts
- Under-serving complex prompts
- Weak routing quality when domain/complexity is ambiguous

For agentic workflows, routing decisions should come from live inference, not only fixed keyword heuristics.

## Solution

**ProofRoute AI** adds an optional **0G Compute Network inference step** before provider routing.

- It sends the user message to a 0G-hosted model (OpenAI-compatible API)
- The model returns structured routing signals:
  `domain`, `complexity`, `requires_web_search`, `requires_thinking`, `confidence`
- These signals are injected into routing metadata and influence final provider/tier selection
- If 0G is unavailable, routing gracefully falls back to local keyword classification

This gives us adaptive routing quality without breaking reliability.

## 0G Integration Evidence

| Evidence | Location |
|---|---|
| 0G inference adapter | `client/app/llm/zero_g.py` |
| Optional orchestration step | `client/app/orchestrator.py` |
| User settings (`use_0g_inference`, API key/model/base URL) | `client/app/config/settings.py` |
| Default 0G endpoint + model | `client/app/config/constants.py` |
| Dashboard toggle and controls | `client/frontend/src/components/Dashboard.tsx` |
| `/analyze` response exposes 0G result | `client/app/api/routes/analyze.py` |

## Inference Flow

1. User sends prompt to local orchestrator.
2. Orchestrator calls `POST {zero_g_base_url}/chat/completions` with a JSON-only classification prompt.
3. 0G response is parsed into `ZeroGClassification`.
4. Routing metadata is updated with 0G signals.
5. Gateway selects provider and executes x402-gated inference.
6. If 0G call fails/timeouts, local fallback classification is used automatically.

## Why This Fits 0G Compute

- Uses **live AI inference on 0G Compute Network** for production routing decisions
- Improves **quality-per-dollar** by adapting model selection to request complexity and capabilities
- Integrates cleanly into an end-to-end AI stack (privacy masking -> adaptive routing -> x402 payment -> ZK accountability)
- Demonstrates practical, user-visible value from 0G inference beyond a standalone demo call

## Scope Note (Honest Positioning)

Current integration is for the **inference** side of the bounty.  
Fine-tuning-specific claims are out of scope unless a fine-tune pipeline is actually added.

## Demo Focus

1. Turn on `0G Compute Inference` in Dashboard settings.
2. Send the same prompt with 0G off/on.
3. Compare `/analyze` outputs (`zero_g` field) and selected providers.
4. Show that failure handling still routes correctly via local fallback.

## Links

- [Main README](../README.md)
- [Kite AI Submission Story (x402-Powered)](BOUNTY-Kite-AI-Agent-Native-Payments-and-Identity-on-Kite-AI-x402-Powered.md)
- [Prosperia Submission Story](BOUNTY-Prosperia.md)
- [Base Submission Story (Self-Sustaining Autonomous Agents)](BOUNTY-Base-Self-Sustaining-Autonomous-Agents.md)
