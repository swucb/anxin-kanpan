"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "today" | "company" | "industry" | "global";

type StockOption = {
  name: string;
  code: string;
  symbol: string;
};

type CompanyGroup = {
  name: string;
  items: StockOption[];
};

type IndustryOption = {
  id: string;
  name: string;
  symbols: Array<[string, string]>;
};

type GlobalSector = {
  id: string;
  name: string;
  usName: string;
  usSymbol: string;
  cnName: string;
  cnSymbol: string;
};

type MacroItem = {
  id: string;
  name: string;
  country: string;
  value: number;
  year: string;
  unit: string;
};

type IndustryPulseItem = {
  id: string;
  name: string;
  summary: string;
  cn: { label: string; symbol: string; changePct: number; asOf: string; session: string };
  us: { label: string; symbol: string; changePct: number; asOf: string; session: string };
};

type CompanyPreferences = {
  version: 1;
  favorites: StockOption[];
  recents: StockOption[];
};

const COMPANY_PREFS_KEY = "anxin-company-prefs-v1";
const MAX_SAVED_COMPANIES = 8;

const navItems: Array<{ id: Tab; label: string }> = [
  { id: "today", label: "A股" },
  { id: "company", label: "公司" },
  { id: "industry", label: "行业" },
  { id: "global", label: "美股" },
];

