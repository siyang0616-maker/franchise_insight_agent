import { generateBlogArticle } from "./blog-writing-engine.mjs";
import { normalizeDraftHistoryItem } from "./server-ops.mjs";

function clean(value) {
  return String(value || "").trim();
}

function cleanList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagsText(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ");
  }
  return clean(tags);
}

export async function buildGenerateDraftResponse(payload = {}, fallbackAuthor = "") {
  const form = {
    brand: clean(payload.brand),
    region: clean(payload.region),
    sales: clean(payload.sales),
    premium: clean(payload.premium),
    strengths: clean(payload.strengths),
    listingMemo: clean(payload.listingMemo || payload.memo),
    memo: clean(payload.memo || payload.listingMemo),
    brandNews: clean(payload.brandNews),
    readerPain: clean(payload.readerPain),
    proofDetails: clean(payload.proofDetails),
    repeatPhrase: clean(payload.repeatPhrase),
    writingTone: clean(payload.writingTone),
    ctaStyle: clean(payload.ctaStyle),
    target: clean(payload.target),
    message: clean(payload.message),
    hookFocus: clean(payload.hookFocus),
    length: clean(payload.length),
    mode: clean(payload.mode),
    ruleVersion: clean(payload.ruleVersion),
    researchKeys: cleanList(payload.researchKeys),
    qualityKeys: cleanList(payload.qualityKeys)
  };
  if (!form.brand || !form.region || !form.sales) {
    return {
      ok: false,
      error: "brand, region, sales는 필수입니다."
    };
  }
  const generated = await generateBlogArticle(form, {
    mode: form.mode || "hybrid",
    ruleVersion: form.ruleVersion || "rule2",
    useLlm: payload.useLlm !== false
  });
  const draft = normalizeDraftHistoryItem({
    brand: generated.input.brand,
    region: generated.input.region,
    sales: generated.input.salesText,
    premium: generated.input.premiumText,
    repeatPhrase: generated.input.repeatPhrase,
    listingMemo: generated.input.listingMemo,
    brandNews: generated.input.brandNews,
    mode: generated.input.mode,
    ruleVersion: generated.input.ruleVersion,
    titles: generated.titleCandidates,
    tags: tagsText(generated.tags),
    body: generated.body,
    relatedPosts: generated.relatedPosts || [],
    id: Date.now(),
    createdAt: new Date().toLocaleString("ko-KR"),
    author: payload.author || fallbackAuthor || "로컬 API"
  }, fallbackAuthor || "로컬 API");
  return {
    ok: generated.ok,
    draft,
    score: generated.score,
    relatedPosts: generated.relatedPosts || [],
    repairApplied: generated.repairApplied || [],
    warnings: generated.warnings || []
  };
}
