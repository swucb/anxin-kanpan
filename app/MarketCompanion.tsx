"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "today" | "company" | "industry" | "global";

type StockOption = {
  name: string;
  code: string;
  symbol: string;
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

const navItems: Array<{ id: Tab; label: string }> = [
  { id: "today", label: "A股" },
  { id: "company", label: "公司" },
  { id: "industry", label: "行业" },
  { id: "global", label: "美股" },
];

const companies: StockOption[] = [
  { name: "贵州茅台", code: "600519", symbol: "SSE:600519" },
  { name: "宁德时代", code: "300750", symbol: "SZSE:300750" },
  { name: "招商银行", code: "600036", symbol: "SSE:600036" },
  { name: "美的集团", code: "000333", symbol: "SZSE:000333" },
  { name: "比亚迪", code: "002594", symbol: "SZSE:002594" },
  { name: "中国平安", code: "601318", symbol: "SSE:601318" },
  { name: "五粮液", code: "000858", symbol: "SZSE:000858" },
  { name: "格力电器", code: "000651", symbol: "SZSE:000651" },
  { name: "恒瑞医药", code: "600276", symbol: "SSE:600276" },
  { name: "迈瑞医疗", code: "300760", symbol: "SZSE:300760" },
  { name: "中芯国际", code: "688981", symbol: "SSE:688981" },
  { name: "长江电力", code: "600900", symbol: "SSE:600900" },
];

const industries: IndustryOption[] = [
  {
    id: "consumer",
    name: "消费白酒",
    symbols: [
      ["酒类ETF", "SSE:512690|12M"],
      ["贵州茅台", "SSE:600519|12M"],
      ["五粮液", "SZSE:000858|12M"],
      ["泸州老窖", "SZSE:000568|12M"],
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

function stockFromInput(value: string): StockOption | null {
  const normalized = value.trim().replace(/\s+/g, "");
  const known = companies.find((item) => item.name === normalized || item.code === normalized);
  if (known) return known;

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

  const activeIndustry = useMemo(
    () => industries.find((item) => item.id === industryId) ?? industries[0],
    [industryId],
  );

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
      setCompanyError("请输入 6 位股票代码，或点击常用公司。");
      return;
    }
    setSelectedCompany(stock);
    setCompanyInput(stock.name);
    setCompanyError("");
  }

  function chooseCompany(stock: StockOption) {
    setSelectedCompany(stock);
    setCompanyInput(stock.name);
    setCompanyError("");
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

          <form className="company-search" onSubmit={submitCompany} role="search">
            <input
              aria-label="企业名称或股票代码"
              value={companyInput}
              onChange={(event) => setCompanyInput(event.target.value)}
              placeholder="企业名称或 6 位代码"
              autoComplete="off"
            />
            <button type="submit">查看</button>
          </form>
          {companyError && <p className="form-error" role="alert">{companyError}</p>}

          <div className="quick-picks" aria-label="常用公司">
            {companies.slice(0, 8).map((stock) => (
              <button type="button" key={stock.code} className={stock.code === selectedCompany.code ? "is-selected" : ""} onClick={() => chooseCompany(stock)}>
                {stock.name}
              </button>
            ))}
          </div>

          <div className="selected-title">
            <h3>{selectedCompany.name}</h3>
            <span>{selectedCompany.code}</span>
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
            <span>ETF + 代表公司</span>
          </div>

          <div className="choice-row" role="group" aria-label="选择行业">
            {industries.map((industry) => (
              <button type="button" key={industry.id} className={industry.id === industryId ? "is-selected" : ""} aria-pressed={industry.id === industryId} onClick={() => setIndustryId(industry.id)}>
                {industry.name}
              </button>
            ))}
          </div>

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
