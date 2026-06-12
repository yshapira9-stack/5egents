import fs from "node:fs";

// gen.mjs — מעטפת ל-OpenAI Images API (model gpt-image-2)
//
// שני מצבי הרצה:
//   1) יחיד:  node gen.mjs <outPath> <prompt> [quality] [size]
//   2) אצווה במקביל:  node gen.mjs --batch <jobsFile.json> [quality] [size]
//        jobsFile = מערך JSON של { "out": "...", "prompt": "...", "quality"?, "size"? }
//        כל העבודות נשלחות *בו-זמנית* (Promise.allSettled) — זמן האצווה ≈ זמן
//        התמונה האיטית ביותר, לא הסכום.
//
// quality: low | medium | high  (ברירת מחדל: medium — מהיר וזול לתצוגות קונספט;
//          השתמש ב-high רק לרינדור הסופי של הכיוון שנבחר).

const VALID_Q = new Set(["low", "medium", "high"]);

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error("ERROR: OPENAI_API_KEY is not set.");
  process.exit(1);
}

async function generate({ out, prompt, quality, size }) {
  const q = VALID_Q.has(quality) ? quality : "medium";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt,
      size: size || "1024x1024",
      quality: q,
      output_format: "png",
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("non-JSON response:\n" + text.slice(0, 800));
  }
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("no image in response:\n" + JSON.stringify(data).slice(0, 800));
  }
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  return out;
}

const argv = process.argv.slice(2);

if (argv[0] === "--batch") {
  const [, jobsFile, cliQuality, cliSize] = argv;
  if (!jobsFile) {
    console.error("usage: node gen.mjs --batch <jobsFile.json> [quality] [size]");
    process.exit(1);
  }
  let jobs;
  try {
    jobs = JSON.parse(fs.readFileSync(jobsFile, "utf8"));
  } catch (e) {
    console.error("ERROR: cannot read/parse jobs file: " + e.message);
    process.exit(1);
  }
  if (!Array.isArray(jobs) || jobs.length === 0) {
    console.error("ERROR: jobs file must be a non-empty JSON array.");
    process.exit(1);
  }

  // כל העבודות במקביל
  const results = await Promise.allSettled(
    jobs.map((j) =>
      generate({
        out: j.out,
        prompt: j.prompt,
        quality: j.quality || cliQuality,
        size: j.size || cliSize,
      })
    )
  );

  let failed = 0;
  results.forEach((r, i) => {
    const out = jobs[i].out;
    if (r.status === "fulfilled") {
      console.log("WROTE " + out);
    } else {
      failed++;
      console.error("FAILED " + out + " — " + r.reason.message);
    }
  });
  process.exit(failed ? 1 : 0);
} else {
  const [outPath, prompt, quality, size] = argv;
  if (!outPath || !prompt) {
    console.error("usage: node gen.mjs <outPath> <prompt> [quality] [size]");
    process.exit(1);
  }
  try {
    await generate({ out: outPath, prompt, quality, size });
    console.log("WROTE " + outPath);
  } catch (e) {
    console.error("ERROR: " + e.message);
    process.exit(1);
  }
}
