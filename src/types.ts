export type CaseStatus = "queued" | "calling" | "in_progress" | "completed" | "failed";

export type ClearingStatus =
  | "cleared"
  | "needs_customer_contact"
  | "needs_resubmission"
  | "unresolved";

export type CaseFile = {
  id: string;
  case_title: string;
  lieferant: string;
  vnb_name: string;
  malo_id: string;
  lieferstelle: string;
  zaehlernummer: string;
  anmeldung_datum: string;
  lieferbeginn: string;
  statustext: string;
  symptom: string;
  goal: string;
};

export type ClearingOutcome = {
  case_id: string;
  status: ClearingStatus;
  diagnosis: string;
  next_step: string;
  corrected_malo?: string;
  reference_number?: string;
  meter_status?: string;
  readback_confirmed: boolean;
  backoffice_note_de: string;
  triggered_action?: string;
};

export type CallEvent = {
  at: string;
  event_type: string;
  payload: unknown;
};

export type RunRecord = {
  run_id: string;
  case_id: string;
  status: CaseStatus;
  started_at: string;
  updated_at: string;
  events: CallEvent[];
  outcome?: ClearingOutcome;
};