const companyGroups: CompanyGroup[] = [
  {
    name: "消费食品",
    items: [
      { name: "贵州茅台", code: "600519", symbol: "SSE:600519" },
      { name: "五粮液", code: "000858", symbol: "SZSE:000858" },
      { name: "泸州老窖", code: "000568", symbol: "SZSE:000568" },
      { name: "伊利股份", code: "600887", symbol: "SSE:600887" },
      { name: "山西汾酒", code: "600809", symbol: "SSE:600809" },
      { name: "海天味业", code: "603288", symbol: "SSE:603288" },
      { name: "双汇发展", code: "000895", symbol: "SZSE:000895" },
      { name: "青岛啤酒", code: "600600", symbol: "SSE:600600" },
      { name: "牧原股份", code: "002714", symbol: "SZSE:002714" },
    ],
  },
  {
    name: "金融",
    items: [
      { name: "招商银行", code: "600036", symbol: "SSE:600036" },
      { name: "工商银行", code: "601398", symbol: "SSE:601398" },
      { name: "农业银行", code: "601288", symbol: "SSE:601288" },
      { name: "建设银行", code: "601939", symbol: "SSE:601939" },
      { name: "兴业银行", code: "601166", symbol: "SSE:601166" },
      { name: "中国平安", code: "601318", symbol: "SSE:601318" },
      { name: "中国太保", code: "601601", symbol: "SSE:601601" },
      { name: "中信证券", code: "600030", symbol: "SSE:600030" },
      { name: "东方财富", code: "300059", symbol: "SZSE:300059" },
      { name: "华泰证券", code: "601688", symbol: "SSE:601688" },
    ],
  },
  {
    name: "汽车新能源",
    items: [
      { name: "宁德时代", code: "300750", symbol: "SZSE:300750" },
      { name: "比亚迪", code: "002594", symbol: "SZSE:002594" },
      { name: "隆基绿能", code: "601012", symbol: "SSE:601012" },
      { name: "阳光电源", code: "300274", symbol: "SZSE:300274" },
      { name: "通威股份", code: "600438", symbol: "SSE:600438" },
      { name: "亿纬锂能", code: "300014", symbol: "SZSE:300014" },
      { name: "上汽集团", code: "600104", symbol: "SSE:600104" },
      { name: "长安汽车", code: "000625", symbol: "SZSE:000625" },
    ],
  },
  {
    name: "科技通信",
    items: [
      { name: "中芯国际", code: "688981", symbol: "SSE:688981" },
      { name: "寒武纪", code: "688256", symbol: "SSE:688256" },
      { name: "北方华创", code: "002371", symbol: "SZSE:002371" },
      { name: "韦尔股份", code: "603501", symbol: "SSE:603501" },
      { name: "海光信息", code: "688041", symbol: "SSE:688041" },
      { name: "科大讯飞", code: "002230", symbol: "SZSE:002230" },
      { name: "金山办公", code: "688111", symbol: "SSE:688111" },
      { name: "海康威视", code: "002415", symbol: "SZSE:002415" },
      { name: "立讯精密", code: "002475", symbol: "SZSE:002475" },
      { name: "工业富联", code: "601138", symbol: "SSE:601138" },
      { name: "中国移动", code: "600941", symbol: "SSE:600941" },
      { name: "中国联通", code: "600050", symbol: "SSE:600050" },
      { name: "中兴通讯", code: "000063", symbol: "SZSE:000063" },
      { name: "中际旭创", code: "300308", symbol: "SZSE:300308" },
    ],
  },
  {
    name: "医药医疗",
    items: [
      { name: "恒瑞医药", code: "600276", symbol: "SSE:600276" },
      { name: "迈瑞医疗", code: "300760", symbol: "SZSE:300760" },
      { name: "云南白药", code: "000538", symbol: "SZSE:000538" },
      { name: "药明康德", code: "603259", symbol: "SSE:603259" },
      { name: "爱尔眼科", code: "300015", symbol: "SZSE:300015" },
      { name: "片仔癀", code: "600436", symbol: "SSE:600436" },
    ],
  },
  {
    name: "家电制造军工",
    items: [
      { name: "美的集团", code: "000333", symbol: "SZSE:000333" },
      { name: "格力电器", code: "000651", symbol: "SZSE:000651" },
      { name: "海尔智家", code: "600690", symbol: "SSE:600690" },
      { name: "三一重工", code: "600031", symbol: "SSE:600031" },
      { name: "汇川技术", code: "300124", symbol: "SZSE:300124" },
      { name: "中国中车", code: "601766", symbol: "SSE:601766" },
      { name: "中国船舶", code: "600150", symbol: "SSE:600150" },
      { name: "航发动力", code: "600893", symbol: "SSE:600893" },
      { name: "中航沈飞", code: "600760", symbol: "SSE:600760" },
      { name: "京东方A", code: "000725", symbol: "SZSE:000725" },
    ],
  },
  {
    name: "能源资源化工",
    items: [
      { name: "中国石油", code: "601857", symbol: "SSE:601857" },
      { name: "中国石化", code: "600028", symbol: "SSE:600028" },
      { name: "中国神华", code: "601088", symbol: "SSE:601088" },
      { name: "陕西煤业", code: "601225", symbol: "SSE:601225" },
      { name: "兖矿能源", code: "600188", symbol: "SSE:600188" },
      { name: "紫金矿业", code: "601899", symbol: "SSE:601899" },
      { name: "洛阳钼业", code: "603993", symbol: "SSE:603993" },
      { name: "北方稀土", code: "600111", symbol: "SSE:600111" },
      { name: "江西铜业", code: "600362", symbol: "SSE:600362" },
      { name: "长江电力", code: "600900", symbol: "SSE:600900" },
      { name: "中国核电", code: "601985", symbol: "SSE:601985" },
      { name: "三峡能源", code: "600905", symbol: "SSE:600905" },
      { name: "华能水电", code: "600025", symbol: "SSE:600025" },
      { name: "万华化学", code: "600309", symbol: "SSE:600309" },
      { name: "盐湖股份", code: "000792", symbol: "SZSE:000792" },
      { name: "巨化股份", code: "600160", symbol: "SSE:600160" },
    ],
  },
  {
    name: "地产基建物流",
    items: [
      { name: "万科A", code: "000002", symbol: "SZSE:000002" },
      { name: "保利发展", code: "600048", symbol: "SSE:600048" },
      { name: "招商蛇口", code: "001979", symbol: "SZSE:001979" },
      { name: "中国建筑", code: "601668", symbol: "SSE:601668" },
      { name: "海螺水泥", code: "600585", symbol: "SSE:600585" },
      { name: "顺丰控股", code: "002352", symbol: "SZSE:002352" },
      { name: "中国中免", code: "601888", symbol: "SSE:601888" },
    ],
  },
];

const companies = companyGroups.flatMap((group) => group.items);

const featuredCompanies = ["600519", "300750", "600036", "000333", "002594", "601318", "688981", "600900"]
  .flatMap((code) => {
    const company = companies.find((item) => item.code === code);
    return company ? [company] : [];
  });

