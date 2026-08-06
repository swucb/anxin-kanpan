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

type ComparisonSymbols = [
  [string, string],
  [string, string],
  [string, string],
  [string, string],
  [string, string],
  [string, string],
  [string, string],
];

type IndustryOption = {
  id: string;
  name: string;
  symbols: ComparisonSymbols;
};

type GlobalSector = {
  id: string;
  name: string;
  usSymbols: ComparisonSymbols;
  cnSymbols: ComparisonSymbols;
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
  aiSummary?: string;
  aiUpdatedAt?: string;
  cn: { label: string; symbol: string; changePct: number; asOf: string; session: string };
  us: { label: string; symbol: string; changePct: number; asOf: string; session: string };
};

type MarketIndex = {
  name: string;
  code: string;
  current: number;
  change: number;
  changePct: number;
  asOf: string;
};

type TrendPoint = { date: string; close: number };

type CompanyPreferences = {
  version: 1;
  favorites: StockOption[];
  recents: StockOption[];
};

const COMPANY_PREFS_KEY = "anxin-company-prefs-v1";
const MAX_SAVED_COMPANIES = 8;
const STATIC_DATA_ROOT = process.env.NEXT_PUBLIC_STATIC_DATA === "true"
  ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data`
  : "/api";

function dataEndpoint(name: "macro" | "industry-pulse" | "market"): string {
  return process.env.NEXT_PUBLIC_STATIC_DATA === "true"
    ? `${STATIC_DATA_ROOT}/${name}.json`
    : `${STATIC_DATA_ROOT}/${name}`;
}

function historyEndpoint(symbol: string): string {
  return `${STATIC_DATA_ROOT}/history/${symbol.replace(":", "-")}.json`;
}

function StaticTrendWidget({ symbols }: { symbols: Array<[string, string]> }) {
  const cleanSymbols = useMemo(() => symbols.map(([label, symbol]) => [label, symbol.split("|")[0]] as [string, string]), [symbols]);
  const [selected, setSelected] = useState(cleanSymbols[0]?.[1] ?? "");
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [hourly, setHourly] = useState<TrendPoint[]>([]);
  const [failed, setFailed] = useState(false);
  const [range, setRange] = useState<1 | 7 | 30 | 90>(1);
  const activeSymbol = cleanSymbols.some((item) => item[1] === selected) ? selected : cleanSymbols[0]?.[1] ?? "";
  const activeLabel = cleanSymbols.find((item) => item[1] === activeSymbol)?.[0] ?? "行情";

  useEffect(() => {
    if (!activeSymbol) return;
    const controller = new AbortController();
    setPoints([]);
    setHourly([]);
    setFailed(false);
    fetch(`${historyEndpoint(activeSymbol)}?refresh=${Date.now()}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("history unavailable");
        return response.json();
      })
      .then((payload) => {
        setPoints(payload.points ?? []);
        setHourly(payload.hourly ?? []);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [activeSymbol]);

  const hasHourly = range === 1 && hourly.length > 1;
  const visiblePoints = range === 1 ? (hasHourly ? hourly : points.slice(-2)) : points.slice(-range);
  const values = visiblePoints.map((point) => point.close);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = Math.max(maximum - minimum, maximum * 0.01, 1);
  const coordinates = visiblePoints.map((point, index) => {
    const x = visiblePoints.length === 1 ? 200 : 12 + (index / (visiblePoints.length - 1)) * 376;
    const y = 174 - ((point.close - minimum) / spread) * 150;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const first = visiblePoints[0]?.close ?? 0;
  const latest = visiblePoints.at(-1)?.close ?? 0;
  const changePct = first ? ((latest - first) / first) * 100 : 0;
  const direction = changePct > 0 ? "up" : changePct < 0 ? "down" : "flat";

  return (
    <div className="static-trend">
      {cleanSymbols.length > 1 && (
        <div className="trend-tabs" role="tablist" aria-label="选择趋势">
          {cleanSymbols.map(([label, symbol]) => (
            <button type="button" role="tab" aria-selected={symbol === activeSymbol} className={symbol === activeSymbol ? "is-selected" : ""} key={symbol} onClick={() => setSelected(symbol)}>{label}</button>
          ))}
        </div>
      )}
      <div className="trend-heading">
        <div><strong>{activeLabel}</strong><span>{range === 1 ? (hasHourly ? "上一交易日 · 分小时" : "上一交易日 · 收盘变化") : `最近${range}个交易日`}</span></div>
        {points.length > 0 && <div className={direction}><strong>{latest.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</strong><span>{changePct > 0 ? "+" : ""}{changePct.toFixed(2)}%</span></div>}
      </div>
      <div className="range-tabs" role="group" aria-label="趋势周期">
        {([1, 7, 30, 90] as const).map((days) => <button type="button" className={range === days ? "is-selected" : ""} aria-pressed={range === days} key={days} onClick={() => setRange(days)}>{days === 1 ? "1日·小时" : `${days}日`}</button>)}
      </div>
      {failed ? <div className="trend-loading">本次趋势暂未生成，请稍后刷新。</div> : points.length ? (
        <svg className={`trend-chart ${direction}`} viewBox="0 0 400 190" role="img" aria-label={`${activeLabel}${range === 1 ? "上一交易日" : `最近${range}个交易日`}趋势`}>
          <line x1="12" x2="388" y1="174" y2="174" />
          <polyline points={coordinates} />
        </svg>
      ) : <div className="trend-loading">正在加载趋势…</div>}
      {visiblePoints.length > 0 && (hasHourly ? <div className="trend-hours">{visiblePoints.map((point) => <span key={point.date}>{point.date.slice(11)}</span>)}</div> : <div className="trend-dates"><span>{visiblePoints[0].date.slice(5)}</span><span>{visiblePoints.at(-1)?.date.slice(5)}</span></div>)}
    </div>
  );
}

function MarketOverview() {
  const [items, setItems] = useState<MarketIndex[]>([]);
  const [status, setStatus] = useState<{ source: string; session: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(dataEndpoint("market"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("market unavailable");
        return response.json();
      })
      .then((payload) => {
        setItems(payload.data ?? []);
        setStatus({ source: payload.source ?? "公开行情", session: payload.session ?? "最近更新" });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, []);

  if (failed) return <div className="market-status">行情暂时未加载，请稍后刷新。</div>;
  if (!items.length) return <div className="market-status">正在加载今日行情…</div>;

  return (
    <div className="market-overview" aria-live="polite">
      <StaticTrendWidget symbols={[
        ["上证", "SSE:000001"],
        ["深证", "SZSE:399001"],
        ["创业板", "SZSE:399006"],
        ["沪深300", "SSE:000300"],
      ]} />
      <div className="market-list">
        {items.map((item) => {
          const direction = item.changePct > 0 ? "up" : item.changePct < 0 ? "down" : "flat";
          const sign = item.changePct > 0 ? "+" : "";
          return (
            <article className={`market-row ${direction}`} key={item.code}>
              <div><strong>{item.name}</strong><span>{item.code}</span></div>
              <div><strong>{item.current.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</strong><span>{sign}{item.change.toFixed(2)}　{sign}{item.changePct.toFixed(2)}%</span></div>
            </article>
          );
        })}
      </div>
      <footer>{status?.session} · {items[0]?.asOf.slice(0, 16)} · {status?.source}</footer>
    </div>
  );
}

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
      { name: "东鹏饮料", code: "605499", symbol: "SSE:605499" },
      { name: "珀莱雅", code: "603605", symbol: "SSE:603605" },
      { name: "乖宝宠物", code: "301498", symbol: "SZSE:301498" },
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
      { name: "宁波银行", code: "002142", symbol: "SZSE:002142" },
      { name: "江苏银行", code: "600919", symbol: "SSE:600919" },
      { name: "杭州银行", code: "600926", symbol: "SSE:600926" },
      { name: "国泰海通", code: "601211", symbol: "SSE:601211" },
      { name: "国联民生", code: "601456", symbol: "SSE:601456" },
      { name: "中金公司", code: "601995", symbol: "SSE:601995" },
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
      { name: "赛力斯", code: "601127", symbol: "SSE:601127" },
      { name: "拓普集团", code: "601689", symbol: "SSE:601689" },
      { name: "晶科能源", code: "688223", symbol: "SSE:688223" },
      { name: "阿特斯", code: "688472", symbol: "SSE:688472" },
      { name: "德业股份", code: "605117", symbol: "SSE:605117" },
    ],
  },
  {
    name: "科技通信",
    items: [
      { name: "中芯国际", code: "688981", symbol: "SSE:688981" },
      { name: "寒武纪", code: "688256", symbol: "SSE:688256" },
      { name: "北方华创", code: "002371", symbol: "SZSE:002371" },
      { name: "豪威集团", code: "603501", symbol: "SSE:603501" },
      { name: "海光信息", code: "688041", symbol: "SSE:688041" },
      { name: "中微公司", code: "688012", symbol: "SSE:688012" },
      { name: "澜起科技", code: "688008", symbol: "SSE:688008" },
      { name: "科大讯飞", code: "002230", symbol: "SZSE:002230" },
      { name: "金山办公", code: "688111", symbol: "SSE:688111" },
      { name: "中科曙光", code: "603019", symbol: "SSE:603019" },
      { name: "浪潮信息", code: "000977", symbol: "SZSE:000977" },
      { name: "海康威视", code: "002415", symbol: "SZSE:002415" },
      { name: "立讯精密", code: "002475", symbol: "SZSE:002475" },
      { name: "工业富联", code: "601138", symbol: "SSE:601138" },
      { name: "中国移动", code: "600941", symbol: "SSE:600941" },
      { name: "中国联通", code: "600050", symbol: "SSE:600050" },
      { name: "中兴通讯", code: "000063", symbol: "SZSE:000063" },
      { name: "中际旭创", code: "300308", symbol: "SZSE:300308" },
      { name: "新易盛", code: "300502", symbol: "SZSE:300502" },
      { name: "天孚通信", code: "300394", symbol: "SZSE:300394" },
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
      { name: "百济神州", code: "688235", symbol: "SSE:688235" },
      { name: "科伦药业", code: "002422", symbol: "SZSE:002422" },
      { name: "联影医疗", code: "688271", symbol: "SSE:688271" },
    ],
  },
  {
    name: "家电制造军工",
    items: [
      { name: "美的集团", code: "000333", symbol: "SZSE:000333" },
      { name: "格力电器", code: "000651", symbol: "SZSE:000651" },
      { name: "海尔智家", code: "600690", symbol: "SSE:600690" },
      { name: "海信家电", code: "000921", symbol: "SZSE:000921" },
      { name: "石头科技", code: "688169", symbol: "SSE:688169" },
      { name: "科沃斯", code: "603486", symbol: "SSE:603486" },
      { name: "三一重工", code: "600031", symbol: "SSE:600031" },
      { name: "汇川技术", code: "300124", symbol: "SZSE:300124" },
      { name: "中国中车", code: "601766", symbol: "SSE:601766" },
      { name: "中国船舶", code: "600150", symbol: "SSE:600150" },
      { name: "航发动力", code: "600893", symbol: "SSE:600893" },
      { name: "中航沈飞", code: "600760", symbol: "SSE:600760" },
      { name: "中航西飞", code: "000768", symbol: "SZSE:000768" },
      { name: "中航成飞", code: "302132", symbol: "SZSE:302132" },
      { name: "华秦科技", code: "688281", symbol: "SSE:688281" },
      { name: "京东方A", code: "000725", symbol: "SZSE:000725" },
    ],
  },
  {
    name: "能源资源化工",
    items: [
      { name: "中国石油", code: "601857", symbol: "SSE:601857" },
      { name: "中国石化", code: "600028", symbol: "SSE:600028" },
      { name: "中国海油", code: "600938", symbol: "SSE:600938" },
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
      { name: "国电电力", code: "600795", symbol: "SSE:600795" },
      { name: "华电新能", code: "600930", symbol: "SSE:600930" },
      { name: "中煤能源", code: "601898", symbol: "SSE:601898" },
      { name: "山西焦煤", code: "000983", symbol: "SZSE:000983" },
      { name: "新集能源", code: "601918", symbol: "SSE:601918" },
      { name: "中国铝业", code: "601600", symbol: "SSE:601600" },
      { name: "赣锋锂业", code: "002460", symbol: "SZSE:002460" },
      { name: "华友钴业", code: "603799", symbol: "SSE:603799" },
      { name: "万华化学", code: "600309", symbol: "SSE:600309" },
      { name: "盐湖股份", code: "000792", symbol: "SZSE:000792" },
      { name: "巨化股份", code: "600160", symbol: "SSE:600160" },
      { name: "华鲁恒升", code: "600426", symbol: "SSE:600426" },
      { name: "宝丰能源", code: "600989", symbol: "SSE:600989" },
      { name: "卫星化学", code: "002648", symbol: "SZSE:002648" },
      { name: "天赐材料", code: "002709", symbol: "SZSE:002709" },
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
      ["贵州茅台", "SSE:600519|12M"],
      ["五粮液", "SZSE:000858|12M"],
      ["伊利股份", "SSE:600887|12M"],
      ["东鹏饮料", "SSE:605499|12M"],
      ["珀莱雅", "SSE:603605|12M"],
      ["乖宝宠物", "SZSE:301498|12M"],
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
      ["宁波银行", "SZSE:002142|12M"],
      ["江苏银行", "SSE:600919|12M"],
      ["杭州银行", "SSE:600926|12M"],
    ],
  },
  {
    id: "brokerage",
    name: "券商",
    symbols: [
      ["券商ETF", "SSE:512880|12M"],
      ["中信证券", "SSE:600030|12M"],
      ["华泰证券", "SSE:601688|12M"],
      ["国泰海通", "SSE:601211|12M"],
      ["国联民生", "SSE:601456|12M"],
      ["东方财富", "SZSE:300059|12M"],
      ["中金公司", "SSE:601995|12M"],
    ],
  },
  {
    id: "chips",
    name: "半导体",
    symbols: [
      ["半导体ETF", "SSE:512480|12M"],
      ["中芯国际", "SSE:688981|12M"],
      ["北方华创", "SZSE:002371|12M"],
      ["中微公司", "SSE:688012|12M"],
      ["海光信息", "SSE:688041|12M"],
      ["澜起科技", "SSE:688008|12M"],
      ["豪威集团", "SSE:603501|12M"],
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
      ["中科曙光", "SSE:603019|12M"],
      ["浪潮信息", "SZSE:000977|12M"],
      ["中际旭创", "SZSE:300308|12M"],
    ],
  },
  {
    id: "communication",
    name: "通信",
    symbols: [
      ["通信ETF", "SSE:515880|12M"],
      ["中国移动", "SSE:600941|12M"],
      ["中国联通", "SSE:600050|12M"],
      ["中兴通讯", "SZSE:000063|12M"],
      ["中际旭创", "SZSE:300308|12M"],
      ["新易盛", "SZSE:300502|12M"],
      ["天孚通信", "SZSE:300394|12M"],
    ],
  },
  {
    id: "new-energy",
    name: "新能源车",
    symbols: [
      ["新能源车ETF", "SSE:515030|12M"],
      ["宁德时代", "SZSE:300750|12M"],
      ["比亚迪", "SZSE:002594|12M"],
      ["长安汽车", "SZSE:000625|12M"],
      ["赛力斯", "SSE:601127|12M"],
      ["亿纬锂能", "SZSE:300014|12M"],
      ["拓普集团", "SSE:601689|12M"],
    ],
  },
  {
    id: "solar",
    name: "光伏",
    symbols: [
      ["光伏ETF", "SSE:515790|12M"],
      ["隆基绿能", "SSE:601012|12M"],
      ["通威股份", "SSE:600438|12M"],
      ["阳光电源", "SZSE:300274|12M"],
      ["晶科能源", "SSE:688223|12M"],
      ["阿特斯", "SSE:688472|12M"],
      ["德业股份", "SSE:605117|12M"],
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
      ["百济神州", "SSE:688235|12M"],
      ["科伦药业", "SZSE:002422|12M"],
      ["联影医疗", "SSE:688271|12M"],
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
      ["海信家电", "SZSE:000921|12M"],
      ["石头科技", "SSE:688169|12M"],
      ["科沃斯", "SSE:603486|12M"],
    ],
  },
  {
    id: "defense",
    name: "军工",
    symbols: [
      ["军工ETF", "SSE:512660|12M"],
      ["中国船舶", "SSE:600150|12M"],
      ["中航沈飞", "SSE:600760|12M"],
      ["航发动力", "SSE:600893|12M"],
      ["中航西飞", "SZSE:000768|12M"],
      ["中航成飞", "SZSE:302132|12M"],
      ["华秦科技", "SSE:688281|12M"],
    ],
  },
  {
    id: "power",
    name: "电力",
    symbols: [
      ["电力ETF", "SZSE:159611|12M"],
      ["长江电力", "SSE:600900|12M"],
      ["华能水电", "SSE:600025|12M"],
      ["中国核电", "SSE:601985|12M"],
      ["国电电力", "SSE:600795|12M"],
      ["三峡能源", "SSE:600905|12M"],
      ["华电新能", "SSE:600930|12M"],
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
      ["中煤能源", "SSE:601898|12M"],
      ["山西焦煤", "SZSE:000983|12M"],
      ["新集能源", "SSE:601918|12M"],
    ],
  },
  {
    id: "metals",
    name: "有色金属",
    symbols: [
      ["有色ETF", "SSE:512400|12M"],
      ["紫金矿业", "SSE:601899|12M"],
      ["洛阳钼业", "SSE:603993|12M"],
      ["中国铝业", "SSE:601600|12M"],
      ["北方稀土", "SSE:600111|12M"],
      ["赣锋锂业", "SZSE:002460|12M"],
      ["华友钴业", "SSE:603799|12M"],
    ],
  },
  {
    id: "chemical",
    name: "化工",
    symbols: [
      ["化工ETF", "SSE:516020|12M"],
      ["万华化学", "SSE:600309|12M"],
      ["华鲁恒升", "SSE:600426|12M"],
      ["宝丰能源", "SSE:600989|12M"],
      ["卫星化学", "SZSE:002648|12M"],
      ["巨化股份", "SSE:600160|12M"],
      ["天赐材料", "SZSE:002709|12M"],
    ],
  },
];

const globalSectors: GlobalSector[] = [
  {
    id: "technology",
    name: "科技",
    usSymbols: [
      ["美股科技ETF XLK", "AMEX:XLK|12M"],
      ["微软 MSFT", "NASDAQ:MSFT|12M"],
      ["苹果 AAPL", "NASDAQ:AAPL|12M"],
      ["英伟达 NVDA", "NASDAQ:NVDA|12M"],
      ["Alphabet GOOGL", "NASDAQ:GOOGL|12M"],
      ["博通 AVGO", "NASDAQ:AVGO|12M"],
      ["Palantir PLTR", "NASDAQ:PLTR|12M"],
    ],
    cnSymbols: [
      ["A股科技ETF", "SSE:515000|12M"],
      ["中芯国际", "SSE:688981|12M"],
      ["北方华创", "SZSE:002371|12M"],
      ["工业富联", "SSE:601138|12M"],
      ["科大讯飞", "SZSE:002230|12M"],
      ["寒武纪", "SSE:688256|12M"],
      ["中际旭创", "SZSE:300308|12M"],
    ],
  },
  {
    id: "healthcare",
    name: "医疗",
    usSymbols: [
      ["美股医疗ETF XLV", "AMEX:XLV|12M"],
      ["礼来 LLY", "NYSE:LLY|12M"],
      ["联合健康 UNH", "NYSE:UNH|12M"],
      ["强生 JNJ", "NYSE:JNJ|12M"],
      ["艾伯维 ABBV", "NYSE:ABBV|12M"],
      ["直觉外科 ISRG", "NASDAQ:ISRG|12M"],
      ["Vertex VRTX", "NASDAQ:VRTX|12M"],
    ],
    cnSymbols: [
      ["A股医药ETF", "SSE:512010|12M"],
      ["恒瑞医药", "SSE:600276|12M"],
      ["迈瑞医疗", "SZSE:300760|12M"],
      ["药明康德", "SSE:603259|12M"],
      ["百济神州", "SSE:688235|12M"],
      ["科伦药业", "SZSE:002422|12M"],
      ["联影医疗", "SSE:688271|12M"],
    ],
  },
  {
    id: "consumer",
    name: "消费",
    usSymbols: [
      ["美股消费ETF XLP", "AMEX:XLP|12M"],
      ["沃尔玛 WMT", "NASDAQ:WMT|12M"],
      ["好市多 COST", "NASDAQ:COST|12M"],
      ["宝洁 PG", "NYSE:PG|12M"],
      ["可口可乐 KO", "NYSE:KO|12M"],
      ["Celsius CELH", "NASDAQ:CELH|12M"],
      ["e.l.f. Beauty ELF", "NYSE:ELF|12M"],
    ],
    cnSymbols: [
      ["A股消费ETF", "SZSE:159928|12M"],
      ["贵州茅台", "SSE:600519|12M"],
      ["五粮液", "SZSE:000858|12M"],
      ["伊利股份", "SSE:600887|12M"],
      ["海天味业", "SSE:603288|12M"],
      ["东鹏饮料", "SSE:605499|12M"],
      ["珀莱雅", "SSE:603605|12M"],
    ],
  },
  {
    id: "energy",
    name: "能源",
    usSymbols: [
      ["美股能源ETF XLE", "AMEX:XLE|12M"],
      ["埃克森美孚 XOM", "NYSE:XOM|12M"],
      ["雪佛龙 CVX", "NYSE:CVX|12M"],
      ["康菲石油 COP", "NYSE:COP|12M"],
      ["NextEra能源 NEE", "NYSE:NEE|12M"],
      ["星座能源 CEG", "NASDAQ:CEG|12M"],
      ["第一太阳能 FSLR", "NASDAQ:FSLR|12M"],
    ],
    cnSymbols: [
      ["A股能源ETF", "SZSE:159930|12M"],
      ["中国石油", "SSE:601857|12M"],
      ["中国海油", "SSE:600938|12M"],
      ["中国神华", "SSE:601088|12M"],
      ["长江电力", "SSE:600900|12M"],
      ["中国核电", "SSE:601985|12M"],
      ["华电新能", "SSE:600930|12M"],
    ],
  },
  {
    id: "finance",
    name: "金融",
    usSymbols: [
      ["美股金融ETF XLF", "AMEX:XLF|12M"],
      ["摩根大通 JPM", "NYSE:JPM|12M"],
      ["美国银行 BAC", "NYSE:BAC|12M"],
      ["高盛 GS", "NYSE:GS|12M"],
      ["Visa V", "NYSE:V|12M"],
      ["Robinhood HOOD", "NASDAQ:HOOD|12M"],
      ["SoFi SOFI", "NASDAQ:SOFI|12M"],
    ],
    cnSymbols: [
      ["A股金融ETF", "SSE:510230|12M"],
      ["工商银行", "SSE:601398|12M"],
      ["招商银行", "SSE:600036|12M"],
      ["中国平安", "SSE:601318|12M"],
      ["中信证券", "SSE:600030|12M"],
      ["东方财富", "SZSE:300059|12M"],
      ["国泰海通", "SSE:601211|12M"],
    ],
  },
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
    const timeout = window.setTimeout(() => {
      if (!host.querySelector("iframe")) setFailed(true);
    }, 7000);
    return () => {
      window.clearTimeout(timeout);
      host.replaceChildren();
    };
  }, [configText, label, script]);

  return (
    <div className="widget-frame" style={{ height }}>
      <div ref={container} className="tradingview-widget-container" />
      {failed && (
        <a className="widget-fallback" href="https://cn.tradingview.com/markets/china/" target="_blank" rel="noreferrer">
          当前浏览器未能加载图表，请用系统浏览器打开
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
    fetch(dataEndpoint("macro"), { signal: controller.signal })
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
    fetch(dataEndpoint("industry-pulse"), { signal: controller.signal })
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
  if (failed) return <p className="industry-pulse-status">上一交易日对比暂时未加载，趋势仍可查看。</p>;
  if (!active) return <p className="industry-pulse-status">正在加载上一交易日对比…</p>;

  return (
    <article className="industry-pulse" aria-live="polite">
      <strong>上一交易日</strong>
      <p>{active.summary}</p>
      {active.aiSummary && <div className="ai-analysis"><span>Gemini 数据归纳</span><p>{active.aiSummary}</p></div>}
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
          <h1>安心看盘</h1>
        </div>
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
          {process.env.NEXT_PUBLIC_STATIC_DATA === "true" ? (
            <MarketOverview />
          ) : (
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
                tabs: [{
                  title: "A股指数",
                  symbols: [
                    { s: "SSE:000001", d: "上证指数" },
                    { s: "SZSE:399001", d: "深证成指" },
                    { s: "SZSE:399006", d: "创业板指" },
                    { s: "SSE:000300", d: "沪深300" },
                  ],
                  originalTitle: "A股指数",
                }],
              }}
            />
          )}
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

          {process.env.NEXT_PUBLIC_STATIC_DATA === "true" ? <StaticTrendWidget symbols={[[selectedCompany.name, selectedCompany.symbol]]} /> : <TradingViewWidget
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
          />}

          {process.env.NEXT_PUBLIC_STATIC_DATA !== "true" && <div className="widget-grid">
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
          </div>}
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

          {process.env.NEXT_PUBLIC_STATIC_DATA === "true" ? <StaticTrendWidget symbols={activeIndustry.symbols} /> : <TradingViewWidget
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
          />}

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
            <h2 id="global-title">中美行业对比</h2>
            <span>美股在上 · 大A在下</span>
          </div>

          <div className="choice-row" role="group" aria-label="选择对照行业">
            {globalSectors.map((sector) => (
              <button type="button" key={sector.id} className={sector.id === globalSectorId ? "is-selected" : ""} aria-pressed={sector.id === globalSectorId} onClick={() => setGlobalSectorId(sector.id)}>
                {sector.name}
              </button>
            ))}
          </div>

          <div className="market-compare-stack">
            <article>
              <h3>美股 · {activeGlobalSector.name}</h3>
              {process.env.NEXT_PUBLIC_STATIC_DATA === "true" ? <StaticTrendWidget symbols={activeGlobalSector.usSymbols} /> : <TradingViewWidget
                key={`global-us-${activeGlobalSector.id}`}
                script="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
                height={540}
                label={`美股${activeGlobalSector.name}`}
                config={{
                  ...widgetBase,
                  height: "100%",
                  symbols: activeGlobalSector.usSymbols,
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
              />}
            </article>

            <article>
              <h3>大A · {activeGlobalSector.name}</h3>
              {process.env.NEXT_PUBLIC_STATIC_DATA === "true" ? <StaticTrendWidget symbols={activeGlobalSector.cnSymbols} /> : <TradingViewWidget
                key={`global-cn-${activeGlobalSector.id}`}
                script="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
                height={540}
                label={`大A${activeGlobalSector.name}`}
                config={{
                  ...widgetBase,
                  height: "100%",
                  symbols: activeGlobalSector.cnSymbols,
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
              />}
            </article>
          </div>
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
