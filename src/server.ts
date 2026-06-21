import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { getCase, loadCases } from "./cases.js";
import {
  buildAgentInstructions,
  buildDynamicVariables,
  buildElevenLabsAgentScript,
  buildElevenLabsSkills
} from "./agentPrompt.js";
import { callTool, toolDefinitions } from "./mcpTools.js";
import {
  appendEvent,
  attachTwilioSid,
  createRun,
  latestPendingInboundRun,
  listRuns,
  readRun
} from "./storage.js";
import { startOutboundCall } from "./twilioClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nomos-clearing-agent" });
});

app.get("/api/cases", (_req, res) => {
  res.json(loadCases());
});

app.get("/api/runs", async (_req, res, next) => {
  try {
    res.json(await listRuns());
  } catch (error) {
    next(error);
  }
});

app.get("/api/runs/:runId", async (req, res, next) => {
  try {
    res.json(await readRun(req.params.runId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/calls/start", async (req, res, next) => {
  try {
    const body = z.object({ case_id: z.string() }).parse(req.body);
    const caseFile = getCase(body.case_id);
    const run = await createRun(caseFile.id);
    const target = process.env.NOMOS_PRACTICE_CLERK_NUMBER;

    if (!target || !process.env.TWILIO_ACCOUNT_SID) {
      await appendEvent(run.run_id, {
        event_type: "call.mock_created",
        payload: {
          reason: "Twilio env vars are not fully configured.",
          dynamic_variables: buildDynamicVariables(caseFile)
        }
      });
      res.json({
        mode: "mock",
        run,
        agent_instructions: buildAgentInstructions(caseFile)
      });
      return;
    }

    const sid = await startOutboundCall({ caseFile, runId: run.run_id, to: target });
    const updated = await attachTwilioSid(run.run_id, sid);
    res.json({ mode: "twilio", run: updated });
  } catch (error) {
    next(error);
  }
});

app.post("/api/calls/prepare-inbound", async (req, res, next) => {
  try {
    const body = z.object({ case_id: z.string() }).parse(req.body);
    const caseFile = getCase(body.case_id);
    const run = await createRun(caseFile.id);
    const updated = await appendEvent(run.run_id, {
      event_type: "call.inbound_prepared",
      payload: {
        case_id: caseFile.id,
        twilio_number: process.env.TWILIO_FROM_NUMBER ?? "not configured",
        next_step: "Call the Twilio number from your phone. Twilio will connect this prepared run to ElevenLabs."
      }
    });
    res.json({ mode: "inbound", run: updated, call_number: process.env.TWILIO_FROM_NUMBER ?? null });
  } catch (error) {
    next(error);
  }
});

app.post("/api/runs/:runId/simulate-outcome", async (req, res, next) => {
  try {
    const run = await readRun(req.params.runId);
    const outcome = sampleOutcome(run.case_id);
    await callTool("case.complete_clearing", { run_id: run.run_id, outcome });
    if (outcome.corrected_malo) {
      await callTool("case.update_malo", { run_id: run.run_id, corrected_malo: outcome.corrected_malo });
    }
    if (outcome.status === "needs_customer_contact") {
      await callTool("case.trigger_customer_email", { run_id: run.run_id, reason: outcome.diagnosis });
    } else if (outcome.status === "cleared") {
      await callTool("case.trigger_signup_next_step", { run_id: run.run_id });
    }
    res.json(await readRun(run.run_id));
  } catch (error) {
    next(error);
  }
});

app.get("/mcp/tools", (_req, res) => {
  res.json({ tools: toolDefinitions });
});

app.post("/mcp/tools/call", async (req, res, next) => {
  try {
    const body = z.object({ name: z.string(), arguments: z.unknown().optional() }).parse(req.body);
    res.json({ content: await callTool(body.name, body.arguments ?? {}) });
  } catch (error) {
    next(error);
  }
});

app.post("/twilio/status", async (req, res, next) => {
  try {
    await appendEvent(String(req.query.run_id), {
      event_type: "twilio.status",
      payload: req.body
    });
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.post("/twilio/voice", async (req, res, next) => {
  try {
    const runId = String(req.query.run_id);
    const caseFile = getCase(String(req.query.case_id));
    await appendEvent(runId, {
      event_type: "call.connected",
      payload: { case_id: caseFile.id, twilio_body: req.body }
    });

    const response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE">Nomos Klaerfall Agent wird verbunden.</Say>
  <Connect>
    <Stream url="${streamUrl(runId, caseFile.id)}">
      <Parameter name="run_id" value="${runId}" />
      <Parameter name="case_id" value="${caseFile.id}" />
    </Stream>
  </Connect>
</Response>`;
    res.type("text/xml").send(response);
  } catch (error) {
    next(error);
  }
});

app.post("/twilio/inbound", async (req, res, next) => {
  try {
    const run = await latestPendingInboundRun();
    if (!run) {
      res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE">Kein vorbereiteter Nomos Testlauf gefunden. Bitte zuerst im Dashboard einen Inbound Test vorbereiten.</Say>
  <Hangup />
</Response>`);
      return;
    }

    const caseFile = getCase(run.case_id);
    if (typeof req.body.CallSid === "string") {
      await attachTwilioSid(run.run_id, req.body.CallSid);
    }
    await appendEvent(run.run_id, {
      event_type: "call.connected",
      payload: { case_id: caseFile.id, direction: "inbound", twilio_body: req.body }
    });

    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE">Nomos Klaerfall Agent wird verbunden.</Say>
  <Connect>
    <Stream url="${streamUrl(run.run_id, caseFile.id)}">
      <Parameter name="run_id" value="${run.run_id}" />
      <Parameter name="case_id" value="${caseFile.id}" />
      <Parameter name="call_direction" value="inbound" />
    </Stream>
  </Connect>
</Response>`);
  } catch (error) {
    next(error);
  }
});

app.get("/api/agent-config/:caseId", (req, res, next) => {
  try {
    const caseFile = getCase(req.params.caseId);
    res.json({
      dynamic_variables: buildDynamicVariables(caseFile),
      instructions: buildAgentInstructions(caseFile),
      conversation_script: buildElevenLabsAgentScript(caseFile),
      required_skills: buildElevenLabsSkills(caseFile),
      elevenlabs_note:
        "Paste the instructions and conversation_script into the ElevenLabs Conversational AI agent, then configure the required_skills as tools against this app's MCP-style endpoints."
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(400).json({ error: message });
});

function streamUrl(runId: string, caseId: string): string {
  const base = process.env.ELEVENLABS_TWILIO_WS_URL;
  if (!base) {
    throw new Error("ELEVENLABS_TWILIO_WS_URL is required for live Twilio calls.");
  }
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}run_id=${encodeURIComponent(runId)}&case_id=${encodeURIComponent(caseId)}`;
}

function sampleOutcome(caseId: string) {
  if (caseId === "CASE-A") {
    return {
      case_id: caseId,
      status: "needs_customer_contact",
      diagnosis: "Der Zaehler war ein Baustromzaehler und wurde am 18.05. ausgebaut; die alte MaLo ist nicht mehr nutzbar.",
      next_step: "Kunden kontaktieren und neue Anlage klaeren.",
      meter_status: "ausgebaut",
      readback_confirmed: true,
      backoffice_note_de:
        "Telefonisch geklaert: Baustromzaehler wurde am 18.05. ausgebaut. Alte MaLo kann nicht genutzt werden. Kunde muss wegen neuer Anlage kontaktiert werden.",
      triggered_action: "customer_email"
    } as const;
  }
  if (caseId === "CASE-C") {
    return {
      case_id: caseId,
      status: "cleared",
      diagnosis: "Adresse war mehrdeutig; Zaehlernummer hat die richtige Marktlokation eindeutig gemacht.",
      next_step: "Anmeldung mit korrigierter MaLo neu starten.",
      corrected_malo: "71005523911",
      readback_confirmed: true,
      backoffice_note_de:
        "Richtige MaLo telefonisch erhalten und zurueckgelesen: 71005523911. Anmeldung mit korrigierter MaLo fortsetzen.",
      triggered_action: "signup_next_step"
    } as const;
  }
  return {
    case_id: caseId,
    status: "cleared",
    diagnosis: "Anmeldung liegt korrekt vor, wurde aber noch nicht weiterbearbeitet.",
    next_step: "Keine Neusendung noetig; Netzbetreiber bearbeitet heute weiter.",
    reference_number: "KL202644817",
    readback_confirmed: true,
    backoffice_note_de:
      "Anmeldung ist eingegangen und korrekt. Keine Neusendung erforderlich. Vorgangsnummer KL202644817, Bearbeitung erfolgt heute.",
    triggered_action: "signup_next_step"
  } as const;
}

app.listen(port, () => {
  console.log(`Nomos Clearing Agent running at http://localhost:${port}`);
});
