import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = Number(process.env.PORT || 8766);
const PROJECT_CONFIG_PATH = path.join(__dirname, "naver-api-config.json");
const USER_CONFIG_PATH = path.join(os.homedir(), ".naver-blog-agent", "naver-api-config.json");
let nextPort = DEFAULT_PORT;

const DEFAULT_BRANDS = [
  "메가커피",
  "컴포즈커피",
  "투썸플레이스",
  "파리바게뜨",
  "롯데리아",
  "서브웨이",
  "배스킨라빈스",
  "샐러디"
];

const DEFAULT_REGIONS = [
  "서울",
  "경기",
  "인천",
  "수원시",
  "용인시",
  "부천시",
  "성남시",
  "송파구",
  "마포구",
  "의정부시",
  "안양시",
  "천안시"
];

function parseList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBrands(brands) {
  const replacements = new Map([
    ["오브로1", "컴포즈커피"],
    ["이디야", "투썸플레이스"],
    ["이디야커피", "투썸플레이스"]
  ]);
  const clean = [];
  for (const raw of brands || []) {
    const brand = replacements.get(String(raw).trim()) || String(raw || "").trim();
    if (brand && !clean.includes(brand)) clean.push(brand);
  }
  return clean.length ? clean : DEFAULT_BRANDS;
}

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(payload));
}

function parseNumber(value) {
  if (value === undefined || value === null) return 0;
  const text = String(value).trim();
  if (!text || text.includes("<")) return 5;
  return Number(text.replace(/,/g, "")) || 0;
}

