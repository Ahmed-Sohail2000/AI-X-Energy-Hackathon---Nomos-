# Nomos Console Design

Use this as the portable UI brief for Stitch or any design handoff.

## Product Feel

Operational, calm, and precise. The console should feel like a professional back-office tool for clearing energy-market calls, not a marketing page.

## Screens

1. Cases: compact queue with case type, operator, and status.
2. Setup: selected case facts plus connector/tool readiness.
3. Call: launch or simulate the voice-agent workflow.
4. Review: recent runs and structured outcomes.

## Visual Rules

- White and soft neutral surfaces with green action accents and blue informational accents.
- 8px radius for cards, buttons, and panels.
- Dense spacing, low copy, clear labels.
- Avoid large decorative artwork, gradients, or oversized text blocks.
- Mobile layout stacks screens with sticky navigation at the top.

## Interaction Rules

- Primary path is always `Next`.
- Secondary actions are copy config, open JSON config, refresh, and simulate outcome.
- Connector names shown in UI: ElevenLabs, Twilio, OpenAI, MCP Tools, Google Stitch.
- MCP tools should be visible as short command chips, not long paragraphs.