const industries: IndustryOption[] = [
  {
    id: "consumer",
    name: "消费",
    symbols: [
      ["消费ETF", "SZSE:159928|12M"],
      ["伊利股份", "SSE:600887|12M"],
      ["贵州茅台", "SSE:600519|12M"],
      ["五粮液", "SZSE:000858|12M"],
    ],
  },
  {
    id: "bank",
    name: "银行",
    symbols: [
      ["银行ETF", "SSE:512800|12M"],
      ["招商银行", "SSE:600036|12M"],
      ["工商银行", "SSE:601398|12M"],
      ["农业银行", "SSE:601288|12M"],
    ],
  },
  {
    id: "brokerage",
    name: "券商",
    symbols: [
      ["券商ETF", "SSE:512880|12M"],
      ["东方财富", "SZSE:300059|12M"],
      ["中信证券", "SSE:600030|12M"],
      ["华泰证券", "SSE:601688|12M"],
    ],
  },
  {
    id: "chips",
    name: "半导体",
    symbols: [
      ["半导体ETF", "SSE:512480|12M"],
      ["中芯国际", "SSE:688981|12M"],
      ["韦尔股份", "SSE:603501|12M"],
      ["北方华创", "SZSE:002371|12M"],
    ],
  },
  {
    id: "ai",
    name: "人工智能",
    symbols: [
      ["人工智能ETF", "SZSE:159819|12M"],
      ["科大讯飞", "SZSE:002230|12M"],
      ["寒武纪", "SSE:688256|12M"],
      ["金山办公", "SSE:688111|12M"],
    ],
  },
  {
    id: "communication",
    name: "通信",
    symbols: [
      ["通信ETF", "SSE:515880|12M"],
      ["中兴通讯", "SZSE:000063|12M"],
      ["工业富联", "SSE:601138|12M"],
      ["中际旭创", "SZSE:300308|12M"],
    ],
  },
  {
    id: "new-energy",
    name: "新能源车",
    symbols: [
      ["新能源车ETF", "SSE:515030|12M"],
      ["宁德时代", "SZSE:300750|12M"],
      ["比亚迪", "SZSE:002594|12M"],
      ["亿纬锂能", "SZSE:300014|12M"],
    ],
  },
  {
    id: "solar",
    name: "光伏",
    symbols: [
      ["光伏ETF", "SSE:515790|12M"],
      ["特变电工", "SSE:600089|12M"],
      ["隆基绿能", "SSE:601012|12M"],
      ["阳光电源", "SZSE:300274|12M"],
    ],
  },
  {
    id: "healthcare",
    name: "医药",
    symbols: [
      ["医药ETF", "SSE:512010|12M"],
      ["恒瑞医药", "SSE:600276|12M"],
      ["迈瑞医疗", "SZSE:300760|12M"],
      ["药明康德", "SSE:603259|12M"],
    ],
  },
  {
    id: "home",
    name: "家电",
    symbols: [
      ["家电ETF", "SZSE:159996|12M"],
      ["美的集团", "SZSE:000333|12M"],
      ["格力电器", "SZSE:000651|12M"],
      ["海尔智家", "SSE:600690|12M"],
    ],
  },
  {
    id: "defense",
    name: "军工",
    symbols: [
      ["军工ETF", "SSE:512660|12M"],
      ["中国船舶", "SSE:600150|12M"],
      ["航发动力", "SSE:600893|12M"],
      ["中航沈飞", "SSE:600760|12M"],
    ],
  },
  {
    id: "power",
    name: "电力",
    symbols: [
      ["电力ETF", "SZSE:159611|12M"],
      ["长江电力", "SSE:600900|12M"],
      ["中国核电", "SSE:601985|12M"],
      ["三峡能源", "SSE:600905|12M"],
    ],
  },
  {
    id: "coal",
    name: "煤炭",
    symbols: [
      ["煤炭ETF", "SSE:515220|12M"],
      ["中国神华", "SSE:601088|12M"],
      ["陕西煤业", "SSE:601225|12M"],
      ["兖矿能源", "SSE:600188|12M"],
    ],
  },
  {
    id: "metals",
    name: "有色金属",
    symbols: [
      ["有色ETF", "SSE:512400|12M"],
      ["紫金矿业", "SSE:601899|12M"],
      ["洛阳钼业", "SSE:603993|12M"],
      ["北方稀土", "SSE:600111|12M"],
    ],
  },
  {
    id: "chemical",
    name: "化工",
    symbols: [
      ["化工ETF", "SSE:516020|12M"],
      ["万华化学", "SSE:600309|12M"],
      ["盐湖股份", "SZSE:000792|12M"],
      ["巨化股份", "SSE:600160|12M"],
    ],
  },
];