function normalizeKeyword(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function readJsonIfExists(file) {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}


async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function listCacheFiles() {
  try {
    const files = await fs.readdir(__dirname, { withFileTypes: true });
    return files
      .filter((file) => file.isFile() && /^keyword-cache.*\.json$/.test(file.name))
      .map((file) => file.name)
      .sort();
  } catch {
    return [];
  }
}

async function gitStatusSnapshot() {
  const gitDir = path.join(__dirname, ".git");
  const isGitRepo = await fileExists(gitDir);
  if (!isGitRepo) return { isGitRepo: false, repoRoot: __dirname };
  const head = (await readTextIfExists(path.join(gitDir, "HEAD"))).trim();
  const config = await readTextIfExists(path.join(gitDir, "config"));
  const origin = config.match(/url\s*=\s*(.+)/)?.[1]?.trim() || "";
  const branch = head.startsWith("ref:") ? path.basename(head.replace("ref:", "").trim()) : "detached";
  const refPath = head.startsWith("ref:") ? path.join(gitDir, head.replace("ref:", "").trim()) : "";
  const commit = refPath ? (await readTextIfExists(refPath)).trim() : head;
  return {
    isGitRepo,
    repoRoot: __dirname,
    branch,
    origin,
    commit: commit ? commit.slice(0, 12) : ""
  };
}

async function buildStatus(port) {
  const cfg = await loadConfig();
  const cacheFiles = await listCacheFiles();
  const git = await gitStatusSnapshot();
  return {
    ok: cfg.missing.length === 0 && git.isGitRepo,
    checkedAt: new Date().toISOString(),
    server: {
      port,
      url: `http://127.0.0.1:${port}/keyword-insight-agent/insight-agent.html`,
      platform: process.platform
    },
    git,
    config: {
      ok: cfg.missing.length === 0,
      source: cfg.configSource,
      missing: cfg.missing,
      openApiMissing: cfg.openApiMissing,
      locations: cfg.configLocations
    },
    data: {
      cacheFiles,
      cacheCount: cacheFiles.length,
      cacheHours: cfg.cacheHours,
      dailyRefreshHour: cfg.dailyRefreshHour
    }
  };
}
function configCandidates() {
  return [
    process.env.NAVER_BLOG_AGENT_CONFIG,
    PROJECT_CONFIG_PATH,
    USER_CONFIG_PATH
  ].filter(Boolean);
}

function isConfiguredValue(value) {
  const text = String(value || "").trim();
  return text && !text.startsWith("YOUR_");
}

async function findConfigFile() {
  for (const file of configCandidates()) {
    const data = await readJsonIfExists(file);
    if (data) return { file, data };
  }
  return { file: "", data: null };
}

async function loadConfig() {
  const found = await findConfigFile();
  const fileConfig = found.data;
  const cfg = {
    searchAdCustomerId: process.env.NAVER_SEARCHAD_CUSTOMER_ID || fileConfig?.searchAdCustomerId,
    searchAdAccessLicense: process.env.NAVER_SEARCHAD_ACCESS_LICENSE || fileConfig?.searchAdAccessLicense,
    searchAdSecretKey: process.env.NAVER_SEARCHAD_SECRET_KEY || fileConfig?.searchAdSecretKey,
    naverClientId: process.env.NAVER_CLIENT_ID || fileConfig?.naverClientId,
    naverClientSecret: process.env.NAVER_CLIENT_SECRET || fileConfig?.naverClientSecret,
    brands: normalizeBrands(fileConfig?.brands || DEFAULT_BRANDS),
    regions: fileConfig?.regions || DEFAULT_REGIONS,
    customKeywords: fileConfig?.customKeywords || [],
    cacheHours: Number(fileConfig?.cacheHours || process.env.NAVER_CACHE_HOURS || 24),
    dailyRefreshHour: Number(fileConfig?.dailyRefreshHour || process.env.NAVER_DAILY_REFRESH_HOUR || 8),
    configSource: found.file || "환경변수",
    configLocations: configCandidates()
  };
  const missing = [];
  const openApiMissing = [];
  if (!isConfiguredValue(cfg.searchAdCustomerId)) missing.push("NAVER_SEARCHAD_CUSTOMER_ID");
  if (!isConfiguredValue(cfg.searchAdAccessLicense)) missing.push("NAVER_SEARCHAD_ACCESS_LICENSE");
  if (!isConfiguredValue(cfg.searchAdSecretKey)) missing.push("NAVER_SEARCHAD_SECRET_KEY");
  if (!isConfiguredValue(cfg.naverClientId)) openApiMissing.push("NAVER_CLIENT_ID");
  if (!isConfiguredValue(cfg.naverClientSecret)) openApiMissing.push("NAVER_CLIENT_SECRET");
  return { ...cfg, missing, openApiMissing };
}

function searchAdSignature(timestamp, method, uri, secretKey) {
  return crypto
    .createHmac("sha256", secretKey)
    .update(`${timestamp}.${method}.${uri}`)
    .digest("base64");
}

async function searchAdKeywordTool(hints, cfg) {
  const uri = "/keywordstool";
  const safeHints = hints
    .map((hint) => String(hint).replace(/\s+/g, ""))
    .filter(Boolean);
  const qs = new URLSearchParams({
    hintKeywords: safeHints.join(","),
    showDetail: "1"
  });
  const timestamp = String(Date.now());
  const res = await fetch(`https://api.searchad.naver.com${uri}?${qs}`, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "X-Timestamp": timestamp,
      "X-API-KEY": cfg.searchAdAccessLicense,
      "X-Customer": String(cfg.searchAdCustomerId),
      "X-Signature": searchAdSignature(timestamp, "GET", uri, cfg.searchAdSecretKey)
    }
  });
  if (!res.ok) throw new Error(`SearchAd API ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function naverSearchTotal(query, type, cfg) {
  if (cfg.openApiMissing?.length) return 0;
  try {
    const url = new URL(`https://openapi.naver.com/v1/search/${type}.json`);
    url.searchParams.set("query", query);
    url.searchParams.set("display", "1");
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "X-Naver-Client-Id": cfg.naverClientId,
        "X-Naver-Client-Secret": cfg.naverClientSecret
      }
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.total || 0);
  } catch {
    return 0;
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function naverSearchItems(query, type, cfg, display = 3) {
  if (cfg.openApiMissing?.length) return [];
  try {
    const url = new URL(`https://openapi.naver.com/v1/search/${type}.json`);
    url.searchParams.set("query", query);
    url.searchParams.set("display", String(display));
    url.searchParams.set("sort", type === "news" ? "date" : "sim");
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "X-Naver-Client-Id": cfg.naverClientId,
        "X-Naver-Client-Secret": cfg.naverClientSecret
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item) => ({
      title: stripHtml(item.title),
      description: stripHtml(item.description),
      link: item.originallink || item.link || "",
      type
    })).filter((item) => item.title || item.description);
  } catch {
    return [];
  }
}

