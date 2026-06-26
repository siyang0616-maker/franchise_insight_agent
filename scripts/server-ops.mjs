import fs from "node:fs/promises";
import path from "node:path";

export function accessTokenFromEnv(env = process.env) {
  return String(env.BLOG_APP_ACCESS_TOKEN || env.NAVER_BLOG_AGENT_TOKEN || "").trim();
}

export function isAuthorizedRequest(req, url, env = process.env) {
  const expected = accessTokenFromEnv(env);
  if (!expected) return true;
  const headers = req.headers || {};
  const headerToken = String(headers["x-blog-agent-token"] || "").trim();
  const auth = String(headers.authorization || "").trim();
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const queryToken = url.searchParams.get("token") || "";
  return [headerToken, bearer, queryToken].some((token) => token === expected);
}

export function normalizeDraftHistoryItem(item, fallbackAuthor = "") {
  return {
    id: item?.id || Date.now(),
    createdAt: String(item?.createdAt || new Date().toLocaleString("ko-KR")),
    author: String(item?.author || fallbackAuthor || "로컬 사용자"),
    brand: String(item?.brand || ""),
    region: String(item?.region || ""),
    sales: String(item?.sales || ""),
    premium: String(item?.premium || ""),
    repeatPhrase: String(item?.repeatPhrase || ""),
    listingMemo: String(item?.listingMemo || ""),
    brandNews: String(item?.brandNews || ""),
    sourceKeyword: String(item?.sourceKeyword || ""),
    sourceScore: item?.sourceScore !== undefined && item?.sourceScore !== null ? Number(item.sourceScore) : null,
    sourceCompetitionLabel: String(item?.sourceCompetitionLabel || ""),
    recommendedAt: String(item?.recommendedAt || ""),
    publishedAt: String(item?.publishedAt || ""),
    publishedUrl: String(item?.publishedUrl || ""),
    performanceCheckedAt: String(item?.performanceCheckedAt || ""),
    performanceRank: item?.performanceRank !== undefined && item?.performanceRank !== null ? Number(item.performanceRank) : null,
    performanceNote: String(item?.performanceNote || ""),
    inquiryCount: item?.inquiryCount !== undefined && item?.inquiryCount !== null ? Number(item.inquiryCount) : null,
    titles: Array.isArray(item?.titles) ? item.titles.map(String).slice(0, 5) : [],
    relatedPosts: Array.isArray(item?.relatedPosts) ? item.relatedPosts.map(String).slice(0, 5) : [],
    tags: String(item?.tags || ""),
    body: String(item?.body || ""),
    mode: String(item?.mode || ""),
    ruleVersion: String(item?.ruleVersion || "")
  };
}

function dateStamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function backupDraftHistory(historyPath, items, date = new Date()) {
  const backupDir = path.join(path.dirname(historyPath), "backups");
  await fs.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `draft-history-${dateStamp(date)}.json`);
  await fs.writeFile(backupPath, JSON.stringify(Array.isArray(items) ? items : [], null, 2), "utf8");
  return backupPath;
}
