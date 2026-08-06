export interface MarketEnv {
  DB?: D1Database;
  TUSHARE_TOKEN?: string;
}

type Row = Record<string, string | number | null>;

type SourceMode = "live" | "demo";

export interface ApiMeta {
  mode: SourceMode;
  source: string;
  updatedAt: string;
  tradeDate?: string;
  warning?: string;
}

interface TushareResponse {
  code: number;
  msg?: string | null;
  data?: {
    fields: string[];
    items: Array<Array<string | number | null>>;
  };
}

interface BasicStock {
  ts_code: string;
  symbol: string;
  name: string;
  area: string;
  industry: string;
  market: string;
}

interface IndexSummary {
  code: string;
  name: string;
  close: number;
  pct: number;
}

interface MarketSummary {
  tradeDate: string;
  mood: "偏暖" | "平稳" | "偏谨慎";
  moodNote: string;
  indices: IndexSummary[];
  breadth: {
    rises: number;
    falls: number;
    flats: number;
    limitUps: number;
  };
  amountYi: number;
  conclusion: string;
  positives: string[];
  cautions: string[];
}

interface IndustrySummary {
  name: string;
  pct: number;
  advanceRate: number | null;
  amountYi: number;
  medianPe: number | null;
  status: "较强" | "平稳" | "承压";
  note: string;
}

interface CompanySummary {
  code: string;
  tsCode: string;
  name: string;
  industry: string;
  area: string;
  price: number;
  pct: number;
  verdict: "相对稳健" | "中性观察" | "需要谨慎";
  verdictNote: string;
  metrics: Array<{ label: string; value: string; hint: string; tone: "good" | "plain" | "risk" }>;
  trend: Array<{ date: string; close: number }>;
  advantages: string[];
  risks: string[];
  watch: string[];
  peers: Array<{
    code: string;
    name: string;
    price: number;
    pct: number;
    pe: number | null;
    roe: number | null;
    revenueGrowth: number | null;
    marketCapYi: number | null;
  }>;
}

const TUSHARE_URL = "https://api.tushare.pro";
const memoryCache = new Map<string, { payload: unknown; expiresAt: number }>();
let cacheSchemaReady = false;

const demoStocks: BasicStock[] = [
  { ts_code: "600519.SH", symbol: "600519", name: "贵州茅台", area: "贵州", industry: "白酒", market: "主板" },
  { ts_code: "000858.SZ", symbol: "000858", name: "五粮液", area: "四川", industry: "白酒", market: "主板" },
  { ts_code: "000568.SZ", symbol: "000568", name: "泸州老窖", area: "四川", industry: "白酒", market: "主板" },
  { ts_code: "300750.SZ", symbol: "300750", name: "宁德时代", area: "福建", industry: "电池", market: "创业板" },
  { ts_code: "002594.SZ", symbol: "002594", name: "比亚迪", area: "广东", industry: "汽车整车", market: "主板" },
  { ts_code: "601012.SH", symbol: "601012", name: "隆基绿能", area: "陕西", industry: "光伏设备", market: "主板" },
  { ts_code: "600036.SH", symbol: "600036", name: "招商银行", area: "深圳", industry: "银行", market: "主板" },
  { ts_code: "601398.SH", symbol: "601398", name: "工商银行", area: "北京", industry: "银行", market: "主板" },
  { ts_code: "601288.SH", symbol: "601288", name: "农业银行", area: "北京", industry: "银行", market: "主板" },
  { ts_code: "601318.SH", symbol: "601318", name: "中国平安", area: "深圳", industry: "保险", market: "主板" },
  { ts_code: "000333.SZ", symbol: "000333", name: "美的集团", area: "广东", industry: "家用电器", market: "主板" },
  { ts_code: "600690.SH", symbol: "600690", name: "海尔智家", area: "山东", industry: "家用电器", market: "主板" },
  { ts_code: "000651.SZ", symbol: "000651", name: "格力电器", area: "广东", industry: "家用电器", market: "主板" },
  { ts_code: "600276.SH", symbol: "600276", name: "恒瑞医药", area: "江苏", industry: "创新药", market: "主板" },
  { ts_code: "300760.SZ", symbol: "300760", name: "迈瑞医疗", area: "深圳", industry: "医疗器械", market: "创业板" },
];

