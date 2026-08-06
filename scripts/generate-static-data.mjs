import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(new URL("../public/data/", import.meta.url));

const indicators = [
  { id: "cn-gdp", countryCode: "CHN", country: "中国", indicator: "NY.GDP.MKTP.KD.ZG", name: "GDP 增速", unit: "%" },
  { id: "cn-inflation", countryCode: "CHN", country: "中国", indicator: "FP.CPI.TOTL.ZG", name: "居民价格涨幅", unit: "%" },
  { id: "cn-manufacturing", countryCode: "CHN", country: "中国", indicator: "NV.IND.MANF.ZS", name: "制造业占 GDP", unit: "%" },
  { id: "us-gdp", countryCode: "USA", country: "美国", indicator: "NY.GDP.MKTP.KD.ZG", name: "GDP 增速", unit: "%" },
];

const industryPairs = [
  { id: "consumer", name: "消费", cn: { label: "A股消费ETF", symbol: "sz159928" }, us: { label: "美股消费必需品XLP", symbol: "usXLP" } },
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
  const symbols = industryPairs.flatMap((pair) => [pair.cn.symbol, pair.us.symbol]);
  const response = await fetch(`https://qt.gtimg.cn/q=${symbols.join(",")}`, {
    headers: { accept: "text/plain,*/*" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Tencent quote HTTP ${response.status}`);
  const quotes = parseQuotes(new TextDecoder().decode(await response.arrayBuffer()));
  const data = industryPairs.map((pair) => {
    const cn = quotes.get(pair.cn.symbol);
    const us = quotes.get(pair.us.symbol);
    if (!cn || !us) throw new Error(`Missing quote for ${pair.id}`);
    const cnSession = cn.asOf.slice(11, 16) >= "15:00" ? "收盘" : "盘中";
    const usSession = "最近收盘";
    return {
      id: pair.id,
      name: pair.name,
      summary: `${pair.cn.label}${cnSession}${movement(cn.changePct)}，${pair.us.label}${usSession}${movement(us.changePct)}；${comparison(cn.changePct, us.changePct)}`,
      cn: { ...pair.cn, ...cn, session: cnSession },
      us: { ...pair.us, ...us, session: usSession },
    };
  });
  return { data, source: "腾讯行情", updatedAt: new Date().toISOString() };
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
await Promise.all([
  writeWithFallback("macro.json", async () => ({ data: await Promise.all(indicators.map(latestObservation)), source: "World Bank", updatedAt: new Date().toISOString() })),
  writeWithFallback("industry-pulse.json", loadIndustryPulse),
  writeWithFallback("market.json", loadMarketOverview),
]);
