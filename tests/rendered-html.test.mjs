import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker(label) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(label, `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};

const ctx = { waitUntil() {}, passThroughOnException() {} };

test("server-renders the concise market companion", async () => {
  const worker = await loadWorker("page-test");
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    env,
    ctx,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();

  assert.match(html, /<title>安心看盘/);
  assert.match(html, /今日行情/);
  assert.match(html, />A股<\/button>/);
  assert.match(html, />公司<\/button>/);
  assert.match(html, />行业<\/button>/);
  assert.match(html, />美股<\/button>/);
  assert.doesNotMatch(html, />今<\/span>|>查<\/span>|>业<\/span>|>外<\/span>/);
  assert.doesNotMatch(html, /一句话看懂|下一步|不用天天看盘|四件事，影响多数行业|数据先核对/);
  assert.doesNotMatch(html, /演示数据|TUSHARE_TOKEN|codex-preview|Your site is taking shape/i);
});

test("serves World Bank macro data without an API key", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    const value = url.includes("NV.IND.MANF.ZS") ? 26.2 : url.includes("FP.CPI.TOTL.ZG") ? 0.2 : 4.8;
    return Response.json([{}, [{ date: "2024", value }]]);
  };

  try {
    const worker = await loadWorker("macro-test");
    const response = await worker.fetch(new Request("http://localhost/api/macro"), env, ctx);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.source, "World Bank");
    assert.equal(payload.data.length, 4);
    assert.ok(payload.data.every((item) => typeof item.value === "number"));
    assert.doesNotMatch(JSON.stringify(payload), /token|api.?key/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serves rule-based China and US industry comparisons without an API key", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "qt.gtimg.cn");
    const symbols = url.pathname.replace(/^\/q=/, "").split(",").filter(Boolean);
    const body = symbols.map((symbol) => {
      const fields = Array(35).fill("");
      const isUs = symbol.startsWith("us");
      fields[3] = isUs ? "99" : "101";
      fields[4] = "100";
      fields[30] = isUs ? "2026-08-05 16:00:01" : "20260806150000";
      fields[31] = isUs ? "-1" : "1";
      fields[32] = isUs ? "-1.00" : "1.00";
      return `v_${symbol}="${fields.join("~")}";`;
    }).join("\n");
    return new Response(body, { headers: { "content-type": "text/plain" } });
  };

  try {
    const worker = await loadWorker("industry-pulse-test");
    const response = await worker.fetch(new Request("http://localhost/api/industry-pulse"), env, ctx);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.source, "腾讯行情");
    assert.equal(payload.data.length, 15);
    assert.equal(new Set(payload.data.map((item) => item.id)).size, 15);
    const chips = payload.data.find((item) => item.id === "chips");
    assert.match(chips.summary, /A股半导体ETF收盘上涨1\.0%/);
    assert.match(chips.summary, /美股半导体SOXX最近收盘下跌1\.0%/);
    assert.match(chips.summary, /走势分化/);
    assert.equal(chips.cn.asOf, "2026-08-06 15:00");
    assert.equal(chips.us.asOf, "2026-08-05 16:00");
    assert.doesNotMatch(JSON.stringify(payload), /买入|卖出|投资建议|API.?key/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
