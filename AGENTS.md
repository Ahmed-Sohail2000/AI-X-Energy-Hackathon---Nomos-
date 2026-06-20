# Repository Guidelines

## Project Structure & Module Organization

This project is a TypeScript/Express MVP for the Nomos clearing-call voice agent.

- `src/` contains server code, case loading, MCP-style tool handlers, Twilio integration, storage, and formatting utilities.
- `public/` contains the lightweight dashboard UI.
- `agents/` contains Markdown prompt, domain-knowledge, and MCP-tool guidance for the voice agent.
- `data/fixtures.json` contains synthetic Nomos challenge cases; `data/runs/` stores local run JSON output.
- `tests/` contains Vitest unit tests.

Keep new source modules small and grouped by responsibility. Shared types belong in `src/types.ts`; reusable helpers belong under `src/utils/`.

## Build, Test, and Development Commands

- `npm install` installs dependencies.
- `npm run dev` starts the server in watch mode with `tsx`.
- `npm start` starts the server once.
- `npm run typecheck` runs TypeScript validation without emitting files.
- `npm test` runs the Vitest suite.
- `npm audit --audit-level=moderate` checks dependency security.

The local dashboard runs at `http://localhost:3001` by default.

## Coding Style & Naming Conventions

Use TypeScript ES modules and strict typing. Prefer explicit exported functions over large classes. Use two-space indentation, semicolons, and descriptive camelCase names for variables and functions. Type names should be PascalCase, such as `CaseFile` or `ClearingOutcome`.

Keep user-facing German agent instructions in Markdown or prompt-builder modules, not scattered through route handlers.

## Testing Guidelines

Tests use Vitest and live in `tests/*.test.ts`. Add focused tests for behavior that affects safety, routing, or structured outcomes, especially:

- digit-by-digit readback formatting
- practice-number call guardrails
- MCP tool behavior
- fixture and prompt generation

Run `npm run typecheck` and `npm test` before handing off changes.

## Commit & Pull Request Guidelines

No Git history is present in this workspace, so there is no existing commit convention to follow. Use short imperative commit messages, for example `Add Twilio call guardrail`.

Pull requests should include a concise summary, test results, linked issue or challenge requirement, and screenshots for dashboard UI changes.

## Security & Configuration Tips

Never commit real customer data or secrets. Use `.env` for Twilio and ElevenLabs credentials. The app must only dial `NOMOS_PRACTICE_CLERK_NUMBER`; do not weaken that guardrail.
