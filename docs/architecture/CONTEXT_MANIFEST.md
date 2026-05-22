# Context Manifest

Status: Draft
Verification: TBD
Authority: Candidate read-order manifest

This document is a coordination scaffold, not a claim that the architecture already exists.

## Purpose

This file tells future humans, LLMs, and Codex sessions which docs to read and how much authority to give them.

## Read Order

1. `CURRENT_STATUS.md` for the current governance snapshot.
2. `CURRENT_ARCHITECTURE_STATE.md` for handoff constraints.
3. `ENTRYPOINTS.md` before source inspection.
4. `MODULE_BOUNDARIES.md` before moving responsibilities.
5. `MUTATION_RULES.md` and `STATE_OWNERSHIP.md` before changing state.
6. `INVARIANT_REGISTRY.md` and `ARCHITECTURE_GUARDRAILS.md` before broad refactors.
7. `ARCHITECTURE_DECISIONS.md` before making or relying on durable tradeoffs.

## Authority Levels

- Source code: implementation authority.
- Tests and package scripts: verification authority for covered behavior.
- These docs: Draft coordination authority only.
- Existing notes outside this folder: useful context, not automatically governance.

## Update Rule

When docs and source disagree, trust source first, then update docs with the smallest accurate correction.
