# Architecture Guardrails

Status: Draft
Verification: TBD
Authority: Candidate guardrail guide

This document is a coordination scaffold, not a claim that the architecture already exists.

## Purpose

Use these guardrails when planning or reviewing architecture-sensitive changes.

## Guardrails

- Do not enterprise-ize the repo.
- Do not add event sourcing.
- Do not add a workflow engine.
- Do not turn the whole app into a state machine.
- Do not perform a large abstraction rewrite without a local, source-backed need.
- Do not over-apply DDD language or layers.
- Do not break existing UI flow.
- Do not break localStorage compatibility without a tested migration.
- Do not treat generated or AI-authored text as trusted state by default.
- Do not skip build/test/e2e verification for state or flow changes.

## Positive Bias

- Prefer source-of-truth clarity.
- Prefer state ownership clarity.
- Prefer predictable mutation flow.
- Prefer small safe refactors.
- Prefer tests near behavior.
- Prefer explicit TBD markers over confident speculation.
