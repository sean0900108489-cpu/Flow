# Invariant Registry

Status: Draft
Verification: TBD
Authority: Candidate invariant list

This document is a coordination scaffold, not a claim that the architecture already exists.

## Purpose

This registry is intentionally small. Items below are candidate invariants for future verification, not proven enforcement claims.

## Candidate Invariants

### INV-CAND-001: Source Of Truth Must Be Explicit

Before changing a state shape or mutation path, identify which file or data structure owns the truth.

### INV-CAND-002: Derived Data Must Stay Derived

Indexes, filters, summaries, recommendations, and UI display buckets should be recomputed unless explicitly promoted through a reviewed mutation path.

### INV-CAND-003: Persisted State Must Stay Compatible

Changes to localStorage, import, or export data must account for existing user data.

### INV-CAND-004: AI Suggestions Are Not Trusted State

AI or Codex output may guide changes, but it must not become trusted app state without validation, review, or an explicit owner-approved path.

### INV-CAND-005: Small Safe Refactors Beat Broad Rewrites

Architecture improvements should reduce ambiguity without replacing large parts of the app unnecessarily.
