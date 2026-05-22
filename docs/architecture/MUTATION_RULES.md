# Mutation Rules

Status: Draft
Verification: TBD
Authority: Candidate mutation guide

This document is a coordination scaffold, not a claim that the architecture already exists.

## Purpose

This file states conservative rules for future edits that create, update, import, delete, persist, or derive app state.

## Candidate Rules

- Identify the source of truth before adding a mutation.
- Keep mutation flow predictable and easy to trace.
- Do not write derived summaries back into canonical state unless that promotion is explicit.
- Do not let AI output directly mutate trusted app state without validation and owner-visible review.
- Keep validation narrow and useful; validation is a guardrail, not the product core.
- Preserve localStorage compatibility unless a migration is explicit and tested.

## For Imports And Persistence

- Validate shape before replacing live state.
- Prefer backward-compatible optional handling for existing saved data.
- Do not silently drop user data during normalization.
- Do not store transient UI state as durable domain state without a reviewed reason.

## For Refactors

- Prefer small safe refactors.
- Keep existing UI flows working.
- Run the relevant build/test/e2e checks before treating the change as complete.
