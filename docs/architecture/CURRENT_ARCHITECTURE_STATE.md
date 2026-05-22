# Current Architecture State

Status: Draft
Verification: TBD
Authority: Candidate handoff note

This document is a coordination scaffold, not a claim that the architecture already exists.

## Read This First

Use this file as a small handoff note for architecture-sensitive work. It intentionally avoids declaring a complete architecture.

## Current State

- The source tree is the only implementation authority.
- Existing architecture hardening notes may contain useful observations, but they are not a finished governance model.
- This scaffold names the questions future work should answer before making broad changes.

## Questions To Verify Before Hardening

- What is the current source of truth for persisted app state?
- Which components or services are allowed to mutate that state?
- Which data is canonical, derived, or UI-only?
- Which localStorage keys and import/export shapes must remain compatible?
- Which app flows are covered by unit tests and e2e tests?

## Default Change Bias

- Make narrow, reversible changes.
- Confirm ownership before moving state.
- Confirm mutation entrypoints before adding new writes.
- Confirm compatibility before changing persisted shapes.
- Update this scaffold only when source evidence changes.
