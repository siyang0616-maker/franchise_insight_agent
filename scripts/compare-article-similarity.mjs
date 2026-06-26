import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { evaluateArticleQuality } from "./evaluate-article-quality.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const LAB_DIR = path.join(ROOT_DIR, "outputs", "quality-lab");

function sumRepeated(rows) {
  const totals = new Map();
  for (const row of rows) {
    for (const [phrase, count] of Object.entries(row.repeatedPhrases || {})) {
      totals.set(phrase, (totals.get(phrase) || 0) + count);
    }
  }
  return Object.fromEntries([...totals.entries()].sort((a, b) => b[1] - a[1]));
}

function deltaRows(before, after) {
  const afterBySlug = new Map(after.map((row) => [row.slug, row]));
  return before.map((row) => {
    const next = afterBySlug.get(row.slug);
    return {
      slug: row.slug,
      brand: row.brand,
      region: row.region,
      scoreDelta: (next?.score || 0) - row.score,
      weakSentenceDelta: row.weakSentenceCount - (next?.weakSentenceCount || 0),
      charsDelta: (next?.charsNoSpace || 0) - row.charsNoSpace
    };
  }).sort((a, b) => b.scoreDelta - a.scoreDelta || b.weakSentenceDelta - a.weakSentenceDelta);
}

export async function compareArticleSimilarity() {
  const evaluation = await evaluateArticleQuality();
  const beforeRepeated = sumRepeated(evaluation.before);
  const afterRepeated = sumRepeated(evaluation.after);
  const reduced = Object.entries(beforeRepeated)
    .map(([phrase, beforeCount]) => ({
      phrase,
      beforeCount,
      afterCount: afterRepeated[phrase] || 0,
      reducedBy: beforeCount - (afterRepeated[phrase] || 0)
    }))
    .sort((a, b) => b.reducedBy - a.reducedBy);
  const payload = {
    beforeRepeated,
    afterRepeated,
    mostReduced: reduced,
    deltas: deltaRows(evaluation.before, evaluation.after)
  };
  const outPath = path.join(LAB_DIR, "latest-similarity.json");
  await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const result = await compareArticleSimilarity();
  console.log("most reduced repeated expressions");
  for (const item of result.mostReduced.slice(0, 10)) {
    console.log(`${item.phrase}\t${item.beforeCount}->${item.afterCount}`);
  }
}