const globalSectors: GlobalSector[] = [
  { id: "technology", name: "科技", usName: "美股科技 XLK", usSymbol: "AMEX:XLK|12M", cnName: "A股半导体ETF", cnSymbol: "SSE:512480|12M" },
  { id: "healthcare", name: "医疗", usName: "美股医疗 XLV", usSymbol: "AMEX:XLV|12M", cnName: "A股医药ETF", cnSymbol: "SSE:512010|12M" },
  { id: "consumer", name: "消费", usName: "美股消费 XLY", usSymbol: "AMEX:XLY|12M", cnName: "A股酒类ETF", cnSymbol: "SSE:512690|12M" },
  { id: "energy", name: "能源", usName: "美股能源 XLE", usSymbol: "AMEX:XLE|12M", cnName: "A股煤炭ETF", cnSymbol: "SSE:515220|12M" },
  { id: "finance", name: "金融", usName: "美股金融 XLF", usSymbol: "AMEX:XLF|12M", cnName: "A股银行ETF", cnSymbol: "SSE:512800|12M" },
];

const widgetBase = {
  colorTheme: "light",
  isTransparent: true,
  locale: "zh_CN",
  width: "100%",
  autosize: true,
};

function TradingViewWidget({
  script,
  config,
  height,
  label,
}: {
  script: string;
  config: Record<string, unknown>;
  height: number;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const configText = JSON.stringify(config);

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    host.replaceChildren();
    setFailed(false);

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "calc(100% - 28px)";
    widget.style.width = "100%";

    const attribution = document.createElement("div");
    attribution.className = "tradingview-widget-copyright";
    const link = document.createElement("a");
    link.href = "https://cn.tradingview.com/";
    link.target = "_blank";
    link.rel = "noopener nofollow";
    link.textContent = `${label} · TradingView`;
    attribution.appendChild(link);

    const embed = document.createElement("script");
    embed.src = script;
    embed.type = "text/javascript";
    embed.async = true;
    embed.text = configText;
    embed.onerror = () => setFailed(true);

    host.append(widget, attribution, embed);
    return () => host.replaceChildren();
  }, [configText, label, script]);

  return (
    <div className="widget-frame" style={{ height }}>
      <div ref={container} className="tradingview-widget-container" />
      {failed && (
        <a className="widget-fallback" href="https://cn.tradingview.com/markets/china/" target="_blank" rel="noreferrer">
          行情加载失败，点此查看
        </a>
      )}
    </div>
  );
}

function MacroData() {
  const [items, setItems] = useState<MacroItem[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/macro", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("macro unavailable");
        return response.json();
      })
      .then((payload) => setItems(payload.data ?? []))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, []);

  if (failed) return <p className="small-status">宏观数据暂时未加载。</p>;
  if (!items.length) return <p className="small-status">加载宏观数据…</p>;

  return (
    <div className="macro-data-grid">
      {items.map((item) => (
        <article key={item.id}>
          <span>{item.country} · {item.year}</span>
          <strong>{item.value.toFixed(1)}{item.unit}</strong>
          <p>{item.name}</p>
        </article>
      ))}
    </div>
  );
}