const demoCompanySeed: Record<string, { price: number; pct: number; pe: number; roe: number; growth: number; debt: number; margin: number }> = {
  "600519": { price: 1426.3, pct: 0.86, pe: 21.8, roe: 31.2, growth: 15.4, debt: 18.1, margin: 91.4 },
  "000858": { price: 126.9, pct: 0.42, pe: 18.7, roe: 24.8, growth: 11.3, debt: 20.4, margin: 75.6 },
  "000568": { price: 118.2, pct: -0.36, pe: 17.6, roe: 29.1, growth: 9.8, debt: 25.2, margin: 88.2 },
  "300750": { price: 268.4, pct: 1.74, pe: 24.5, roe: 24.2, growth: 12.8, debt: 56.7, margin: 25.1 },
  "002594": { price: 344.6, pct: 1.12, pe: 27.2, roe: 22.3, growth: 18.1, debt: 74.6, margin: 20.4 },
  "601012": { price: 17.8, pct: -1.46, pe: 0, roe: -8.1, growth: -31.4, debt: 63.2, margin: 7.3 },
  "600036": { price: 45.1, pct: 0.27, pe: 7.2, roe: 16.4, growth: 2.1, debt: 91.2, margin: 0 },
  "601398": { price: 7.1, pct: -0.14, pe: 6.8, roe: 10.4, growth: 1.2, debt: 92.1, margin: 0 },
  "601288": { price: 5.4, pct: 0.19, pe: 6.5, roe: 10.8, growth: 2.6, debt: 92.4, margin: 0 },
  "601318": { price: 59.3, pct: 0.64, pe: 8.9, roe: 14.1, growth: 8.2, debt: 88.6, margin: 0 },
  "000333": { price: 78.2, pct: 0.91, pe: 14.6, roe: 23.2, growth: 9.4, debt: 64.7, margin: 26.1 },
  "600690": { price: 27.8, pct: 0.36, pe: 13.9, roe: 18.7, growth: 7.8, debt: 69.1, margin: 31.4 },
  "000651": { price: 45.5, pct: -0.22, pe: 8.7, roe: 31.6, growth: 4.9, debt: 65.4, margin: 29.7 },
  "600276": { price: 54.6, pct: 1.24, pe: 44.2, roe: 14.8, growth: 18.6, debt: 12.5, margin: 84.3 },
  "300760": { price: 245.2, pct: -0.58, pe: 28.4, roe: 25.7, growth: 6.1, debt: 28.4, margin: 65.2 },
};

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 2): number {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function compactDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}${map.month}${map.day}`;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return compactDate(date);
}

function readableDate(value: string): string {
  if (!/^\d{8}$/.test(value)) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function stableKey(apiName: string, params: Record<string, unknown>, fields: string): string {
  const ordered = Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  return `tushare:${apiName}:${JSON.stringify(ordered)}:${fields}`;
}

async function ensureCacheSchema(env: MarketEnv): Promise<void> {
  if (!env.DB || cacheSchemaReady) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS market_cache (
      cache_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`,
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS market_cache_expires_idx ON market_cache (expires_at)",
  ).run();
  cacheSchemaReady = true;
}

async function readCache<T>(env: MarketEnv, key: string): Promise<{ payload: T; expiresAt: number } | null> {
  const inMemory = memoryCache.get(key);
  if (inMemory) return inMemory as { payload: T; expiresAt: number };
  if (!env.DB) return null;
  await ensureCacheSchema(env);
  const row = await env.DB.prepare(
    "SELECT payload, expires_at AS expiresAt FROM market_cache WHERE cache_key = ?1",
  ).bind(key).first<{ payload: string; expiresAt: number }>();
  if (!row) return null;
  try {
    const value = { payload: JSON.parse(row.payload) as T, expiresAt: Number(row.expiresAt) };
    memoryCache.set(key, value);
    return value;
  } catch {
    return null;
  }
}

async function writeCache<T>(env: MarketEnv, key: string, payload: T, ttlMs: number): Promise<void> {
  const now = Date.now();
  const expiresAt = now + ttlMs;
  memoryCache.set(key, { payload, expiresAt });
  if (!env.DB) return;
  await ensureCacheSchema(env);
  await env.DB.prepare(
    `INSERT INTO market_cache (cache_key, payload, updated_at, expires_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(cache_key) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at,
       expires_at = excluded.expires_at`,
  ).bind(key, JSON.stringify(payload), now, expiresAt).run();
}

async function cached<T>(env: MarketEnv, key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = await readCache<T>(env, key);
  if (existing && existing.expiresAt > Date.now()) return existing.payload;
  try {
    const payload = await loader();
    await writeCache(env, key, payload, ttlMs);
    return payload;
  } catch (error) {
    if (existing) return existing.payload;
    throw error;
  }
}

function rowsFromResponse(response: TushareResponse): Row[] {
  if (response.code !== 0) {
    throw new Error(response.msg || `TuShare request failed with code ${response.code}`);
  }
  const fields = response.data?.fields ?? [];
  return (response.data?.items ?? []).map((item) =>
    Object.fromEntries(fields.map((field, index) => [field, item[index] ?? null])),
  );
}

async function tushare(
  env: MarketEnv,
  apiName: string,
  params: Record<string, unknown>,
  fields: string,
  ttlMs = 30 * 60 * 1000,
): Promise<Row[]> {
  if (!env.TUSHARE_TOKEN) throw new Error("TUSHARE_TOKEN is not configured");
  const key = stableKey(apiName, params, fields);
  return cached(env, key, ttlMs, async () => {
    const response = await fetch(TUSHARE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_name: apiName, token: env.TUSHARE_TOKEN, params, fields }),
    });
    if (!response.ok) throw new Error(`TuShare HTTP ${response.status}`);
    return rowsFromResponse((await response.json()) as TushareResponse);
  });
}

