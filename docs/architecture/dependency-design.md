# Dependency Analysis Design Document

**Status**: Implemented (context-hint-based) + Optional Ollama local LLM assistance
**Related Code**: `packages/core/vibesmith_core/dependency.py`, `packages/core/vibesmith_core/ollama_client.py`
**Related Requirements**: FR-090 ~ FR-097

---

## 1. Current State

The dependency extraction feature is implemented with **context-hint-based matching**. `DependencyAnalyzer` extracts text within markers (backticks, quotes, slashes, etc.) and matches them against known component names to detect dependencies.

Additionally, **Ollama local LLM** is supported as an optional supplementary tool. The LLM helps cover cases where references are made in natural language without markers.

### 1.1 Dependency Types

| Type | Description | Detection Method |
|------|-------------|-----------------|
| `CONTEXT` | Skill context field reference | Frontmatter parsing |
| `AGENTS_FIELD` | Subagent agents field reference | Frontmatter parsing |
| `BODY_REFERENCE` | Body marker-based reference | Hint-based matching |
| `LLM_INFERRED` | Ollama LLM inference (optional) | Local LLM analysis |

The DB schema (`dependencies` table) `dep_type TEXT` column stores the values above.

---

## 2. Limitations of Previous Implementation (Reason for Removal)

### 2.1 Regex-Based Approach

The previous implementation matched `skills/xxx`, `agents/xxx` patterns in body text using regex:

```python
# Previous code (removed)
re.findall(r"skills/([a-zA-Z0-9_-]+)", content)
re.findall(r"agents/([a-zA-Z0-9_-]+)", content)
```

### 2.2 Problem: False Negatives

In actual skill/agent bodies, names are often mentioned without the `skills/` prefix:

```markdown
# Not detected — all missed
Use the pydantic-model skill
Call `pydantic-model`
Run with /pydantic-model command
"Run fastapi-route first"
```

Dependencies could not be detected at all without the `skills/` or `agents/` prefix.

---

## 3. Alternatives Considered

### 3.1 Full Known-Name Matching

Searching body text with all component names:

```python
for name in known_names:
    if re.search(rf"\b{re.escape(name)}\b", content):
        # Add dependency
```

**Rejection reason**: False positives are critical. Short, common names like `check`, `dev`, `test` would match in ordinary English sentences.

### 3.2 LLM-Based Syntactic Analysis

Having an LLM extract reference relationships from body text.

**Rejection reasons for paid external APIs** (still valid):
- Core engine becomes dependent on external API (offline use impossible)
- Cost/latency incurred with every scan
- Non-deterministic — same input may produce different results
- Doesn't fit the nature of a local scanning tool

**Conditional exception — Ollama local LLM (adopted)**:

The rejection reasons above apply to paid external APIs. LLM assistance is permitted when all of the following conditions are met:

1. Only accessible via **Ollama local server** (no external network required)
2. When env var `OLLAMA_URL` is not set, **completely disabled** (offline operation guaranteed)
3. Hint-based matching **always runs first** as the primary filter; LLM only supplements
4. Results are **separately marked** with `LLM_INFERRED` dep_type (distinguished from hint results)
5. On LLM failure (timeout, parse error, etc.), **silently returns empty results** (no impact on overall analysis)

### 3.3 Context-Hint-Based Matching (Adopted)

Extracts text wrapped in markers (backticks, quotes, slashes, etc.) and matches against known names.

---

## 4. Implementation: Context-Hint-Based Matching

### 4.1 Core Idea

**Markers serve as the primary filter, known-name matching as the secondary filter** — providing double protection.

### 4.2 Detection Patterns

| Pattern | Regex | Example |
|---------|-------|---------|
| Backticks | `` `([a-zA-Z0-9_-]+)` `` | `` `pydantic-model` `` |
| Slash command | `/([a-zA-Z0-9_-]+)` | `/pydantic-model` |
| Double quotes | `"([a-zA-Z0-9_-]+)"` | `"pydantic-model"` |
| Single quotes | `'([a-zA-Z0-9_-]+)'` | `'pydantic-model'` |
| skills/ prefix | `skills/([a-zA-Z0-9_-]+)` | `skills/pydantic-model` |
| agents/ prefix | `agents/([a-zA-Z0-9_-]+)` | `agents/planner` |

### 4.3 Decision Rules

```
Extract candidates (text within markers)
    ↓
Is it a known component name?  ──NO──→  Ignore
    ↓ YES
Is it self-referencing?  ──YES──→  Ignore
    ↓ NO
Already registered as dependency?  ──YES──→  Ignore (prevent duplicates)
    ↓ NO
Register as dependency
```

### 4.4 Expected Results

| Body Text | Extracted Value | Known Name? | Result |
|-----------|----------------|-------------|--------|
| `` Run `pydantic-model` `` | `pydantic-model` | Y | Dependency |
| `Verify with /check command` | `check` | Y | Dependency |
| `References "fastapi-route"` | `fastapi-route` | Y | Dependency |
| `please check the output` | (no marker) | - | Ignore |
| `` `some-random-thing` `` | `some-random-thing` | N | Ignore |

### 4.5 Caveats

- The slash pattern may conflict with URL paths (`/api/v1/check`). Paths following `skills/`, `agents/` are handled by existing logic; standalone slashes need tight word boundary matching.
- Cases where references are made only in natural language without markers are supplemented by Ollama LLM assistance (§5).

---

## 5. Ollama Local LLM Assistance (Optional)

### 5.1 Operating Conditions

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OLLAMA_URL` | None | Ollama server URL (e.g., `http://localhost:11434`). LLM analysis disabled if not set |
| `OLLAMA_MODEL` | `llama3` | Ollama model name to use |

When `OLLAMA_URL` is not set, `OllamaClient.from_env()` returns `None`, and the entire analysis operates with hint-based matching only.

### 5.2 Analysis Flow

```
analyze_all() called
    ↓
1. CONTEXT type analysis (frontmatter context field)
2. AGENTS_FIELD type analysis (frontmatter agents field)
3. BODY_REFERENCE type analysis (marker-based)
4. LLM_INFERRED type analysis (Ollama assistance, optional)
    ↓
Exclude pairs already detected in steps 1-3 via seen set
    ↓
Only new references inferred by LLM are added as LLM_INFERRED
```

### 5.3 Prompt Design

- Explicitly lists `known_names` so the LLM only selects from those names
- Component body is wrapped in `<content>...</content>` delimiters for prompt injection defense
- Only JSON arrays are accepted as responses; parse failures return an empty list

### 5.4 What Is Retained

- `Dependency`, `DependencyType` models (models.py)
- `dependencies` DB table (db.py)
- `DependencyAnalyzer` interface (analyze_all, detect_cycles, get_dependents, get_dependencies)
- Facade's `analyze_dependencies()` method
- `DependencyType.LLM_INFERRED` added (no DB migration needed)