function IndustryPulse({ industryId }: { industryId: string }) {
  const [items, setItems] = useState<IndustryPulseItem[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/industry-pulse", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("industry pulse unavailable");
        return response.json();
      })
      .then((payload) => setItems(payload.data ?? []))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const active = items.find((item) => item.id === industryId);
  if (failed) return <p className="industry-pulse-status">今日对比暂时未加载，图表仍可查看。</p>;
  if (!active) return <p className="industry-pulse-status">正在生成今日对比…</p>;

  return (
    <article className="industry-pulse" aria-live="polite">
      <strong>今日一句</strong>
      <p>{active.summary}</p>
      <footer>
        <span>A股 {active.cn.asOf.slice(0, 10)} {active.cn.session}</span>
        <span>美股 {active.us.asOf.slice(0, 10)} {active.us.session}</span>
        <a href="https://gu.qq.com/" target="_blank" rel="noreferrer">腾讯行情</a>
      </footer>
    </article>
  );
}

function isStoredStock(value: unknown): value is StockOption {
  if (!value || typeof value !== "object") return false;
  const stock = value as Partial<StockOption>;
  return typeof stock.name === "string"
    && stock.name.length > 0
    && stock.name.length <= 24
    && typeof stock.code === "string"
    && /^\d{6}$/.test(stock.code)
    && typeof stock.symbol === "string"
    && /^(SSE|SZSE):\d{6}$/.test(stock.symbol);
}

function stockFromInput(value: string): StockOption | null {
  const normalized = value.trim().replace(/\s+/g, "");
  const known = companies.find((item) => item.name === normalized || item.code === normalized);
  if (known) return known;

  const nameMatches = companies.filter((item) => item.name.includes(normalized));
  if (normalized && nameMatches.length === 1) return nameMatches[0];

  const code = normalized.match(/\d{6}/)?.[0];
  if (!code) return null;
  const exchange = /^[569]/.test(code) ? "SSE" : "SZSE";
  return { name: code, code, symbol: `${exchange}:${code}` };
}

