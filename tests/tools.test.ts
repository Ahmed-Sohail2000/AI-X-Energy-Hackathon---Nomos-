import { describe, expect, it } from "vitest";
import { getCase } from "../src/cases.js";
import { buildAgentInstructions, buildElevenLabsAgentScript, buildElevenLabsSkills } from "../src/agentPrompt.js";

describe("Nomos agent assets", () => {
  it("loads fixture cases", () => {
    expect(getCase("CASE-A").case_title).toContain("Marktlokation");
  });

  it("requires AI disclosure as first human-facing instruction", () => {
    const instructions = buildAgentInstructions(getCase("CASE-B"));
    expect(instructions).toContain("Guten Tag, hier spricht ein KI-Assistent im Auftrag des Stromlieferanten Nomos.");
  });

  it("includes DTMF menu routing guidance", () => {
    const instructions = buildAgentInstructions(getCase("CASE-C"));
    expect(instructions).toContain("Marktkommunikation oder MaLo-Ident: 2");
  });

  it("builds ElevenLabs scripts and required skills per case", () => {
    const caseFile = getCase("CASE-C");
    expect(buildElevenLabsAgentScript(caseFile)).toContain("Guten Tag, hier spricht ein KI-Assistent");
    expect(buildElevenLabsSkills(caseFile).map((skill) => skill.name)).toEqual([
      "case.update_malo",
      "case.complete_clearing",
      "case.trigger_signup_next_step"
    ]);
  });

  it("builds CASE-C script from the corrected MaLo example call", () => {
    const script = buildElevenLabsAgentScript(getCase("CASE-C"));
    expect(script).toContain("DTMF die 2");
    expect(script).toContain("Betreff mit der MaLo");
    expect(script).toContain("Zaehlernummer als klaerendes Merkmal");
    expect(script).toContain("lies sie sofort digit-by-digit zurueck");
    expect(script).toContain("Anmeldung mit der korrigierten Marktlokation neu starten");
  });
});
