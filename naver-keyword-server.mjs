import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  backupDraftHistory,
  isAuthorizedRequest,
  normalizeDraftHistoryItem
} from "./scripts/server-ops.mjs";
import { buildGenerateDraftResponse } from "./scripts/generate-draft-api.mjs";
import {
  buildTrend7d,
  classifyContentCompetition,
  normalizeDataLabPoints,
  occupancyBonusFor
} from "./scripts/keyword-insight-metrics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = Number(process.env.PORT || 8766);
const PROJECT_CONFIG_PATH = path.join(__dirname, "naver-api-config.json");
const USER_CONFIG_PATH = path.join(os.homedir(), ".naver-blog-agent", "naver-api-config.json");
const DRAFT_HISTORY_PATH = path.join(__dirname, "draft-history.json");
let nextPort = DEFAULT_PORT;
let openApiRequestChain = Promise.resolve();

const DEFAULT_BRANDS = [
  "메가커피",
  "컴포즈커피",
  "투썸플레이스",
  "파리바게뜨",
  "롯데리아",
  "서브웨이",
  "배스킨라빈스",
  "샐러디",
  "이디야커피",
  "빽다방",
  "던킨",
  "파스쿠찌",
  "공차",
  "맘스터치",
  "버거킹",
  "맥도날드",
  "교촌치킨",
  "BBQ",
  "BHC",
  "굽네치킨",
  "본죽",
  "한솥도시락",
  "역전할머니맥주",
  "홍콩반점"
];

const DEFAULT_REGIONS = [
  "서울",
  "경기",
  "인천",
  "강남구",
  "서초구",
  "송파구",
  "노원구",
  "도봉구",
  "강북구",
  "마포구",
  "수원시",
  "용인시",
  "부천시",
  "성남시",
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
  const clean = [];
  for (const raw of brands || []) {
    const brand = String(raw || "").trim();
    if (brand && !clean.includes(brand)) clean.push(brand);
  }
  return clean.length ? clean : DEFAULT_BRANDS;
}

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, x-blog-agent-token, x-blog-agent-author, authorization"
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

function matchMostSpecific(text, candidates) {
  const normalizedText = normalizeKeyword(text);
  const matches = (candidates || []).filter((candidate) => {
    const normalizedCandidate = normalizeKeyword(candidate);
    return normalizedCandidate && normalizedText.includes(normalizedCandidate);
  });
  if (!matches.length) return { best: "", all: [] };
  const sorted = [...matches].sort((a, b) => normalizeKeyword(b).length - normalizeKeyword(a).length);
  return { best: sorted[0], all: matches };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOpenApiSlot() {
  const previous = openApiRequestChain;
  let release;
  openApiRequestChain = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  await sleep(180);
  release();
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
    await waitForOpenApiSlot();
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "X-Naver-Client-Id": cfg.naverClientId,
        "X-Naver-Client-Secret": cfg.naverClientSecret
      }
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(`[naverSearchTotal] 실패 query="${query}" type="${type}" status=${res.status} ${errorBody}`);
      return 0;
    }
    const data = await res.json();
    return Number(data.total || 0);
  } catch (error) {
    console.error(`[naverSearchTotal] 예외 query="${query}" type="${type}" error=${error.message || error}`);
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

async function naverSearchItems(query, type, cfg, display = 3, sort = "") {
  if (cfg.openApiMissing?.length) return [];
  try {
    const url = new URL(`https://openapi.naver.com/v1/search/${type}.json`);
    url.searchParams.set("query", query);
    url.searchParams.set("display", String(display));
    url.searchParams.set("sort", sort || (type === "news" ? "date" : "sim"));
    await waitForOpenApiSlot();
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "X-Naver-Client-Id": cfg.naverClientId,
        "X-Naver-Client-Secret": cfg.naverClientSecret
      }
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(`[naverSearchItems] 실패 query="${query}" type="${type}" status=${res.status} ${errorBody}`);
      return [];
    }
    const data = await res.json();
    return (data.items || []).map((item) => ({
      title: stripHtml(item.title),
      description: stripHtml(item.description),
      link: item.originallink || item.link || "",
      bloggername: stripHtml(item.bloggername || ""),
      cafename: stripHtml(item.cafename || ""),
      postdate: item.postdate || "",
      type
    })).filter((item) => item.title || item.description);
  } catch (error) {
    console.error(`[naverSearchItems] 예외 query="${query}" type="${type}" error=${error.message || error}`);
    return [];
  }
}

