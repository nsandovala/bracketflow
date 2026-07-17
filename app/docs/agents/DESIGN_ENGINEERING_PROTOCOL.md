# BracketFlow Design Engineering Protocol v1

## 1. Visual contract

A screenshot, mockup, or explicitly approved visual reference is the design contract. An agent must identify what the reference governs before changing code: composition, hierarchy, layout, copy, background, atmosphere, responsive behavior, or product function. When the contract is absent or contradictory, stop and request clarification.

Build and lint validate technical constraints only. They never constitute visual approval. A visual change may be committed only after explicit owner approval of the relevant rendered evidence.

## 2. Surface model

Distinguish a full-bleed visual surface from a centered shell:

- A full-bleed surface owns the complete viewport or section background and its atmospheric system must remain continuous across that entire surface.
- A centered shell owns content width, reading order, controls, and operational hierarchy. It is not a pretext to constrain or decorate the background locally.

Do not move content, change copy, or alter hierarchy when the request is only to extend an atmospheric system. Do not use a local decorative patch to solve continuity that belongs to the global full-bleed layer.

## 3. Responsive priorities

Cockpit and operational surfaces are desktop/laptop first. Validate the primary operating experience at wide desktop and laptop dimensions before adapting it downward. Tablet is the second priority. Mobile must remain safe: text readable, controls reachable, content non-overlapping, and no false claim that it is the primary operating layout.

Stream and OBS surfaces are specialized outputs. Their framing, readability, and information density must be validated independently from the operator cockpit. A stream overlay is not an excuse to simplify or visually degrade the operating workflow.

## 4. Function before decoration

Differentiate functional components from atmosphere. Do not degrade real controls, live status, navigation, validation, or data readability for visual effect. Do not insert decorative cards inside an operational cockpit; cards must represent meaningful repeated items, framed tools, or modal contexts.

Do not display future capabilities as if they exist. Empty states must be honest, data must be real or visibly unavailable, and roadmap language must not impersonate an active feature.

## 5. Home Lower Arena lesson

**Failed pattern:** an agent notices empty space and adds particles, circuits, or visual objects at one local point.

**Correct pattern:** the agent extends the existing atmospheric system across the whole full-bleed surface, without moving content or altering the approved hierarchy. The continuity belongs to the global visual layer, while the centered shell remains stable.

The same rule applies to every full-bleed scene: diagnose the owning layer before adding visual material.

## 6. Required visual QA

Capture and inspect the affected experience at:

- `1920x1080`
- `2560x1440`
- `1366x768`
- `1024px` width
- `390x844`

For each viewport, verify framing, no unintended overlap, readable text, stable controls, real-data honesty, correct background continuity, and preservation of the approved hierarchy. Also validate the specialized Stream/OBS surface when it is touched.

Record the rendered evidence and the owner's explicit decision. Without that approval, report the visual work as pending; do not describe it as complete and do not create a visual commit.