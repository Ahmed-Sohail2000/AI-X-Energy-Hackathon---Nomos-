import twilio from "twilio";
import type { CaseFile } from "./types.js";
import { isPracticeNumber } from "./utils/format.js";

type StartCallArgs = {
  caseFile: CaseFile;
  runId: string;
  to: string;
};

export async function startOutboundCall({ caseFile, runId, to }: StartCallArgs): Promise<string> {
  const required = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "PUBLIC_BASE_URL",
    "NOMOS_PRACTICE_CLERK_NUMBER",
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_TWILIO_WS_URL"
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Twilio configuration: ${missing.join(", ")}`);
  }
  if (!isPracticeNumber(to, process.env.NOMOS_PRACTICE_CLERK_NUMBER)) {
    throw new Error("Refusing to dial anything except NOMOS_PRACTICE_CLERK_NUMBER.");
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const call = await client.calls.create({
    to,
    from: process.env.TWILIO_FROM_NUMBER!,
    url: `${process.env.PUBLIC_BASE_URL}/twilio/voice?run_id=${encodeURIComponent(runId)}&case_id=${encodeURIComponent(caseFile.id)}`,
    statusCallback: `${process.env.PUBLIC_BASE_URL}/twilio/status?run_id=${encodeURIComponent(runId)}`,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"]
  });
  return call.sid;
}
