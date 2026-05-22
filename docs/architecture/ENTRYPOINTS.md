# Entrypoints

Status: Draft
Verification: TBD
Authority: Candidate navigation guide

This document is a coordination scaffold, not a claim that the architecture already exists.

## Purpose

This file gives future agents a safe starting order for source inspection. It does not certify ownership or completeness.

## Candidate Read Order

1. `package.json` for available commands.
2. `src/main.tsx` for app bootstrap.
3. `src/App.tsx` for current top-level coordination.
4. `src/domain/types.ts` for domain shape hints.
5. `src/services/storage.ts` for persistence behavior.
6. Relevant screen/component/domain files for the requested change.
7. Existing tests near the touched behavior.

## Command Entrypoints

- `npm run build`: candidate build verification.
- `npm run test`: candidate unit/domain verification.
- `npm run e2e`: candidate browser flow verification.
- `npm run check`: candidate aggregate verification.

## Rule For Agents

Do not assume an entrypoint owns state just because it imports many files. Inspect call paths and mutation paths before editing.
