const express = require("express");
const fs = require("fs");
const path = require("path");
const mime = require("mime");
const { spawn } = require("child_process");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

async function resolveChrome() {
  // Empêche l'env de forcer un mauvais binaire
  delete process.env.PUPPETEER_EXECUTABLE_PATH;

  // 1) Demande à Puppeteer
  try {
    const p = await puppeteer.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch {}

  // 2) Fallbacks courants selon distro/images
  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;

  throw new Error("Aucun binaire Chrome/Chromium trouvé.");
}

app.post("/api/gif", async (req, res) => {
  const {
    url,
    width = 1280,
    height = 800,
    fps = 10,
    duration = 6000,
    startDelay = 1500,
    scrollStep = 40,
    slowAnimations
  } = req.body || {};

  if (!url) return res.status(400).send("Missing url");

  const W = clamp(parseInt(width), 320, 3840);
  const H = clamp(parseInt(height), 240, 2160);
  const FPS = clamp(parseInt(fps), 1, 60);
  const DUR = clamp(parseInt(duration), 500, 120000);
  const DEL = clamp(parseInt(startDelay), 0, 60000);
  const STEP = clamp(parseInt(scrollStep), 1, 800);
  const SLOW = !!(slowAnimations === true || slowAnimations === "on" || slowAnimations === "true");

  const tmp = "/app/tmp";
  fs.mkdirSync(tmp, { recursive: true });
  for (const f of fs.readdirSync(tmp)) {
    if (f.startsWith("frame_") || f.startsWith("palette") || f === "capture.gif") {
      try { fs.unlinkSync(path.join(tmp, f)); } catch {}
    }
  }

  let browser;
  try {
    const executablePath = await resolveChrome();
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--ignore-certificate-errors"
      ],
    });
  } catch (e) {
    console.error("PUPPETEER_LAUNCH:", e);
    return res.status(500).send("PUPPETEER_LAUNCH: " + e.message);
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H });

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    } catch (e) {
      await browser.close().catch(()=>{});
      console.error("PAGE_GOTO:", e);
      return res.status(500).send("PAGE_GOTO: " + e.message);
    }

    if (SLOW) {
      await page.addStyleTag({ content: `
        * { animation-duration: 2s !important; transition-duration: 2s !important; }
        html, body { scroll-behavior: auto !important; }
      `});
    }

    if (DEL > 0) await page.waitForTimeout(DEL);

    let fullHeight = await page.evaluate(() =>
      document.body.scrollHeight || document.documentElement.scrollHeight || 0
    );
    if (!fullHeight || fullHeight < H) fullHeight = H;

    const frames = Math.max(1, Math.floor((DUR / 1000) * FPS));
    let currentY = 0;
    let written = 0;

    for (let i = 0; i < frames; i++) {
      currentY = Math.min(currentY + STEP, Math.max(0, fullHeight - H));
      await page.evaluate(y => window.scrollTo(0, y), currentY).catch(()=>{});
      await page.waitForTimeout(Math.max(1, Math.floor(1000 / FPS)));

      try {
        const buf = await page.screenshot({ type: "png" });
        fs.writeFileSync(path.join(tmp, `frame_${String(written).padStart(5, "0")}.png`), buf);
        written++;
      } catch (e) {
        await browser.close().catch(()=>{});
        console.error("SCREENSHOT:", e);
        return res.status(500).send("SCREENSHOT: " + e.message);
      }

      if (currentY >= fullHeight - H) break;
    }

    await browser.close();
    if (written === 0) {
      return res.status(500).send("NO_FRAMES: aucune frame écrite");
    }

    const pattern = path.join(tmp, "frame_%05d.png");
    const palette = path.join(tmp, "palette.png");
    const gifPath = path.join(tmp, "capture.gif");

    // palette
    try {
      await runFFmpeg(["-y","-framerate", String(FPS), "-i", pattern, "-vf", "palettegen=max_colors=256", palette]);
    } catch (e) {
      console.error("FFMPEG_PALETTEGEN:", e);
      return res.status(500).send("FFMPEG_PALETTEGEN: " + e.message);
    }
    // gif
    try {
      await runFFmpeg([
        "-y","-framerate", String(FPS),
        "-i", pattern, "-i", palette,
        "-lavfi", "paletteuse=dither=sierra2_4a",
        "-gifflags", "+transdiff",
        gifPath
      ]);
    } catch (e) {
      console.error("FFMPEG_PALETTEUSE:", e);
      return res.status(500).send("FFMPEG_PALETTEUSE: " + e.message);
    }

    res.setHeader("Content-Type", mime.getType("gif") || "image/gif");
    res.setHeader("Content-Disposition", 'attachment; filename="capture.gif"');
    fs.createReadStream(gifPath).pipe(res);
  } catch (e) {
    try { await browser?.close(); } catch {}
    console.error("GENERAL:", e);
