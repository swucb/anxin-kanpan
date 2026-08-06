type QuoteSide = {
  label: string;
  symbol: string;
};

type IndustryPair = {
  id: string;
  name: string;
  cn: QuoteSide;
  us: QuoteSide;
};

type ParsedQuote = {
  changePct: number;
  asOf: string;
  session: "盘中" | "收盘" | "最近收盘";
};

type IndustryPulse = {
  id: string;
  name: string;
  summary: string;
  cn: QuoteSide & ParsedQuote;
  us: QuoteSide & ParsedQuote;
};

const industryPairs: IndustryPair[] = [
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

let memoryCache: { data: IndustryPulse[]; updatedAt: string; expiresAt: number } | null = null;

function cleanQuoteDate(value: string): string {
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]} ${compact[4]}:${compact[5]}`;
  return value.slice(0, 16);
}

function parseQuotes(body: string): Map<string, Omit<ParsedQuote, "session">> {
  const quotes = new Map<string, ParsedQuote>();
  for (const match of body.matchAll(/v_([^=]+)="([^"]*)"/g)) {
    const fields = match[2].split("~");
    const current = Number(fields[3]);
    const previous = Number(fields[4]);
    const reportedChange = Number(fields[32]);
    const changePct = Number.isFinite(reportedChange)
      ? reportedChange
      : previous > 0 && Number.isFinite(current) ? ((current - previous) / previous) * 100 : Number.NaN;
    const asOf = cleanQuoteDate(fields[30] ?? "");
    if (!Number.isFinite(changePct) || !asOf) continue;
    quotes.set(match[1], { changePct, asOf });
  }
  return quotes;
}

function movement(value: number): string {
  if (value > 0.1) return `上涨${Math.abs(value).toFixed(1)}%`;
  if (value < -0.1) return `下跌${Math.abs(value).toFixed(1)}%`;
  return "基本持平";
}

function direction(value: number): -1 | 0 | 1 {
  if (value > 0.1) return 1;
  if (value < -0.1) return -1;
  return 0;
}

function comparison(cn: number, us: number): string {
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

async function loadIndustryPulse(): Promise<{ data: IndustryPulse[]; updatedAt: string }> {
  if (memoryCache && memoryCache.expiresAt > Date.now()) return memoryCache;

  const symbols = industryPairs.flatMap((pair) => [pair.cn.symbol, pair.us.symbol]);
  const response = await fetch(`https://qt.gtimg.cn/q=${symbols.join(",")}`, {
    headers: { accept: "text/plain,*/*" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Quote HTTP ${response.status}`);

  const body = new TextDecoder().decode(await response.arrayBuffer());
  const quotes = parseQuotes(body);
  const data = industryPairs.flatMap((pair) => {
    const cn = quotes.get(pair.cn.symbol);
    const us = quotes.get(pair.us.symbol);
    if (!cn || !us) return [];
    const cnSession = cn.asOf.slice(11, 16) >= "15:00" ? "收盘" : "盘中";
    const usSession = "最近收盘";
    return [{
      id: pair.id,
      name: pair.name,
      summary: `${pair.cn.label}${cnSession}${movement(cn.changePct)}，${pair.us.label}${usSession}${movement(us.changePct)}；${comparison(cn.changePct, us.changePct)}`,
      cn: { ...pair.cn, ...cn, session: cnSession },
      us: { ...pair.us, ...us, session: usSession },
    }];
  });
  if (!data.length) throw new Error("Industry quotes unavailable");

  const updatedAt = new Date().toISOString();
  memoryCache = { data, updatedAt, expiresAt: Date.now() + 10 * 60 * 1000 };
  return { data, updatedAt };
}

export async function handleIndustryPulseApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/industry-pulse") return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  try {
    const payload = await loadIndustryPulse();
    const body = request.method === "HEAD" ? null : JSON.stringify({ ...payload, source: "腾讯行情" });
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return Response.json({ error: "行业对比暂时无法加载" }, { status: 502 });
  }
}
