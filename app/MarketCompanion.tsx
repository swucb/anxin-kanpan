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

type Tab = "today" | "company" | "industry";

const navItems: Array<{ id: Tab; mark: string; label: string }> = [
  { id: "today", mark: "今", label: "今日行情" },
  { id: "company", mark: "查", label: "查企业" },
  { id: "industry", mark: "业", label: "看行业" },
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

  useEffect(() => {
    const saved = window.localStorage.getItem("anxin-large-type") === "true";
    setLargeType(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.typeSize = largeType ? "extra" : "large";
    window.localStorage.setItem("anxin-large-type", String(largeType));
  }, [largeType]);

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
    const normalized = query.trim();
    if (!searchOpen || normalized.length < 1) {
      setSearchResults([]);
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

  const displayMeta = activeTab === "company" ? companyMeta : activeTab === "industry" ? industryMeta : marketMeta;

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">安</div>
          <div>
            <p className="eyebrow">给家里人的 A 股助手</p>
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
        <span className="data-strip__time">更新：{formatTime(displayMeta?.updatedAt)}</span>
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
            {searchOpen && searchResults.length > 0 && (
              <div className="search-results" role="listbox" aria-label="搜索建议">
                {searchResults.map((result) => (
                  <button
                    type="button"
                    key={result.ts_code}
                    role="option"
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

              <div className="industry-list" role="list" aria-label="行业情况列表">
                {industries.map((industry) => (
                  <button
                    type="button"
                    role="listitem"
                    className={selectedIndustry === industry.name ? "is-selected" : ""}
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
