# Nomos Clearing Voice Agent

Runnable MVP for the Nomos energy-market voice-agent challenge.

## What It Does

- Loads the synthetic Nomos fixture cases.
- Builds German agent instructions and dynamic variables for ElevenLabs Conversational AI.
- Starts Twilio outbound calls only to `NOMOS_PRACTICE_CLERK_NUMBER`.
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
PUBLIC_BASE_URL=https://your-ngrok-or-cloudflared-url
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...
ELEVENLABS_TWILIO_WS_URL=wss://...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=...
NOMOS_PRACTICE_CLERK_NUMBER=...
```

Without live Twilio and ElevenLabs WebSocket configuration, `Start call` creates a mock run and still shows the generated agent instructions.

## ElevenLabs Agent Configuration

Open `/api/agent-config/CASE-A`, `/api/agent-config/CASE-B`, or `/api/agent-config/CASE-C` and copy the instructions plus dynamic variables into the ElevenLabs agent setup. Configure `ELEVENLABS_TWILIO_WS_URL` with the WebSocket URL supplied by your ElevenLabs/Twilio integration for the agent.

The agent must:

- Speak German.
- Disclose AI as first words to a human.
- Detect phone menus and send DTMF.
- Read long numbers one character at a time.
- Use the MCP-style tools to store the outcome and trigger the next action.

## Validation Checklist

- `npm test` passes.
- Dashboard loads and lists CASE-A, CASE-B, CASE-C.
- Guardrail refuses non-practice numbers.
- CASE-A simulation completes with customer email action.
- CASE-B simulation completes with signup next step and reference number.
- CASE-C simulation records corrected MaLo and signup next step.
- Manual phone run confirms German warmth, IVR handling, AI disclosure, digit readback, and structured output.

## Sources Used

- https://github.com/nomos-energy/voice-agent/
- https://github.com/nomos-energy/voice-agent/blob/main/CHEATSHEET.md
- https://github.com/nomos-energy/voice-agent/blob/main/fixtures.json
- https://github.com/nomos-energy/voice-agent/tree/main/recordings
- https://www.twilio.com/docs/voice/twiml/stream
