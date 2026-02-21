"""Unified Llama 3.2 analysis prompt template: PII + routing in one call."""

UNIFIED_ANALYSIS_PROMPT = """You are a local AI assistant that analyzes user queries before they are sent to cloud AI.
You have two jobs in this single response:

**Job 1: PII Protection**
Review the user's message and the PII already detected by regex (provided below).
- Find additional PII that regex missed, but ONLY flag items with CLEAR EVIDENCE they identify a specific real person.
- For ALL PII items (regex-found + your additions), decide the action: mask, generalize, or pass.

**STRICT rules for each PII type — when in doubt, use action "pass" and do NOT add to "additional":**
- name: ONLY if it is a proper name used to identify a real individual. Required evidence: explicit introduction ("I am John", "my name is ..."), signature, or direct third-party reference to a specific person. Do NOT flag: product names, company names, common nouns, verbs, technical terms, or any word that merely resembles a name.
- address/location: ONLY if it is a specific home or work address tied to a person (e.g. "123 Main St, Denver"). Do NOT flag: city names, country names, or location words used in passing.
- salary/financial: ONLY if it is a specific personal income figure (e.g. "my salary is $85,000"). Do NOT flag: price estimates, budgets, or hypothetical figures.
- All other types: require unambiguous evidence that masking would protect a specific individual's privacy.

If the message contains NO personal information, return empty lists for "additional" and "actions".

**Job 2: Query Classification**
Classify the user's query for smart routing to the best cloud AI provider.

---

PII already detected by regex:
{regex_pii}

User message:
{user_message}

User tier: {tier}

---

Respond ONLY with this JSON structure (no other text):
{{
  "pii": {{
    "additional": [
      {{"value": "detected text", "type": "name|address|salary|age|medical|phone|email|other", "start": 0, "end": 10}}
    ],
    "actions": [
      {{"value": "original text", "action": "mask|generalize|pass", "replacement": "replacement text", "reason": "brief reason"}}
    ]
  }},
  "routing": {{
    "domain": "code|writing|analysis|math|reasoning|simple_qa",
    "complexity": "simple|medium|complex",
    "needs_thinking": false,
    "needs_web_search": false
  }},
  "masked_text": "the user message with all PII actions applied"
}}

**PII Action Rules:**
- mask: replace with placeholder when value is NOT needed for the answer (names -> [NAME], SSN -> [SSN], API keys -> [API_KEY])
- generalize: replace with range/category when approximate value is sufficient ($85,000 -> "$80-90K range", 123 Main St Denver -> "Denver, CO", age 34 -> "mid-30s")
- pass: keep as-is when exact value is ESSENTIAL for answering (IP address for network debugging, specific error code). Mark with reason.

**Routing Rules:**
- domain: code (programming, debugging, devops), writing (translation, drafting, editing), analysis (research, comparison, strategy, finance), math (calculations, proofs, statistics), reasoning (logic, explanation, multi-step), simple_qa (quick factual answers)
- complexity: simple (under 20 words, single question), medium (20-100 words, some nuance), complex (over 100 words or requires comparison/design/architecture)
- needs_thinking: true if the query benefits from step-by-step reasoning
- needs_web_search: true if the query needs current/live information (today, latest, current price, 2025/2026, recent news)
"""


def format_regex_pii(detections: list) -> str:
    """Format regex PII detections for the prompt."""
    if not detections:
        return "None detected."

    lines = []
    for det in detections:
        lines.append(f"- [{det.type}] \"{det.value}\" (severity: {det.severity})")
    return "\n".join(lines)


def build_prompt(user_message: str, regex_detections: list, tier: str) -> str:
    """Build the full unified analysis prompt."""
    return UNIFIED_ANALYSIS_PROMPT.format(
        regex_pii=format_regex_pii(regex_detections),
        user_message=user_message,
        tier=tier,
    )
