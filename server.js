// 轻卡 — 拍照算卡路里减肥 App 后端（零依赖，Node 18+）
// 用法：ANTHROPIC_API_KEY=sk-ant-... node server.js
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;      // 免费：https://aistudio.google.com/apikey
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
let GEMINI_MODEL = process.env.GEMINI_MODEL || ""; // 留空 = 自动向 Google 询问并选最新的 Flash
const PROVIDER = process.env.AI_PROVIDER || (GEMINI_KEY ? "gemini" : ANTHROPIC_KEY ? "claude" : "none");
const API_KEY = PROVIDER === "gemini" ? GEMINI_KEY : PROVIDER === "claude" ? ANTHROPIC_KEY : "";
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const PUBLIC = path.join(__dirname, "public");
const crypto = require("crypto");

// ---- 访问保护：设置 ACCESS_PASSWORD 后，识别接口需要密码 ----
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "";
const MAX_DAILY = +process.env.MAX_DAILY || 200;          // 全站每天最多识别次数（保护你的 API 额度）
const MAX_PER_IP_HOUR = +process.env.MAX_PER_IP_HOUR || 30; // 每个 IP 每小时最多识别次数
const hits = new Map();   // ip -> [timestamps] 识别次数
const fails = new Map();  // ip -> [timestamps] 密码错误次数
let daily = { day: "", n: 0 };

