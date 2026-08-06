import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(new URL("../public/data/", import.meta.url));
const historyDirectory = fileURLToPath(new URL("../public/data/history/", import.meta.url));
const companionSource = fileURLToPath(new URL("../app/MarketCompanion.tsx", import.meta.url));

const indicators = [
  { id: "cn-gdp", countryCode: "CHN", country: "中国", indicator: "NY.GDP.MKTP.KD.ZG", name: "GDP 增速", unit: "%" },
  { id: "cn-inflation", countryCode: "CHN", country: "中国", indicator: "FP.CPI.TOTL.ZG", name: "居民价格涨幅", unit: "%" },
  { id: "cn-manufacturing", countryCode: "CHN", country: "中国", indicator: "NV.IND.MANF.ZS", name: "制造业占 GDP", unit: "%" },
  { id: "us-gdp", countryCode: "USA", country: "美国", indicator: "NY.GDP.MKTP.KD.ZG", name: "GDP 增速", unit: "%" },
];

const industryPairs = [
  { id: "consumer", name: "消费", cn: { label: "A股消费ETF", symbol: "sz159928" }, us: { label: "美股消费必需品XLP", symbol: "usXLP" }, companies: [["贵州茅台", "sh600519"], ["伊利股份", "sh600887"], ["东鹏饮料", "sh605499"]] },
  { id: "bank", name: "银行", cn: { label: "A股银行ETF", symbol: "sh512800" }, us: { label: "美股银行KBE", symbol: "usKBE" } },
  { id: "brokerage", name: "券商", cn: { label: "A股券商ETF", symbol: "sh512880" }, us: { label: "美股券商IAI", symbol: "usIAI" } },
  { id: "chips", name: "半导体", cn: { label: "A股半导体ETF", symbol: "sh512480" }, us: { label: "美股半导体SOXX", symbol: "usSOXX" } },
  { id: "ai", name: "人工智能", cn: { label: "A股人工智能ETF", symbol: "sz159819" }, us: { label: "美股人工智能AIQ", symbol: "usAIQ" } },
  { id: "communication", name: "通信", cn: { label: "A股通信ETF", symbol: "sh515880" }, us: { label: "美股通信XTL", symbol: "usXTL" } },
  { id: "new-energy", name: "新能源车", cn: { label: "A股新能源车ETF", symbol: "sh515030" }, us: { label: "美股新能源车DRIV", symbol: "usDRIV" } },
  { id: "solar", name: "光伏", cn: { label: "A股光伏ETF", symbol: "sh515790" }, us: { label: "美股光伏TAN", symbol: "usTAN" } },
  { id: "healthcare", name: "医药", cn: { label: "A股医药ETF", symbol: "sh512010" }, us: { label: "美股医疗XLV", symbol: "usXLV" } },
  { id: "home", name: "家电", cn: { label: "A股家电ETF", symbol: "sz159996" }, us: { label: "美股可选消费XLY", symbol: "usXLY" } },
  { id: "defense", name: "军工", cn: { label: "A股军工ETF", symbol: "sh512660" }, us: { label: "美股航空国防ITA", symbol: "usITA" } },
  { id: "power", name: "电力", cn: { label: "A股电力ETF", symbol: "sz159611" }, us: { label: "美股公用事业XLU", symbol: "usXLU" } },
  { id: "coal", name: "煤炭", cn: { label: "A股煤炭ETF", symbol: "sh515220" }, us: { label: "美股能源XLE", symbol: "usXLE" } },
  { id: "metals", name: "有色金属", cn: { label: "A股有色ETF", symbol: "sh512400" }, us: { label: "美股金属矿业XME", symbol: "usXME" } },
  { id: "chemical", name: "化工", cn: { label: "A股化工ETF", symbol: "sh516020" }, us: { label: "美股材料XLB", symbol: "usXLB" } },
];

