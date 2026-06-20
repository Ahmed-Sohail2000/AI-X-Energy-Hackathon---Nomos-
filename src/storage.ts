import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CallEvent, ClearingOutcome, RunRecord } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runsDir = path.join(__dirname, "..", "data", "runs");

async function ensureRunsDir(): Promise<void> {
  await fs.mkdir(runsDir, { recursive: true });
}

function runPath(runId: string): string {
  return path.join(runsDir, `${runId}.json`);
}

export async function createRun(caseId: string): Promise<RunRecord> {
  await ensureRunsDir();
  const now = new Date().toISOString();
  const run: RunRecord = {
    run_id: `run_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    case_id: caseId,
    status: "queued",
    started_at: now,
    updated_at: now,
    events: []
  };
  await saveRun(run);
  return run;
}

export async function saveRun(run: RunRecord): Promise<RunRecord> {
  await ensureRunsDir();
  run.updated_at = new Date().toISOString();
  await fs.writeFile(runPath(run.run_id), JSON.stringify(run, null, 2));
  return run;
}

export async function readRun(runId: string): Promise<RunRecord> {
  return JSON.parse(await fs.readFile(runPath(runId), "utf8")) as RunRecord;
}

export async function listRuns(): Promise<RunRecord[]> {
  await ensureRunsDir();
  const files = await fs.readdir(runsDir);
  const runs = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map((file) => fs.readFile(path.join(runsDir, file), "utf8").then((raw) => JSON.parse(raw) as RunRecord))
  );
  return runs.sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export async function appendEvent(runId: string, event: Omit<CallEvent, "at">): Promise<RunRecord> {
  const run = await readRun(runId);
  run.events.push({ at: new Date().toISOString(), ...event });
  if (event.event_type === "call.connected") {
    run.status = "in_progress";
  }
  if (event.event_type === "twilio.status" && !run.outcome) {
    const status = twilioCallStatus(event.payload);
    if (status === "initiated" || status === "ringing") {
      run.status = "calling";
    }
    if (status === "answered" || status === "in-progress") {
      run.status = "in_progress";
    }
    if (status === "busy" || status === "failed" || status === "no-answer" || status === "canceled") {
      run.status = "failed";
    }
  }
  return saveRun(run);
}

export async function attachTwilioSid(runId: string, sid: string): Promise<RunRecord> {
  const run = await readRun(runId);
  run.twilio_call_sid = sid;
  run.status = "calling";
  return saveRun(run);
}

export async function completeRun(runId: string, outcome: ClearingOutcome): Promise<RunRecord> {
  const run = await readRun(runId);
  run.outcome = outcome;
  run.status = "completed";
  run.events.push({
    at: new Date().toISOString(),
    event_type: "case.completed",
    payload: outcome
  });
  return saveRun(run);
}

function twilioCallStatus(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const value = (payload as Record<string, unknown>).CallStatus;
  return typeof value === "string" ? value.toLowerCase() : undefined;
}
