import {
  generateLocalBlogArticle,
  normalizeInput,
  repairDraft,
  scoreDraft
} from "./blog-writing-engine.mjs";

export const sampleCases = [
  {
    brand: "써브웨이",
    region: "강남",
    sales: "7500",
    premium: "18000",
    strengths: "식사 대체 수요, 오피스 점심 수요, 피크타임 주문 동선",
    listingMemo: "역세권 1층, 점심 피크 수요, 기존 단골 고객층",
    brandNews: "간편한 식사 대체 수요가 꾸준히 유지되는 브랜드",
    readerPain: "창업비용 회수 가능성과 초보 운영 부담",
    proofDetails: "월매출, 점심 피크타임, 고객 동선, 인력 구성을 확인"
  },
  {
    brand: "메가커피",
    region: "수원",
    sales: "6800",
    premium: "13500",
    strengths: "테이크아웃 친화 구조, 빠른 회전율, 생활동선 반복 수요",
    listingMemo: "아파트와 학원가 사이 유동, 오후 음료 수요",
    brandNews: "저가 커피 시장에서 반복 구매 수요가 강한 브랜드",
    readerPain: "주변 경쟁 카페와 비교했을 때 매출 방어력",
    proofDetails: "월매출, 피크 시간대, 테이크아웃 비중, 고정비를 확인"
  },
  {
    brand: "샐러디",
    region: "분당",
    sales: "5200",
    premium: "12000",
    strengths: "건강식 트렌드, 오피스 점심 수요, 배달 재주문",
    listingMemo: "오피스 밀집 상권, 점심과 저녁 간편식 수요",
    brandNews: "가벼운 한 끼와 건강식 수요가 이어지는 브랜드",
    readerPain: "건강식 브랜드가 실제 반복 매출을 만들 수 있는지",
    proofDetails: "월매출, 배달 비중, 점심 피크타임, 재주문 고객층을 확인"
  }
];

function blocksFromBody(body) {
  return String(body || "").split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
}

function draftFromArticle(article = {}, options = {}) {
  const input = normalizeInput({
    ...article,
    mode: options.mode || article.mode || "hybrid",
    ruleVersion: options.ruleVersion || article.ruleVersion || "rule2"
  });
  const blocks = blocksFromBody(article.body);
  const bodyParagraphs = Array.isArray(article.bodyParagraphs)
    ? article.bodyParagraphs
    : blocks.length > 12
      ? blocks.slice(1)
      : blocks;
  return {
    input,
    titleCandidates: article.titles || article.titleCandidates || [blocks[0] || `${input.region} ${input.brand} 양도양수`],
    tags: String(article.tags || "").split(/\s+/).filter(Boolean),
    bodyParagraphs
  };
}

function failureText(warning) {
  return String(warning || "")
    .replace("industryMismatch", "업종 혼선")
    .replace("paragraphs", "문단")
    .replace("repeatPhrase", "반복 키워드")
    .replace("awkwardPhrases", "조사 오류")
    .replace("forbidden", "금지어");
}

function toHarnessScore(score, input) {
  return {
    brand: input.brand,
    region: input.region,
    ok: score.ok,
    status: score.status,
    structure: score.structure,
    failures: score.warnings.map(failureText),
    criticalFailures: score.criticalFailures.map(failureText),
    roles: score.roles
  };
}

export function generateDraft(form, options = {}) {
  const generated = generateLocalBlogArticle({
    ...form,
    mode: options.mode || form.mode,
    ruleVersion: options.ruleVersion || form.ruleVersion
  }, options);
  const draft = {
    ...form,
    brand: generated.input.brand,
    region: generated.input.region,
    sales: generated.input.salesText,
    premium: generated.input.premiumText,
    repeatPhrase: generated.input.repeatPhrase,
    titles: generated.titleCandidates,
    tags: generated.tags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" "),
    body: generated.body,
    relatedPosts: generated.relatedPosts,
    mode: generated.input.mode,
    ruleVersion: generated.input.ruleVersion,
    repairApplied: generated.repairApplied || []
  };
  return {
    ok: generated.ok,
    draft,
    score: toHarnessScore(generated.score, generated.input)
  };
}

export function generateCase(form, options = {}) {
  return generateDraft(form, options).score;
}

export function scoreArticle(article, options = {}) {
  const draft = draftFromArticle(article, options);
  const score = scoreDraft(draft, draft.input, {});
  return toHarnessScore(score, draft.input);
}

export function repairArticle(article, options = {}) {
  const draft = draftFromArticle(article, options);
  const before = scoreDraft(draft, draft.input, {});
  const repaired = repairDraft(generateLocalBlogArticle({
    ...draft.input,
    repeatPhrase: draft.input.repeatPhrase
  }, options), draft.input, {});
  const after = scoreDraft(repaired, draft.input, {});
  return {
    before: toHarnessScore(before, draft.input),
    after: toHarnessScore(after, draft.input),
    applied: ["새 엔진으로 재작성", ...(repaired.repairApplied || [])]
  };
}

export function runQualityHarness(cases = sampleCases, options = {}) {
  const results = cases.map((item) => generateCase(item, options));
  const failed = results.filter((item) => !item.ok);
  return {
    ok: failed.length === 0,
    summary: failed.length
      ? `품질 하네스 실패: ${failed.map((item) => `${item.brand} ${item.region}`).join(", ")}`
      : `품질 하네스 통과: ${results.length}개 브랜드 샘플`,
    cases: results
  };
}
