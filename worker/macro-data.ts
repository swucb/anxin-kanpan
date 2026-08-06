type MacroItem = {
  id: string;
  name: string;
  country: string;
  value: number;
  year: string;
  unit: string;
};

type IndicatorConfig = {
  id: string;
  countryCode: "CHN" | "USA";
  country: string;
  indicator: string;
  name: string;
  unit: string;
};

const indicators: IndicatorConfig[] = [
  { id: "cn-gdp", countryCode: "CHN", country: "中国", indicator: "NY.GDP.MKTP.KD.ZG", name: "GDP 增速", unit: "%" },
  { id: "cn-inflation", countryCode: "CHN", country: "中国", indicator: "FP.CPI.TOTL.ZG", name: "居民价格涨幅", unit: "%" },
  { id: "cn-manufacturing", countryCode: "CHN", country: "中国", indicator: "NV.IND.MANF.ZS", name: "制造业占 GDP", unit: "%" },
  { id: "us-gdp", countryCode: "USA", country: "美国", indicator: "NY.GDP.MKTP.KD.ZG", name: "GDP 增速", unit: "%" },
];

let memoryCache: { data: MacroItem[]; expiresAt: number } | null = null;

async function latestObservation(config: IndicatorConfig): Promise<MacroItem | null> {
  const currentYear = new Date().getUTCFullYear();
  const url = new URL(`https://api.worldbank.org/v2/country/${config.countryCode}/indicator/${config.indicator}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("per_page", "20");
  url.searchParams.set("date", `${currentYear - 8}:${currentYear}`);

  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`World Bank HTTP ${response.status}`);
  const payload = await response.json() as [unknown, Array<{ date?: string; value?: number | null }> | undefined];
  const row = payload[1]?.find((item) => typeof item.value === "number" && Number.isFinite(item.value));
  if (!row || typeof row.value !== "number") return null;

  return {
    id: config.id,
    name: config.name,
    country: config.country,
    value: row.value,
    year: String(row.date ?? ""),
    unit: config.unit,
  };
}

async function loadMacroData(): Promise<MacroItem[]> {
  if (memoryCache && memoryCache.expiresAt > Date.now()) return memoryCache.data;
  const results = await Promise.allSettled(indicators.map(latestObservation));
  const data = results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
  if (!data.length) throw new Error("Macro data unavailable");
  memoryCache = { data, expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
  return data;
}

export async function handleMacroApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/macro") return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  try {
    const data = await loadMacroData();
    const body = request.method === "HEAD" ? null : JSON.stringify({ data, source: "World Bank", updatedAt: new Date().toISOString() });
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600, s-maxage=43200, stale-while-revalidate=86400",
      },
    });
  } catch {
    return Response.json({ error: "宏观数据暂时无法加载" }, { status: 502 });
  }
}
