import test from "node:test";
import assert from "node:assert/strict";
import { buildDraft, matchClient, matchService, nameSimilarity } from "../src/lib/ai/voiceDraft.ts";

const clients = [
  { id: "c1", name: "Marie Keilor East" },
  { id: "c2", name: "John Smith" },
  { id: "c3", name: "Joan Smith" },
  { id: "c4", name: "Maria Santos" },
];
const services = [
  { id: "s1", name: "Lawn mowing", description: "Front and back", price: 85 },
  { id: "s2", name: "Hedge trimming", description: "", price: 120 },
  { id: "s3", name: "Gutter cleaning", description: "", price: 150 },
];

test("misheard suburb still matches the right client", () => {
  const m = matchClient("Marie and Keylor East", clients);
  assert.equal(m.clientId, "c1");
});

test("exact name is an exact match", () => {
  assert.deepEqual(matchClient("john smith", clients).confidence, "exact");
});

test("ambiguous first names are never auto-picked", () => {
  const m = matchClient("Smith", clients);
  assert.equal(m.clientId, null);
  assert.ok(m.candidates.length >= 2);
});

test("unknown customer matches nothing", () => {
  assert.equal(matchClient("Zed Quartermaine", clients).clientId, null);
});

test("similarity is symmetric enough and bounded", () => {
  const s = nameSimilarity("Keylor", "Keilor");
  assert.ok(s > 0.6 && s < 1);
  assert.equal(nameSimilarity("", "x"), 0);
});

test("services match by name and ambiguity is left alone", () => {
  assert.equal(matchService("mow the lawn mowing front", services)?.id, "s1");
  assert.equal(matchService("trim the hedge trimming", services)?.id, "s2");
  assert.equal(matchService("rocket surgery", services), null);
});

test("price list wins over a spoken price, and the difference is flagged", () => {
  const d = buildDraft("t", { customer_name: "John Smith", items: [{ description: "Lawn mowing", quantity: 2, spoken_unit_price: 90 }] }, clients, services);
  assert.equal(d.lines[0].unitPrice, 85);
  assert.equal(d.lines[0].qty, 2);
  assert.equal(d.lines[0].priceSource, "price_list");
  assert.match(d.lines[0].warning ?? "", /price list/);
});

test("unknown service uses the spoken price and is flagged; no price becomes zero and flagged", () => {
  const d = buildDraft("t", { customer_name: "John Smith", items: [{ description: "Fence painting", spoken_unit_price: 300 }, { description: "Tree removal" }] }, clients, services);
  assert.equal(d.lines[0].priceSource, "spoken");
  assert.equal(d.lines[0].unitPrice, 300);
  assert.ok(d.lines[0].warning);
  assert.equal(d.lines[1].priceSource, "missing");
  assert.equal(d.lines[1].unitPrice, 0);
});

test("absurd or negative numbers are rejected", () => {
  const d = buildDraft("t", { customer_name: "John Smith", items: [{ description: "Fence painting", quantity: -5, spoken_unit_price: 1e12 }] }, clients, services);
  assert.equal(d.lines[0].qty, 1);
  assert.equal(d.lines[0].unitPrice, 0);
});

test("empty extraction warns and creates nothing", () => {
  const d = buildDraft("", {}, clients, services);
  assert.equal(d.lines.length, 0);
  assert.ok(d.warnings.length >= 2);
});

test("control characters and overlong text are cleaned", () => {
  const d = buildDraft("t", { customer_name: "A\u0000B", items: [{ description: "x".repeat(500) + "\n" }], notes: "n".repeat(5000) }, clients, services);
  assert.ok(!d.customer.spokenName.includes("\u0000"));
  assert.equal(d.lines[0].serviceName.length, 200);
  assert.equal(d.notes.length, 1000);
});

test("a suggested price-list match is used only if it is a real service name", () => {
  const ok = buildDraft("t", { customer_name: "John Smith", items: [{ description: "mow the front and back lawns", quantity: 2, price_list_match: "Lawn mowing" }] }, clients, services);
  assert.equal(ok.lines[0].serviceId, "s1");
  assert.equal(ok.lines[0].unitPrice, 85);
  const fake = buildDraft("t", { customer_name: "John Smith", items: [{ description: "paint the fence", spoken_unit_price: 50, price_list_match: "Premium Fence Painting" }] }, clients, services);
  assert.equal(fake.lines[0].serviceId, null);
  assert.equal(fake.lines[0].priceSource, "spoken");
});
