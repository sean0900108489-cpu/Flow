# Architecture Decisions

Status: Draft
Verification: TBD
Authority: Candidate ADR index

This document is a coordination scaffold, not a claim that the architecture already exists.

## Purpose

This file records durable decisions only after they are reviewed. For now it starts as a minimal holding area.

## Candidate Decisions

### ADR-CAND-001: Keep Governance Lightweight

Candidate: Architecture docs should coordinate work, not create an enterprise documentation system.

### ADR-CAND-002: Prefer Existing App Shape Before New Frameworks

Candidate: Do not add large frameworks, workflow engines, event sourcing, or broad state-machine infrastructure unless a concrete source-backed need appears.

### ADR-CAND-003: Protect Existing User Flows And Saved Data

Candidate: Architecture changes should preserve existing UI flows, localStorage compatibility, and green build/test/e2e checks.

## Decision Rule

Promote a candidate to accepted only when the repo source, tests, and human intent support it.
