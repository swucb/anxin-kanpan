"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ApiMeta = {
  mode: "live" | "demo";
  source: string;
  updatedAt: string;
  tradeDate?: string;
  warning?: string;
};

type MarketData = {
  tradeDate: string;
  mood: "偏暖" | "平稳" | "偏谨慎";
  moodNote: string;
  indices: Array<{ code: string; name: string; close: number; pct: number }>;
  breadth: { rises: number; falls: number; flats: number; limitUps: number };
  amountYi: number;
  conclusion: string;
  positives: string[];
  cautions: string[];
};

type UsSectorReference = {
  id: string;
  symbol: string;
  name: string;
  pct: number | null;
  status: "较强" | "平稳" | "承压" | "暂无";
  cnLabel: string;
  cnKeywords: string[];
  referenceStrength: "较高" | "中等" | "较低";
  commonDriver: string;
  difference: string;
  referenceNote: string;
};

type UsReferenceData = {
  tradeDate: string;
  mood: "偏暖" | "平稳" | "偏谨慎";
  moodNote: string;
  indices: Array<{ code: string; name: string; close: number; pct: number; isProxy: boolean }>;
  sectors: UsSectorReference[];
  takeaways: string[];
  caution: string;
};

type IndustryData = {
  name: string;
  pct: number;
  advanceRate: number | null;
  amountYi: number;
  medianPe: number | null;
  status: "较强" | "平稳" | "承压";
  note: string;
};

type SearchResult = {
  ts_code: string;
  symbol: string;
  name: string;
  area: string;
  industry: string;
  market: string;
};

type CompanyData = {
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
};

type Tab = "today" | "company" | "industry" | "global";

const navItems: Array<{ id: Tab; mark: string; label: string }> = [
  { id: "today", mark: "今", label: "今日行情" },
  { id: "company", mark: "查", label: "查企业" },
  { id: "industry", mark: "业", label: "看行业" },
  { id: "global", mark: "外", label: "美股参考" },
];

