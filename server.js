const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const dotenv = require("dotenv");
const {
  callAIWithOptions,
  buildSurveyPrompt,
  buildAnalysisPrompt,
  buildPlanPrompt,
  buildCoachPrompt,
  safeJsonParse,
} = require("./api/_lib/openai");

dotenv.config();

const AI_REQUEST_PRESETS = {
  survey: {
    model: process.env.GEMINI_SURVEY_MODEL || "gemini-2.5-flash-lite",
    temperature: 0.1,
    maxOutputTokens: 900,
    timeoutMs: Number(process.env.SURVEY_TIMEOUT_MS || 25000),
  },
  analyze: {
    temperature: 0.35,
    maxOutputTokens: 1400,
    timeoutMs: Number(process.env.ANALYZE_TIMEOUT_MS || 22000),
  },
  plan: {
    temperature: 0.3,
    maxOutputTokens: 1100,
    timeoutMs: Number(process.env.PLAN_TIMEOUT_MS || 18000),
  },
  coach: {
    temperature: 0.35,
    maxOutputTokens: 1200,
    timeoutMs: Number(process.env.COACH_TIMEOUT_MS || 20000),
  },
};

function getAIErrorStatus(error) {
  const message = String(error?.message || "").toLowerCase();
  if (error?.name === "TimeoutError") {
    return 504;
  }
  if (message.includes("quota exceeded") || message.includes("rate limit") || message.includes("billing details")) {
    return 429;
  }
  return 500;
}

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, "data");
const storageFile = path.join(dataDir, "accounts.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname)));

async function ensureStorageFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(storageFile);
  } catch {
    await fs.writeFile(
      storageFile,
      JSON.stringify({ currentUser: null, users: {} }, null, 2),
      "utf8"
    );
  }
}

async function readStorage() {
  await ensureStorageFile();
  const raw = await fs.readFile(storageFile, "utf8");
  const parsed = JSON.parse(raw);

  return {
    currentUser: parsed?.currentUser || null,
    users: parsed?.users && typeof parsed.users === "object" ? parsed.users : {},
  };
}

async function writeStorage(payload) {
  const safePayload = {
    currentUser: payload?.currentUser || null,
    users: payload?.users && typeof payload.users === "object" ? payload.users : {},
  };

  await ensureStorageFile();
  await fs.writeFile(storageFile, JSON.stringify(safePayload, null, 2), "utf8");
  return safePayload;
}

app.get("/api/storage", async (req, res) => {
  try {
    const storage = await readStorage();
    return res.json({ ok: true, storage });
  } catch (error) {
    console.error("Storage read failed:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/storage", async (req, res) => {
  try {
    const storage = await writeStorage(req.body || {});
    return res.json({ ok: true, storage });
  } catch (error) {
    console.error("Storage write failed:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const payload = req.body || {};
    const prompt = buildAnalysisPrompt(payload);
    const text = await callAIWithOptions(prompt, AI_REQUEST_PRESETS.analyze);
    const parsed = safeJsonParse(text);

    if (!parsed) {
      return res.status(502).json({ ok: false, error: "Model returned invalid JSON.", raw: text });
    }

    return res.json({ ok: true, analysis: parsed });
  } catch (error) {
    console.error("Analyze API failed:", error);
    const status = getAIErrorStatus(error);
    return res.status(status).json({ ok: false, error: error.message });
  }
});

app.post("/api/survey", async (req, res) => {
  try {
    const payload = req.body || {};
    const prompt = buildSurveyPrompt(payload);
    let text = await callAIWithOptions(prompt, AI_REQUEST_PRESETS.survey);
    let parsed = safeJsonParse(text);

    if (!parsed) {
      text = await callAIWithOptions(prompt, {
        ...AI_REQUEST_PRESETS.survey,
        temperature: 0.05,
        maxOutputTokens: 1200,
        timeoutMs: Math.max(AI_REQUEST_PRESETS.survey.timeoutMs, 30000),
      });
      parsed = safeJsonParse(text);
    }

    if (!parsed) {
      return res.status(502).json({ ok: false, error: "Model returned invalid JSON.", raw: text });
    }

    return res.json({ ok: true, questions: parsed.questions || parsed });
  } catch (error) {
    console.error("Survey API failed:", error);
    const status = getAIErrorStatus(error);
    return res.status(status).json({ ok: false, error: error.message });
  }
});

app.post("/api/plan", async (req, res) => {
  try {
    const payload = req.body || {};
    const prompt = buildPlanPrompt(payload);
    const text = await callAIWithOptions(prompt, AI_REQUEST_PRESETS.plan);
    const parsed = safeJsonParse(text);

    if (!parsed) {
      return res.status(502).json({ ok: false, error: "Model returned invalid JSON.", raw: text });
    }

    return res.json({ ok: true, plan: parsed.plan || parsed });
  } catch (error) {
    console.error("Plan API failed:", error);
    const status = getAIErrorStatus(error);
    return res.status(status).json({ ok: false, error: error.message });
  }
});

app.post("/api/coach", async (req, res) => {
  try {
    const payload = req.body || {};
    const prompt = buildCoachPrompt(payload);
    const text = await callAIWithOptions(prompt, AI_REQUEST_PRESETS.coach);
    const parsed = safeJsonParse(text);

    if (!parsed) {
      return res.status(502).json({ ok: false, error: "Model returned invalid JSON.", raw: text });
    }

    return res.json({ ok: true, coach: parsed });
  } catch (error) {
    console.error("Coach API failed:", error);
    const status = getAIErrorStatus(error);
    return res.status(status).json({ ok: false, error: error.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Week Mind server running at http://localhost:${port}`);
});
