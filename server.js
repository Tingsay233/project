// 轻卡 — 拍照算卡路里减肥 App 后端（零依赖，Node 18+）
// 用法：ANTHROPIC_API_KEY=sk-ant-... node server.js
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const PUBLIC = path.join(__dirname, "public");

const PROMPT = `你是一位专业营养师。请分析这张食物照片，估算图中每样食物的份量与营养。
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
如果图中不是食物，is_food 设为 false，其余字段可为空。
常见东南亚/中式食物（椰浆饭、炒粿条、海南鸡饭、叻沙、面包、奶茶等）请按实际做法估算，油和酱汁也要计入。`;

async function analyze(imageB64, mediaType) {
  if (!API_KEY) {
    const e = new Error("服务器未设置 ANTHROPIC_API_KEY");
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
            { type: "text", text: PROMPT },
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
  const text = (data.content || []).map((b) => b.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw Object.assign(new Error("无法解析 AI 返回结果"), { status: 502 });
  return JSON.parse(m[0]);
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

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      if (req.method === "GET" && url.pathname === "/api/status") {
        return send(res, 200, { ai: !!API_KEY });
      }
      if (req.method === "POST" && url.pathname === "/api/analyze") {
        const { image, mediaType } = JSON.parse(await readBody(req));
        if (!image) return send(res, 400, { error: "缺少图片" });
        const result = await analyze(image, mediaType || "image/jpeg");
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
    console.log(`轻卡已启动: http://localhost:${PORT}  (AI 识别: ${API_KEY ? "已开启" : "未设置 ANTHROPIC_API_KEY，仅手动记录"})`);
  });