const industryCompanyFallbacks = {
  bank: [["工商银行", "sh601398"], ["招商银行", "sh600036"], ["江苏银行", "sh600919"]],
  brokerage: [["中信证券", "sh600030"], ["东方财富", "sz300059"], ["国泰海通", "sh601211"]],
  chips: [["中芯国际", "sh688981"], ["北方华创", "sz002371"], ["寒武纪", "sh688256"]],
  ai: [["科大讯飞", "sz002230"], ["金山办公", "sh688111"], ["寒武纪", "sh688256"]],
  communication: [["中兴通讯", "sz000063"], ["中际旭创", "sz300308"], ["新易盛", "sz300502"]],
  "new-energy": [["宁德时代", "sz300750"], ["比亚迪", "sz002594"], ["赛力斯", "sh601127"]],
  solar: [["隆基绿能", "sh601012"], ["阳光电源", "sz300274"], ["晶科能源", "sh688223"]],
  healthcare: [["恒瑞医药", "sh600276"], ["迈瑞医疗", "sz300760"], ["百济神州", "sh688235"]],
  home: [["美的集团", "sz000333"], ["海尔智家", "sh600690"], ["石头科技", "sh688169"]],
  defense: [["中国船舶", "sh600150"], ["中航沈飞", "sh600760"], ["中航成飞", "sz302132"]],
  power: [["长江电力", "sh600900"], ["中国核电", "sh601985"], ["华电新能", "sh600930"]],
  coal: [["中国神华", "sh601088"], ["陕西煤业", "sh601225"], ["新集能源", "sh601918"]],
  metals: [["紫金矿业", "sh601899"], ["洛阳钼业", "sh603993"], ["北方稀土", "sh600111"]],
  chemical: [["万华化学", "sh600309"], ["巨化股份", "sh600160"], ["卫星化学", "sz002648"]],
};

for (const pair of industryPairs) pair.companies ??= industryCompanyFallbacks[pair.id] ?? [];

const marketIndices = [
  { name: "上证指数", code: "000001", symbol: "sh000001" },
  { name: "深证成指", code: "399001", symbol: "sz399001" },
  { name: "创业板指", code: "399006", symbol: "sz399006" },
  { name: "沪深300", code: "000300", symbol: "sh000300" },
];

async function latestObservation(config) {
  const currentYear = new Date().getUTCFullYear();
  const url = new URL(`https://api.worldbank.org/v2/country/${config.countryCode}/indicator/${config.indicator}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("date", `${currentYear - 8}:${currentYear}`);

  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`World Bank HTTP ${response.status}`);
  const payload = await response.json();
  const row = payload[1]?.find((item) => typeof item.value === "number" && Number.isFinite(item.value));
  if (!row) throw new Error(`No World Bank observation for ${config.id}`);
  return { id: config.id, name: config.name, country: config.country, value: row.value, year: String(row.date ?? ""), unit: config.unit };
}

function cleanQuoteDate(value) {
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]} ${compact[4]}:${compact[5]}`;
  return value.slice(0, 16);
}

function parseQuotes(body) {
  const quotes = new Map();
  for (const match of body.matchAll(/v_([^=]+)="([^"]*)"/g)) {
    const fields = match[2].split("~");
    const current = Number(fields[3]);
    const previous = Number(fields[4]);
    const reportedChange = Number(fields[32]);
    const changePct = Number.isFinite(reportedChange)
      ? reportedChange
      : previous > 0 && Number.isFinite(current) ? ((current - previous) / previous) * 100 : Number.NaN;
    const asOf = cleanQuoteDate(fields[30] ?? "");
    const change = Number(fields[31]);
    if (Number.isFinite(changePct) && asOf) {
      quotes.set(match[1], {
        marketSymbol: fields[2] ?? "",
        current,
        previous,
        change: Number.isFinite(change) ? change : current - previous,
        changePct,
        asOf,
      });
    }
  }
  return quotes;
}

function dateStamp(date) {
  return date.toISOString().slice(0, 10);
}