function currentMonthLabel() {
  const now = new Date();
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
}

function brandSearchAliases(brand) {
  const aliases = {
    "투썸플레이스": ["투썸플레이스", "투썸"],
    "배스킨라빈스": ["배스킨라빈스", "배라"],
    "써브웨이": ["써브웨이", "서브웨이"]
  };
  return aliases[brand] || [brand];
}

async function brandContext(brand, cfg) {
  const cleanBrand = String(brand || "").trim();
  if (!cleanBrand) return { ok: false, error: "브랜드명이 필요합니다.", items: [] };
  if (cfg.openApiMissing?.length) {
    return {
      ok: false,
      brand: cleanBrand,
      monthLabel: currentMonthLabel(),
      openApiMissing: cfg.openApiMissing,
      summary: "네이버 개발센터 Client ID/Secret 설정이 없어 최신 브랜드 이슈를 자동 조회하지 못했습니다.",
      items: []
    };
  }
  const monthLabel = currentMonthLabel();
  const aliases = brandSearchAliases(cleanBrand);
  const queries = [
    `${aliases[0]} 신메뉴`,
    `${aliases.at(-1)} 이벤트`,
    `${aliases[0]} 프로모션`,
    `${aliases.at(-1)} 메뉴`,
    `${cleanBrand} 창업 양도양수`
  ];
  const batches = await Promise.all(queries.flatMap((query, index) => [
    naverSearchItems(query, "news", cfg, index === 4 ? 2 : 3),
    naverSearchItems(query, "blog", cfg, index === 4 ? 2 : 3)
  ]));
  const seen = new Set();
  const items = batches.flat().filter((item) => {
    const key = `${item.title}|${item.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
  const summary = items.length
    ? `${monthLabel} 기준 ${cleanBrand} 관련 검색 결과에서 신메뉴, 이벤트, 프로모션, 창업 이슈 흐름을 확인해 글에 반영할 수 있습니다. 최종 발행 전 실제 진행 여부는 공식 채널이나 매장 자료로 한 번 더 확인하세요.`
    : `${monthLabel} 기준 자동 검색에서 바로 쓸 최신 이슈가 충분히 잡히지 않았습니다. 이 경우 매출, 상권, 양도 사유, 매장 상태처럼 확인된 실매물 정보 중심으로 작성하는 편이 안전합니다.`;
  return { ok: true, brand: cleanBrand, monthLabel, queries, summary, items };
}

async function dataLabTrend(query, cfg) {
  if (cfg.openApiMissing?.length) return { yesterday: 0, delta: 0 };
  try {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const res = await fetch("https://openapi.naver.com/v1/datalab/search", {
      method: "POST",
      signal: AbortSignal.timeout(6000),
      headers: {
        "content-type": "application/json",
        "X-Naver-Client-Id": cfg.naverClientId,
        "X-Naver-Client-Secret": cfg.naverClientSecret
      },
      body: JSON.stringify({
        startDate: ymd(start),
        endDate: ymd(end),
        timeUnit: "date",
        keywordGroups: [{ groupName: query, keywords: [query] }]
      })
    });
    if (!res.ok) return { yesterday: 0, delta: 0 };
    const data = await res.json();
    const points = data.results?.[0]?.data || [];
    const last = Number(points.at(-1)?.ratio || 0);
    const prev = Number(points.at(-2)?.ratio || 0);
    return { yesterday: last, delta: Math.round((last - prev) * 10) / 10 };
  } catch {
    return { yesterday: 0, delta: 0 };
  }
}

function buildCandidateKeywords(brands, regions, customKeywords = []) {
  const set = new Set();
  for (const keyword of customKeywords) {
    const text = String(keyword || "").trim();
    if (text) set.add(text);
  }
  for (const brand of brands) {
    set.add(`${brand} 창업`);
    set.add(`${brand} 양도양수`);
    set.add(`${brand} 창업비용`);
    for (const region of regions) {
      set.add(`${region} ${brand} 창업`);
      set.add(`${region} ${brand} 양도양수`);
    }
  }
  return [...set];
}

function pickContentType(keyword) {
  if (keyword.includes("창업비용")) return "비용분석형";
  if (keyword.includes("양도양수")) return "매물소개형";
  return "상권/브랜드분석형";
}

function cachePathFor(cfg) {
  const key = JSON.stringify({
    brands: cfg.brands,
    regions: cfg.regions,
    customKeywords: cfg.customKeywords || []
  });
  const hash = crypto.createHash("sha1").update(key).digest("hex").slice(0, 12);
  return path.join(__dirname, `keyword-cache-${hash}.json`);
}

function keywordIntent(keyword) {
  if (keyword.includes("양도양수")) return "양도양수";
  if (keyword.includes("창업비용")) return "창업비용";
  if (keyword.includes("창업")) return "창업";
  return "기타";
}

function intentWeight(keyword) {
  const intent = keywordIntent(keyword);
  if (intent === "양도양수") return 1.25;
  if (intent === "창업비용") return 1.1;
  if (intent === "창업") return 1;
  return 0.8;
}

function opportunityScore(row) {
  const searchScore = Math.min(10, Math.log(row.totalSearch + 1) * 1.15);
  const competitionBonus = row.competition === "낮음" ? 1.4 : row.competition === "중간" ? 0.7 : 0;
  const docOpportunity = row.blogTotal ? Math.min(2, row.totalSearch / Math.max(row.blogTotal, 1) * 4) : 1;
  const trendBonus = Math.max(-1, Math.min(2, row.trendDelta / 10));
  const intentBonus = intentWeight(row.keyword);
  return Math.round((searchScore + competitionBonus + docOpportunity + trendBonus) * intentBonus * 10) / 10;
}

function scoreRow(row) {
  return opportunityScore(row);
}

function explainRow(row) {
  const parts = [];
  const intent = keywordIntent(row.keyword || "");
  if (intent === "양도양수") parts.push("매물 전환 의도가 있는 양도양수 키워드");
  if (intent === "창업비용") parts.push("비용 비교형 글감으로 클릭 유도 가능");
  if (row.region) parts.push(`${row.region} 지역성을 제목에 바로 반영 가능`);
  if (Number(row.totalSearch || 0) > 0) parts.push(`월 검색량 ${row.totalSearch.toLocaleString("ko-KR")}회`);
  if (row.competition === "낮음" || row.competition === "중간") parts.push(`경쟁도 ${row.competition}`);
  if (Number(row.trendDelta || 0) > 0) parts.push(`전일 관심도 +${row.trendDelta}`);
  return parts.join(" · ") || "검색 의도 확인용 후보";
}

function sumRows(rows) {
  return rows.reduce((sum, row) => sum + Number(row.totalSearch || 0), 0);
}

function topBy(rows, fn, limit = 5) {
  return [...rows].sort((a, b) => fn(b) - fn(a)).slice(0, limit);
}

function shouldUseCache(cached, cfg) {
  if (!cached?.dashboard?.totals || !Array.isArray(cached?.dashboard?.writingPicks)) return false;
  const cacheDate = cached?.collectedAt ? new Date(cached.collectedAt) : null;
  if (!cacheDate || Number.isNaN(cacheDate.getTime())) return false;
  const ageHours = (Date.now() - cacheDate.getTime()) / 36e5;
  if (ageHours >= cfg.cacheHours) return false;

  const now = new Date();
  const todayRefresh = new Date(now);
  todayRefresh.setHours(cfg.dailyRefreshHour, 0, 0, 0);
  if (now >= todayRefresh && cacheDate < todayRefresh) return false;
  return true;
}

function buildDashboard(rows) {
  const safeRows = rows || [];
  const byBrand = new Map();
  for (const row of safeRows) {
    if (!row.brand) continue;
    const current = byBrand.get(row.brand) || {
      brand: row.brand,
      totalSearch: 0,
      transferSearch: 0,
      startupSearch: 0,
      costSearch: 0,
      trendYesterday: 0,
      trendDelta: 0,
      count: 0,
      bestRows: []
    };
    current.totalSearch += Number(row.totalSearch || 0);
    if (keywordIntent(row.keyword) === "양도양수") current.transferSearch += Number(row.totalSearch || 0);
    if (keywordIntent(row.keyword) === "창업") current.startupSearch += Number(row.totalSearch || 0);
    if (keywordIntent(row.keyword) === "창업비용") current.costSearch += Number(row.totalSearch || 0);
    current.trendYesterday += Number(row.trendYesterday || 0);
    current.trendDelta += Number(row.trendDelta || 0);
    current.count += 1;
    current.bestRows.push(row);
    byBrand.set(row.brand, current);
  }

  const brandDemand = [...byBrand.values()]
    .map((row) => ({
      ...row,
      trendYesterday: Math.round(row.trendYesterday * 10) / 10,
      trendDelta: Math.round(row.trendDelta * 10) / 10,
      opportunity: Math.round(topBy(row.bestRows, opportunityScore, 3).reduce((sum, item) => sum + opportunityScore(item), 0) * 10) / 10,
      bestKeyword: topBy(row.bestRows, opportunityScore, 1)[0]?.keyword || ""
    }))
    .sort((a, b) => (b.transferSearch * 1.25 + b.costSearch * 1.05 + b.opportunity * 10) - (a.transferSearch * 1.25 + a.costSearch * 1.05 + a.opportunity * 10))
    .slice(0, 8);

  const rising = [...safeRows]
    .sort((a, b) => Number(b.trendDelta || 0) - Number(a.trendDelta || 0))
    .slice(0, 5);

  const lowCompetition = [...safeRows]
    .filter((row) => row.competition === "낮음" || row.competition === "중간")
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 5);

  const regionalOpportunities = topBy(
    safeRows.filter((row) => row.region && row.brand),
    (row) => opportunityScore(row) + (keywordIntent(row.keyword) === "양도양수" ? 2 : 0),
    10
  ).map((row) => ({
    keyword: row.keyword,
    brand: row.brand,
    region: row.region,
    totalSearch: row.totalSearch,
    competition: row.competition,
    score: row.score,
    reason: explainRow(row),
    suggestedTitle: `[${row.region}] ${row.brand} 창업보다 양도양수를 먼저 봐야 하는 이유`
  }));

  const writingPicks = topBy(
    safeRows,
    (row) => opportunityScore(row) + (row.region ? 0.8 : 0) + (keywordIntent(row.keyword) === "양도양수" ? 1.5 : 0),
    10
  ).map((row) => ({
    keyword: row.keyword,
    brand: row.brand,
    region: row.region,
    totalSearch: row.totalSearch,
    competition: row.competition,
    score: row.score,
    reason: explainRow(row),
    angle: keywordIntent(row.keyword) === "창업비용"
      ? "신규창업 비용과 양도양수 비용을 비교하는 글"
      : row.region
        ? `${row.region} 상권에서 ${row.brand} 양도양수를 검토하는 글`
        : `${row.brand} 브랜드 수요와 양도양수 타이밍을 설명하는 글`,
    suggestedTitle: row.region
      ? `[${row.region}] ${row.brand} 창업 양도양수, 지금 봐야 할 체크포인트`
      : `${row.brand} 창업 양도양수, 검색수요로 보는 오늘의 글감`
  }));

  return {
    brandDemand,
    rising,
    lowCompetition,
    regionalOpportunities,
    writingPicks,
    totals: {
      totalSearch: sumRows(safeRows),
      transferSearch: sumRows(safeRows.filter((row) => keywordIntent(row.keyword) === "양도양수")),
      startupSearch: sumRows(safeRows.filter((row) => keywordIntent(row.keyword) === "창업")),
      costSearch: sumRows(safeRows.filter((row) => keywordIntent(row.keyword) === "창업비용"))
    }
  };
}

async function collectKeywords(cfg) {
  const candidates = buildCandidateKeywords(cfg.brands, cfg.regions, cfg.customKeywords);
  const keywordMap = new Map();
  let searchAdError = "";
  try {
    for (let i = 0; i < candidates.length; i += 5) {
      const hints = candidates.slice(i, i + 5);
      const data = await searchAdKeywordTool(hints, cfg);
      for (const item of data.keywordList || []) {
        const key = normalizeKeyword(item.relKeyword);
        if (!keywordMap.has(key)) keywordMap.set(key, item);
      }
    }
  } catch (error) {
    searchAdError = error.message || String(error);
  }

  const rows = candidates.map((keyword) => {
    const item = keywordMap.get(normalizeKeyword(keyword)) || {};
    const pc = parseNumber(item.monthlyPcQcCnt);
    const mobile = parseNumber(item.monthlyMobileQcCnt);
    return {
      keyword,
      brand: cfg.brands.find((brand) => keyword.includes(brand)) || "",
      region: cfg.regions.find((region) => keyword.includes(region)) || "",
      pcSearch: pc,
      mobileSearch: mobile,
      totalSearch: pc + mobile,
      competition: item.compIdx || "확인필요",
      contentType: pickContentType(keyword)
    };
  });

  let topRows;
  if (searchAdError) {
    const brandDemand = rows.filter((row) => row.brand && !row.region && row.keyword.includes("양도양수"));
    const regionalDemand = rows.filter((row) => row.brand && row.region && row.keyword.includes("양도양수"));
    const costDemand = rows.filter((row) => row.brand && !row.region && row.keyword.includes("창업비용"));
    topRows = [...brandDemand, ...regionalDemand.slice(0, 50), ...costDemand];
  } else {
    const highVolume = rows
      .filter((row) => row.totalSearch > 0)
      .sort((a, b) => b.totalSearch - a.totalSearch)
      .slice(0, 40);
    const brandDemand = rows.filter((row) => row.brand && !row.region && row.keyword.includes("양도양수"));
    const regionalDemand = rows.filter((row) => row.brand && row.region && row.keyword.includes("양도양수")).slice(0, 30);
    topRows = [...new Map([...highVolume, ...brandDemand, ...regionalDemand].map((row) => [row.keyword, row])).values()];
  }

  await Promise.all(topRows.map(async (row) => {
    const [blogTotal, newsTotal, trend] = await Promise.all([
      naverSearchTotal(row.keyword, "blog", cfg),
      naverSearchTotal(row.keyword, "news", cfg),
      dataLabTrend(row.keyword, cfg)
    ]);
    row.blogTotal = blogTotal;
    row.newsTotal = newsTotal;
    row.trendYesterday = trend.yesterday;
    row.trendDelta = trend.delta;
    row.score = scoreRow(row);
    row.reason = explainRow(row);
    row.recommendedTitle = `[${row.region || "전국"}] ${row.brand} 창업 양도양수 / ${row.keyword} 검색수요 기반 분석`;
  }));

  const result = {
    collectedAt: new Date().toISOString(),
    source: "naver-searchad + naver-datalab + naver-search",
    searchAdStatus: searchAdError ? (keywordMap.size ? "partial" : "error") : "ok",
    openApiStatus: cfg.openApiMissing?.length ? "missing" : "ok",
    openApiMissing: cfg.openApiMissing || [],
    searchAdError,
    brands: cfg.brands,
    regions: cfg.regions,
    customKeywords: cfg.customKeywords || [],
    dashboard: buildDashboard(topRows),
    apiUsageEstimate: {
      keywordCandidates: candidates.length,
      searchAdCalls: Math.ceil(candidates.length / 5),
      openApiCalls: topRows.length * 3,
      cacheHours: cfg.cacheHours,
      dailyRefreshHour: cfg.dailyRefreshHour
    },
    rows: topRows.sort((a, b) => b.score - a.score)
  };
  await fs.writeFile(cachePathFor(cfg), JSON.stringify(result, null, 2), "utf8");
  return result;
}

function applyKeywordOverrides(cfg, url) {
  const brands = parseList(url.searchParams.get("brands"));
  const regions = parseList(url.searchParams.get("regions"));
  const customKeywords = parseList(url.searchParams.get("keywords"));
  return {
    ...cfg,
    brands: brands.length ? brands : cfg.brands,
    regions: regions.length ? regions : cfg.regions,
    customKeywords: customKeywords.length ? customKeywords : cfg.customKeywords || []
  };
}

async function serveFile(req, res, port) {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const pathname = url.pathname === "/" ? "/naver-blog-agent.html" : url.pathname;
  const filePath = path.normalize(path.join(__dirname, decodeURIComponent(pathname)));
  if (!filePath.startsWith(__dirname)) return json(res, 403, { error: "Forbidden" });
  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(content);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const port = server.address()?.port || DEFAULT_PORT;
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type"
      });
      return res.end();
    }
    if (url.pathname === "/api/health") {
      const cfg = await loadConfig();
      return json(res, 200, {
        ok: cfg.missing.length === 0,
        missing: cfg.missing,
        openApiMissing: cfg.openApiMissing,
        configSource: cfg.configSource,
        configLocations: cfg.configLocations
      });
    }
    if (url.pathname === "/api/config") {
      const cfg = await loadConfig();
      return json(res, 200, {
        ok: cfg.missing.length === 0,
        missing: cfg.missing,
        openApiMissing: cfg.openApiMissing,
        configSource: cfg.configSource,
        configLocations: cfg.configLocations,
        cacheHours: cfg.cacheHours,
        dailyRefreshHour: cfg.dailyRefreshHour,
        brands: cfg.brands,
        regions: cfg.regions,
        customKeywords: cfg.customKeywords || []
      });
    }
    if (url.pathname === "/api/status") {
      return json(res, 200, await buildStatus(port));
    }
    if (url.pathname === "/api/keywords") {
      const cfg = applyKeywordOverrides(await loadConfig(), url);
      if (cfg.missing.length) {
        return json(res, 200, {
          setupNeeded: true,
          missing: cfg.missing,
          openApiMissing: cfg.openApiMissing,
          configSource: cfg.configSource,
          configLocations: cfg.configLocations,
          rows: []
        });
      }
      const refresh = url.searchParams.get("refresh") === "1";
      const cached = await readJsonIfExists(cachePathFor(cfg));
      if (!refresh && cached && shouldUseCache(cached, cfg)) {
        return json(res, 200, { ...cached, cacheStatus: "hit" });
      }
      const result = await collectKeywords(cfg);
      return json(res, 200, { ...result, cacheStatus: "fresh" });
    }
    if (url.pathname === "/api/brand-context") {
      const cfg = await loadConfig();
      const brand = url.searchParams.get("brand") || "";
      const result = await brandContext(brand, cfg);
      return json(res, result.ok ? 200 : 200, result);
    }
    return serveFile(req, res, port);
  } catch (error) {
    json(res, 500, { error: error.message || String(error) });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    if (nextPort < DEFAULT_PORT + 20) {
      nextPort += 1;
      server.listen(nextPort, "127.0.0.1");
      return;
    }
    console.error(`${DEFAULT_PORT}~${DEFAULT_PORT + 20}번 포트를 사용할 수 없습니다.`);
    return;
  }
  console.error(error.message || String(error));
  process.exitCode = 1;
});

server.listen(nextPort, "127.0.0.1", () => {
  const port = server.address()?.port || DEFAULT_PORT;
  console.log(`Naver Blog Agent running at http://127.0.0.1:${port}/naver-blog-agent.html`);
});

