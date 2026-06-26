import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const port = 9876;
const root = path.resolve(".");
const historyPath = path.join(root, "draft-history.json");
let server;

async function request(pathname, options = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  const data = await res.json();
  return { res, data };
}

async function waitForServer() {
  const deadline = Date.now() + 7000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const { res } = await request("/api/status");
      if (res.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError || new Error("server did not start");
}

try {
  await fs.rm(historyPath, { force: true });
  server = spawn(process.execPath, ["naver-keyword-server.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), OPENAI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer();

  const payload = {
    brand: "BBQ",
    region: "인천",
    sales: "1200",
    premium: "5000",
    listingMemo: "배달 주문이 꾸준한 주거 배후 매장",
    sourceKeyword: "인천 BBQ 양도양수",
    sourceScore: 9.7,
    sourceCompetitionLabel: "틈새",
    recommendedAt: "2026-06-26T00:00:00.000Z",
    useLlm: false
  };
  const generated = await request("/api/generate-draft", {
    method: "POST",
    headers: { "content-type": "application/json", "x-blog-agent-author": "route-test" },
    body: JSON.stringify(payload)
  });

  assert.equal(generated.res.status, 200);
  assert.equal(generated.data.ok, true, generated.data.error || generated.data.warnings?.join(" / "));
  assert.equal(generated.data.draft.sourceKeyword, "인천 BBQ 양도양수");
  assert.equal(generated.data.draft.sourceScore, 9.7);
  assert.match(generated.data.draft.body, /치킨|배달|조리|주말/);

  const history = await request("/api/draft-history");
  assert.equal(history.res.status, 200);
  assert.equal(history.data.ok, true);
  assert.equal(history.data.items.length, 1);
  assert.equal(history.data.items[0].sourceKeyword, "인천 BBQ 양도양수");

  const updated = await request("/api/draft-history/update", {
    method: "POST",
    headers: { "content-type": "application/json", "x-blog-agent-author": "route-test" },
    body: JSON.stringify({
      id: history.data.items[0].id,
      publishedAt: "2026-06-26",
      publishedUrl: "https://example.com/bbq",
      performanceCheckedAt: "2026-06-27",
      performanceRank: 4,
      inquiryCount: 2,
      performanceNote: "문의 2건"
    })
  });
  assert.equal(updated.res.status, 200);
  assert.equal(updated.data.ok, true);
  assert.equal(updated.data.item.publishedAt, "2026-06-26");
  assert.equal(updated.data.item.publishedUrl, "https://example.com/bbq");
  assert.equal(updated.data.item.performanceRank, 4);
  assert.equal(updated.data.item.inquiryCount, 2);

  const cleared = await request("/api/draft-history", { method: "DELETE" });
  assert.equal(cleared.res.status, 200);
  assert.deepEqual(cleared.data.items, []);

  console.log("server draft routes test passed");
} finally {
  if (server) server.kill();
}