async function stockBasics(env: MarketEnv): Promise<BasicStock[]> {
  const rows = await tushare(
    env,
    "stock_basic",
    { exchange: "", list_status: "L" },
    "ts_code,symbol,name,area,industry,market",
    24 * 60 * 60 * 1000,
  );
  return rows.map((row) => ({
    ts_code: String(row.ts_code ?? ""),
    symbol: String(row.symbol ?? ""),
    name: String(row.name ?? ""),
    area: String(row.area ?? ""),
    industry: String(row.industry ?? "未分类"),
    market: String(row.market ?? ""),
  }));
}

function sourceMeta(mode: SourceMode, tradeDate?: string, warning?: string): ApiMeta {
  return {
    mode,
    source: mode === "live" ? "TuShare Pro 正式数据" : "产品演示数据",
    updatedAt: new Date().toISOString(),
    tradeDate,
    warning,
  };
}

function demoMarket(warning?: string): { data: MarketSummary; meta: ApiMeta } {
  return {
    data: {
      tradeDate: "示例交易日",
      mood: "偏暖",
      moodNote: "多数股票上涨，但量能仍需继续观察",
      indices: [
        { code: "000001.SH", name: "上证指数", close: 3359.42, pct: 0.42 },
        { code: "399001.SZ", name: "深证成指", close: 10748.36, pct: 0.81 },
        { code: "399006.SZ", name: "创业板指", close: 2216.73, pct: 1.16 },
      ],
      breadth: { rises: 3268, falls: 1734, flats: 183, limitUps: 68 },
      amountYi: 11842,
      conclusion: "市场整体偏暖，成长方向表现更活跃，适合先看基本面再做选择。",
      positives: ["上涨公司明显多于下跌公司", "主要指数同步走强", "成交保持在较活跃区间"],
      cautions: ["部分热门方向涨幅较快", "单日上涨不代表趋势已经确认"],
    },
    meta: sourceMeta("demo", "示例交易日", warning),
  };
}

function marketAssessment(indices: IndexSummary[], dailyRows: Row[]): Omit<MarketSummary, "tradeDate" | "indices" | "amountYi"> {
  const rises = dailyRows.filter((row) => number(row.pct_chg) > 0).length;
  const falls = dailyRows.filter((row) => number(row.pct_chg) < 0).length;
  const flats = Math.max(0, dailyRows.length - rises - falls);
  const limitUps = dailyRows.filter((row) => number(row.pct_chg) >= 9.8).length;
  const riseRate = dailyRows.length ? rises / dailyRows.length : 0.5;
  const indexAverage = average(indices.map((item) => item.pct));
  const mood: MarketSummary["mood"] = riseRate >= 0.58 && indexAverage > 0
    ? "偏暖"
    : riseRate <= 0.42 && indexAverage < 0
      ? "偏谨慎"
      : "平稳";
  const moodNote = mood === "偏暖"
    ? "上涨公司较多，市场体感较好"
    : mood === "偏谨慎"
      ? "下跌公司较多，先控制节奏"
      : "多空较均衡，重点看公司本身";
  const positives: string[] = [];
  const cautions: string[] = [];
  if (riseRate >= 0.55) positives.push("上涨公司多于下跌公司");
  if (indexAverage >= 0.5) positives.push("主要指数整体走强");
  if (limitUps >= 50) positives.push("市场活跃度较高");
  if (riseRate < 0.5) cautions.push("下跌公司数量偏多");
  if (indexAverage < 0) cautions.push("主要指数仍有压力");
  cautions.push("单日行情不能替代长期基本面判断");
  if (!positives.length) positives.push("市场暂未出现明显失衡");
  return {
    mood,
    moodNote,
    breadth: { rises, falls, flats, limitUps },
    conclusion: mood === "偏暖"
      ? "市场整体偏暖，可以关注景气改善且财务稳健的公司。"
      : mood === "偏谨慎"
        ? "市场整体偏谨慎，优先关注现金流和负债更稳的公司。"
        : "市场较为平稳，行业与公司基本面比指数涨跌更重要。",
    positives: positives.slice(0, 3),
    cautions: cautions.slice(0, 3),
  };
}

async function liveMarket(env: MarketEnv): Promise<{ data: MarketSummary; meta: ApiMeta }> {
  const startDate = daysAgo(14);
  const endDate = compactDate(new Date());
  const indexDefinitions = [
    { code: "000001.SH", name: "上证指数" },
    { code: "399001.SZ", name: "深证成指" },
    { code: "399006.SZ", name: "创业板指" },
  ];
  const indexRows = await Promise.all(indexDefinitions.map((item) =>
    tushare(env, "index_daily", { ts_code: item.code, start_date: startDate, end_date: endDate }, "ts_code,trade_date,close,pct_chg"),
  ));
  const latestRows = indexRows.map((rows) => rows[0]).filter(Boolean);
  if (!latestRows.length) throw new Error("No recent index data returned");
  const tradeDate = String(latestRows[0].trade_date ?? "");
  const indices = indexDefinitions.map((item, index) => ({
    ...item,
    close: number(indexRows[index][0]?.close),
    pct: number(indexRows[index][0]?.pct_chg),
  }));
  const dailyRows = await tushare(
    env,
    "daily",
    { trade_date: tradeDate },
    "ts_code,trade_date,close,pre_close,pct_chg,amount",
  );
  const amountYi = round(dailyRows.reduce((sum, row) => sum + number(row.amount), 0) / 100000, 0);
  const assessment = marketAssessment(indices, dailyRows);
  return {
    data: { tradeDate: readableDate(tradeDate), indices, amountYi, ...assessment },
    meta: sourceMeta("live", readableDate(tradeDate)),
  };
}

