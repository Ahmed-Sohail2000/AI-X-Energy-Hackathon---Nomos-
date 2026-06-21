const steps = ["cases", "setup", "call", "review"];
const mcpTools = [
  "case.get",
  "case.record_call_event",
  "case.complete_clearing",
  "case.update_malo",
  "case.trigger_signup_next_step",
  "case.trigger_customer_email"
];

const state = {
  cases: [],
  runs: [],
  selectedCaseId: null,
  step: "cases",
  activeRunId: null,
  polling: false,
  pendingCall: false,
  lastError: null
};

const els = {
  page: document.querySelector("#page"),
  health: document.querySelector("#health"),
  refresh: document.querySelector("#refresh"),
  stepButtons: document.querySelectorAll("[data-step]"),
  scrollConsoleButtons: document.querySelectorAll("[data-scroll-console]"),
  landingCaseButtons: document.querySelectorAll("[data-landing-case]"),
  metricCases: document.querySelector("#metric-cases"),
  metricOpen: document.querySelector("#metric-open"),
  metricCompleted: document.querySelector("#metric-completed"),
  metricMode: document.querySelector("#metric-mode")
};

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    let message = await response.text();
    try {
      message = JSON.parse(message).error ?? message;
    } catch {
      // Keep raw response text when it is not JSON.
    }
    throw new Error(message);
  }
  return response.json();
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectedCase() {
  return state.cases.find((item) => item.id === state.selectedCaseId) ?? state.cases[0];
}

function latestRun(caseId = state.selectedCaseId) {
  return state.runs.find((run) => run.case_id === caseId);
}

function activeRun(caseId = state.selectedCaseId) {
  return state.runs.find((run) => run.run_id === state.activeRunId) ?? latestRun(caseId);
}

async function load() {
  const [health, cases, runs] = await Promise.all([api("/health"), api("/api/cases"), api("/api/runs")]);
  state.cases = cases;
  state.runs = runs;
  state.selectedCaseId ||= cases[0]?.id ?? null;
  els.health.textContent = health.ok ? "Ready" : "Offline";
  els.health.dataset.state = health.ok ? "ready" : "offline";
  render();
}

function render() {
  if (state.step !== "call") {
    state.lastError = null;
  }
  renderMetrics();
  renderSteps();
  if (state.step === "cases") renderCases();
  if (state.step === "setup") renderSetup();
  if (state.step === "call") renderCall();
  if (state.step === "review") renderReview();
  syncPolling();
}

function renderMetrics() {
  const completed = state.runs.filter((run) => run.status === "completed").length;
  els.metricCases.textContent = String(state.cases.length);
  els.metricOpen.textContent = String(state.runs.length - completed);
  els.metricCompleted.textContent = String(completed);
  els.metricMode.textContent = state.runs.some((run) => run.twilio_call_sid) ? "Twilio" : "Mock";
}

function renderSteps() {
  els.stepButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.step === state.step);
  });
}

function renderCases() {
  els.page.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Step 1</p>
        <h2>Select case</h2>
      </div>
      ${nextButton("Setup")}
    </div>
    <div class="case-grid">
      ${state.cases.map(caseCard).join("")}
    </div>
  `;
  bindPageActions();
}

function caseCard(item) {
  const run = latestRun(item.id);
  const selected = item.id === state.selectedCaseId ? " selected" : "";
  return `
    <button class="case-card${selected}" data-select="${html(item.id)}" type="button">
      <span class="case-row">
        <strong>${html(item.id)}</strong>
        <span class="tag">${html(run?.status ?? "ready")}</span>
      </span>
      <span class="title">${html(item.case_title)}</span>
      <span class="meta">${html(item.vnb_name)}</span>
    </button>
  `;
}

function renderSetup() {
  const item = selectedCase();
  els.page.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Step 2</p>
        <h2>Prepare agent</h2>
      </div>
      ${nextButton("Call")}
    </div>
    <div class="split">
      <section class="panel">
        <h3>${html(item.id)} facts</h3>
        <div class="facts">
          ${fact("Operator", item.vnb_name)}
          ${fact("MaLo", item.malo_id)}
          ${fact("Meter", item.zaehlernummer)}
          ${fact("Start", item.lieferbeginn)}
          ${fact("Address", item.lieferstelle)}
        </div>
      </section>
      <section class="panel">
        <h3>Connectors</h3>
        <div class="connector-list">
          ${connector("ElevenLabs", "Voice")}
          ${connector("Twilio", "Calling")}
          ${connector("OpenAI", "Reasoning")}
          ${connector("MCP Tools", "Actions")}
          ${connector("Google Stitch", "Design")}
        </div>
        <div class="actions">
          <button data-copy="${html(item.id)}" type="button">Copy config</button>
          <a href="/api/agent-config/${encodeURIComponent(item.id)}" target="_blank" rel="noreferrer">Open JSON</a>
        </div>
      </section>
    </div>
    <section class="panel compact">
      <h3>MCP tools</h3>
      <div class="chips">${mcpTools.map((tool) => `<span>${html(tool)}</span>`).join("")}</div>
    </section>
  `;
  bindPageActions();
}

