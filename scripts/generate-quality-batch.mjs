import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateBlogArticle } from "./blog-writing-engine.mjs";
import { buildSampleMarkdown } from "./smoke-generate-samples.mjs";
import { qualityCases } from "./quality-cases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "outputs", "quality-lab", "after");

export async function generateQualityBatch(cases = qualityCases) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const results = [];
  for (const sample of cases) {
    const result = await generateBlogArticle(sample, { useLlm: false });
    const filePath = path.join(OUTPUT_DIR, `after-${sample.slug}.md`);
    await fs.writeFile(filePath, buildSampleMarkdown(sample, result), "utf8");
    results.push({
      slug: sample.slug,
      brand: sample.brand,
      region: sample.region,
      filePath,
      score: result.score.qualityScore,
      charsNoSpace: result.score.structure.charsNoSpace,
      weakSentenceCount: result.score.qualityMetrics?.weakSentenceCount || 0,
      warnings: result.score.allWarnings || []
    });
  }
  const summaryPath = path.join(ROOT_DIR, "outputs", "quality-lab", "latest-batch-summary.json");
  await fs.writeFile(summaryPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const results = await generateQualityBatch();
  for (const item of results) {
    console.log(`${item.slug}\t${item.score}\t${item.charsNoSpace}\tweak=${item.weakSentenceCount}`);
  }
}
