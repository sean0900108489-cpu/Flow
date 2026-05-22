# System Overview

Status: Draft
Verification: TBD
Authority: Candidate coordination guide

This document is a coordination scaffold, not a claim that the architecture already exists.

## Purpose

This repo needs a small shared map so future humans, LLMs, and Codex sessions can make changes without inventing architecture on the fly.

## Current Claim Level

- Treat existing source code as the source of truth.
- Treat this folder as orientation and guardrails only.
- Do not infer backend services, workflow engines, event sourcing, large domain layers, or complete governance machinery unless the source proves they exist.

## Working Principles

- Keep the app small and understandable.
- Prefer source-of-truth clarity over new abstractions.
- Prefer state ownership clarity over broad rewrites.
- Prefer predictable mutation flow over clever indirection.
- Keep validation as a guardrail, not the main product.
- Preserve existing UI flow, persistence compatibility, and green build/test/e2e checks.

## Non-Goals For Now

- No enterprise architecture program.
- No event sourcing.
- No workflow engine.
- No full state-machine rewrite.
- No broad DDD rewrite.
- No large framework/tooling addition.