function renderCall() {
  const item = selectedCase();
  const run = activeRun(item.id);
  const isActive = run && !["completed", "failed"].includes(run.status);
  const agentState = run?.events?.some((event) => event.event_type === "call.connected") ? "stream connected" : "waiting for answer";
  const twilioStatus = latestTwilioStatus(run) ?? (run?.twilio_call_sid ? "created" : "not started");
  els.page.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Step 3</p>
        <h2>Run call</h2>
      </div>
      ${nextButton("Review")}
    </div>
    <section class="call-screen">
      <div>
        <span class="tag">${html(run?.status ?? "not started")}</span>
        <h3>${html(item.case_title)}</h3>
        <p>${html(item.statustext)}</p>
      </div>
      <div class="actions">
        <button data-start="${html(item.id)}" type="button" ${state.pendingCall ? "disabled" : ""}>${state.pendingCall ? "Starting..." : isActive ? "Restart call" : "Start Twilio call"}</button>
        ${run ? `<button data-refresh-run type="button" class="secondary">Refresh status</button>` : ""}
        ${run ? `<button data-sim="${html(run.run_id)}" class="secondary" type="button">Simulate outcome</button>` : ""}
      </div>
    </section>
    ${state.lastError ? `<section class="error-banner"><strong>Call failed</strong><span>${html(state.lastError)}</span></section>` : ""}
    <section class="live-grid">
      ${liveTile("Twilio call", twilioStatus)}
      ${liveTile("ElevenLabs agent", agentState)}
      ${liveTile("Call SID", run?.twilio_call_sid ?? "not assigned")}
      ${liveTile("Run ID", run?.run_id ?? "not created")}
    </section>
    ${
      run
        ? `<section class="panel compact">
            <div class="case-row">
              <h3>Live events</h3>
              <span class="tag">${html(String(run.events?.length ?? 0))}</span>
            </div>
            <div class="event-list">${eventRows(run)}</div>
          </section>`
        : ""
    }
  `;
  bindPageActions();
}

function renderReview() {
  els.page.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Step 4</p>
        <h2>Review runs</h2>
      </div>
      <button data-step-to="cases" class="secondary" type="button">New case</button>
    </div>
    <div class="run-list">
      ${
        state.runs.length
          ? state.runs.map(runCard).join("")
          : `<p class="empty">No runs yet.</p>`
      }
    </div>
  `;
  bindPageActions();
}

function runCard(run) {
  const twilioStatus = latestTwilioStatus(run);
  return `
    <article class="run-card">
      <div class="case-row">
        <strong>${html(run.case_id)}</strong>
        <span class="tag">${html(run.status)}</span>
      </div>
      <p>${html(run.outcome?.backoffice_note_de ?? "Awaiting outcome.")}</p>
      ${twilioStatus ? `<small>Twilio: ${html(twilioStatus)}</small>` : ""}
      <small>${html(run.run_id)}</small>
    </article>
  `;
}

function fact(label, value) {
  return `<div><span>${html(label)}</span><strong>${html(value || "n/a")}</strong></div>`;
}

function connector(name, role) {
  return `<div><strong>${html(name)}</strong><span>${html(role)}</span></div>`;
}

function liveTile(label, value) {
  return `
    <article>
      <span>${html(label)}</span>
      <strong>${html(value)}</strong>
    </article>
  `;
}

