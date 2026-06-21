# Nomos Clearing Voice Agent

Runnable MVP for the Nomos energy-market voice-agent challenge.

## What It Does

- Loads the synthetic Nomos fixture cases.
- Builds German agent instructions and dynamic variables for ElevenLabs Conversational AI.
- Embeds the ElevenLabs voice agent directly in the dashboard.
- Exposes MCP-style tools for case lookup, call logging, clearing completion, MaLo update, signup continuation, and customer-email handoff.
- Stores run state as local JSON under `data/runs`.
- Provides a local dashboard at `http://localhost:3001`.

## Setup

```powershell
cd C:\Users\ahmed\Desktop\nomos-clearing-agent
copy .env.example .env
npm install
npm run dev
```

Set `.env` values:

```env
PORT=3001
PUBLIC_BASE_URL=https://your-deployed-app.example.com
ELEVENLABS_AGENT_ID=...
```

## ElevenLabs Agent Configuration

Open `/api/agent-config/CASE-A`, `/api/agent-config/CASE-B`, or `/api/agent-config/CASE-C` and copy the instructions plus dynamic variables into the ElevenLabs agent setup.

Configure the ElevenLabs agent tools to call:

```text
POST https://your-deployed-app.example.com/mcp/tools/call
```

The dashboard creates a run through `/api/voice-agent/session` and passes `run_id` plus case variables into the embedded ElevenLabs widget.

The agent must:

- Speak German.
- Disclose AI as first words to a human.
- Handle menu-like prompts when they appear in the test conversation.
- Read long numbers one character at a time.
- Use the MCP-style tools to store the outcome and trigger the next action.

## Validation Checklist

- `npm test` passes.
- Dashboard loads and lists CASE-A, CASE-B, CASE-C.
- CASE-A simulation completes with customer email action.
- CASE-B simulation completes with signup next step and reference number.
- CASE-C simulation records corrected MaLo and signup next step.
- Direct ElevenLabs widget run receives the selected case variables and calls MCP tools with the generated `run_id`.

## Sources Used

- https://github.com/nomos-energy/voice-agent/
- https://github.com/nomos-energy/voice-agent/blob/main/CHEATSHEET.md
- https://github.com/nomos-energy/voice-agent/blob/main/fixtures.json
- https://github.com/nomos-energy/voice-agent/tree/main/recordings
