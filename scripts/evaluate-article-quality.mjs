import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeInput, scoreDraft, weakSentenceHits } from "./blog-writing-engine.mjs";
import { qualityCases } from "./quality-cases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const LAB_DIR = path.join(ROOT_DIR, "outputs", "quality-lab");

function numberFromLine(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}:\\s*([0-9,]+)`));
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function bodyText(markdown) {
  return markdown.split("## 본문 전체")[1]?.split("## 태그")[0]?.trim() || markdown;
}

function bodyParagraphs(markdown) {
  const body = bodyText(markdown);
  return body
    .split(/### \d+문단/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function titleCandidates(markdown) {
  const block = markdown.split("## 제목 후보 3개")[1]?.split("## 본문 전체")[0] || "";
  return block
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function tagList(markdown) {
  const block = markdown.split("## 태그")[1]?.split("## 품질 정보")[0] || "";
  return block.split(/\s+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean);
}

function repeatedPhrases(text) {
  const targets = [
    "봐야 합니다",
    "확인해야 한다",
    "확인해야 합니다",
    "중요합니다",
    "보는 것이 좋습니다",
    "보는 편이 좋습니다",
    "자료로 살피는 편이 좋습니다",
    "조건만 보면 좋아 보여도",
    "최근 이슈는 검증된 자료",
    "리스크도 분명히 남습니다"
  ];
  return Object.fromEntries(targets.map((target) => {
    const count = (text.match(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    return [target, count];
  }).filter(([, count]) => count > 0));
}

async function readArticleSet(kind) {
  const dir = path.join(LAB_DIR, kind);
  const rows = [];
  for (const sample of qualityCases) {
    const fileName = `${kind === "before" ? "before" : "after"}-${sample.slug}.md`;
    const filePath = path.join(dir, fileName);
    const markdown = await fs.readFile(filePath, "utf8");
    const body = bodyText(markdown);
    const input = normalizeInput(sample);
    const scored = scoreDraft({
      input,
      titleCandidates: titleCandidates(markdown),
      tags: tagList(markdown),
      bodyParagraphs: bodyParagraphs(markdown)
    }, input, {});
    rows.push({
      slug: sample.slug,
      brand: sample.brand,
      region: sample.region,
      filePath,
      savedScore: numberFromLine(markdown, "품질 점수"),
      score: scored.qualityScore,
      charsNoSpace: numberFromLine(markdown, "공백 제외 글자 수"),
      weakSentenceCount: weakSentenceHits(body).length,
      warnings: scored.allWarnings,
      repeatedPhrases: repeatedPhrases(body),
      body
    });
  }
  return rows;
}

function average(rows, key) {
  return rows.length ? Math.round(rows.reduce((sum, row) => sum + row[key], 0) / rows.length * 10) / 10 : 0;
}

export async function evaluateArticleQuality() {
  const before = await readArticleSet("before");
  const after = await readArticleSet("after");
  const payload = {
    beforeAverageScore: average(before, "score"),
    afterAverageScore: average(after, "score"),
    beforeAverageChars: average(before, "charsNoSpace"),
    afterAverageChars: average(after, "charsNoSpace"),
    before,
    after
  };
  const outPath = path.join(LAB_DIR, "latest-quality-evaluation.json");
  await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const result = await evaluateArticleQuality();
  console.log(`before score avg: ${result.beforeAverageScore}`);
  console.log(`after score avg: ${result.afterAverageScore}`);
  console.log(`before chars avg: ${result.beforeAverageChars}`);
  console.log(`after chars avg: ${result.afterAverageChars}`);
}
