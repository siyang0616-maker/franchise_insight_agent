import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_REFERENCE_DIR = path.join(ROOT_DIR, "reference-posts");

function readTxtFiles(referenceDir) {
  if (!fs.existsSync(referenceDir)) return [];
  return fs.readdirSync(referenceDir)
    .filter((name) => name.toLowerCase().endsWith(".txt"))
    .sort()
    .map((name) => {
      const filePath = path.join(referenceDir, name);
      return {
        name,
        filePath,
        text: fs.readFileSync(filePath, "utf8")
      };
    });
}

function blocksFrom(text) {
  return String(text || "")
    .split(/\n{2,}|\r?\n\s*\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sentencesFrom(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?。]|다\.|요\.|니다\.)\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 12);
}

function topCounts(items, limit = 10) {
  const counts = new Map();
  for (const item of items.filter(Boolean)) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function noSpaceLength(text) {
  return String(text || "").replace(/\s/g, "").length;
}

function sentenceEnding(sentence) {
  const clean = sentence.replace(/\s+/g, " ").replace(/[\"'“”‘’]/g, "").trim();
  const match = clean.match(/([가-힣]{2,12}(?:니다|세요|습니다|입니다|됩니다|합니다|좋습니다|있습니다|없습니다|보입니다|드립니다|같습니다)\.?)$/);
  if (match) return match[1].replace(/\.$/, "");
  return clean.slice(-8).replace(/\.$/, "");
}

function keywordFromName(name) {
  const cleaned = name.replace(/\.txt$/i, "").replace(/[_-]+/g, " ");
  const match = cleaned.match(/([가-힣A-Za-z&]+)\s*창업\s*양도양수/);
  return match ? match[1].trim() : "";
}

function buildGuidelines(stats) {
  const guidelines = [
    `참고글 평균은 공백 제외 약 ${Math.round(stats.averageCharsNoSpace).toLocaleString("ko-KR")}자라서, 현재 네이버용 1800~2100자 규칙과는 별도 기준으로 다뤄야 합니다.`,
    `참고글은 평균 ${Math.round(stats.averageBlocks)}개 블록 흐름이므로, 현재 생성기는 문체만 참고하고 12문단 구조는 유지해야 합니다.`,
    "첫 문단은 매장 조건과 지역/브랜드를 바로 제시하고, 작성자용 설명이나 SEO 해설로 시작하지 않습니다.",
    "중간 문단은 브랜드 장점, 상권, 월매출, 창업비용, 양도양수 장점을 분리해서 설명합니다.",
    "마지막 문단은 무리한 홍보보다 상담 전 확인 기준과 비교 검토 흐름으로 닫습니다.",
    "반복 표현은 유지하되 같은 문장 시작과 같은 어미가 이어지면 템플릿 냄새가 강해지므로 문장 리듬을 분산합니다.",
    "참고글의 상담형 말투는 가져오되, 독자는 항상 예비 양수자와 창업 검토자로 고정합니다."
  ];
  if (stats.commonEndings.length) {
    guidelines.push(`자주 보이는 마무리 어미는 ${stats.commonEndings.slice(0, 4).map((item) => item.term).join(", ")} 계열입니다.`);
  }
  return guidelines;
}

export function analyzeReferencePosts(options = {}) {
  const referenceDir = options.referenceDir || DEFAULT_REFERENCE_DIR;
  const files = readTxtFiles(referenceDir);
  const allBlocks = files.flatMap((file) => blocksFrom(file.text));
  const allSentences = files.flatMap((file) => sentencesFrom(file.text));
  const chars = files.map((file) => noSpaceLength(file.text));
  const blockCounts = files.map((file) => blocksFrom(file.text).length);
  const endings = topCounts(allSentences.map(sentenceEnding), 12);
  const brandNames = topCounts(files.map((file) => keywordFromName(file.name)).filter(Boolean), 12);
  const internalMemoSignals = topCounts(
    allSentences
      .filter((sentence) => /참고|문단|본문|제목|키워드|블로그|검색자|상위노출/.test(sentence))
      .map((sentence) => sentence.slice(0, 44)),
    8
  );
  const stats = {
    totalFiles: files.length,
    totalBlocks: allBlocks.length,
    totalSentences: allSentences.length,
    averageCharsNoSpace: chars.length ? chars.reduce((sum, value) => sum + value, 0) / chars.length : 0,
    averageBlocks: blockCounts.length ? blockCounts.reduce((sum, value) => sum + value, 0) / blockCounts.length : 0,
    commonEndings: endings,
    commonBrandsInFilenames: brandNames,
    internalMemoSignals,
    protectedSourceFiles: true
  };
  return {
    ...stats,
    styleGuidelines: buildGuidelines(stats),
    sourceDirectory: referenceDir
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(analyzeReferencePosts(), null, 2));
}
