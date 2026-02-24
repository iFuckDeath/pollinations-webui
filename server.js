
import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const DEFAULT_MODEL = "flux";

// Optional: allow passing token from UI (NOT recommended, but you asked)
// If you want to disable this, delete the two lines reading req.headers below.
function getToken(req) {
  return req.headers["x-pollinations-token"] || process.env.POLLINATIONS_TOKEN || "";
}

function buildPollinationsUrl(body) {
  const {
    prompt,
    model = DEFAULT_MODEL,
    width = 1024,
    height = 1024,
    seed,
    enhance,
    nologo,
    private: isPrivate,
    safe,
    // image-to-image (kontext)
    image
  } = body;

  if (!prompt || typeof prompt !== "string") throw new Error("Missing prompt");

  const params = new URLSearchParams();
  params.set("width", String(width));
  params.set("height", String(height));
  params.set("model", model);

  if (seed !== undefined && seed !== null && seed !== "") params.set("seed", String(seed));
  if (enhance) params.set("enhance", "true");
  if (nologo) params.set("nologo", "true");
  if (isPrivate) params.set("private", "true");
  if (safe) params.set("safe", "true");

  // image-to-image mode: model must be kontext and include an image URL
  if (image) {
    params.set("model", "kontext");
    params.set("image", String(image));
  }

  // cache-bust to avoid stale images
  params.set("_ts", String(Date.now()));

  const encodedPrompt = encodeURIComponent(prompt.trim());
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`;
}

app.get("/api/models", async (req, res) => {
  try {
    const r = await fetch("https://image.pollinations.ai/models");
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.json(["flux", "turbo"]); // fallback
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const url = buildPollinationsUrl(req.body);
    const token = getToken(req);

    const headers = {};
    // Backend auth (recommended by docs) 2
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const r = await fetch(url, { headers });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(r.status).send(text || `Pollinations error ${r.status}`);
    }

    const contentType = r.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await r.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Image-URL", url);
    res.send(buf);
  } catch (e) {
    res.status(400).send(String(e.message || e));
  }
});

app.listen(PORT, () => {
  console.log(`✅ Web UI running: http://localhost:${PORT}`);
});
