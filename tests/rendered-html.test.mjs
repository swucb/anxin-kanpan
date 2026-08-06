import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished A-share companion", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>安心看盘/);
  assert.match(html, /把 A 股和全球行业线索说得明白/);
  assert.match(html, /今日行情/);
  assert.match(html, /查企业/);
  assert.match(html, /看行业/);
  assert.match(html, /美股参考/);
  assert.match(html, /不构成任何投资建议/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("serves the market data API without exposing a token", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/market"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.meta.mode, "demo");
  assert.equal(typeof payload.data.conclusion, "string");
  assert.doesNotMatch(JSON.stringify(payload), /TUSHARE_TOKEN=/);
});

test("serves a clearly bounded US-market reference API", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("us-api-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/us-reference"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.meta.mode, "demo");
  assert.equal(payload.data.indices.length, 3);
  assert.ok(payload.data.sectors.length >= 7);
  assert.match(payload.data.caution, /不提供美股选股或交易建议/);
  assert.doesNotMatch(JSON.stringify(payload), /TUSHARE_TOKEN=/);
});

test("never turns missing formal US indices into fabricated zero values", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const requestBody = JSON.parse(String(init?.body ?? "{}"));
    if (requestBody.api_name === "us_daily" && requestBody.params?.ts_code === "SPY") {
      return Response.json({
        code: 0,
        data: {
          fields: ["ts_code", "trade_date", "close", "pre_close", "pct_change"],
          items: [["SPY", "20260805", 641.2, 638.1, 0.49]],
        },
      });
    }
    return Response.json({ code: 0, data: { fields: [], items: [] } });
  };

  try {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("missing-us-test", `${process.pid}-${Date.now()}`);
    const { default: worker } = await import(workerUrl.href);
    const response = await worker.fetch(
      new Request("http://localhost/api/us-reference"),
      {
        ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
        TUSHARE_TOKEN: "formal-test-token",
      },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.meta.mode, "demo");
    assert.ok(payload.data.indices.every((index) => index.close > 0));
    assert.ok(payload.data.indices.every((index) => index.pct !== 0));
    assert.match(payload.meta.warning, /美股日线需要单独开通权限/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
