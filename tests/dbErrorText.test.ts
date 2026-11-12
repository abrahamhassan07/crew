import test from "node:test";
import assert from "node:assert/strict";
import { describeDbError } from "../src/lib/dbErrorText.ts";

test("names the field for common database errors", () => {
  assert.equal(describeDbError("23502", 'null value in column "address" of relation "jobs" violates not-null constraint'), "Address is required.");
  assert.equal(describeDbError("23502", 'null value in column "client_name" of relation "jobs" violates not-null constraint'), "Client name is required.");
  assert.match(describeDbError("23514", 'new row for relation "jobs" violates check constraint "jobs_recurrence_check"')!, /^The repeat option you chose isn't accepted/);
  assert.match(describeDbError("23514", 'new row for relation "clients" violates check constraint "clients_status_check"')!, /^The status you chose/);
  assert.equal(describeDbError("23514", 'new row for relation "recurring_services" violates check constraint "recurring_services_check"'), "Enter how many days between visits for a custom repeat.");
  assert.equal(describeDbError("23505", 'duplicate key value violates unique constraint "invoices_num_org_unique"'), "That invoice number is already used. Choose a different number.");
  assert.match(describeDbError("22001", "value too long for type character varying(200)")!, /too long/);
  assert.equal(describeDbError("42501", "permission denied"), null);
});

test("never echoes table or constraint names", () => {
  const out = describeDbError("23514", 'new row for relation "secret_table" violates check constraint "weird_name"')!;
  assert.doesNotMatch(out, /secret_table|weird_name/);
});