const quickCompanies = [
  { name: "贵州茅台", code: "600519" },
  { name: "宁德时代", code: "300750" },
  { name: "招商银行", code: "600036" },
  { name: "美的集团", code: "000333" },
];

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatTime(value?: string) {
  if (!value) return "刚刚检查";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toneForPct(value: number) {
  if (value > 0) return "rise";
  if (value < 0) return "fall";
  return "flat";
}

function pctText(value: number) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}%`;
}

function SourceBadge({ meta }: { meta?: ApiMeta }) {
  if (!meta) return <span className="source-pill source-pill--checking">正在检查数据</span>;
  return (
    <span className={`source-pill ${meta.mode === "live" ? "source-pill--live" : "source-pill--demo"}`}>
      <span className="source-dot" aria-hidden="true" />
      {meta.mode === "live" ? "正式数据" : "演示数据"}
    </span>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="loading-card" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-card">
      <div className="empty-mark" aria-hidden="true">!</div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export function MarketCompanion() {
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [largeType, setLargeType] = useState(false);
  const [typePreferenceReady, setTypePreferenceReady] = useState(false);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketMeta, setMarketMeta] = useState<ApiMeta>();
  const [industries, setIndustries] = useState<IndustryData[]>([]);
  const [industryMeta, setIndustryMeta] = useState<ApiMeta>();
  const [marketError, setMarketError] = useState("");
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [companyMeta, setCompanyMeta] = useState<ApiMeta>();
  const [companyError, setCompanyError] = useState("");
  const [companyLoading, setCompanyLoading] = useState(true);
  const [query, setQuery] = useState("贵州茅台");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [usReference, setUsReference] = useState<UsReferenceData | null>(null);
  const [usMeta, setUsMeta] = useState<ApiMeta>();
  const [usLoading, setUsLoading] = useState(true);
  const [usError, setUsError] = useState("");
  const [selectedUsSector, setSelectedUsSector] = useState<string>("technology");

  useEffect(() => {
    const saved = window.localStorage.getItem("anxin-large-type") === "true";
    const frame = window.requestAnimationFrame(() => {
      setLargeType(saved);
      setTypePreferenceReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!typePreferenceReady) return;
    document.documentElement.dataset.typeSize = largeType ? "extra" : "large";
    window.localStorage.setItem("anxin-large-type", String(largeType));
  }, [largeType, typePreferenceReady]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/market").then((response) => response.json()),
      fetch("/api/industries").then((response) => response.json()),
    ])
      .then(([marketResult, industryResult]) => {
        if (cancelled) return;
        if (marketResult.error) throw new Error(marketResult.error);
        setMarket(marketResult.data);
        setMarketMeta(marketResult.meta);
        setIndustries(industryResult.data ?? []);
        setIndustryMeta(industryResult.meta);
        setSelectedIndustry(industryResult.data?.[0]?.name ?? "");
      })
      .catch(() => {
        if (!cancelled) setMarketError("行情数据暂时没有准备好，请稍后再试。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadCompany("600519");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/us-reference")
      .then((response) => response.json().then((result) => ({ response, result })))
      .then(({ response, result }) => {
        if (cancelled) return;
        if (!response.ok || result.error) throw new Error(result.error || "美股参考数据暂未准备好");
        setUsReference(result.data);
        setUsMeta(result.meta);
        setSelectedUsSector(result.data?.sectors?.[0]?.id ?? "technology");
      })
      .catch((error) => {
        if (!cancelled) setUsError(error instanceof Error ? error.message : "美股参考数据暂未准备好");
      })
      .finally(() => {
        if (!cancelled) setUsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (!searchOpen || normalized.length < 1) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((result) => setSearchResults(result.data ?? []))
        .catch(() => undefined);
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchOpen]);

  async function loadCompany(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    setCompanyLoading(true);
    setCompanyError("");
    setSearchOpen(false);
    try {
      const response = await fetch(`/api/company?q=${encodeURIComponent(normalized)}`);
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || "暂时没有查到这家公司");
      setCompany(result.data);
      setCompanyMeta(result.meta);
      setQuery(result.data.name);
    } catch (error) {
      setCompanyError(error instanceof Error ? error.message : "暂时没有查到这家公司");
    } finally {
      setCompanyLoading(false);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadCompany(query);
  }

  function jumpTo(tab: Tab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeIndustry = useMemo(
    () => industries.find((item) => item.name === selectedIndustry) ?? industries[0],
    [industries, selectedIndustry],
  );

  const activeUsSector = useMemo(
    () => usReference?.sectors.find((item) => item.id === selectedUsSector) ?? usReference?.sectors[0],
    [usReference, selectedUsSector],
  );

  const matchingCnIndustry = useMemo(() => {
    if (!activeUsSector) return undefined;
    return industries.find((industry) => activeUsSector.cnKeywords.some((keyword) =>
      industry.name.includes(keyword) || keyword.includes(industry.name),
    ));
  }, [activeUsSector, industries]);

  const crossMarketRelation = useMemo(() => {
    if (!activeUsSector || activeUsSector.pct === null || !matchingCnIndustry) return "等待 A 股对应数据";
    const usDirection = Math.abs(activeUsSector.pct) < 0.35 ? 0 : Math.sign(activeUsSector.pct);
    const cnDirection = Math.abs(matchingCnIndustry.pct) < 0.35 ? 0 : Math.sign(matchingCnIndustry.pct);
    if (usDirection === cnDirection && usDirection !== 0) return "方向相近，但原因仍需核对";
    if (usDirection === 0 || cnDirection === 0) return "一边较平稳，暂不形成共同信号";
    return "走势分化，以 A 股本地因素为主";
  }, [activeUsSector, matchingCnIndustry]);

  const displayMeta = activeTab === "company"
    ? companyMeta
    : activeTab === "industry"
      ? industryMeta
      : activeTab === "global"
        ? usMeta
        : marketMeta;

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">安</div>
          <div>
            <p className="eyebrow">给家里人的市场助手</p>
            <h1>安心看盘</h1>
          </div>
        </div>
        <button
          type="button"
          className="type-toggle"
          aria-pressed={largeType}
          onClick={() => setLargeType((value) => !value)}
        >
          <span aria-hidden="true">字</span>
          {largeType ? "标准大字" : "再大一点"}
        </button>
      </header>

      <div className="data-strip" aria-live="polite">
        <SourceBadge meta={displayMeta} />
        <span>{displayMeta?.tradeDate ? `数据日：${displayMeta.tradeDate}` : "按交易日自动检查"}</span>
        <span className="data-strip__time">检查：{formatTime(displayMeta?.updatedAt)}</span>
      </div>

      {displayMeta?.warning && (
        <div className="notice-banner" role="note">
          <strong>温馨提示：</strong>{displayMeta.warning}
        </div>
      )}

      <nav className="top-nav" aria-label="主要功能">
        {navItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={activeTab === item.id ? "is-active" : ""}
            onClick={() => jumpTo(item.id)}
          >
            <span aria-hidden="true">{item.mark}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {activeTab === "today" && (
        <section className="page-section" aria-labelledby="today-title">
          {!market && !marketError && <LoadingCard label="正在把今天的行情说清楚…" />}
          {marketError && <EmptyCard title="暂时没取到行情" text={marketError} />}
          {market && (
            <>
              <div className={`market-hero market-hero--${market.mood}`}>
                <div className="market-weather" aria-hidden="true">
                  <span>{market.mood === "偏暖" ? "暖" : market.mood === "偏谨慎" ? "慎" : "稳"}</span>
                </div>
                <div className="market-hero__copy">
                  <p className="eyebrow">今天的市场体感</p>
                  <h2 id="today-title">整体{market.mood}</h2>
                  <p>{market.moodNote}</p>
                </div>
                <div className="market-hero__summary">
                  <span>一句话看懂</span>
                  <strong>{market.conclusion}</strong>
                </div>
              </div>

              <div className="index-grid" aria-label="主要指数">
                {market.indices.map((index) => (
                  <article className="index-card" key={index.code}>
                    <p>{index.name}</p>
                    <strong>{formatNumber(index.close)}</strong>
                    <span className={`change ${toneForPct(index.pct)}`}>{pctText(index.pct)}</span>
                  </article>
                ))}
              </div>

              <div className="market-grid">
                <article className="content-card breadth-card">
                  <div className="card-heading">
                    <div>
                      <p className="eyebrow">市场温度计</p>
                      <h3>多少公司在涨？</h3>
                    </div>
                    <span className="plain-chip">成交 {formatNumber(market.amountYi, 0)} 亿元</span>
                  </div>
                  <div className="breadth-bar" aria-label={`上涨 ${market.breadth.rises} 家，下跌 ${market.breadth.falls} 家`}>
                    <span
                      className="breadth-bar__rise"
                      style={{ width: `${(market.breadth.rises / Math.max(1, market.breadth.rises + market.breadth.falls + market.breadth.flats)) * 100}%` }}
                    />
                    <span
                      className="breadth-bar__flat"
                      style={{ width: `${(market.breadth.flats / Math.max(1, market.breadth.rises + market.breadth.falls + market.breadth.flats)) * 100}%` }}
                    />
                  </div>
                  <div className="breadth-numbers">
                    <div><span className="dot dot--rise" />上涨<strong>{market.breadth.rises} 家</strong></div>
                    <div><span className="dot dot--fall" />下跌<strong>{market.breadth.falls} 家</strong></div>
                    <div><span className="dot dot--flat" />平盘<strong>{market.breadth.flats} 家</strong></div>
                    <div><span className="dot dot--gold" />涨停附近<strong>{market.breadth.limitUps} 家</strong></div>
                  </div>
                </article>

                <article className="content-card two-sides-card">
                  <div className="side-list side-list--good">
                    <h3><span aria-hidden="true">＋</span>有利的地方</h3>
                    <ul>{market.positives.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                  <div className="side-list side-list--risk">
                    <h3><span aria-hidden="true">!</span>需要留意</h3>
                    <ul>{market.cautions.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                </article>
              </div>

              <button type="button" className="next-action" onClick={() => jumpTo("company")}>
                <span>
                  <small>下一步</small>
                  输入一家公司，看看优点和风险
                </span>
                <b aria-hidden="true">→</b>
              </button>
            </>
          )}
        </section>
      )}

      {activeTab === "company" && (
        <section className="page-section company-section" aria-labelledby="company-title">
          <div className="section-intro">
            <p className="eyebrow">不猜涨跌，只看事实</p>
            <h2 id="company-title">查一家公司</h2>
            <p>输入企业名称或股票代码，我们会用通俗的话说明优势、风险和同行位置。</p>
          </div>

          <form className="company-search" onSubmit={handleSearch} role="search">
            <label htmlFor="company-query">企业名称或股票代码</label>
            <div className="search-box">
              <span className="search-mark" aria-hidden="true">查</span>
              <input
                id="company-query"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="例如：贵州茅台、600519"
                autoComplete="off"
              />
              <button type="submit">开始分析</button>
            </div>
            {searchOpen && query.trim().length > 0 && searchResults.length > 0 && (
              <div className="search-results" role="listbox" aria-label="搜索建议">
                {searchResults.map((result) => (
                  <button
                    type="button"
                    key={result.ts_code}
                    role="option"
                    aria-selected="false"
                    onClick={() => void loadCompany(result.ts_code)}
                  >
                    <span><strong>{result.name}</strong><small>{result.symbol} · {result.market}</small></span>
                    <em>{result.industry || "未分类"}</em>
                  </button>
                ))}
              </div>
            )}
          </form>

          <div className="quick-picks" aria-label="常用公司">
            <span>也可以直接点：</span>
            {quickCompanies.map((item) => (
              <button type="button" key={item.code} onClick={() => void loadCompany(item.code)}>{item.name}</button>
            ))}
          </div>

          {companyLoading && <LoadingCard label="正在核对行情、财务和同行数据…" />}
          {companyError && !companyLoading && <EmptyCard title="没有查到结果" text={companyError} />}

          {company && !companyLoading && (
            <div className="company-results">
              <article className={`company-hero verdict-${company.verdict}`}>
                <div className="company-identity">
                  <div className="company-monogram" aria-hidden="true">{company.name.slice(0, 1)}</div>
                  <div>
                    <div className="company-title-line">
                      <h3>{company.name}</h3>
                      <span>{company.code}</span>
                    </div>
                    <p>{company.industry} · {company.area || "中国"}</p>
                  </div>
                </div>
                <div className="company-price">
                  <strong>{formatNumber(company.price)}</strong>
                  <span className={`change ${toneForPct(company.pct)}`}>{pctText(company.pct)}</span>
                </div>
                <div className="verdict-box">
                  <span>综合观察</span>
                  <strong>{company.verdict}</strong>
                  <p>{company.verdictNote}</p>
                </div>
              </article>

              <article className="content-card trend-card">
                <div className="card-heading">
                  <div>
                    <p className="eyebrow">近期走势</p>
                    <h3>价格走到哪里了？</h3>
                  </div>
                  <span className="plain-chip">仅反映价格，不代表预测</span>
                </div>
                <div className="bar-chart" role="img" aria-label={`${company.name}近期收盘价走势`}>
                  {company.trend.map((point, index) => {
                    const values = company.trend.map((item) => item.close);
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const height = 18 + ((point.close - min) / Math.max(0.01, max - min)) * 72;
                    return <span key={`${point.date}-${index}`} style={{ height: `${height}%` }} title={`${point.date}：${point.close}`} />;
                  })}
                </div>
                <div className="chart-axis"><span>{company.trend[0]?.date}</span><span>最近</span></div>
              </article>

              <article className="content-card metric-card">
                <div className="card-heading">
                  <div>
                    <p className="eyebrow">核心指标</p>
                    <h3>先看这几个数字</h3>
                  </div>
                  <button type="button" className="explain-button" onClick={() => window.alert("绿色表示相对有利，橙色表示需要留意。银行、保险等行业会采用更适合本行业的口径。")}>这些词怎么看？</button>
                </div>
                <div className="metric-grid">
                  {company.metrics.map((metric) => (
                    <div className={`metric metric--${metric.tone}`} key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                      <small>{metric.hint}</small>
                    </div>
                  ))}
                </div>
              </article>

              <article className="content-card two-sides-card company-sides">
                <div className="side-list side-list--good">
                  <h3><span aria-hidden="true">＋</span>相对优势</h3>
                  <ul>{company.advantages.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div className="side-list side-list--risk">
                  <h3><span aria-hidden="true">!</span>主要风险</h3>
                  <ul>{company.risks.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </article>

              <article className="content-card peer-card">
                <div className="card-heading">
                  <div>
                    <p className="eyebrow">同业比较</p>
                    <h3>和同行放在一起看</h3>
                  </div>
                  <span className="plain-chip">{company.industry}</span>
                </div>
                <div className="peer-table-wrap">
                  <table>
                    <thead>
                      <tr><th>公司</th><th>价格</th><th>市盈率</th><th>市值</th></tr>
                    </thead>
                    <tbody>
                      {company.peers.map((peer) => (
                        <tr key={peer.code} className={peer.code === company.code ? "is-current" : ""}>
                          <td><strong>{peer.name}</strong><small>{peer.code}{peer.code === company.code ? " · 当前" : ""}</small></td>
                          <td>{peer.price ? formatNumber(peer.price) : "—"}</td>
                          <td>{peer.pe ? `${formatNumber(peer.pe, 1)} 倍` : "—"}</td>
                          <td>{peer.marketCapYi ? `${formatNumber(peer.marketCapYi, 0)} 亿` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="watch-card">
                <div className="watch-mark" aria-hidden="true">看</div>
                <div>
                  <p className="eyebrow">接下来重点关注</p>
                  <h3>不用天天盯盘，等这几个信号</h3>
                  <ol>{company.watch.map((item) => <li key={item}>{item}</li>)}</ol>
                </div>
              </article>
            </div>
          )}
        </section>
      )}

      {activeTab === "industry" && (
        <section className="page-section" aria-labelledby="industry-title">
          <div className="section-intro section-intro--row">
            <div>
              <p className="eyebrow">从大环境看到细行业</p>
              <h2 id="industry-title">行业现在怎么样？</h2>
              <p>先看行业里的多数公司，再看单个龙头，避免只盯一只股票。</p>
            </div>
            <div className="legend-box"><span className="dot dot--rise" />较强 <span className="dot dot--flat" />平稳 <span className="dot dot--fall" />承压</div>
          </div>

          {!industries.length && !marketError && <LoadingCard label="正在汇总各行业情况…" />}
          {activeIndustry && (
            <>
              <article className={`industry-hero industry-hero--${activeIndustry.status}`}>
                <div>
                  <p className="eyebrow">当前选择</p>
                  <h3>{activeIndustry.name}</h3>
                  <p>{activeIndustry.note}</p>
                </div>
                <div className="industry-score">
                  <span>行业平均涨跌</span>
                  <strong className={toneForPct(activeIndustry.pct)}>{pctText(activeIndustry.pct)}</strong>
                  <small>{activeIndustry.status}</small>
                </div>
                <div className="industry-facts">
                  <div><span>上涨覆盖</span><strong>{activeIndustry.advanceRate === null ? "暂无" : `${formatNumber(activeIndustry.advanceRate, 0)}%`}</strong></div>
                  <div><span>成交规模</span><strong>{formatNumber(activeIndustry.amountYi, 0)} 亿</strong></div>
                  <div><span>市盈率中位数</span><strong>{activeIndustry.medianPe ? `${formatNumber(activeIndustry.medianPe, 1)} 倍` : "暂无"}</strong></div>
                </div>
              </article>

              <div className="industry-list" role="group" aria-label="成交较活跃的行业情况列表">
                {industries.slice(0, 12).map((industry) => (
                  <button
                    type="button"
                    className={selectedIndustry === industry.name ? "is-selected" : ""}
                    aria-pressed={selectedIndustry === industry.name}
                    key={industry.name}
                    onClick={() => setSelectedIndustry(industry.name)}
                  >
                    <div className="industry-list__top">
                      <span className={`status-dot status-dot--${industry.status}`} />
                      <strong>{industry.name}</strong>
                      <em className={toneForPct(industry.pct)}>{pctText(industry.pct)}</em>
                    </div>
                    <p>{industry.note}</p>
                    <div className="industry-list__foot">
                      <span>上涨覆盖 {industry.advanceRate === null ? "暂无" : `${formatNumber(industry.advanceRate, 0)}%`}</span>
                      <span>成交 {formatNumber(industry.amountYi, 0)} 亿</span>
                    </div>
                  </button>
                ))}
              </div>

              <article className="content-card macro-card">
                <div className="macro-mark" aria-hidden="true">宏</div>
                <div>
                  <p className="eyebrow">怎么看宏观环境</p>
                  <h3>四件事，影响多数行业</h3>
                  <div className="macro-grid">
                    <div><strong>需求</strong><span>订单、消费和出口有没有改善</span></div>
                    <div><strong>成本</strong><span>原材料、能源和人工价格怎么变</span></div>
                    <div><strong>资金</strong><span>利率与融资环境是否更友好</span></div>
                    <div><strong>政策</strong><span>行业支持、规范与监管方向</span></div>
                  </div>
                </div>
              </article>
            </>
          )}
        </section>
      )}

      {activeTab === "global" && (
        <section className="page-section global-section" aria-labelledby="global-title">
          <div className="section-intro section-intro--row">
            <div>
              <p className="eyebrow">只作参考，不提供美股交易建议</p>
              <h2 id="global-title">昨夜美股，怎么看？</h2>
              <p>我们只看市场风向和行业共同因素，再回到 A 股自己的政策、需求和财报。</p>
            </div>
            <span className="reference-only-chip">美股参考模式</span>
          </div>

          {usLoading && <LoadingCard label="正在整理昨夜美股和中美行业线索…" />}
          {usError && !usLoading && <EmptyCard title="暂时没有美股参考" text={usError} />}

          {usReference && !usLoading && (
            <>
              <article className={`global-hero global-hero--${usReference.mood}`}>
                <div className="global-orbit" aria-hidden="true">
                  <span>美</span>
                  <i />
                </div>
                <div className="global-hero__copy">
                  <p className="eyebrow">三大指数平均体感</p>
                  <h3>整体{usReference.mood}</h3>
                  <p>{usReference.moodNote}</p>
                </div>
                <div className="global-hero__boundary">
                  <span>怎么使用这条信息</span>
                  <strong>先找共同因素，再看 A 股是否有自己的数据配合</strong>
                </div>
              </article>

              <div className="index-grid us-index-grid" aria-label="美国主要指数">
                {usReference.indices.map((index) => (
                  <article className="index-card" key={index.code}>
                    <p>{index.name}<small>{index.isProxy ? "ETF 代理" : "指数"}</small></p>
                    <strong>{formatNumber(index.close)}</strong>
                    <span className={`change ${toneForPct(index.pct)}`}>{pctText(index.pct)}</span>
                  </article>
                ))}
              </div>

              <div className="global-summary-grid">
                <article className="content-card takeaway-card">
                  <div className="card-heading">
                    <div>
                      <p className="eyebrow">三句话看懂</p>
                      <h3>昨夜留下什么线索？</h3>
                    </div>
                    <span className="plain-chip">北京时间次日参考</span>
                  </div>
                  <ol>
                    {usReference.takeaways.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                </article>

                <article className="content-card reference-rules">
                  <div><span>1</span><strong>看共同变量</strong><p>芯片、油价、利率和全球需求，可能同时影响两个市场。</p></div>
                  <div><span>2</span><strong>看是否同向</strong><p>只有 A 股对应行业也有数据配合，参考意义才会提高。</p></div>
                  <div><span>3</span><strong>不照搬涨跌</strong><p>政策、估值和投资者结构不同，隔夜上涨不是买入信号。</p></div>
                </article>
              </div>

              <div className="global-subheading">
                <div>
                  <p className="eyebrow">行业参考地图</p>
                  <h3>点一个美股行业，和 A 股放在一起看</h3>
                </div>
                <p>这里用行业 ETF 做参考篮子，不是官方行业分类；只比较共同因素，不比较哪边“更值得买”。</p>
              </div>

              <div className="us-sector-grid" role="group" aria-label="美股行业参考列表">
                {usReference.sectors.map((sector) => (
                  <button
                    type="button"
                    key={sector.id}
                    className={selectedUsSector === sector.id ? "is-selected" : ""}
                    aria-pressed={selectedUsSector === sector.id}
                    onClick={() => setSelectedUsSector(sector.id)}
                  >
                    <div className="us-sector-grid__top">
                      <span className={`status-dot status-dot--${sector.status}`} />
                      <strong>{sector.name}</strong>
                      <em className={sector.pct === null ? "flat" : toneForPct(sector.pct)}>
                        {sector.pct === null ? "暂无" : pctText(sector.pct)}
                      </em>
                    </div>
                    <p>对应参考：{sector.cnLabel}</p>
                    <div><span>经验关联度</span><b>{sector.referenceStrength}</b></div>
                  </button>
                ))}
              </div>

              {activeUsSector && (
                <article className="cross-market-card">
                  <div className="cross-market-card__head">
                    <div>
                      <p className="eyebrow">中美行业对照</p>
                      <h3>{activeUsSector.name} ↔ {activeUsSector.cnLabel}</h3>
                    </div>
                    <span className={`reference-scale reference-scale--${activeUsSector.referenceStrength}`}>经验关联度：{activeUsSector.referenceStrength}</span>
                  </div>

                  <div className="cross-market-pair">
                    <div className="cross-column cross-column--us">
                      <span>美股行业参考</span>
                      <strong>{activeUsSector.name}</strong>
                      <em className={activeUsSector.pct === null ? "flat" : toneForPct(activeUsSector.pct)}>
                        {activeUsSector.pct === null ? "暂无涨跌数据" : pctText(activeUsSector.pct)}
                      </em>
                      <small>数据日：{usMeta?.tradeDate ?? usReference.tradeDate}<br />{activeUsSector.referenceNote}</small>
                    </div>
                    <div className="link-mark" aria-hidden="true">↔</div>
                    <div className="cross-column cross-column--cn">
                      <span>A 股对应观察</span>
                      <strong>{matchingCnIndustry?.name ?? activeUsSector.cnLabel}</strong>
                      <em className={matchingCnIndustry ? toneForPct(matchingCnIndustry.pct) : "flat"}>
                        {matchingCnIndustry ? pctText(matchingCnIndustry.pct) : "等待对应数据"}
                      </em>
                      <small>数据日：{industryMeta?.tradeDate ?? "等待对应数据"}<br />{matchingCnIndustry?.note ?? "以国内行业数据和公司财报为准"}</small>
                    </div>
                  </div>

                  <div className="cross-market-reasoning">
                    <div><span>通常共同因素（经验项）</span><strong>{activeUsSector.commonDriver}</strong></div>
                    <div><span>主要差异</span><strong>{activeUsSector.difference}</strong></div>
                    <div><span>当前关系</span><strong>{crossMarketRelation}</strong></div>
                  </div>
                </article>
              )}

              <article className="overnight-flow">
                <div className="overnight-flow__intro">
                  <div className="watch-mark" aria-hidden="true">隔</div>
                  <div><p className="eyebrow">正确的参考顺序</p><h3>从美股收盘，到 A 股判断</h3></div>
                </div>
                <div className="overnight-steps">
                  <div><span>昨夜</span><strong>美股行业变化</strong><p>先找变化最大的行业</p></div>
                  <i aria-hidden="true">→</i>
                  <div><span>早间</span><strong>核对共同因素</strong><p>油价、芯片、利率或需求</p></div>
                  <i aria-hidden="true">→</i>
                  <div><span>今天</span><strong>回到 A 股数据</strong><p>看政策、估值与公司财报</p></div>
                </div>
              </article>

              <div className="reference-caution" role="note">
                <strong>边界说明：</strong>{usReference.caution}
              </div>
            </>
          )}
        </section>
      )}

      <footer className="site-footer">
        <div>
          <strong>安心看盘</strong>
          <span>数据先核对，结论再说清楚。</span>
        </div>
        <p>本工具用于信息整理与学习交流，不构成任何投资建议。市场有风险，决策需谨慎。</p>
      </footer>

      <nav className="bottom-nav" aria-label="手机端主要功能">
        {navItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={activeTab === item.id ? "is-active" : ""}
            onClick={() => jumpTo(item.id)}
          >
            <span aria-hidden="true">{item.mark}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
    </main>
  );
}
