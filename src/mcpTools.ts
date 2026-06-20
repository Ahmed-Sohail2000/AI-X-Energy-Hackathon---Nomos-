import { z } from "zod";
import { getCase } from "./cases.js";
import { appendEvent, completeRun, readRun } from "./storage.js";
import type { ClearingOutcome } from "./types.js";

const outcomeSchema = z.object({
  case_id: z.string(),
  status: z.enum(["cleared", "needs_customer_contact", "needs_resubmission", "unresolved"]),
  diagnosis: z.string(),
  next_step: z.string(),
  corrected_malo: z.string().optional(),
  reference_number: z.string().optional(),
  meter_status: z.string().optional(),
  readback_confirmed: z.boolean(),
  backoffice_note_de: z.string(),
  triggered_action: z.string().optional()
});

export const toolDefinitions = [
  {
    name: "case.get",
    description: "Return the synthetic Nomos case file for a case_id.",
    input_schema: { type: "object", properties: { case_id: { type: "string" } }, required: ["case_id"] }
  },
  {
    name: "case.record_call_event",
    description: "Append a call milestone, transcript event, or observation to a run.",
    input_schema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
        event_type: { type: "string" },
        payload: { type: "object" }
      },
      required: ["run_id", "event_type", "payload"]
    }
  },
  {
    name: "case.complete_clearing",
    description: "Store the final structured clearing outcome and mark the run complete.",
    input_schema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
        outcome: { type: "object" }
      },
      required: ["run_id", "outcome"]
    }
  },
  {
    name: "case.update_malo",
    description: "Record a corrected MaLo discovered during a call.",
    input_schema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
        corrected_malo: { type: "string" }
      },
      required: ["run_id", "corrected_malo"]
    }
  },
  {
    name: "case.trigger_signup_next_step",
    description: "Mock the next signup workflow step after the clearing result allows progress.",
    input_schema: { type: "object", properties: { run_id: { type: "string" } }, required: ["run_id"] }
  },
  {
    name: "case.trigger_customer_email",
    description: "Mock handing the case to the email agent when Nomos must contact the customer.",
    input_schema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
        reason: { type: "string" }
      },
      required: ["run_id", "reason"]
    }
  }
];

export async function callTool(name: string, args: unknown) {
  const data = (args ?? {}) as Record<string, unknown>;
  switch (name) {
    case "case.get":
      return getCase(String(data.case_id));
    case "case.record_call_event":
      return appendEvent(String(data.run_id), {
        event_type: String(data.event_type),
        payload: data.payload ?? {}
      });
    case "case.complete_clearing": {
      const outcome = outcomeSchema.parse(data.outcome) as ClearingOutcome;
      return completeRun(String(data.run_id), outcome);
    }
    case "case.update_malo":
      return appendEvent(String(data.run_id), {
        event_type: "case.corrected_malo",
        payload: { corrected_malo: String(data.corrected_malo) }
      });
    case "case.trigger_signup_next_step":
      return appendEvent(String(data.run_id), {
        event_type: "action.signup_next_step",
        payload: { action: "signup_next_step_triggered" }
      });
    case "case.trigger_customer_email":
      return appendEvent(String(data.run_id), {
        event_type: "action.customer_email",
        payload: { action: "customer_email_triggered", reason: String(data.reason) }
      });
    case "run.get":
      return readRun(String(data.run_id));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