function historyFilename(symbol) {
  return `${symbol.replace(":", "-")}.json`;
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function loadQuoteSymbols(symbols) {
  const result = new Map();
  for (let offset = 0; offset < symbols.length; offset += 40) {
    const batch = symbols.slice(offset, offset + 40);
    const response = await fetch(`https://qt.gtimg.cn/q=${batch.join(",")}`, {
      headers: { accept: "text/plain,*/*" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Tencent quote HTTP ${response.status}`);
    for (const [key, quote] of parseQuotes(new TextDecoder().decode(await response.arrayBuffer()))) result.set(key, quote);
  }
  return result;
}

async function loadHistories() {
  const source = await readFile(companionSource, "utf8");
  const symbols = [...new Set(source.match(/(?:SSE|SZSE|NASDAQ|NYSE|AMEX):[A-Z0-9.-]+/g) ?? [])];
  const usSymbols = symbols.filter((symbol) => !symbol.startsWith("SSE:") && !symbol.startsWith("SZSE:"));
  const usQuoteKeys = usSymbols.map((symbol) => `us${symbol.split(":")[1]}`);
  const usQuotes = await loadQuoteSymbols(usQuoteKeys);
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 190);
  let cursor = 0;
  let written = 0;

  async function worker() {
    while (cursor < symbols.length) {
      const symbol = symbols[cursor++];
      const [exchange, code] = symbol.split(":");
      const quoteKey = exchange === "SSE" ? `sh${code}` : exchange === "SZSE" ? `sz${code}` : `us${code}`;
      const marketSymbol = usQuotes.get(quoteKey)?.marketSymbol;
      const historyKey = exchange === "SSE" || exchange === "SZSE" ? quoteKey : marketSymbol ? `us${marketSymbol}` : "";
      if (!historyKey) continue;
      const dates = historyKey.startsWith("us") ? `${dateStamp(start)},${dateStamp(end)}` : ",";
      const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${historyKey},day,${dates},90,qfq`;
      try {
        const payload = await fetchJson(url);
        const rows = payload.data?.[historyKey]?.qfqday ?? payload.data?.[historyKey]?.day ?? [];
        const points = rows.map((row) => ({ date: row[0], close: Number(row[2]) })).filter((point) => point.date && Number.isFinite(point.close));
        if (points.length < 2) throw new Error("not enough history");
        await writeFile(`${historyDirectory}/${historyFilename(symbol)}`, `${JSON.stringify({ symbol, points, source: "腾讯行情", updatedAt: new Date().toISOString() })}\n`, "utf8");
        written += 1;
      } catch (error) {
        try {
          await readFile(`${historyDirectory}/${historyFilename(symbol)}`, "utf8");
        } catch {
          console.warn(`Skipped history ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: 10 }, worker));
  console.log(`Updated ${written}/${symbols.length} trend files`);
}

async function loadMarketOverview() {
  const response = await fetch(`https://qt.gtimg.cn/q=${marketIndices.map((item) => item.symbol).join(",")}`, {
    headers: { accept: "text/plain,*/*" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Tencent quote HTTP ${response.status}`);
  const quotes = parseQuotes(new TextDecoder().decode(await response.arrayBuffer()));
  const data = marketIndices.map((item) => {
    const quote = quotes.get(item.symbol);
    if (!quote || !Number.isFinite(quote.current)) throw new Error(`Missing quote for ${item.symbol}`);
    return { ...item, ...quote };
  });
  const latest = data.map((item) => item.asOf).sort().at(-1) ?? "";
  const session = latest.slice(11, 16) >= "15:00" ? "收盘" : "盘中";
  return { data, source: "腾讯行情", session, updatedAt: new Date().toISOString() };
}

function movement(value) {
  if (value > 0.1) return `上涨${Math.abs(value).toFixed(1)}%`;
  if (value < -0.1) return `下跌${Math.abs(value).toFixed(1)}%`;
  return "基本持平";
}

function direction(value) {
  if (value > 0.1) return 1;
  if (value < -0.1) return -1;
  return 0;
}

function comparison(cn, us) {
  const cnDirection = direction(cn);
  const usDirection = direction(us);
  const spread = Math.abs(cn - us);
  if (cnDirection === 0 && usDirection === 0) return "两边变化都不大，强弱接近。";
  if (cnDirection === usDirection) {
    if (spread < 0.5) return `两边${cnDirection > 0 ? "同向走强" : "同向回落"}，幅度接近。`;
    if (cnDirection > 0) return `两边同向走强，${cn >= us ? "A股" : "美股"}涨幅更大。`;
    return `两边同向回落，${cn >= us ? "A股" : "美股"}相对抗跌。`;
  }
  const stronger = cn >= us ? "A股" : "美股";
  if (cnDirection !== 0 && usDirection !== 0) return `两边走势分化，${stronger}相对更强。`;
  return `一边平稳、一边波动，${stronger}相对更强。`;
}

async function loadIndustryPulse() {
  const symbols = [...new Set(industryPairs.flatMap((pair) => [pair.cn.symbol, pair.us.symbol, ...pair.companies.map((company) => company[1])]))];
  const response = await fetch(`https://qt.gtimg.cn/q=${symbols.join(",")}`, {
    headers: { accept: "text/plain,*/*" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Tencent quote HTTP ${response.status}`);
  const quotes = parseQuotes(new TextDecoder().decode(await response.arrayBuffer()));
  let data = industryPairs.map((pair) => {
    const cn = quotes.get(pair.cn.symbol);
    const us = quotes.get(pair.us.symbol);
    if (!cn || !us) throw new Error(`Missing quote for ${pair.id}`);
    const cnSession = cn.asOf.slice(11, 16) >= "15:00" ? "收盘" : "盘中";
    const usSession = "最近收盘";
    return {
      id: pair.id,
      name: pair.name,
      summary: `${pair.cn.label}${cnSession}${movement(cn.changePct)}，${pair.us.label}${usSession}${movement(us.changePct)}；${comparison(cn.changePct, us.changePct)}`,
      companies: pair.companies.map(([name, symbol]) => ({ name, symbol, changePct: quotes.get(symbol)?.changePct ?? null })),
      cn: { ...pair.cn, ...cn, session: cnSession },
      us: { ...pair.us, ...us, session: usSession },
    };
  });
  const prior = await readFile(`${outputDirectory}/industry-pulse.json`, "utf8").then(JSON.parse).catch(() => ({ data: [] }));
  const priorMap = new Map((prior.data ?? []).map((item) => [item.id, item]));
  data = data.map((item) => ({ ...item, aiSummary: priorMap.get(item.id)?.aiSummary, aiUpdatedAt: priorMap.get(item.id)?.aiUpdatedAt }));

  if (process.env.GEMINI_API_KEY) {
    try {
      const promptData = data.map((item) => ({
        id: item.id,
        industry: item.name,
        aShareChangePct: item.cn.changePct,
        usReferenceChangePct: item.us.changePct,
        companies: item.companies.map((company) => ({ name: company.name, changePct: company.changePct })),
      }));
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `你是家庭投资信息工具的数据归纳员。只允许依据给出的上一交易日涨跌数据，不得补充新闻、财务、估值或预测。为每个行业写一句45到90字的中文归纳，必须提及A股行业、至少一家给定企业及美股参考的相对表现；语气客观，不使用买入、卖出、推荐、看多、看空。输出JSON数组，每项仅含id和summary。数据：${JSON.stringify(promptData)}` }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      });
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const payload = await response.json();
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      const generated = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
      const generatedMap = new Map(generated.filter((item) => typeof item.id === "string" && typeof item.summary === "string").map((item) => [item.id, item.summary.slice(0, 180)]));
      const aiUpdatedAt = new Date().toISOString();
      data = data.map((item) => generatedMap.has(item.id) ? { ...item, aiSummary: generatedMap.get(item.id), aiUpdatedAt } : item);
    } catch (error) {
      console.warn(`Kept prior Gemini summaries: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { data, source: "腾讯行情", aiModel: "Gemini 3.6 Flash", updatedAt: new Date().toISOString() };
}

async function writeWithFallback(filename, loader) {
  const path = `${outputDirectory}/${filename}`;
  try {
    const payload = await loader();
    await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Updated ${filename}`);
  } catch (error) {
    await readFile(path, "utf8");
    console.warn(`Kept existing ${filename}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(historyDirectory, { recursive: true });
await Promise.all([
  writeWithFallback("macro.json", async () => ({ data: await Promise.all(indicators.map(latestObservation)), source: "World Bank", updatedAt: new Date().toISOString() })),
  writeWithFallback("industry-pulse.json", loadIndustryPulse),
  writeWithFallback("market.json", loadMarketOverview),
  loadHistories(),
]);
