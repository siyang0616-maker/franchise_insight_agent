import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { evaluateArticleQuality } from "./evaluate-article-quality.mjs";
import { compareArticleSimilarity } from "./compare-article-similarity.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const LAB_DIR = path.join(ROOT_DIR, "outputs", "quality-lab");

function excerpt(body) {
  return body
    .split(/\n{2,}/)
    .map((item) => item.replace(/^### \d+문단\s*/m, "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n\n");
}

function afterArticleFullText(row) {
  return row.body
    .split(/\n{2,}/)
    .map((item) => item.replace(/^### \d+문단\s*/m, "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function formatPhraseList(items) {
  return items.length ? items.map((item) => `- ${item.phrase}: ${item.beforeCount} -> ${item.afterCount}`).join("\n") : "- 없음";
}

export async function refineQualityLoop() {
  const evaluation = await evaluateArticleQuality();
  const similarity = await compareArticleSimilarity();
  const afterBySlug = new Map(evaluation.after.map((row) => [row.slug, row]));
  const deltas = similarity.deltas;
  const mostImproved = deltas.slice(0, 3);
  const needsHumanReview = [...evaluation.after]
    .sort((a, b) => a.score - b.score || b.weakSentenceCount - a.weakSentenceCount)
    .slice(0, 3);
  const best = afterBySlug.get(mostImproved[0]?.slug) || evaluation.after[0];
  const beforeBest = evaluation.before.find((row) => row.slug === best.slug) || evaluation.before[0];
  const report = [
    "# Quality Lab Before/After Report",
    "",
    `- 개선 전 평균 점수: ${evaluation.beforeAverageScore}`,
    `- 개선 후 평균 점수: ${evaluation.afterAverageScore}`,
    `- 개선 전 평균 글자 수: ${evaluation.beforeAverageChars}`,
    `- 개선 후 평균 글자 수: ${evaluation.afterAverageChars}`,
    "",
    "## 가장 많이 줄어든 반복 표현",
    "",
    formatPhraseList(similarity.mostReduced.slice(0, 8)),
    "",
    "## 여전히 남아 있는 반복 표현",
    "",
    Object.keys(similarity.afterRepeated).length
      ? Object.entries(similarity.afterRepeated).map(([phrase, count]) => `- ${phrase}: ${count}`).join("\n")
      : "- 없음",
    "",
    "## 실제로 교체된 bad pattern 목록",
    "",
    formatPhraseList(similarity.mostReduced.filter((item) => item.reducedBy > 0).slice(0, 12)),
    "",
    "## 가장 많이 개선된 원고 3개",
    "",
    ...mostImproved.map((item) => `- ${item.region} ${item.brand}: 점수 ${item.scoreDelta >= 0 ? "+" : ""}${item.scoreDelta}, weak sentence ${item.weakSentenceDelta}개 감소`),
    "",
    "## 아직 사람이 직접 봐야 할 원고 3개",
    "",
    ...needsHumanReview.map((item) => `- ${item.region} ${item.brand}: ${item.score}점, weak sentence ${item.weakSentenceCount}개`),
    "",
    "## Before 일부",
    "",
    excerpt(beforeBest.body),
    "",
    "## After 일부",
    "",
    excerpt(best.body),
    "",
    "## 가장 많이 개선된 샘플 1개 전체 본문",
    "",
    afterArticleFullText(best),
    ""
  ].join("\n");
  const outPath = path.join(LAB_DIR, "latest-before-after-report.md");
  await fs.writeFile(outPath, report, "utf8");
  console.log(outPath);
  return { reportPath: outPath, evaluation, similarity };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  await refineQualityLoop();
}
