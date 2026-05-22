# State Ownership

Status: Draft
Verification: TBD
Authority: Candidate ownership guide

This document is a coordination scaffold, not a claim that the architecture already exists.

## Purpose

This file prevents future edits from creating hidden or duplicate state ownership.

## Candidate Ownership Questions

Before changing state behavior, answer:

- Which data is canonical?
- Which data is derived?
- Which data is UI-only?
- Which file applies mutations?
- Which file persists or restores state?
- Which tests prove the expected behavior?

## Candidate Rules

- Store ids or primitive selections instead of duplicated object copies where practical.
- Recompute derived views instead of persisting them.
- Keep local UI draft state out of durable domain state unless intentionally designed.
- Do not introduce a global store without updating ownership docs and tests.
- Do not change persisted state shape without compatibility handling.

## Compatibility Bias

When unsure, preserve the existing persisted shape and add narrow translation at the boundary.
