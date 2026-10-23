/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");
const file = path.join(__dirname, "../app/lib/connection-proof.ts");
function load() {
  if (!fs.existsSync(file)) return {};
  const m = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { module: m, exports: m.exports, Date, JSON },
  );
  return m.exports;
}
test("server connection proof round-trips zero-activity connection without requiring a report", () => {
  const p = load();
  assert.equal(typeof p.writeConnectionProof, "function");
  const text = p.writeConnectionProof("Ordinary notes", {
    source: "ga4",
    propertyId: "123456",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(p.readConnectionProof(text).propertyId, "123456");
  assert.match(text, /Ordinary notes/);
});
test("user notes cannot mint a proof; edits preserve only current server proof", () => {
  const p = load();
  const proof = p.writeConnectionProof("Original", {
    source: "ga4",
    propertyId: "123456",
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(
    p.readConnectionProof(p.preserveConnectionProof(null, proof, "123456")),
    null,
  );
  assert.equal(
    p.readConnectionProof(p.preserveConnectionProof(proof, "Edited", "123456"))
      .source,
    "ga4",
  );
  assert.equal(
    p.readConnectionProof(p.preserveConnectionProof(proof, "Edited", "999999")),
    null,
  );
  assert.match(p.preserveConnectionProof(proof, "Edited", "123456"), /Edited/);
});
test("only a bounded, valid first-line marker is accepted", () => {
  const p = load();
  for (const text of [
    "anything",
    "[convert-connection-v1]{}[/convert-connection-v1]",
    "[convert-connection-v1]" +
      JSON.stringify({
        source: "ga4",
        propertyId: "abc",
        verifiedAt: "2026-01-01",
      }) +
      "[/convert-connection-v1]",
  ])
    assert.equal(p.readConnectionProof(text), null);
  const text = p.writeConnectionProof("", {
    source: "upload",
    propertyId: null,
    verifiedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(p.readConnectionProof("user text\n" + text), null);
  assert.equal(p.readConnectionProof(text).source, "upload");
  assert.equal(
    p.readConnectionProof(
      text.replace("2026-01-01T00:00:00.000Z", "2999-01-01T00:00:00.000Z"),
    ),
    null,
  );
});
