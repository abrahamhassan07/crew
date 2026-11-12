// Plain-English wording for database errors. The raw message names tables, columns and constraints, so it is never
// shown; instead the column or constraint is picked out and turned into a field name people recognise.
// Kept free of server-only imports so it can be unit tested.

const FIELD_LABEL: Record<string, string> = {
  recurrence: "repeat option",
  job_type: "job type",
  job_date: "date",
  start_time: "start time",
  duration_minutes: "duration",
  client_name: "client name",
  client_id: "client",
  num: "number",
  frequency: "how often",
  interval_days: "days between visits",
  anchor_date: "first visit date",
  pricing_type: "pricing type",
  job_role: "role",
  lead_source: "lead source",
  postcode: "postcode",
  kind: "type",
  abn: "ABN",
  gst_mode: "GST setting",
  due_date: "due date",
  issue_date: "issue date",
};

const UNIQUE_LABEL: Record<string, string> = {
  jobs_num_org_unique: "That job number is already used. Please try saving again.",
  jobs_num_unique: "That job number is already used. Please try saving again.",
  invoices_num_org_unique: "That invoice number is already used. Choose a different number.",
  quotes_num_org_unique: "That quote number is already used. Please try saving again.",
  requests_num_org_unique: "That request number is already used. Please try saving again.",
};

const CHECK_LABEL: Record<string, string> = {
  recurring_services_check: "Enter how many days between visits for a custom repeat.",
};

export function fieldLabel(column: string): string {
  return FIELD_LABEL[column] ?? column.replace(/_id$/, "").replace(/_/g, " ");
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Returns a specific message for the common validation errors, or null to fall back to the generic one. */
export function describeDbError(code: string | undefined, message: string): string | null {
  switch (code) {
    case "23502": {
      // null value in column "address" of relation "jobs" violates not-null constraint
      const col = message.match(/column "([a-z0-9_]+)"/i)?.[1];
      return col ? `${capitalise(fieldLabel(col))} is required.` : "A required field is empty. Fill it in and try again.";
    }
    case "23514": {
      // new row for relation "jobs" violates check constraint "jobs_recurrence_check"
      const m = message.match(/relation "([a-z0-9_]+)" violates check constraint "([a-z0-9_]+)"/i);
      if (!m) return "One of the values isn't allowed. Check the form and try again.";
      const [, table, constraint] = m;
      if (CHECK_LABEL[constraint]) return CHECK_LABEL[constraint];
      const col = constraint.startsWith(`${table}_`) && constraint.endsWith("_check") ? constraint.slice(table.length + 1, -"_check".length) : "";
      return col ? `The ${fieldLabel(col)} you chose isn't accepted. Choose another option, or contact support if it should be allowed.` : "One of the values isn't allowed. Check the form and try again.";
    }
    case "23505": {
      const constraint = message.match(/unique constraint "([a-z0-9_]+)"/i)?.[1];
      return (constraint && UNIQUE_LABEL[constraint]) || "That already exists. Check for a duplicate and try again.";
    }
    case "22001":
      return "One of the fields is too long. Shorten it and try again.";
    case "22P02":
    case "22007":
    case "22008":
      return "One of the values isn't in the right format, for example a number, date or time. Check it and try again.";
    case "22003":
      return "One of the numbers is too large. Check it and try again.";
    default:
      return null;
  }
}
