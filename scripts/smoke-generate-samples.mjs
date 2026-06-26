import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateBlogArticle } from "./blog-writing-engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "outputs", "sample-articles");

export const samples = [
  {
    brand: "메가커피",
    region: "강동구",
    sales: "3000",
    premium: "18000",
    strengths: "전면부 넓은 매장, 유동인구 많음, 주거상권, 풀오토운영매장, 기복없는 매출",
    repeatPhrase: "강동구 메가커피 양도양수",
    slug: "gangdong-mega-coffee"
  },
  {
    brand: "배스킨라빈스",
    region: "구로구",
    sales: "4000",
    premium: "17000",
    strengths: "가족 고객층, 아이스크림 케이크 수요, 역세권 주거상권, 안정적인 브랜드 인지도",
    repeatPhrase: "구로구 배스킨라빈스 양도양수",
    slug: "guro-baskin-robbins"
  },
  {
    brand: "빽다방",
    region: "동작구",
    sales: "2700",
    premium: "8000",
    strengths: "저가커피 수요, 출근 동선, 생활밀착형 상권",
    repeatPhrase: "동작구 빽다방 양도양수",
    slug: "dongjak-paikdabang"
  },
  {
    brand: "노모어피자",
    region: "강남구",
    sales: "3300",
    premium: "19000",
    strengths: "브랜드 인지도 상승, 배달/포장 수요, 젊은 고객층",
    repeatPhrase: "강남구 노모어피자 양도양수",
    slug: "gangnam-nomorepizza"
  },
  {
    brand: "파리바게뜨",
    region: "마포구",
    sales: "5000",
    premium: "25000",
    strengths: "생활밀착형 수요, 케이크/간식 수요, 주거와 오피스 혼합 상권",
    repeatPhrase: "마포구 파리바게뜨 양도양수",
    slug: "mapo-parisbaguette"
  }
];

export function paragraphRoleSummary() {
  return [
    "1문단: 검색자가 클릭한 이유와 인수 후 운영 가능성",
    "2문단: 브랜드, 지역, 월매출, 창업비용, 핵심 장점 요약",
    "3문단: 브랜드 특성과 고객 반복 수요 해석",
    "4문단: 지역 상권과 시간대별 고객 흐름",
    "5문단: 월매출을 객단가, 회전율, 고정비와 연결",
    "6문단: 창업비용, 회수 가능성, 신규창업 비교",
    "7문단: 임대료, 인건비, 원가율, 배달비중 중심 수익 구조",
    "8문단: 예비 양수인이 실제로 걱정하는 운영 난이도",
    "9문단: POS, 임대차, 인력, 원가, 본사승인 검증 자료",
    "10문단: 신규창업 대비 양도양수의 장점과 한계",
    "11문단: 권리금 성격 비용, 매출 기복, 직원 의존도 리스크",
    "12문단: 자료 기반 상담형 마무리"
  ];
}

function todayString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function sampleFileName(sample, dateText = todayString()) {
  return `${dateText}-${sample.slug}.md`;
}

function tagsText(tags) {
  return Array.isArray(tags)
    ? tags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")
    : String(tags || "");
}

export function buildSampleMarkdown(sample, result) {
  const input = result.input || {};
  const warnings = result.score?.allWarnings?.length
    ? result.score.allWarnings
    : result.warnings || [];
  return [
    `# ${sample.region} ${sample.brand} 샘플 원고`,
    "",
    "## 입력값",
    "",
    `- 브랜드: ${sample.brand}`,
    `- 지역: ${sample.region}`,
    `- 월매출: ${input.salesText || sample.sales}`,
    `- 창업비용: ${input.premiumText || sample.premium}`,
    `- 장점: ${sample.strengths}`,
    `- 반복문구: ${input.repeatPhrase || sample.repeatPhrase}`,
    "",
    "## 제목 후보 3개",
    "",
    ...result.titleCandidates.map((title, index) => `${index + 1}. ${title}`),
    "",
    "## 본문 전체",
    "",
    ...result.bodyParagraphs.flatMap((paragraph, index) => [
      `### ${index + 1}문단`,
      paragraph,
      ""
    ]),
    "## 태그",
    "",
    tagsText(result.tags),
    "",
    "## 품질 정보",
    "",
    `- 공백 제외 글자 수: ${result.score.structure.charsNoSpace}`,
    `- 반복 키워드 횟수: ${result.score.structure.repeatCount}`,
    `- 품질 점수: ${result.score.qualityScore}`,
    `- 경고 목록: ${warnings.length ? warnings.join(" / ") : "없음"}`,
    "",
    "## 문단별 역할 요약",
    "",
    ...paragraphRoleSummary().map((role) => `- ${role}`)
  ].join("\n");
}

async function saveSample(sample, result, dateText = todayString()) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, sampleFileName(sample, dateText));
  await fs.writeFile(filePath, buildSampleMarkdown(sample, result), "utf8");
  return filePath;
}

export async function generateAndSaveSamples(dateText = todayString()) {
  const saved = [];
  for (const sample of samples) {
    const result = await generateBlogArticle(sample, { useLlm: false });
    const warnings = result.score.allWarnings?.length ? result.score.allWarnings : result.warnings;
    const filePath = await saveSample(sample, result, dateText);
    saved.push({ sample, result, filePath });
    console.log("=".repeat(72));
    console.log(`${sample.region} ${sample.brand}`);
    console.log(`ok: ${result.ok}`);
    console.log(`공백 제외 글자 수: ${result.score.structure.charsNoSpace}`);
    console.log(`반복 키워드 횟수: ${result.score.structure.repeatCount}`);
    console.log(`품질 점수: ${result.score.qualityScore}`);
    console.log(`경고 목록: ${warnings.length ? warnings.join(" / ") : "없음"}`);
    console.log(`제목 후보 1번: ${result.titleCandidates[0]}`);
    console.log("본문 첫 2문단 미리보기:");
    console.log(result.bodyParagraphs.slice(0, 2).join("\n\n"));
    console.log(`저장 파일: ${filePath}`);
  }
  console.log("=".repeat(72));
  console.log("저장된 샘플 원고 파일");
  for (const item of saved) console.log(`- ${item.filePath}`);
  return saved;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  await generateAndSaveSamples();
}