function demoIndustries(warning?: string): { data: IndustrySummary[]; meta: ApiMeta } {
  const data: IndustrySummary[] = [
    { name: "创新药", pct: 2.34, advanceRate: 72, amountYi: 684, medianPe: 32.8, status: "较强", note: "上涨公司较多，资金关注度提升" },
    { name: "半导体", pct: 1.86, advanceRate: 68, amountYi: 1260, medianPe: 45.2, status: "较强", note: "景气预期改善，但估值不低" },
    { name: "家用电器", pct: 0.74, advanceRate: 61, amountYi: 326, medianPe: 14.1, status: "较强", note: "盈利较稳，估值处于温和区间" },
    { name: "银行", pct: 0.18, advanceRate: 54, amountYi: 418, medianPe: 6.7, status: "平稳", note: "波动较小，关注息差和资产质量" },
    { name: "电池", pct: -0.42, advanceRate: 44, amountYi: 822, medianPe: 24.9, status: "平稳", note: "需求仍在，价格竞争需要观察" },
    { name: "光伏设备", pct: -1.67, advanceRate: 28, amountYi: 574, medianPe: 19.6, status: "承压", note: "供需压力尚未完全缓解" },
  ];
  return { data, meta: sourceMeta("demo", "示例交易日", warning) };
}

async function liveIndustries(env: MarketEnv): Promise<{ data: IndustrySummary[]; meta: ApiMeta }> {
  const indexRows = await tushare(
    env,
    "index_daily",
    { ts_code: "000001.SH", start_date: daysAgo(14), end_date: compactDate(new Date()) },
    "trade_date,close,pct_chg",
  );
  const tradeDate = String(indexRows[0]?.trade_date ?? "");
  if (!tradeDate) throw new Error("No trade date available");
  try {
    const swRows = await tushare(
      env,
      "sw_daily",
      { trade_date: tradeDate },
      "ts_code,trade_date,name,pct_change,amount,pe,pb,mv",
    );
    if (swRows.length) {
      const data = swRows
        .map((row) => {
          const pct = round(number(row.pct_change));
          const status: IndustrySummary["status"] = pct >= 1 ? "较强" : pct <= -1 ? "承压" : "平稳";
          const pe = nullableNumber(row.pe);
          return {
            name: String(row.name ?? row.ts_code ?? "行业"),
            pct,
            advanceRate: null,
            amountYi: round(number(row.amount) / 100000, 0),
            medianPe: pe ? round(pe, 1) : null,
            status,
            note: status === "较强"
              ? `申万行业指数走强${pe && pe > 35 ? "，同时留意估值" : "，继续看盈利能否跟上"}`
              : status === "承压"
                ? "申万行业指数短期承压，先观察需求与价格变化"
                : "申万行业指数表现平稳，重点比较公司基本面",
          } satisfies IndustrySummary;
        })
        .sort((a, b) => b.amountYi - a.amountYi)
        .slice(0, 12);
      return { data, meta: sourceMeta("live", readableDate(tradeDate)) };
    }
  } catch {
    // Accounts without the SW industry entitlement fall back to a transparent
    // aggregation of the official stock_basic industry field below.
  }
  const [basics, dailyRows, basicRows] = await Promise.all([
    stockBasics(env),
    tushare(env, "daily", { trade_date: tradeDate }, "ts_code,pct_chg,amount"),
    tushare(env, "daily_basic", { trade_date: tradeDate }, "ts_code,pe,total_mv"),
  ]);
  const industryByCode = new Map(basics.map((stock) => [stock.ts_code, stock.industry || "未分类"]));
  const valuationByCode = new Map(basicRows.map((row) => [String(row.ts_code), number(row.pe)]));
  const groups = new Map<string, { pcts: number[]; amount: number; advances: number; count: number; pes: number[] }>();
  dailyRows.forEach((row) => {
    const industry = industryByCode.get(String(row.ts_code)) ?? "未分类";
    if (industry === "未分类") return;
    const group = groups.get(industry) ?? { pcts: [], amount: 0, advances: 0, count: 0, pes: [] };
    const pct = number(row.pct_chg);
    group.pcts.push(pct);
    group.amount += number(row.amount);
    group.advances += pct > 0 ? 1 : 0;
    group.count += 1;
    const pe = valuationByCode.get(String(row.ts_code));
    if (pe && pe > 0) group.pes.push(pe);
    groups.set(industry, group);
  });
  const data = [...groups.entries()]
    .filter(([, group]) => group.count >= 5)
    .map(([name, group]) => {
      const pct = round(average(group.pcts));
      const advanceRate = round((group.advances / group.count) * 100, 0);
      const status: IndustrySummary["status"] = pct >= 1 && advanceRate >= 58 ? "较强" : pct <= -1 && advanceRate <= 42 ? "承压" : "平稳";
      const pe = median(group.pes);
      const note = status === "较强"
        ? `上涨覆盖面较好${pe && pe > 35 ? "，但估值偏高" : "，可关注盈利持续性"}`
        : status === "承压"
          ? "行业短期承压，先观察需求和价格变化"
          : `行业表现较平稳${pe && pe < 18 ? "，估值相对温和" : "，重点看龙头公司"}`;
      return {
        name,
        pct,
        advanceRate,
        amountYi: round(group.amount / 100000, 0),
        medianPe: pe ? round(pe, 1) : null,
        status,
        note,
      };
    })
    .sort((a, b) => b.amountYi - a.amountYi)
    .slice(0, 12);
  return { data, meta: sourceMeta("live", readableDate(tradeDate)) };
}