function eventRows(run) {
  const events = [...(run.events ?? [])].reverse().slice(0, 8);
  if (events.length === 0) {
    return `<p class="empty">No Twilio or agent events yet.</p>`;
  }
  return events
    .map((event) => {
      const payload = eventPayloadSummary(event);
      return `
        <div class="event-row">
          <time>${html(formatTime(event.at))}</time>
          <strong>${html(event.event_type)}</strong>
          <span>${html(payload)}</span>
        </div>
      `;
    })
    .join("");
}

function eventPayloadSummary(event) {
  if (event.event_type === "twilio.status") {
    return latestEventValue(event, "CallStatus") ?? "status callback";
  }
  if (event.event_type === "call.connected") {
    return "Twilio connected to ElevenLabs stream";
  }
  if (event.event_type === "call.mock_created") {
    return "mock run created";
  }
  if (event.event_type === "case.completed") {
    return "structured outcome saved";
  }
  return "agent event recorded";
}

function latestTwilioStatus(run) {
  if (!run?.events) return null;
  const event = [...run.events].reverse().find((item) => item.event_type === "twilio.status");
  return event ? latestEventValue(event, "CallStatus") : null;
}

function latestEventValue(event, key) {
  const value = event?.payload?.[key];
  return typeof value === "string" ? value : null;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function nextButton(label) {
  const next = steps[Math.min(steps.indexOf(state.step) + 1, steps.length - 1)];
  return `<button data-step-to="${next}" type="button">Next: ${html(label)}</button>`;
}

function bindPageActions() {
  els.page.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCaseId = button.dataset.select;
      render();
    });
  });
  els.page.querySelectorAll("[data-step-to]").forEach((button) => {
    button.addEventListener("click", () => {
      state.step = button.dataset.stepTo;
      render();
    });
  });
  els.page.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => copyConfig(button.dataset.copy, button));
  });
  els.page.querySelectorAll("[data-start]").forEach((button) => {
    button.addEventListener("click", async () => startCall(button.dataset.start));
  });
  els.page.querySelectorAll("[data-refresh-run]").forEach((button) => {
    button.addEventListener("click", refreshRuns);
  });
  els.page.querySelectorAll("[data-sim]").forEach((button) => {
    button.addEventListener("click", async () => simulate(button.dataset.sim));
  });
}

async function copyConfig(caseId, button) {
  const config = await api(`/api/agent-config/${encodeURIComponent(caseId)}`);
  await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
  const original = button.textContent;
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

async function startCall(caseId) {
  state.pendingCall = true;
  state.lastError = null;
  render();
  try {
    const result = await api("/api/calls/start", {
      method: "POST",
      body: JSON.stringify({ case_id: caseId })
    });
    state.runs = await api("/api/runs");
    state.activeRunId = result.run.run_id;
    els.metricMode.textContent = result.mode === "twilio" ? "Twilio" : "Mock";
    state.step = "call";
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "Unknown call error";
  } finally {
    state.pendingCall = false;
    render();
  }
}

async function simulate(runId) {
  await api(`/api/runs/${runId}/simulate-outcome`, { method: "POST", body: "{}" });
  state.runs = await api("/api/runs");
  state.activeRunId = runId;
  state.step = "review";
  render();
}

async function refreshRuns() {
  state.runs = await api("/api/runs");
  render();
}

function syncPolling() {
  const run = state.runs.find((item) => item.run_id === state.activeRunId);
  const shouldPoll = state.step === "call" && run && !["completed", "failed"].includes(run.status);
  if (shouldPoll && !state.polling) {
    state.polling = window.setInterval(refreshRuns, 2500);
  }
  if (!shouldPoll && state.polling) {
    window.clearInterval(state.polling);
    state.polling = false;
  }
}

els.refresh.addEventListener("click", refreshRuns);

els.stepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.step = button.dataset.step;
    render();
    scrollToConsole();
  });
});

els.scrollConsoleButtons.forEach((button) => {
  button.addEventListener("click", scrollToConsole);
});

els.landingCaseButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedCaseId = button.dataset.landingCase;
    state.step = "setup";
    render();
    scrollToConsole();
  });
});

function scrollToConsole() {
  document.querySelector("#console")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

load().catch((error) => {
  els.health.textContent = "Error";
  els.health.dataset.state = "offline";
  els.page.innerHTML = `<pre>${html(error.message)}</pre>`;
});