const clientIp = (req) => (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
function recent(map, ip, windowMs) {
  const now = Date.now();
  const arr = (map.get(ip) || []).filter((t) => now - t < windowMs);
  map.set(ip, arr);
  return arr;
}
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function guard(req) {
  const ip = clientIp(req);
  if (ACCESS_PASSWORD) {
    if (recent(fails, ip, 10 * 60e3).length >= 5)
      throw Object.assign(new Error("密码错误次数过多，请 10 分钟后再试 / Too many attempts, try again in 10 min"), { status: 429 });
    if (!safeEqual(req.headers["x-access-password"] || "", ACCESS_PASSWORD)) {
      fails.get(ip).push(Date.now());
      throw Object.assign(new Error("需要访问密码 / Access password required"), { status: 401 });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  if (daily.day !== today) daily = { day: today, n: 0 };
  if (daily.n >= MAX_DAILY) throw Object.assign(new Error("今日识别额度已用完 / Daily limit reached"), { status: 429 });
  if (recent(hits, ip, 3600e3).length >= MAX_PER_IP_HOUR)
    throw Object.assign(new Error("请求太频繁，请稍后再试 / Too many requests"), { status: 429 });
  hits.get(ip).push(Date.now());
  daily.n++;
}

const PROMPT_ZH = `你是一位专业营养师。请分析这张食物照片，估算图中每样食物的份量与营养。
只输出一个 JSON 对象，不要任何其他文字，格式：
{
  "is_food": true/false,
  "dish": "整体餐点名称（中文）",
  "items": [
    {"name":"食物名","portion":"估计份量，如 1碗(约250g)","kcal":整数,"protein":克,"carbs":克,"fat":克}
  ],
  "total": {"kcal":整数,"protein":克,"carbs":克,"fat":克},
  "confidence": "high|medium|low",
  "health_score": 1到10的整数（10最适合减肥）,
  "tip": "一句针对减肥的具体建议，例如如何少吃点热量、怎么替换"
}
锅里、碗里、盘里的各种煮好的菜（咖喱、肉类、炒菜、汤）、饮料、零食、包装食品、水果都算食物，哪怕光线暗、颜色看不清、没有摆盘；只有画面里完全没有任何食物或饮料时，才把 is_food 设为 false。照片模糊或光线暗时仍请尽力估算，并把 confidence 设为 low。
常见东南亚/中式食物（椰浆饭、炒粿条、海南鸡饭、叻沙、面包、奶茶等）请按实际做法估算，油和酱汁也要计入。`;

const PROMPT_EN = `You are a professional dietitian. Analyze this food photo and estimate the portion and nutrition of every food in it.
Output ONLY one JSON object, no other text, in this format:
{
  "is_food": true/false,
  "dish": "name of the whole meal (English)",
  "items": [
    {"name":"food name","portion":"estimated portion, e.g. 1 bowl (~250g)","kcal":integer,"protein":grams,"carbs":grams,"fat":grams}
  ],
  "total": {"kcal":integer,"protein":grams,"carbs":grams,"fat":grams},
  "confidence": "high|medium|low",
  "health_score": integer 1-10 (10 = best for weight loss),
  "tip": "one specific weight-loss tip, e.g. how to cut calories or what to swap"
}
Cooked dishes in a pot, pan, bowl or plate (curry, meat, stir-fry, soup), drinks, snacks, packaged foods and fruit all count as food, even if the lighting is poor, the colours are unclear or it is not plated; set is_food to false only if there is no food or drink at all. If the photo is blurry or dark, still make your best estimate and set confidence to low.
For Southeast Asian / Chinese dishes (nasi lemak, char kway teow, Hainanese chicken rice, laksa, teh tarik, etc.) estimate based on how they are really cooked, and count oil and sauces.`;

function parseJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw Object.assign(new Error("无法解析 AI 返回结果"), { status: 502 });
  return JSON.parse(m[0]);
}

async function pickGeminiModel() {
  if (GEMINI_MODEL) return GEMINI_MODEL;
  const base = process.env.GEMINI_BASE || "https://generativelanguage.googleapis.com";
  const res = await fetch(`${base}/v1beta/models?pageSize=200`, { headers: { "x-goog-api-key": GEMINI_KEY } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(d?.error?.message || "无法获取模型列表"), { status: 502 });
  const ver = (n) => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]);
  const pre = (n) => (/preview|exp/.test(n) ? 1 : 0);
  const c = (d.models || [])
    .filter((x) => (x.supportedGenerationMethods || []).includes("generateContent"))
    .filter((x) => /gemini-\d+(\.\d+)?-flash/.test(x.name) && !/image|tts|live|audio|lite|thinking|robotics|computer|embedding/.test(x.name))
    .sort((a, b) => ver(b.name) - ver(a.name) || pre(a.name) - pre(b.name));
  if (!c.length) throw Object.assign(new Error("没有可用的 Gemini Flash 模型"), { status: 502 });
  return (GEMINI_MODEL = c[0].name.replace(/^models\//, ""));
}

async function analyzeGemini(imageB64, mediaType, lang, retry = true) {
  const model = await pickGeminiModel();
  const gen = { responseMimeType: "application/json", maxOutputTokens: 4096 };
  if (model.includes("2.5")) gen.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetch(`${process.env.GEMINI_BASE || "https://generativelanguage.googleapis.com"}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mediaType, data: imageB64 } }, { text: lang === "en" ? PROMPT_EN : PROMPT_ZH }] }],
      generationConfig: gen,
    }),
  });
  const data = await res.json().catch(() => ({}));
  const msg = data?.error?.message || "";
  if (!res.ok && retry && !process.env.GEMINI_MODEL && (res.status === 404 || /no longer available|not found|deprecated|not supported/i.test(msg))) {
    GEMINI_MODEL = ""; // 模型被下线：重新选一个再试一次
    return analyzeGemini(imageB64, mediaType, lang, false);
  }
  if (!res.ok) {
    const quota = res.status === 429;
    throw Object.assign(new Error(quota ? "免费额度暂时用完，请稍后再试 / Free quota reached, try later" : msg || "AI 服务出错"), { status: quota ? 429 : 502 });
  }
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  return parseJson(text);
}

async function analyze(imageB64, mediaType, lang) {
  if (PROVIDER === "gemini") return analyzeGemini(imageB64, mediaType, lang);
  if (!API_KEY) {
    const e = new Error("服务器未设置 GEMINI_API_KEY（免费）或 ANTHROPIC_API_KEY");
    e.status = 503;
    throw e;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageB64 } },
            { type: "text", text: lang === "en" ? PROMPT_EN : PROMPT_ZH },
          ],
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const e = new Error(data?.error?.message || "AI 服务出错");
    e.status = 502;
    throw e;
  }
  return parseJson((data.content || []).map((b) => b.text || "").join(""));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error("图片太大"), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

const CORS = {
  "access-control-allow-origin": "*", // App(APK) 的 WebView 来源不同；接口本身有密码保护
  "access-control-allow-headers": "content-type, x-access-password",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type, ...CORS });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      if (req.method === "OPTIONS") return send(res, 204, "");
      if (req.method === "GET" && url.pathname === "/api/status") {
        return send(res, 200, { ai: !!API_KEY, locked: !!ACCESS_PASSWORD });
      }
      if (req.method === "POST" && url.pathname === "/api/check") { // 仅校验密码，不消耗识别额度
        if (ACCESS_PASSWORD) {
          const ip = clientIp(req);
          if (recent(fails, ip, 10 * 60e3).length >= 5) return send(res, 429, { error: "Too many attempts" });
          if (!safeEqual(req.headers["x-access-password"] || "", ACCESS_PASSWORD)) { fails.get(ip).push(Date.now()); return send(res, 401, { error: "Wrong password" }); }
        }
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/api/analyze") {
        guard(req);
        const { image, mediaType, lang } = JSON.parse(await readBody(req));
        if (!image) return send(res, 400, { error: "缺少图片" });
        const result = await analyze(image, mediaType || "image/jpeg", lang);
        return send(res, 200, result);
      }
      if (req.method === "GET") {
        let p = url.pathname === "/" ? "/index.html" : url.pathname;
        const file = path.normalize(path.join(PUBLIC, p));
        if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          return send(res, 404, "Not found", "text/plain");
        }
        return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || "application/octet-stream");
      }
      send(res, 404, { error: "Not found" });
    } catch (e) {
      send(res, e.status || 500, { error: e.message });
    }
  })
  .listen(PORT, () => {
    console.log(`轻卡已启动: http://localhost:${PORT}  (AI 识别: ${API_KEY ? "已开启 (" + PROVIDER + ")" : "未设置 GEMINI_API_KEY / ANTHROPIC_API_KEY，仅手动记录"}; 访问密码: ${ACCESS_PASSWORD ? "已开启" : "未设置，任何人都能用你的额度！"})`);
  });