function demoSearch(query: string): BasicStock[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return demoStocks.slice(0, 8);
  return demoStocks.filter((stock) =>
    stock.name.includes(query.trim()) || stock.symbol.includes(normalized) || stock.ts_code.toLowerCase().includes(normalized),
  ).slice(0, 8);
}

async function liveSearch(env: MarketEnv, query: string): Promise<BasicStock[]> {
  const normalized = query.trim().toLowerCase();
  const basics = await stockBasics(env);
  if (!normalized) return basics.slice(0, 8);
  return basics.filter((stock) =>
    stock.name.includes(query.trim()) || stock.symbol.includes(normalized) || stock.ts_code.toLowerCase().includes(normalized),
  ).slice(0, 8);
}

function buildDemoTrend(seed: number): Array<{ date: string; close: number }> {
  return Array.from({ length: 28 }, (_, index) => {
    const wave = Math.sin(index / 3.2) * seed * 0.024;
    const drift = (index - 14) * seed * 0.0015;
    return { date: `第${index + 1}日`, close: round(seed + wave + drift) };
  });
}

function demoCompany(query: string, warning?: string): { data: CompanySummary; meta: ApiMeta } {
  const stock = demoSearch(query)[0] ?? demoStocks[0];
  const seed = demoCompanySeed[stock.symbol] ?? { price: 32.6, pct: 0.28, pe: 18.2, roe: 13.6, growth: 7.8, debt: 48.2, margin: 32.4 };
  const isFinancial = /银行|保险|证券/.test(stock.industry);
  const sameIndustry = demoStocks.filter((item) => item.industry === stock.industry);
  const peerPool = sameIndustry.length >= 2 ? sameIndustry : demoStocks.slice(0, 4);
  const advantages = [
    seed.roe >= 15 ? `净资产收益率约 ${seed.roe}% ，盈利效率较好` : "核心业务具备一定市场基础",
    seed.growth >= 10 ? `收入增速约 ${seed.growth}% ，仍保持增长` : "经营表现相对平稳",
    isFinancial ? "行业地位和规模形成一定支撑" : seed.debt < 50 ? "资产负债率较温和，财务压力相对较小" : "行业地位和规模形成一定支撑",
  ];
  const risks = [
    seed.pe >= 30 ? `市盈率约 ${seed.pe} 倍，估值已经不低` : "行业需求变化可能影响短期表现",
    !isFinancial && seed.debt >= 65 ? `资产负债率约 ${seed.debt}% ，需要持续观察现金流` : isFinancial ? "金融企业需继续观察资产质量、净息差和资本充足率" : "单日股价波动不能代表长期趋势",
  ];
  const verdict: CompanySummary["verdict"] = seed.roe >= 15 && seed.growth >= 5 && (seed.pe > 0 && seed.pe < 35)
    ? "相对稳健"
    : seed.growth < 0 || seed.roe < 0
      ? "需要谨慎"
      : "中性观察";
  const peers = peerPool.slice(0, 5).map((item, index) => {
    const itemSeed = demoCompanySeed[item.symbol] ?? seed;
    return {
      code: item.symbol,
      name: item.name,
      price: itemSeed.price,
      pct: itemSeed.pct,
      pe: itemSeed.pe || null,
      roe: itemSeed.roe,
      revenueGrowth: itemSeed.growth,
      marketCapYi: round((itemSeed.price * (800 + index * 220)), 0),
    };
  });
  return {
    data: {
      code: stock.symbol,
      tsCode: stock.ts_code,
      name: stock.name,
      industry: stock.industry,
      area: stock.area,
      price: seed.price,
      pct: seed.pct,
      verdict,
      verdictNote: verdict === "相对稳健" ? "盈利和增长较均衡，但仍要留意估值与行业变化" : verdict === "需要谨慎" ? "基本面存在压力，先等改善信号更清楚" : "优点和风险并存，适合继续观察关键指标",
      metrics: [
        { label: "市盈率", value: seed.pe > 0 ? `${seed.pe} 倍` : "亏损", hint: "市场为盈利支付的价格", tone: seed.pe > 0 && seed.pe < 25 ? "good" : seed.pe >= 40 || seed.pe <= 0 ? "risk" : "plain" },
        { label: "净资产收益率", value: `${seed.roe}%`, hint: "公司使用股东资金的效率", tone: seed.roe >= 15 ? "good" : seed.roe < 6 ? "risk" : "plain" },
        { label: "收入增速", value: `${seed.growth}%`, hint: "主营收入相比上年变化", tone: seed.growth >= 10 ? "good" : seed.growth < 0 ? "risk" : "plain" },
        { label: isFinancial ? "金融杠杆" : "资产负债率", value: `${seed.debt}%`, hint: isFinancial ? "金融行业需结合资本充足率和资产质量" : "公司有多少资产来自负债", tone: isFinancial ? "plain" : seed.debt < 50 ? "good" : seed.debt > 70 ? "risk" : "plain" },
        { label: "毛利率", value: seed.margin ? `${seed.margin}%` : "行业口径不同", hint: "产品销售后的基础盈利空间", tone: seed.margin >= 35 ? "good" : seed.margin > 0 && seed.margin < 15 ? "risk" : "plain" },
      ],
      trend: buildDemoTrend(seed.price),
      advantages: advantages.slice(0, 3),
      risks: risks.slice(0, 3),
      watch: ["下一期财报中的收入和利润增速", "经营现金流是否与利润同步", `${stock.industry}行业的需求、价格与政策变化`],
      peers,
    },
    meta: sourceMeta("demo", "示例交易日", warning),
  };
}

