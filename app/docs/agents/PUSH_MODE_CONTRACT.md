# BracketFlow Push Mode Contract v1

Push Mode expresses the next real action for a tournament. It is a deterministic operational contract, not a roadmap narrator, automation promise, or decorative dashboard concept.

## A. Push Mode v0: current contract

The current contract derives a single next action from existing, verified tournament state. It must answer:

| Question | Required answer |
|---|---|
| What is missing? | The concrete missing state, data, or operator action |
| Who acts? | The operator, participant, organizer, or another real actor |
| Where do they act? | The current BracketFlow surface or external source only when it exists |
| What is blocked? | The exact dependency preventing progression |
| What is ready? | Verified state that needs no further confirmation |
| What can be published or streamed? | Only confirmed, non-draft material allowed by the competitive contract |
| What needs human confirmation? | Any score, identity, source, dispute, or release decision not confirmed by a human |

Push Mode v0 is manual-first. It may guide an operator to the next real screen, but it must not infer data, submit a result, confirm a record, publish a draft, or present a planned integration as available.

## B. Target Push Mode: guided tournament flow

The target flow guides an operator through verified steps from tournament creation or selection to roster, ingestion, validation, preparation, and the next action:

1. Create or select the tournament.
2. Establish roster and team readiness.
3. Ingest source data with its declared origin.
4. Validate data and surface unresolved items.
5. Prepare the valid competitive state for operation.
6. Present the next deterministic action, blocking reason, and human confirmation required before progression or publication.

This is a target workflow, not evidence that the repository currently implements all steps or integrations.

## C. State and source rules

Every ingested item must retain its source category: `manual`, `print/OCR`, `API`, or `agent source`. A source category is provenance, not confirmation. In particular, `print/OCR` and `agent source` require human validation unless a separately approved product contract states otherwise.

Every result or record must be represented as one of:

- `pending`: received or incomplete, not ready for competitive use or publication.
- `confirmed`: human-validated and eligible for the next permitted action.
- `disputed`: challenged or inconsistent; blocked until resolved by the responsible human authority.

Never automatically confirm data. Never crown a champion without a defined, satisfied competitive contract. Never publish drafts. A stream or publication decision must expose both readiness and the required human confirmation.

## D. Non-invention rules

Push Mode must never claim that OCR, Discord, Caster Console, Copilot, or any other integration exists unless the current product exposes it and its data contract is verified. It must not fabricate import success, API availability, roster completeness, score confirmation, standings, publishing eligibility, or a next action absent from real state.

When state is missing, it must say so plainly and route the real responsible actor to the real available surface. When no safe next action can be derived, Push Mode must report the blocker and require human resolution rather than produce an optimistic recommendation.