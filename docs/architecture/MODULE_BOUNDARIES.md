# Module Boundaries

Status: Draft
Verification: TBD
Authority: Candidate boundary guide

This document is a coordination scaffold, not a claim that the architecture already exists.

## Purpose

Use this as a lightweight checklist before changing file responsibilities. It is not a finalized dependency map.

## Candidate Boundary Principles

- Domain/type files should define concepts and pure behavior where practical.
- Service files should isolate persistence, import/export, and external-ish app mechanics where practical.
- UI components should own presentation and transient UI state.
- Top-level app coordination should stay understandable and avoid becoming a hidden domain engine.
- Tests should remain close to the behavior they protect.

## Forbidden By Default

- Introducing a second canonical state store without an ownership update.
- Moving logic into a large abstraction layer without reducing real complexity.
- Creating an enterprise-style domain boundary system before the code needs it.
- Adding workflow engines, event sourcing, or global state-machine infrastructure.

## When Boundaries Change

Update this file only with source-backed facts. If the boundary is aspirational, mark it Candidate and keep it small.