function latestByDate(rows: Row[], dateField: string): Row | undefined {
  return [...rows].sort((a, b) => String(b[dateField] ?? "").localeCompare(String(a[dateField] ?? "")))[0];
}

function buildCompanyAssessment(
  stock: BasicStock,
  dailyRows: Row[],
  basicRow: Row | undefined,
  financialRow: Row | undefined,
  peers: CompanySummary["peers"],
): CompanySummary {
  const isFinancial = /银行|保险|证券/.test(stock.industry);
  const latestDaily = latestByDate(dailyRows, "trade_date") ?? {};
  const latestClose = number(latestDaily.close);
  const pe = nullableNumber(basicRow?.pe_ttm ?? basicRow?.pe);
  const pb = nullableNumber(basicRow?.pb);
  const roe = nullableNumber(financialRow?.roe);
  const grossMargin = nullableNumber(financialRow?.grossprofit_margin);
  const netMargin = nullableNumber(financialRow?.netprofit_margin);
  const debt = nullableNumber(financialRow?.debt_to_assets);
  const revenueGrowth = nullableNumber(financialRow?.or_yoy);
  const profitGrowth = nullableNumber(financialRow?.netprofit_yoy);
  const industryPes = peers.map((item) => item.pe ?? 0).filter((value) => value > 0);
  const industryMedianPe = median(industryPes);
  const advantages: string[] = [];
  const risks: string[] = [];
  if (roe !== null && roe >= 15) advantages.push(`净资产收益率 ${round(roe, 1)}%，盈利效率较好`);
  if (revenueGrowth !== null && revenueGrowth >= 10) advantages.push(`收入同比增长 ${round(revenueGrowth, 1)}%，业务仍有增长`);
  if (!isFinancial && debt !== null && debt < 50) advantages.push(`资产负债率 ${round(debt, 1)}%，财务压力相对温和`);
  if (pe !== null && industryMedianPe !== null && pe > 0 && pe < industryMedianPe * 0.9) advantages.push(`估值低于同业中位数 ${round(industryMedianPe, 1)} 倍`);
  if (profitGrowth !== null && profitGrowth < 0) risks.push(`净利润同比变化 ${round(profitGrowth, 1)}%，盈利承压`);
  if (revenueGrowth !== null && revenueGrowth < 0) risks.push(`收入同比变化 ${round(revenueGrowth, 1)}%，需求需要观察`);
  if (!isFinancial && debt !== null && debt > 70) risks.push(`资产负债率 ${round(debt, 1)}%，需要关注现金流和偿债能力`);
  if (isFinancial) risks.push("金融企业需要结合资产质量、资本充足率和净息差单独判断");
  if (pe !== null && industryMedianPe !== null && pe > industryMedianPe * 1.3) risks.push(`估值高于同业中位数 ${round(industryMedianPe, 1)} 倍`);
  if (pe !== null && pe <= 0) risks.push("公司当前为亏损口径，市盈率不适用");
  if (!advantages.length) advantages.push("公司具备持续经营基础，仍需结合后续财报确认改善");
  if (!risks.length) risks.push("行业景气和市场情绪变化仍可能带来股价波动");
  let score = 0;
  if (roe !== null) score += roe >= 15 ? 2 : roe < 6 ? -2 : 0;
  if (revenueGrowth !== null) score += revenueGrowth >= 10 ? 1 : revenueGrowth < 0 ? -1 : 0;
  if (profitGrowth !== null) score += profitGrowth >= 10 ? 1 : profitGrowth < 0 ? -2 : 0;
  if (!isFinancial && debt !== null) score += debt < 50 ? 1 : debt > 70 ? -1 : 0;
  if (pe !== null && industryMedianPe !== null && pe > 0) score += pe < industryMedianPe ? 1 : pe > industryMedianPe * 1.35 ? -1 : 0;
  const verdict: CompanySummary["verdict"] = score >= 3 ? "相对稳健" : score <= -2 ? "需要谨慎" : "中性观察";
  return {
    code: stock.symbol,
    tsCode: stock.ts_code,
    name: stock.name,
    industry: stock.industry,
    area: stock.area,
    price: latestClose,
    pct: number(latestDaily.pct_chg),
    verdict,
    verdictNote: verdict === "相对稳健" ? "盈利、增长或估值中有多项表现较好，但仍需跟踪最新财报" : verdict === "需要谨慎" ? "当前存在较明显的经营或估值压力，先观察改善信号" : "优势与风险大致均衡，适合继续观察关键指标",
    metrics: [
      { label: "市盈率", value: pe !== null && pe > 0 ? `${round(pe, 1)} 倍` : "不适用", hint: industryMedianPe ? `同业中位数约 ${round(industryMedianPe, 1)} 倍` : "市场为盈利支付的价格", tone: pe !== null && industryMedianPe !== null && pe > 0 && pe < industryMedianPe ? "good" : pe !== null && (pe <= 0 || (industryMedianPe !== null && pe > industryMedianPe * 1.35)) ? "risk" : "plain" },
      { label: "市净率", value: pb !== null ? `${round(pb, 2)} 倍` : "暂无", hint: "股价与每股净资产的关系", tone: "plain" },
      { label: "净资产收益率", value: roe !== null ? `${round(roe, 1)}%` : "暂无", hint: "使用股东资金的效率", tone: roe !== null && roe >= 15 ? "good" : roe !== null && roe < 6 ? "risk" : "plain" },
      { label: "收入增速", value: revenueGrowth !== null ? `${round(revenueGrowth, 1)}%` : "暂无", hint: "营业收入同比变化", tone: revenueGrowth !== null && revenueGrowth >= 10 ? "good" : revenueGrowth !== null && revenueGrowth < 0 ? "risk" : "plain" },
      { label: "利润增速", value: profitGrowth !== null ? `${round(profitGrowth, 1)}%` : "暂无", hint: "净利润同比变化", tone: profitGrowth !== null && profitGrowth >= 10 ? "good" : profitGrowth !== null && profitGrowth < 0 ? "risk" : "plain" },
      { label: isFinancial ? "金融杠杆" : "资产负债率", value: debt !== null ? `${round(debt, 1)}%` : "暂无", hint: isFinancial ? "需结合资本充足率和资产质量" : "资产中来自负债的比例", tone: isFinancial ? "plain" : debt !== null && debt < 50 ? "good" : debt !== null && debt > 70 ? "risk" : "plain" },
      { label: "毛利率", value: grossMargin !== null ? `${round(grossMargin, 1)}%` : "暂无", hint: netMargin !== null ? `净利率约 ${round(netMargin, 1)}%` : "产品的基础盈利空间", tone: grossMargin !== null && grossMargin >= 35 ? "good" : grossMargin !== null && grossMargin < 15 ? "risk" : "plain" },
    ],
    trend: [...dailyRows]
      .sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)))
      .slice(-42)
      .map((row) => ({ date: readableDate(String(row.trade_date ?? "")), close: number(row.close) })),
    advantages: advantages.slice(0, 3),
    risks: risks.slice(0, 3),
    watch: ["下一期财报的收入和利润增速", "经营现金流能否与利润同步", `${stock.industry}行业的需求、价格和政策变化`],
    peers,
  };
}