export function MarketCompanion() {
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [largeType, setLargeType] = useState(false);
  const [typeReady, setTypeReady] = useState(false);
  const [companyInput, setCompanyInput] = useState("贵州茅台");
  const [selectedCompany, setSelectedCompany] = useState(companies[0]);
  const [companyError, setCompanyError] = useState("");
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const [favorites, setFavorites] = useState<StockOption[]>([]);
  const [recents, setRecents] = useState<StockOption[]>([]);
  const [companyPrefsReady, setCompanyPrefsReady] = useState(false);
  const [industryId, setIndustryId] = useState(industries[0].id);
  const [globalSectorId, setGlobalSectorId] = useState(globalSectors[0].id);

  useEffect(() => {
    const saved = window.localStorage.getItem("anxin-large-type") === "true";
    const frame = window.requestAnimationFrame(() => {
      setLargeType(saved);
      setTypeReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!typeReady) return;
    document.documentElement.dataset.typeSize = largeType ? "extra" : "large";
    window.localStorage.setItem("anxin-large-type", String(largeType));
  }, [largeType, typeReady]);

  useEffect(() => {
    let savedFavorites: StockOption[] = [];
    let savedRecents: StockOption[] = [];
    try {
      const stored = JSON.parse(window.localStorage.getItem(COMPANY_PREFS_KEY) ?? "null") as Partial<CompanyPreferences> | null;
      if (stored?.version === 1) {
        savedFavorites = Array.isArray(stored.favorites) ? stored.favorites.filter(isStoredStock).slice(0, MAX_SAVED_COMPANIES) : [];
        savedRecents = Array.isArray(stored.recents) ? stored.recents.filter(isStoredStock).slice(0, MAX_SAVED_COMPANIES) : [];
      }
    } catch {
      // Ignore damaged device-local preferences and start with an empty list.
    }

    const frame = window.requestAnimationFrame(() => {
      setFavorites(savedFavorites);
      setRecents(savedRecents);
      setCompanyPrefsReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!companyPrefsReady) return;
    const preferences: CompanyPreferences = { version: 1, favorites, recents };
    try {
      window.localStorage.setItem(COMPANY_PREFS_KEY, JSON.stringify(preferences));
    } catch {
      // The site remains usable when a browser blocks device-local storage.
    }
  }, [companyPrefsReady, favorites, recents]);

  const activeIndustry = useMemo(
    () => industries.find((item) => item.id === industryId) ?? industries[0],
    [industryId],
  );

  const companyMatches = useMemo(() => {
    const query = companyInput.trim().replace(/\s+/g, "").toLowerCase();
    if (!query) {
      return [...favorites, ...recents, ...featuredCompanies]
        .filter((item, index, list) => list.findIndex((candidate) => candidate.code === item.code) === index)
        .slice(0, 6);
    }
    return companies
      .filter((item) => item.name.toLowerCase().includes(query) || item.code.includes(query))
      .slice(0, 6);
  }, [companyInput, favorites, recents]);

  const visibleRecents = useMemo(
    () => recents.filter((stock) => !favorites.some((favorite) => favorite.code === stock.code)),
    [favorites, recents],
  );

  const selectedIsFavorite = favorites.some((stock) => stock.code === selectedCompany.code);

  const activeGlobalSector = useMemo(
    () => globalSectors.find((item) => item.id === globalSectorId) ?? globalSectors[0],
    [globalSectorId],
  );

  function jumpTo(tab: Tab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const stock = stockFromInput(companyInput);
    if (!stock) {
      setCompanyError("请选择搜索结果，或输入 6 位股票代码。");
      return;
    }
    chooseCompany(stock);
  }

  function rememberCompany(stock: StockOption) {
    setRecents((current) => [stock, ...current.filter((item) => item.code !== stock.code)].slice(0, MAX_SAVED_COMPANIES));
  }

  function chooseCompany(stock: StockOption) {
    setSelectedCompany(stock);
    setCompanyInput(stock.name);
    setCompanyError("");
    setCompanySearchOpen(false);
    rememberCompany(stock);
  }

  function toggleFavorite(stock: StockOption) {
    setFavorites((current) => current.some((item) => item.code === stock.code)
      ? current.filter((item) => item.code !== stock.code)
      : [stock, ...current.filter((item) => item.code !== stock.code)].slice(0, MAX_SAVED_COMPANIES));
    rememberCompany(stock);
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">安</div>
          <h1>安心看盘</h1>
        </div>
        <button type="button" className="type-toggle" aria-pressed={largeType} onClick={() => setLargeType((value) => !value)}>
          <span aria-hidden="true">字</span>
          {largeType ? "标准大字" : "再大一点"}
        </button>
      </header>

      <nav className="top-nav" aria-label="主要功能">
        {navItems.map((item) => (
          <button type="button" key={item.id} className={activeTab === item.id ? "is-active" : ""} onClick={() => jumpTo(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {activeTab === "today" && (
        <section className="page-section" aria-labelledby="today-title">
          <div className="section-heading">
            <h2 id="today-title">今日行情</h2>
            <span>A股 · 收盘数据</span>
          </div>
          <TradingViewWidget
            script="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
            height={560}
            label="A股行情"
            config={{
              ...widgetBase,
              height: "100%",
              dateRange: "3M",
              showChart: true,
              showFloatingTooltip: false,
              showSymbolLogo: true,
              tabs: [
                {
                  title: "A股指数",
                  symbols: [
                    { s: "SSE:000001", d: "上证指数" },
                    { s: "SZSE:399001", d: "深证成指" },
                    { s: "SZSE:399006", d: "创业板指" },
                    { s: "SSE:000300", d: "沪深300" },
                  ],
                  originalTitle: "A股指数",
                },
              ],
            }}
          />
        </section>
      )}

      {activeTab === "company" && (
        <section className="page-section" aria-labelledby="company-title">
          <div className="section-heading">
            <h2 id="company-title">查公司</h2>
            <span>A股 · 收盘数据</span>
          </div>

          <div
            className="company-search-wrap"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setCompanySearchOpen(false);
            }}
          >
            <form className="company-search" onSubmit={submitCompany} role="search">
              <input
                aria-label="企业名称或股票代码"
                aria-autocomplete="list"
                aria-controls="company-suggestions"
                aria-expanded={companySearchOpen && companyMatches.length > 0}
                role="combobox"
                value={companyInput}
                onChange={(event) => {
                  setCompanyInput(event.target.value);
                  setCompanyError("");
                  setCompanySearchOpen(true);
                }}
                onFocus={() => setCompanySearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setCompanySearchOpen(false);
                }}
                placeholder="企业名称或 6 位代码"
                autoComplete="off"
              />
              <button type="submit">查看</button>
            </form>
            {companySearchOpen && companyMatches.length > 0 && (
              <div id="company-suggestions" className="company-suggestions" role="listbox" aria-label="公司搜索结果">
                {companyMatches.map((stock) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={stock.code === selectedCompany.code}
                    key={stock.code}
                    onClick={() => chooseCompany(stock)}
                  >
                    <strong>{stock.name}</strong>
                    <span>{stock.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {companyError && <p className="form-error" role="alert">{companyError}</p>}

          <div className="company-personal">
            <section className="company-list-block" aria-labelledby="favorites-title">
              <div className="company-list-heading">
                <h3 id="favorites-title">我的常用</h3>
              </div>
              {companyPrefsReady && favorites.length > 0 ? (
                <div className="quick-picks">
                  {favorites.map((stock) => (
                    <button type="button" key={stock.code} className={stock.code === selectedCompany.code ? "is-selected" : ""} onClick={() => chooseCompany(stock)}>
                      {stock.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="company-list-empty">查看公司后，可加入常用。</p>
              )}
            </section>

            <section className="company-list-block" aria-labelledby="recents-title">
              <div className="company-list-heading">
                <h3 id="recents-title">最近查看</h3>
                {visibleRecents.length > 0 && <button type="button" onClick={() => setRecents([])}>清空</button>}
              </div>
              {companyPrefsReady && visibleRecents.length > 0 ? (
                <div className="quick-picks">
                  {visibleRecents.map((stock) => (
                    <button type="button" key={stock.code} className={stock.code === selectedCompany.code ? "is-selected" : ""} onClick={() => chooseCompany(stock)}>
                      {stock.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="company-list-empty">还没有查看记录。</p>
              )}
            </section>
          </div>

          <div className="company-directory">
            <label htmlFor="company-directory-select">全部公司（{companies.length}家）</label>
            <select
              id="company-directory-select"
              aria-label={`全部公司，共 ${companies.length} 家`}
              value={companies.some((stock) => stock.code === selectedCompany.code) ? selectedCompany.code : ""}
              onChange={(event) => {
                const stock = companies.find((item) => item.code === event.target.value);
                if (stock) chooseCompany(stock);
              }}
            >
              <option value="">选择公司</option>
              {companyGroups.map((group) => (
                <optgroup key={group.name} label={group.name}>
                  {group.items.map((stock) => (
                    <option key={stock.code} value={stock.code}>{stock.name} · {stock.code}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="selected-title">
            <div>
              <h3>{selectedCompany.name}</h3>
              <span>{selectedCompany.code}</span>
            </div>
            <button type="button" className="favorite-toggle" aria-pressed={selectedIsFavorite} onClick={() => toggleFavorite(selectedCompany)}>
              {selectedIsFavorite ? "移出常用" : "加入常用"}
            </button>
          </div>

          <TradingViewWidget
            key={`chart-${selectedCompany.symbol}`}
            script="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
            height={470}
            label={`${selectedCompany.name}行情`}
            config={{
              ...widgetBase,
              height: "100%",
              symbols: [[selectedCompany.name, `${selectedCompany.symbol}|12M`]],
              chartOnly: false,
              chartType: "area",
              lineWidth: 2,
              dateRanges: ["1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
              changeMode: "price-and-percent",
              hideDateRanges: false,
              hideMarketStatus: false,
              hideSymbolLogo: false,
              scalePosition: "right",
              scaleMode: "Normal",
            }}
          />

          <div className="widget-grid">
            <article>
              <h3>财务数据</h3>
              <TradingViewWidget
                key={`financials-${selectedCompany.symbol}`}
                script="https://s3.tradingview.com/external-embedding/embed-widget-financials.js"
                height={560}
                label={`${selectedCompany.name}财务`}
                config={{ ...widgetBase, height: "100%", symbol: selectedCompany.symbol, displayMode: "regular" }}
              />
            </article>
            <article>
              <h3>技术指标</h3>
              <TradingViewWidget
                key={`technical-${selectedCompany.symbol}`}
                script="https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js"
                height={560}
                label={`${selectedCompany.name}技术指标`}
                config={{
                  ...widgetBase,
                  height: "100%",
                  symbol: selectedCompany.symbol,
                  interval: "1D",
                  displayMode: "single",
                  showIntervalTabs: true,
                  disableInterval: false,
                }}
              />
            </article>
          </div>
        </section>
      )}

      {activeTab === "industry" && (
        <section className="page-section" aria-labelledby="industry-title">
          <div className="section-heading">
            <h2 id="industry-title">行业对比</h2>
            <span>{industries.length}个行业</span>
          </div>

          <div className="industry-picker">
            <label htmlFor="industry-select">选择行业</label>
            <select id="industry-select" value={industryId} onChange={(event) => setIndustryId(event.target.value)}>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>{industry.name}</option>
              ))}
            </select>
          </div>

          <IndustryPulse industryId={industryId} />

          <TradingViewWidget
            key={`industry-${activeIndustry.id}`}
            script="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
            height={560}
            label={`${activeIndustry.name}对比`}
            config={{
              ...widgetBase,
              height: "100%",
              symbols: activeIndustry.symbols,
              chartOnly: false,
              chartType: "area",
              lineWidth: 2,
              dateRanges: ["1m|30", "3m|60", "12m|1D", "60m|1W"],
              changeMode: "price-and-percent",
              hideDateRanges: false,
              hideMarketStatus: false,
              hideSymbolLogo: false,
              scalePosition: "right",
              scaleMode: "Percentage",
            }}
          />

          <div className="subheading">
            <h3>宏观数据</h3>
            <a href="https://data.worldbank.org/" target="_blank" rel="noreferrer">世界银行</a>
          </div>
          <MacroData />
        </section>
      )}

      {activeTab === "global" && (
        <section className="page-section" aria-labelledby="global-title">
          <div className="section-heading">
            <h2 id="global-title">美股参考</h2>
            <span>延迟行情 · 不选美股</span>
          </div>

          <TradingViewWidget
            script="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
            height={500}
            label="美股主要ETF"
            config={{
              ...widgetBase,
              height: "100%",
              symbols: [
                ["标普500 SPY", "AMEX:SPY|12M"],
                ["纳斯达克100 QQQ", "NASDAQ:QQQ|12M"],
                ["道琼斯 DIA", "AMEX:DIA|12M"],
              ],
              chartOnly: false,
              chartType: "area",
              lineWidth: 2,
              dateRanges: ["1m|30", "3m|60", "12m|1D", "60m|1W"],
              changeMode: "price-and-percent",
              hideDateRanges: false,
              hideMarketStatus: false,
              hideSymbolLogo: false,
              scalePosition: "right",
              scaleMode: "Percentage",
            }}
          />

          <div className="subheading">
            <h3>中美行业对照</h3>
            <span>只比较走势</span>
          </div>
          <div className="choice-row" role="group" aria-label="选择对照行业">
            {globalSectors.map((sector) => (
              <button type="button" key={sector.id} className={sector.id === globalSectorId ? "is-selected" : ""} aria-pressed={sector.id === globalSectorId} onClick={() => setGlobalSectorId(sector.id)}>
                {sector.name}
              </button>
            ))}
          </div>

          <TradingViewWidget
            key={`global-${activeGlobalSector.id}`}
            script="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
            height={520}
            label={`${activeGlobalSector.name}中美对照`}
            config={{
              ...widgetBase,
              height: "100%",
              symbols: [
                [activeGlobalSector.usName, activeGlobalSector.usSymbol],
                [activeGlobalSector.cnName, activeGlobalSector.cnSymbol],
              ],
              chartOnly: false,
              chartType: "area",
              lineWidth: 2,
              dateRanges: ["1m|30", "3m|60", "12m|1D", "60m|1W"],
              changeMode: "price-and-percent",
              hideDateRanges: false,
              hideMarketStatus: false,
              hideSymbolLogo: false,
              scalePosition: "right",
              scaleMode: "Percentage",
            }}
          />
        </section>
      )}

      <nav className="bottom-nav" aria-label="手机端主要功能">
        {navItems.map((item) => (
          <button type="button" key={item.id} className={activeTab === item.id ? "is-active" : ""} onClick={() => jumpTo(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
