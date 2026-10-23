/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  pdf = require("pdf-lib");
test("actual PDF handler shows shared milestone grading and task-specific DIY/help instead of generic redesign ad", async () => {
  const drawn = [];
  const client = {
    id: "site",
    user_id: "owner",
    name: "Synthetic",
    website: "https://example.invalid",
  };
  const report = {
    id: "report",
    client_id: "site",
    traffic: 0,
    conversions: 0,
    month: "2026-09-01 to 2026-09-30",
    notes: null,
    clients: client,
  };
  const data = {
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        single: async () => ({
          data: table === "clients" ? client : report,
          error: null,
        }),
        maybeSingle: async () => ({
          data: table === "clients" ? client : report,
          error: null,
        }),
      };
      return q;
    },
  };
  function load(file) {
    const m = { exports: {} },
      f = path.join(__dirname, "..", file);
    const code = ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const req = (n) => {
      if (n === "@/lib/data-store") return { appData: data };
      if (n === "@/lib/supabase-server")
        return {
          getRequestUser: async () => ({ user: { id: "owner" }, error: null }),
          isAdminUser: () => false,
        };
      if (n.startsWith("@/lib/")) return load("app/lib/" + n.slice(6) + ".ts");
      if (n === "pdf-lib")
        return {
          ...pdf,
          PDFDocument: {
            create: async () => {
              const d = await pdf.PDFDocument.create();
              const add = d.addPage.bind(d);
              d.addPage = (...args) => {
                const p = add(...args),
                  draw = p.drawText.bind(p);
                p.drawText = (text, ...opts) => {
                  drawn.push(text);
                  return draw(text, ...opts);
                };
                return p;
              };
              return d;
            },
          },
        };
      return require(n);
    };
    Function(
      "module",
      "exports",
      "require",
      "Response",
      "Request",
      "Buffer",
      code,
    )(m, m.exports, req, Response, Request, Buffer);
    return m.exports;
  }
  const res = await load("app/api/reports/[id]/pdf/route.ts").GET(
    new Request("https://convert.example/api/reports/report/pdf"),
    { params: Promise.resolve({ id: "report" }) },
  );
  assert.equal(res.status, 200);
  assert.ok((await res.arrayBuffer()).byteLength > 5000);
  const text = drawn.join("\n");
  assert.match(text, /0\/100/);
  assert.match(text, /READINESS 0\/70/);
  assert.match(text, /Your next steps/);
  assert.match(text, /\/guides\/connect-analytics/);
  assert.match(text, /George/);
  assert.doesNotMatch(
    text,
    /contact page redesign|GET CONTACT PAGE HELP|Get redesign help/i,
  );
});