async function liveCompany(env: MarketEnv, query: string): Promise<{ data: CompanySummary; meta: ApiMeta }> {
  const basics = await stockBasics(env);
  const normalized = query.trim().toLowerCase();
  const stock = basics.find((item) => item.ts_code.toLowerCase() === normalized || item.symbol === normalized || item.name === query.trim())
    ?? basics.find((item) => item.name.includes(query.trim()) || item.symbol.includes(normalized));
  if (!stock) throw new Error("没有找到这家公司，请检查名称或股票代码");
  const endDate = compactDate(new Date());
  const startDate = daysAgo(240);
  const financialStart = daysAgo(900);
  const [dailyRows, basicRows, financialRows] = await Promise.all([
    tushare(env, "daily", { ts_code: stock.ts_code, start_date: startDate, end_date: endDate }, "ts_code,trade_date,close,pct_chg"),
    tushare(env, "daily_basic", { ts_code: stock.ts_code, start_date: startDate, end_date: endDate }, "ts_code,trade_date,close,pe,pe_ttm,pb,total_mv"),
    tushare(env, "fina_indicator", { ts_code: stock.ts_code, start_date: financialStart, end_date: endDate }, "ts_code,ann_date,end_date,roe,grossprofit_margin,netprofit_margin,debt_to_assets,or_yoy,netprofit_yoy"),
  ]);
  const latestDaily = latestByDate(dailyRows, "trade_date");
  const tradeDate = String(latestDaily?.trade_date ?? "");
  let analysisStock = stock;
  let officialPeerCodes: string[] | null = null;
  try {
    const memberships = await tushare(
      env,
      "index_member_all",
      { ts_code: stock.ts_code, is_new: "Y" },
      "l1_code,l1_name,l2_code,l2_name,l3_code,l3_name,ts_code,name,in_date,out_date,is_new",
      24 * 60 * 60 * 1000,
    );
    const membership = memberships[0];
    const l3Code = String(membership?.l3_code ?? "");
    const l3Name = String(membership?.l3_name ?? "");
    if (l3Code) {
      const members = await tushare(
        env,
        "index_member_all",
        { l3_code: l3Code, is_new: "Y" },
        "l3_code,l3_name,ts_code,name,is_new",
        24 * 60 * 60 * 1000,
      );
      officialPeerCodes = members.map((row) => String(row.ts_code ?? "")).filter(Boolean);
      if (l3Name) analysisStock = { ...stock, industry: l3Name };
    }
  } catch {
    // Lower-tier accounts may not expose the complete SW membership table.
    // The basic provider industry remains a useful, clearly sourced fallback.
  }
  const allMarketBasic = tradeDate
    ? await tushare(env, "daily_basic", { trade_date: tradeDate }, "ts_code,trade_date,close,pe_ttm,pe,total_mv")
    : [];
  const marketBasicMap = new Map(allMarketBasic.map((row) => [String(row.ts_code), row]));
  const peerStocks = basics
    .filter((item) => officialPeerCodes ? officialPeerCodes.includes(item.ts_code) : item.industry === stock.industry)
    .map((item) => ({ stock: item, basic: marketBasicMap.get(item.ts_code) }))
    .sort((a, b) => number(b.basic?.total_mv) - number(a.basic?.total_mv))
    .slice(0, 6);
  const peers: CompanySummary["peers"] = peerStocks.map(({ stock: peer, basic }) => ({
    code: peer.symbol,
    name: peer.name,
    price: number(basic?.close),
    pct: 0,
    pe: nullableNumber(basic?.pe_ttm ?? basic?.pe),
    roe: peer.ts_code === stock.ts_code ? nullableNumber(latestByDate(financialRows, "end_date")?.roe) : null,
    revenueGrowth: peer.ts_code === stock.ts_code ? nullableNumber(latestByDate(financialRows, "end_date")?.or_yoy) : null,
    marketCapYi: basic ? round(number(basic.total_mv) / 10000, 0) : null,
  }));
  const latestBasic = latestByDate(basicRows, "trade_date");
  const latestFinancial = latestByDate(financialRows, "end_date");
  return {
    data: buildCompanyAssessment(analysisStock, dailyRows, latestBasic, latestFinancial, peers),
    meta: sourceMeta("live", readableDate(tradeDate)),
  };
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "正式数据暂时不可用";
  if (message.includes("token") || message.includes("TOKEN")) return "正式数据密钥尚未配置，当前展示演示数据";
  if (message.length > 100) return "正式数据服务暂时不可用，当前展示演示数据";
  return `正式数据暂时不可用：${message}`;
}