function itemPostDate(item) {
  const raw = String(item.postdate || "").replace(/[^\d]/g, "");
  if (raw.length !== 8) return "";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function daysSince(dateText) {
  if (!dateText) return null;
  const date = new Date(`${dateText}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
}

function contentIntent(title) {
  const text = String(title || "");
  if (/양도|양수|인수|매매|매물/.test(text)) return "양도양수형";
  if (/창업비용|비용|수익|마진|권리금/.test(text)) return "비용비교형";
  if (/추천|후기|리뷰|순위/.test(text)) return "정보탐색형";
  if (/상담|문의|급매|정리/.test(text)) return "광고강함";
  return "일반형";
}

function normalizeContentItem(item, source, query, index) {
  const title = stripHtml(item.title || "");
  const date = itemPostDate(item);
  const ageDays = daysSince(date);
  const intent = contentIntent(title);
  return {
    source,
    query,
    rank: index + 1,
    title,
    link: item.link || "",
    description: stripHtml(item.description || ""),
    author: stripHtml(item.bloggername || item.cafename || ""),
    postdate: date,
    ageDays,
    intent,
    viewCount: null,
    viewStatus: "공식 API 미제공"
  };
}

async function contentIntel(cfg, url) {
  const brand = (url.searchParams.get("brand") || "").trim();
  const region = (url.searchParams.get("region") || "").trim();
  const keyword = (url.searchParams.get("keyword") || "").trim();
  const queries = [];
  if (keyword) queries.push(keyword);
  if (brand && region) queries.push(`${region} ${brand} 양도양수`);
  if (brand && region) queries.push(`${region} ${brand} 창업`);
  if (brand && !region) queries.push(`${brand} 양도양수`);
  if (region && !brand) queries.push(`${region} 프랜차이즈 양도양수`);
  if (!queries.length) {
    const fallbackBrand = cfg.brands?.[0] || "메가커피";
    const fallbackRegion = cfg.regions?.find((item) => item !== "서울" && item !== "경기") || cfg.regions?.[0] || "서울";
    queries.push(`${fallbackRegion} ${fallbackBrand} 양도양수`);
  }
  const uniqueQueries = [...new Set(queries)].slice(0, 3);
  const groups = await Promise.all(uniqueQueries.map(async (query) => {
    const [blogItems, cafeItems, blogTotal, newsTotal] = await Promise.all([
      naverSearchItems(query, "blog", cfg, 5, "date"),
      naverSearchItems(query, "cafearticle", cfg, 5, "date"),
      naverSearchTotal(query, "blog", cfg),
      naverSearchTotal(query, "news", cfg)
    ]);
    const items = [
      ...blogItems.map((item, index) => normalizeContentItem(item, "블로그", query, index)),
      ...cafeItems.map((item, index) => normalizeContentItem(item, "카페", query, index))
    ].sort((a, b) => {
      const dateA = a.postdate || "0000-00-00";
      const dateB = b.postdate || "0000-00-00";
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return a.rank - b.rank;
    });
    const decision = classifyContentCompetition(0, blogTotal, newsTotal, items);
    return {
      query,
      decision,
      counts: {
        total: items.length,
        blog: items.filter((item) => item.source === "블로그").length,
        cafe: items.filter((item) => item.source === "카페").length,
        recent14d: items.filter((item) => item.ageDays !== null && item.ageDays <= 14).length,
        blogTotal,
        newsTotal,
        supplyRatio: decision.supplyRatio,
        demandLevel: decision.demandLevel
      },
      items
    };
  }));
  return {
    checkedAt: new Date().toISOString(),
    source: "naver-search blog + cafearticle",
    viewStatus: "네이버 공식 검색 API는 블로그/카페글 조회수를 제공하지 않습니다.",
    groups
  };
}

function currentMonthLabel() {
  const now = new Date();
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
}

function brandSearchAliases(brand) {
  const aliases = {
    "투썸플레이스": ["투썸플레이스", "투썸"],
    "배스킨라빈스": ["배스킨라빈스", "배라"],
    "서브웨이": ["서브웨이", "써브웨이"]
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

async function dataLabTrend(query, cfg, days = 30) {
  if (cfg.openApiMissing?.length) return { yesterday: 0, delta: 0, points: [] };
  try {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - Math.max(1, days - 1));
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
    if (!res.ok) return { yesterday: 0, delta: 0, points: [] };
    const data = await res.json();
    const rawPoints = data.results?.[0]?.data || [];
    const points = normalizeDataLabPoints(rawPoints);
    const values = points.map((point) => point.value);
    const last = Number(values.at(-1) || 0);
    const prev = Number(values.at(-2) || 0);
    const first = Number(values[0] || 0);
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return {
      yesterday: last,
      delta: Math.round((last - prev) * 10) / 10,
      periodDelta: Math.round((last - first) * 10) / 10,
      average: Math.round(average * 10) / 10,
      points
    };
  } catch {
    return { yesterday: 0, delta: 0, points: [] };
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

function dailySnapshotPathFor(cfg, dateStr) {
  const key = JSON.stringify({
    brands: cfg.brands,
    regions: cfg.regions,
    customKeywords: cfg.customKeywords || []
  });
  const hash = crypto.createHash("sha1").update(key).digest("hex").slice(0, 12);
  const date = dateStr || new Date().toISOString().slice(0, 10);
  return path.join(__dirname, "snapshots", `${date}-${hash}.json`);
}

async function ensureSnapshotDir() {
  const dir = path.join(__dirname, "snapshots");
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
  return dir;
}

async function writeDailySnapshot(cfg, result) {
  await ensureSnapshotDir();
  const today = new Date().toISOString().slice(0, 10);
  const slim = {
    date: today,
    checkedAt: result.collectedAt || new Date().toISOString(),
    rows: (result.rows || []).map((row) => ({
      keyword: row.keyword,
      brand: row.brand,
      region: row.region,
      totalSearch: row.totalSearch,
      searchVolumeStatus: row.searchVolumeStatus,
      competitionLabel: row.competitionLabel,
      supplyRatio: row.supplyRatio ?? null,
      score: row.score
    }))
  };
  await fs.writeFile(dailySnapshotPathFor(cfg, today), JSON.stringify(slim), "utf8");
}

async function listSnapshotDates(cfg) {
  const dir = await ensureSnapshotDir();
  const key = JSON.stringify({
    brands: cfg.brands,
    regions: cfg.regions,
    customKeywords: cfg.customKeywords || []
  });
  const hash = crypto.createHash("sha1").update(key).digest("hex").slice(0, 12);
  try {
    const files = await fs.readdir(dir);
    return files
      .filter((name) => name.endsWith(`-${hash}.json`))
      .map((name) => name.slice(0, 10))
      .sort()
      .reverse();
  } catch { return []; }
}

async function readSnapshot(cfg, dateStr) {
  return readJsonIfExists(dailySnapshotPathFor(cfg, dateStr));
}

async function pruneOldSnapshots(cfg, keepDays = 90) {
  const dates = await listSnapshotDates(cfg);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const date of dates) {
    if (date < cutoffStr) {
      try { await fs.unlink(dailySnapshotPathFor(cfg, date)); } catch {}
    }
  }
}

async function readDraftHistory() {
  const items = await readJsonIfExists(DRAFT_HISTORY_PATH);
  return Array.isArray(items) ? items : [];
}

async function writeDraftHistory(items) {
  const safeItems = Array.isArray(items) ? items.slice(0, 200) : [];
  await fs.writeFile(DRAFT_HISTORY_PATH, JSON.stringify(safeItems, null, 2), "utf8");
  await backupDraftHistory(DRAFT_HISTORY_PATH, safeItems);
  return safeItems;
}

async function readRequestJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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

function intentBonusFor(keyword) {
  const intent = keywordIntent(keyword);
  if (intent === "양도양수") return 2;
  if (intent === "창업비용") return 1;
  if (intent === "창업") return 0;
  return -1;
}

function trendLiftBonusFor(row) {
  const lift = trendLift(row);
  if (lift > 30) return 1.5;
  if (lift > 0) return 0.5;
  return 0;
}

function confidenceMultiplierFor(status) {
  if (status === "ok") return 1;
  if (status === "fallback_brand") return 0.85;
  if (status === "partial") return 0.5;
  return 0.3;
}

function rowConfidence(row) {
  if (row.searchVolumeStatus === "fallback_brand") return "브랜드추정";
  if (row.searchVolumeStatus === "partial") return "부분";
  if (row.searchVolumeStatus === "unknown") return "확인필요";
  if (Number(row.totalSearch || 0) > 0 && (Number(row.blogTotal || 0) > 0 || Number(row.newsTotal || 0) > 0)) return "높음";
  if (Number(row.totalSearch || 0) > 0) return "검색량확인";
  return "낮음";
}

function recommendationLabel(row) {
  if (row.searchVolumeStatus === "partial") return "검색량 재확인";
  const score = opportunityScore(row);
  if (score >= 10 && keywordIntent(row.keyword) === "양도양수") return "오늘 작성";
  if (score >= 8) return "상위 후보";
  if (row.region && row.brand) return "지역 후보";
  return "보조 후보";
}

function nextAction(row) {
  if (row.searchVolumeStatus === "partial") return "검색광고 API 제한이 풀린 뒤 새로 수집해서 월검색량을 확인하세요.";
  if (keywordIntent(row.keyword) === "양도양수" && row.region) return `${row.region} 지역명과 ${row.brand} 브랜드를 앞세워 상담 유입형 글로 작성하세요.`;
  if (keywordIntent(row.keyword) === "창업비용") return "신규창업 비용과 양도양수 비용을 비교하는 구조로 작성하세요.";
  if (keywordIntent(row.keyword) === "양도양수") return "브랜드 수요와 실제 양도 조건을 연결해 상담형 글로 작성하세요.";
  return "브랜드 이슈와 상권 조건을 확인한 뒤 보조 글감으로 검토하세요.";
}

function enrichRecommendation(row) {
  return {
    confidence: rowConfidence(row),
    recommendationLabel: recommendationLabel(row),
    nextAction: nextAction(row),
    searchVolumeStatus: row.searchVolumeStatus || "ok"
  };
}
function opportunityScore(row) {
  const totalSearch = Number(row.totalSearch || 0);
  const searchScore = Math.min(10, Math.log(totalSearch + 1) * 1.15);
  const competitionBonus = row.competition === "낮음" ? 1.4 : row.competition === "중간" ? 0.7 : 0;
  const docOpportunity = row.blogTotal ? Math.min(2, totalSearch / Math.max(row.blogTotal, 1) * 4) : 0;
  const trendBonus = Math.max(-1, Math.min(2, Number(row.trendDelta || 0) / 10));
  const trendLiftBonus = trendLiftBonusFor(row);
  const regionBonus = row.region && keywordIntent(row.keyword) === "양도양수" ? 0.6 : 0;
  const intentBonus = intentBonusFor(row.keyword);
  const occupancyBonus = occupancyBonusFor(row);
  const confidenceMultiplier = confidenceMultiplierFor(row.searchVolumeStatus);
  const baseScore = Math.max(0, searchScore + competitionBonus + docOpportunity + trendBonus + trendLiftBonus + regionBonus + intentBonus + occupancyBonus);
  row.searchScore = Math.round(searchScore * 10) / 10;
  row.competitionBonus = Math.round(competitionBonus * 10) / 10;
  row.trendBonus = Math.round(trendBonus * 10) / 10;
  row.intentBonus = Math.round(intentBonus * 10) / 10;
  return Math.round(baseScore * confidenceMultiplier * 10) / 10;
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
  if (row.brandMatchAmbiguous || row.regionMatchAmbiguous) parts.push("브랜드/지역명이 여러 후보와 겹친 자동 분류이니 확인 필요");
  if (row.searchVolumeStatus === "partial") parts.push("검색광고 제한으로 월검색량 재확인 필요");
  else if (row.searchVolumeStatus === "fallback_brand") parts.push("브랜드 단위 검색량으로 보정한 추정값");
  else if (Number(row.totalSearch || 0) > 0) parts.push(`월 검색량 ${row.totalSearch.toLocaleString("ko-KR")}회`);
  else parts.push("월검색량 확인 필요");
  if (row.competitionLabel) parts.push(`경쟁 상태: ${row.competitionLabel}`);
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
  if (
    !cached?.dashboard?.totals ||
    !Array.isArray(cached?.dashboard?.writingPicks) ||
    !Array.isArray(cached?.dashboard?.regionalGroups) ||
    !Array.isArray(cached?.dashboard?.regionalOpportunities) ||
    !Array.isArray(cached?.dashboard?.volumeLeaders) ||
    !Array.isArray(cached?.dashboard?.anomalySignals)
  ) return false;
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

async function readLatestUsableCache(cfg) {
  const files = (await fs.readdir(__dirname))
    .filter((name) => /^keyword-cache-.+\.json$/.test(name))
    .map((name) => path.join(__dirname, name));
  const byTime = await Promise.all(files.map(async (file) => ({
    file,
    mtime: (await fs.stat(file)).mtimeMs
  })));
  byTime.sort((a, b) => b.mtime - a.mtime);
  for (const item of byTime) {
    const cached = await readJsonIfExists(item.file);
    if (shouldUseCache(cached, cfg)) return cached;
  }
  return null;
}

function hasDashboardCacheShape(cached) {
  return Boolean(cached?.dashboard?.totals && Array.isArray(cached?.dashboard?.writingPicks));
}

async function readLatestDashboardCache() {
  const files = (await fs.readdir(__dirname))
    .filter((name) => /^keyword-cache-.+\.json$/.test(name))
    .map((name) => path.join(__dirname, name));
  const byTime = await Promise.all(files.map(async (file) => ({
    file,
    mtime: (await fs.stat(file)).mtimeMs
  })));
  byTime.sort((a, b) => b.mtime - a.mtime);
  for (const item of byTime) {
    const cached = await readJsonIfExists(item.file);
    if (hasDashboardCacheShape(cached)) return cached;
  }
  return null;
}

function regionGroup(region) {
  const text = String(region || "");
  if (!text) return "전국";
  if (/강남|서초|송파|강동/.test(text)) return "서울 동남권";
  if (/노원|도봉|강북|성북|중랑|동대문/.test(text)) return "서울 동북권";
  if (/마포|서대문|은평|용산|중구|종로|성동|광진/.test(text)) return "서울 도심·서북권";
  if (/양천|강서|구로|금천|영등포|동작|관악/.test(text)) return "서울 서남권";
  if (/서울/.test(text)) return "서울 전체";
  if (/인천/.test(text)) return "인천권";
  if (/부천|김포|광명|시흥|고양|파주/.test(text)) return "경기 서부";
  if (/수원|용인|성남|분당|판교|안양|과천|의왕|군포|화성|오산|평택|안성|동탄/.test(text)) return "경기 남부";
  if (/하남|광주|양평|이천|여주/.test(text)) return "경기 동부";
  if (/의정부|양주|동두천|포천|연천|구리|남양주/.test(text)) return "경기 북부";
  if (/경기/.test(text)) return "경기 전체";
  return "기타 지역";
}

function priorityLabel(row) {
  if (row.searchVolumeStatus === "partial") return "검색량 재확인";
  const search = Number(row.totalSearch || 0);
  if (keywordIntent(row.keyword) === "양도양수" && row.region && search >= 50) return "바로 작성";
  if (keywordIntent(row.keyword) === "양도양수" && search >= 200) return "브랜드 글감";
  if (keywordIntent(row.keyword) === "창업비용" && search >= 500) return "비교글 보조";
  if (row.region && row.brand) return "지역 보조";
  return "참고";
}

function writingBrief(row) {
  const region = row.region || "전국";
  const brand = row.brand || "프랜차이즈";
  if (keywordIntent(row.keyword) === "양도양수" && row.region) {
    return `${region}에서 ${brand} 양도양수를 찾는 수요가 있으니, 지역명과 브랜드명을 앞세운 상담 유입용 글을 작성하세요.`;
  }
  if (keywordIntent(row.keyword) === "양도양수") {
    return `${brand} 양도양수 검색수요가 높으니, 브랜드 수요와 실제 양도 조건을 연결한 글을 작성하세요.`;
  }
  if (keywordIntent(row.keyword) === "창업비용") {
    return `${brand} 창업비용 수요를 활용해 신규창업 비용과 양도양수 비용을 비교하는 보조 글감으로 쓰세요.`;
  }
  return `${region} ${brand} 검색 흐름을 참고해 보조 글감으로 검토하세요.`;
}

function handoffText(row) {
  const region = row.region || "전국";
  const brand = row.brand || "";
  return [
    `브랜드: ${brand}`,
    `지역: ${region}`,
    `핵심 키워드: ${row.keyword}`,
    `글 방향: ${writingBrief(row)}`,
    `제목 후보: ${row.suggestedTitle || row.recommendedTitle || `${region} ${brand} 양도양수 체크포인트`}`
  ].join("\n");
}

function legacyBlogVolumeLabel(row) {
  const total = Number(row.blogTotal || 0);
  if (!total) return "블로그 경쟁 확인 필요";
  if (total >= 10000) return "블로그 경쟁 높음";
  if (total >= 3000) return "블로그 경쟁 보통";
  return "블로그 경쟁 낮음";
}

function trendLift(row) {
  const seven = Number(row.trend7d?.average || 0);
  const thirty = Number(row.trend30d?.average || 0);
  if (!seven || !thirty) return 0;
  return Math.round(((seven - thirty) / Math.max(thirty, 1)) * 100);
}

function anomalyReason(row) {
  const lift = trendLift(row);
  const parts = [];
  if (lift > 0) parts.push(`최근 7일 평균이 30일 평균보다 ${lift}% 높습니다`);
  else if (lift < 0) parts.push(`최근 7일 평균이 30일 평균보다 ${Math.abs(lift)}% 낮습니다`);
  if (Number(row.totalSearch || 0) > 0) parts.push(`월검색 ${Number(row.totalSearch || 0).toLocaleString("ko-KR")}회`);
  parts.push(legacyBlogVolumeLabel(row));
  return parts.join(" · ");
}

function recommendationFromRow(row) {
  return {
    keyword: row.keyword,
    brand: row.brand,
    region: row.region || "전국",
    group: regionGroup(row.region),
    totalSearch: row.totalSearch,
    blogTotal: row.blogTotal,
    newsTotal: row.newsTotal,
    trendYesterday: row.trendYesterday,
    trendDelta: row.trendDelta,
    trend7d: row.trend7d,
    trend30d: row.trend30d,
    trendLift: trendLift(row),
    competitionLabel: row.competitionLabel || "확인 필요",
    competitionReason: row.competitionReason || "",
    supplyRatio: row.supplyRatio ?? null,
    demandLevel: row.demandLevel || "",
    contentSamples: row.contentSamples || [],
    score: row.score,
    searchScore: row.searchScore,
    competitionBonus: row.competitionBonus,
    trendBonus: row.trendBonus,
    intentBonus: row.intentBonus,
    brandMatchAmbiguous: Boolean(row.brandMatchAmbiguous),
    regionMatchAmbiguous: Boolean(row.regionMatchAmbiguous),
    blogTitles: row.blogTitles || [],
    blogTitleSignals: row.blogTitleSignals || "",
    searchVolumeStatus: row.searchVolumeStatus || "ok",
    priorityLabel: priorityLabel(row),
    confidence: rowConfidence(row),
    reason: explainRow(row),
    writingBrief: writingBrief(row),
    handoffText: handoffText(row),
    suggestedTitle: row.region
      ? `[${row.region}] ${row.brand} 양도양수, 지금 봐야 할 체크포인트`
      : `${row.brand} 양도양수, 검색수요로 보는 오늘의 글감`
  };
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
      count: 0,
      bestRows: []
    };
    current.totalSearch += Number(row.totalSearch || 0);
    if (keywordIntent(row.keyword) === "양도양수") current.transferSearch += Number(row.totalSearch || 0);
    if (keywordIntent(row.keyword) === "창업") current.startupSearch += Number(row.totalSearch || 0);
    if (keywordIntent(row.keyword) === "창업비용") current.costSearch += Number(row.totalSearch || 0);
    current.count += 1;
    current.bestRows.push(row);
    byBrand.set(row.brand, current);
  }

  const brandDemand = [...byBrand.values()]
    .map((row) => {
      const best = topBy(row.bestRows, opportunityScore, 1)[0];
      return {
        ...row,
        bestKeyword: best?.keyword || "",
        recommendedRegion: topBy(row.bestRows.filter((item) => item.region && keywordIntent(item.keyword) === "양도양수"), opportunityScore, 1)[0]?.region || "전국",
        writeReason: `${row.brand} 양도양수 ${row.transferSearch.toLocaleString("ko-KR")}회, 창업비용 ${row.costSearch.toLocaleString("ko-KR")}회 기준으로 글감 가치가 있습니다.`
      };
    })
    .sort((a, b) => (b.transferSearch * 1.4 + b.costSearch * 0.4) - (a.transferSearch * 1.4 + a.costSearch * 0.4))
    .slice(0, 10);

  const regionalRows = safeRows.filter((row) => row.region && row.brand && keywordIntent(row.keyword) === "양도양수");
  const groupMap = new Map();
  for (const row of regionalRows) {
    const group = regionGroup(row.region);
    const current = groupMap.get(group) || { group, totalSearch: 0, rows: [] };
    current.totalSearch += Number(row.totalSearch || 0);
    current.rows.push(row);
    groupMap.set(group, current);
  }

  const regionalGroups = [...groupMap.values()]
    .map((group) => {
      const topRows = topBy(group.rows, (row) => Number(row.totalSearch || 0) + opportunityScore(row), 5);
      const top = topRows[0];
      return {
        group: group.group,
        totalSearch: group.totalSearch,
        topBrand: top?.brand || "-",
        topRegion: top?.region || "-",
        topKeyword: top?.keyword || "-",
        writingBrief: top ? writingBrief(top) : "해당 권역의 양도양수 후보를 더 수집하세요.",
        rows: topRows.map(recommendationFromRow)
      };
    })
    .sort((a, b) => b.totalSearch - a.totalSearch);

  const transferRows = safeRows.filter((row) => row.brand && keywordIntent(row.keyword) === "양도양수");
  const regionalTransferRows = transferRows.filter((row) => row.region);
  const writingSourceRows = transferRows.length ? transferRows : safeRows.filter((row) => row.brand);

  const writingPicks = topBy(
    writingSourceRows,
    (row) => opportunityScore(row) * 120 + Number(row.totalSearch || 0) + (row.region ? 300 : 0),
    10
  ).map(recommendationFromRow);

  const regionalOpportunities = topBy(
    writingSourceRows,
    (row) => Number(row.totalSearch || 0) + opportunityScore(row) * 100,
    120
  ).map(recommendationFromRow);

  const volumeLeaders = topBy(
    writingSourceRows,
    (row) => Number(row.totalSearch || 0),
    8
  ).map((row) => ({ ...recommendationFromRow(row), signalReason: row.region ? "지역명이 붙은 양도양수 후보 중 검색량이 높은 조합입니다." : "브랜드 단위 검색량이 큰 참고 후보입니다." }));

  const anomalySignals = topBy(
    safeRows.filter((row) => row.brand && row.region && keywordIntent(row.keyword) === "양도양수"),
    (row) => Math.max(0, trendLift(row)) * 12 + opportunityScore(row) * 30 + (legacyBlogVolumeLabel(row).includes("낮음") ? 120 : 0),
    8
  ).map((row) => ({ ...recommendationFromRow(row), signalReason: anomalyReason(row) }));

  return {
    brandDemand,
    regionalGroups,
    regionalOpportunities,
    volumeLeaders,
    anomalySignals,
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
  const fallbackKeywordMap = new Map();
  let searchAdError = "";
  let searchAd429Count = 0;
  let fallback429Count = 0;
  let consecutiveFailures = 0;
  const startedAt = Date.now();
  for (let i = 0; i < candidates.length; i += 5) {
    if (i % 50 === 0) {
      console.log(`SearchAd 진행: ${i}/${candidates.length}, 성공 매칭 ${keywordMap.size}개, 에러: ${searchAdError || "없음"}`);
    }
    const hints = candidates.slice(i, i + 5);
    try {
      const data = await searchAdKeywordTool(hints, cfg);
      for (const item of data.keywordList || []) {
        const key = normalizeKeyword(item.relKeyword);
        if (!keywordMap.has(key)) keywordMap.set(key, item);
      }
      consecutiveFailures = 0;
    } catch (error) {
      const message = error.message || String(error);
      searchAdError = message;
      consecutiveFailures += 1;
      if (message.includes("429")) {
        searchAd429Count += 1;
        await sleep(2000);
      }
      if (consecutiveFailures >= 10) {
        console.error(`SearchAd API 연속 ${consecutiveFailures}회 실패, 나머지 후보는 건너뜁니다.`);
        break;
      }
    }
    await sleep(280);
  }
  console.log(`SearchAd 완료: 후보 ${candidates.length}개, 정확 매칭 ${keywordMap.size}개, 429 ${searchAd429Count}회, ${(Date.now() - startedAt) / 1000}초`);

  if (!searchAdError) {
    const fallbackHints = new Set();
    for (const keyword of candidates) {
      if (keywordMap.has(normalizeKeyword(keyword))) continue;
      const brandMatch = matchMostSpecific(keyword, cfg.brands);
      if (!brandMatch.best) continue;
      fallbackHints.add(`${brandMatch.best} ${keywordIntent(keyword)}`);
    }
    const fallbackList = [...fallbackHints].filter((hint) => !hint.includes("기타"));
    if (fallbackList.length) console.log(`[SearchAd fallback] ${fallbackList.length} brand-intent hints`);
    let fallbackFailures = 0;
    for (let i = 0; i < fallbackList.length; i += 5) {
      if (i % 50 === 0) {
        console.log(`SearchAd fallback 진행: ${i}/${fallbackList.length}, 성공 매칭 ${fallbackKeywordMap.size}개, 에러: ${searchAdError || "없음"}`);
      }
      const hints = fallbackList.slice(i, i + 5);
      try {
        const data = await searchAdKeywordTool(hints, cfg);
        for (const hint of hints) {
          const exact = (data.keywordList || []).find((item) => normalizeKeyword(item.relKeyword) === normalizeKeyword(hint));
          if (exact && !fallbackKeywordMap.has(normalizeKeyword(hint))) fallbackKeywordMap.set(normalizeKeyword(hint), exact);
        }
        fallbackFailures = 0;
      } catch (error) {
        const message = error.message || String(error);
        searchAdError = searchAdError || message;
        fallbackFailures += 1;
        if (message.includes("429")) {
          fallback429Count += 1;
          await sleep(2000);
        }
        if (fallbackFailures >= 10) {
          console.error(`SearchAd fallback API 연속 ${fallbackFailures}회 실패, 나머지 보정 후보는 건너뜁니다.`);
          break;
        }
      }
      await sleep(280);
    }
  }

  const rows = candidates.map((keyword) => {
    const brandMatch = matchMostSpecific(keyword, cfg.brands);
    const regionMatch = matchMostSpecific(keyword, cfg.regions);
    const fallbackKey = brandMatch.best ? normalizeKeyword(`${brandMatch.best} ${keywordIntent(keyword)}`) : "";
    const exactItem = keywordMap.get(normalizeKeyword(keyword));
    const fallbackItem = fallbackKey ? fallbackKeywordMap.get(fallbackKey) : null;
    let item = {};
    let searchVolumeStatus = "unknown";
    if (exactItem) {
      item = exactItem;
      searchVolumeStatus = "ok";
    } else if (fallbackItem) {
      item = fallbackItem;
      searchVolumeStatus = "fallback_brand";
    } else if (searchAdError) {
      searchVolumeStatus = "partial";
    }
    const hasSearchAdData = Boolean(item.relKeyword);
    const pc = hasSearchAdData ? parseNumber(item.monthlyPcQcCnt) : null;
    const mobile = hasSearchAdData ? parseNumber(item.monthlyMobileQcCnt) : null;
    return {
      keyword,
      brand: brandMatch.best,
      region: regionMatch.best,
      brandMatchAmbiguous: brandMatch.all.length > 1,
      regionMatchAmbiguous: regionMatch.all.length > 1,
      pcSearch: pc,
      mobileSearch: mobile,
      totalSearch: hasSearchAdData ? pc + mobile : null,
      searchVolumeStatus,
      competition: item.compIdx || "확인필요",
      contentType: pickContentType(keyword)
    };
  });

  let topRows;
  if (searchAdError) {
    const brandDemand = rows.filter((row) => row.brand && !row.region && row.keyword.includes("양도양수"));
    const regionalDemand = rows.filter((row) => row.brand && row.region && row.keyword.includes("양도양수"));
    const costDemand = rows.filter((row) => row.brand && !row.region && row.keyword.includes("창업비용"));
    topRows = [...brandDemand, ...regionalDemand.slice(0, 80), ...costDemand];
  } else {
    const highVolume = rows
      .filter((row) => row.totalSearch > 0)
      .sort((a, b) => b.totalSearch - a.totalSearch)
      .slice(0, 60);
    const brandDemand = rows.filter((row) => row.brand && !row.region && row.keyword.includes("양도양수"));
    const regionalDemand = rows
      .filter((row) => row.brand && row.region && row.keyword.includes("양도양수"))
      .sort((a, b) => Number(b.totalSearch || 0) - Number(a.totalSearch || 0))
      .slice(0, 80);
    topRows = [...new Map([...highVolume, ...brandDemand, ...regionalDemand].map((row) => [row.keyword, row])).values()];
  }

  await Promise.all(topRows.map(async (row) => {
    const [blogTotal, newsTotal, trend30d] = await Promise.all([
      naverSearchTotal(row.keyword, "blog", cfg),
      naverSearchTotal(row.keyword, "news", cfg),
      dataLabTrend(row.keyword, cfg, 30)
    ]);
    const trend7d = buildTrend7d(trend30d);
    row.blogTotal = blogTotal;
    row.newsTotal = newsTotal;
    row.trendYesterday = trend30d.yesterday;
    row.trendDelta = trend7d.delta;
    row.trend7d = trend7d;
    row.trend30d = {
      points: trend30d.points || [],
      average: trend30d.average || 0,
      delta: trend30d.periodDelta || 0
    };
    const baselineDecision = classifyContentCompetition(row.totalSearch, row.blogTotal, row.newsTotal, []);
    row.competitionLabel = baselineDecision.label;
    row.competitionReason = baselineDecision.reason;
    row.supplyRatio = baselineDecision.supplyRatio;
    row.demandLevel = baselineDecision.demandLevel;
    row.score = scoreRow(row);
    row.reason = explainRow(row);
    row.recommendedTitle = `[${row.region || "전국"}] ${row.brand} 창업 양도양수 / ${row.keyword} 검색수요 기반 분석`;
  }));

  const occupancyRows = [...topRows]
    .sort((a, b) => scoreRow(b) - scoreRow(a))
    .slice(0, 30);
  await Promise.all(occupancyRows.map(async (row) => {
    const hasSearchSignal = Number(row.totalSearch || 0) >= 10 || ["ok", "fallback_brand"].includes(row.searchVolumeStatus);
    if (!hasSearchSignal) {
      row.competitionLabel = "미분석";
      row.competitionReason = "검색량 기준이 낮아 최근 점유공백 분석에서 제외했습니다.";
      return;
    }
    const [blogItems, cafeItems] = await Promise.all([
      naverSearchItems(row.keyword, "blog", cfg, 5, "date"),
      naverSearchItems(row.keyword, "cafearticle", cfg, 5, "date")
    ]);
    const items = [
      ...blogItems.map((item, index) => normalizeContentItem(item, "블로그", row.keyword, index)),
      ...cafeItems.map((item, index) => normalizeContentItem(item, "카페", row.keyword, index))
    ];
    const decision = classifyContentCompetition(row.totalSearch, row.blogTotal, row.newsTotal, items);
    row.competitionLabel = decision.label;
    row.competitionReason = decision.reason;
    row.supplyRatio = decision.supplyRatio;
    row.demandLevel = decision.demandLevel;
    row.contentSamples = items.slice(0, 5).map((item) => ({
      source: item.source,
      title: item.title,
      postdate: item.postdate,
      ageDays: item.ageDays,
      intent: item.intent
    }));
    row.score = scoreRow(row);
    row.reason = explainRow(row);
  }));
  for (const row of topRows) {
    row.score = scoreRow(row);
    row.reason = explainRow(row);
  }

  const evidenceRows = topRows
    .filter((row) => row.brand && row.region && keywordIntent(row.keyword) === "양도양수")
    .sort((a, b) => opportunityScore(b) - opportunityScore(a))
    .slice(0, 12);
  await Promise.all(evidenceRows.map(async (row) => {
    const items = await naverSearchItems(row.keyword, "blog", cfg, 3);
    const titles = items.map((item) => stripHtml(item.title || "")).filter(Boolean);
    row.blogTitles = titles;
    row.blogTitleSignals = titles.length
      ? `${row.region} ${row.brand} 관련 블로그 제목 ${titles.length}건을 참고했습니다.`
      : "블로그 제목 표본이 부족해 검색량 중심으로 판단하세요.";
  }));

  const result = {
    dashboardVersion: "region-dashboard-v3",
    collectedAt: new Date().toISOString(),
    source: "naver-searchad + naver-datalab + naver-search",
    searchAdStatus: searchAdError ? (keywordMap.size ? "partial" : "error") : "ok",
    searchAdStats: {
      candidateCount: candidates.length,
      exactMatchCount: rows.filter((row) => row.searchVolumeStatus === "ok").length,
      fallbackMatchCount: rows.filter((row) => row.searchVolumeStatus === "fallback_brand").length,
      partialCount: rows.filter((row) => row.searchVolumeStatus === "partial").length,
      unknownCount: rows.filter((row) => row.searchVolumeStatus === "unknown").length,
      searchAd429Count,
      fallback429Count,
      elapsedSeconds: Math.round(((Date.now() - startedAt) / 1000) * 10) / 10
    },
    openApiStatus: cfg.openApiMissing?.length ? "missing" : "ok",
    openApiMissing: cfg.openApiMissing || [],
    searchAdError,
    brands: cfg.brands,
    regions: cfg.regions,
    customKeywords: cfg.customKeywords || [],
    dashboard: buildDashboard(topRows),
    recommendationGuide: {
      today: "오늘 작성은 양도양수 의도와 검색량이 함께 확인된 후보입니다.",
      verify: "검색량 재확인은 API 제한 또는 부분 데이터라서 발행 전 새로 수집이 필요한 후보입니다.",
      regional: "지역 후보는 제목에 지역명과 브랜드명을 함께 넣기 좋은 후보입니다.",
      handoff: "복사 문구를 글쓰기 에이전트에 넘기면 브랜드, 지역, 키워드가 한 번에 전달됩니다."
    },
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
  await writeDailySnapshot(cfg, result);
  await pruneOldSnapshots(cfg, 90);
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

function apiUsageEstimateFor(cfg) {
  const candidates = buildCandidateKeywords(cfg.brands, cfg.regions, cfg.customKeywords || []);
  const estimatedTopRows = Math.min(candidates.length, 140);
  return {
    keywordCandidates: candidates.length,
    searchAdCalls: Math.ceil(candidates.length / 5),
    openApiCalls: estimatedTopRows * 3,
    cacheHours: cfg.cacheHours,
    dailyRefreshHour: cfg.dailyRefreshHour
  };
}

function emptyKeywordResult(cfg, cacheStatus = "miss") {
  return {
    dashboardVersion: "region-dashboard-v4-empty",
    collectedAt: new Date().toISOString(),
    source: "cache-only",
    searchAdStatus: "none",
    openApiStatus: cfg.openApiMissing?.length ? "missing" : "ok",
    openApiMissing: cfg.openApiMissing || [],
    searchAdError: "",
    brands: cfg.brands,
    regions: cfg.regions,
    customKeywords: cfg.customKeywords || [],
    dashboard: buildDashboard([]),
    recommendationGuide: {},
    apiUsageEstimate: apiUsageEstimateFor(cfg),
    rows: [],
    cacheStatus,
    cacheOnlyMiss: true
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
    const type =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".js"
          ? "text/javascript; charset=utf-8"
          : ext === ".json"
            ? "application/json; charset=utf-8"
            : "application/octet-stream";
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
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "content-type, x-blog-agent-token, x-blog-agent-author, authorization"
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
    if (url.pathname === "/api/draft-history") {
      if (!isAuthorizedRequest(req, url)) {
        return json(res, 401, { ok: false, error: "Unauthorized" });
      }
      if (req.method === "GET") {
        return json(res, 200, { ok: true, items: await readDraftHistory() });
      }
      if (req.method === "POST") {
        const payload = await readRequestJson(req);
        const item = normalizeDraftHistoryItem(payload.item || payload, req.headers["x-blog-agent-author"]);
        const current = await readDraftHistory();
        const next = [item, ...current.filter((saved) => String(saved.id) !== String(item.id))];
        return json(res, 200, { ok: true, items: await writeDraftHistory(next) });
      }
      if (req.method === "DELETE") {
        return json(res, 200, { ok: true, items: await writeDraftHistory([]) });
      }
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }
    if (url.pathname === "/api/draft-history/update") {
      if (!isAuthorizedRequest(req, url)) return json(res, 401, { ok: false, error: "Unauthorized" });
      if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });
      const payload = await readRequestJson(req);
      const targetId = String(payload.id || "");
      if (!targetId) return json(res, 400, { ok: false, error: "id가 필요합니다." });
      const current = await readDraftHistory();
      const index = current.findIndex((item) => String(item.id) === targetId);
      if (index === -1) return json(res, 404, { ok: false, error: "해당 항목을 찾을 수 없습니다." });
      const updated = normalizeDraftHistoryItem({ ...current[index], ...payload }, current[index].author);
      current[index] = updated;
      await writeDraftHistory(current);
      return json(res, 200, { ok: true, item: updated });
    }
    if (url.pathname === "/api/generate-draft") {
      if (!isAuthorizedRequest(req, url)) {
        return json(res, 401, { ok: false, error: "Unauthorized" });
      }
      if (req.method !== "POST") {
        return json(res, 405, { ok: false, error: "Method not allowed" });
      }
      const payload = await readRequestJson(req);
      const generated = await buildGenerateDraftResponse(payload, req.headers["x-blog-agent-author"]);
      if (!generated.ok && generated.error) {
        return json(res, 400, generated);
      }
      if (payload.sourceScore !== undefined || payload.sourceKeyword) {
        generated.draft.sourceKeyword = String(payload.sourceKeyword || "");
        generated.draft.sourceScore = payload.sourceScore !== undefined ? Number(payload.sourceScore) : null;
        generated.draft.sourceCompetitionLabel = String(payload.sourceCompetitionLabel || "");
        generated.draft.recommendedAt = String(payload.recommendedAt || "");
      }
      const current = await readDraftHistory();
      const next = [generated.draft, ...current.filter((saved) => String(saved.id) !== String(generated.draft.id))];
      await writeDraftHistory(next);
      return json(res, 200, generated);
    }
    if (url.pathname === "/api/keywords") {
      if (!isAuthorizedRequest(req, url)) {
        return json(res, 401, { ok: false, error: "Unauthorized" });
      }
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
      const cacheOnly = url.searchParams.get("cacheOnly") === "1";
      const cached = await readJsonIfExists(cachePathFor(cfg));
      if (!refresh && cached && shouldUseCache(cached, cfg)) {
        return json(res, 200, { ...cached, cacheStatus: "hit" });
      }
      if (cacheOnly) {
        return json(res, 200, emptyKeywordResult(cfg, "miss"));
      }
      const result = await collectKeywords(cfg);
      return json(res, 200, { ...result, cacheStatus: "fresh" });
    }
    if (url.pathname === "/api/snapshots") {
      const cfg = applyKeywordOverrides(await loadConfig(), url);
      const dates = await listSnapshotDates(cfg);
      return json(res, 200, { ok: true, dates });
    }
    if (url.pathname === "/api/snapshots/compare") {
      const cfg = applyKeywordOverrides(await loadConfig(), url);
      const allDates = await listSnapshotDates(cfg);
      const baseDate = url.searchParams.get("date") || allDates[1];
      const today = new Date().toISOString().slice(0, 10);
      const current = await readSnapshot(cfg, today);
      const previous = baseDate ? await readSnapshot(cfg, baseDate) : null;
      if (!current || !previous) {
        return json(res, 200, { ok: true, available: false, reason: "비교할 과거 스냅샷이 아직 충분하지 않습니다." });
      }
      const prevMap = new Map(previous.rows.map((row) => [row.keyword, row]));
      const diffs = current.rows.map((row) => {
        const prevRow = prevMap.get(row.keyword);
        const prevSearch = Number(prevRow?.totalSearch || 0);
        const currSearch = Number(row.totalSearch || 0);
        return {
          ...row,
          previousSearch: prevRow ? prevSearch : null,
          searchChange: prevRow ? currSearch - prevSearch : null,
          searchChangePct: prevRow && prevSearch > 0 ? Math.round(((currSearch - prevSearch) / prevSearch) * 1000) / 10 : null
        };
      });
      return json(res, 200, { ok: true, available: true, baseDate, diffs });
    }
    if (url.pathname === "/api/content-intel") {
      if (!isAuthorizedRequest(req, url)) {
        return json(res, 401, { ok: false, error: "Unauthorized" });
      }
      const cfg = await loadConfig();
      if (cfg.missing.length || cfg.openApiMissing?.length) {
        return json(res, 200, {
          setupNeeded: true,
          missing: [...(cfg.missing || []), ...(cfg.openApiMissing || [])],
          groups: []
        });
      }
      return json(res, 200, await contentIntel(cfg, url));
    }
    if (url.pathname === "/api/brand-context") {
      if (!isAuthorizedRequest(req, url)) {
        return json(res, 401, { ok: false, error: "Unauthorized" });
      }
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

let lastAutoCollectDate = null;

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function checkAndRunScheduledCollect(cfg) {
  const now = new Date();
  const todayKey = localDateKey(now);
  if (now.getHours() !== cfg.dailyRefreshHour || lastAutoCollectDate === todayKey) return;

  lastAutoCollectDate = todayKey;
  console.log(`[자동수집] ${now.toISOString()} 예약된 데이터 수집을 시작합니다.`);
  collectKeywords(cfg)
    .then((result) => {
      console.log(`[자동수집] 완료. 후보 ${result.searchAdStats?.candidateCount ?? "?"}개 처리.`);
    })
    .catch((error) => {
      console.error(`[자동수집] 실패: ${error.message || error}`);
    });
}

setInterval(async () => {
  try {
    const cfg = await loadConfig();
    if (cfg.missing.length === 0) checkAndRunScheduledCollect(cfg);
  } catch (error) {
    console.error(`[자동수집] 설정 확인 중 오류: ${error.message || error}`);
  }
}, 10 * 60 * 1000);

server.listen(nextPort, "127.0.0.1", () => {
  const port = server.address()?.port || DEFAULT_PORT;
  console.log(`Naver Blog Agent running at http://127.0.0.1:${port}/naver-blog-agent.html`);
});