export async function handleMarketApi(request: Request, env: MarketEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  try {
    if (url.pathname === "/api/market") {
      if (!env.TUSHARE_TOKEN) return json(demoMarket("正式数据密钥尚未配置，当前展示演示数据"));
      try {
        return json(await liveMarket(env));
      } catch (error) {
        return json(demoMarket(safeMessage(error)));
      }
    }
    if (url.pathname === "/api/industries") {
      if (!env.TUSHARE_TOKEN) return json(demoIndustries("正式数据密钥尚未配置，当前展示演示数据"));
      try {
        return json(await liveIndustries(env));
      } catch (error) {
        return json(demoIndustries(safeMessage(error)));
      }
    }
    if (url.pathname === "/api/search") {
      const query = url.searchParams.get("q") ?? "";
      if (!env.TUSHARE_TOKEN) return json({ data: demoSearch(query), meta: sourceMeta("demo", "示例交易日", "正式数据密钥尚未配置") });
      try {
        return json({ data: await liveSearch(env, query), meta: sourceMeta("live") });
      } catch (error) {
        return json({ data: demoSearch(query), meta: sourceMeta("demo", "示例交易日", safeMessage(error)) });
      }
    }
    if (url.pathname === "/api/company") {
      const query = url.searchParams.get("q")?.trim() || "600519";
      if (!env.TUSHARE_TOKEN) return json(demoCompany(query, "正式数据密钥尚未配置，当前展示演示数据"));
      try {
        return json(await liveCompany(env, query));
      } catch (error) {
        const fallback = demoSearch(query)[0];
        if (fallback) return json(demoCompany(query, safeMessage(error)));
        return json({ error: error instanceof Error ? error.message : "没有找到这家公司" }, 404);
      }
    }
    if (url.pathname === "/api/health") {
      return json({ ok: true, provider: env.TUSHARE_TOKEN ? "tushare" : "demo", cache: env.DB ? "d1" : "memory" });
    }
    return json({ error: "接口不存在" }, 404);
  } catch {
    return json({ error: "数据服务暂时不可用，请稍后再试" }, 500);
  }
}

export async function refreshFormalMarketData(env: MarketEnv): Promise<void> {
  if (!env.TUSHARE_TOKEN) return;
  await Promise.all([liveMarket(env), liveIndustries(env), stockBasics(env)]);
}
