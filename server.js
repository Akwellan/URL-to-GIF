const express = require("express");
const fs = require("fs");
const path = require("path");
const mime = require("mime");
const { spawn } = require("child_process");
const puppeteer = require("puppeteer");

const app = express();

// ✅ accepter JSON et x-www-form-urlencoded (pas de parsing maison)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

app.post("/api/gif", async (req, res) => {
  try {
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
    const DUR = clamp(parseInt(duration), 1000, 120000);
    const DEL = clamp(parseInt(startDelay), 0, 60000);
    const STEP = clamp(parseInt(scrollStep), 1, 400);
    const SLOW = !!(slowAnimations === true || slowAnimations === "on" || slowAnimations === "true");

    const frames = Math.floor((DUR / 1000) * FPS);
    const tmp = "/app/tmp";
    fs.mkdirSync(tmp, { recursive: true });

    // Nettoyage
    for (const f of fs.readdirSync(tmp)) {
      if (f.startsWith("frame_") || f.startsWith("palette") || f === "capture.gif") {
        try { fs.unlinkSync(path.join(tmp, f)); } catch {}
      }
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    if (SLOW) {
      await page.addStyleTag({ content: `
        * { animation-duration: 2s !important; transition-duration: 2s !important; }
        html, body { scroll-behavior: auto !important; }
      `});
    }

    if (DEL > 0) await page.waitForTimeout(DEL);

    const fullHeight = await page.evaluate(() =>
      document.body.scrollHeight || document.documentElement.scrollHeight
    );
    let currentY = 0;

    for (let i = 0; i < frames; i++) {
      currentY = Math.min(currentY + STEP, Math.max(0, fullHeight - H));
      await page.evaluate(y => window.scrollTo(0, y), currentY);
      await page.waitForTimeout(1000 / FPS);

      const buf = await page.screenshot({ type: "png" });
      fs.writeFileSync(path.join(tmp, `frame_${String(i).padStart(5, "0")}.png`), buf);

      if (currentY >= fullHeight - H) break;
    }

    await browser.close();

    // FFmpeg palettegen + paletteuse
    const palette = path.join(tmp, "palette.png");
    await runFFmpeg(["-y", "-framerate", String(FPS), "-i", path.join(tmp, "frame_%05d.png"),
                     "-vf", "palettegen=max_colors=256", palette]);

    const gifPath = path.join(tmp, "capture.gif");
    await runFFmpeg(["-y", "-framerate", String(FPS),
                     "-i", path.join(tmp, "frame_%05d.png"),
                     "-i", palette,
                     "-lavfi", "paletteuse=dither=sierra2_4a",
                     "-gifflags", "+transdiff",
                     gifPath]);

    res.setHeader("Content-Type", mime.getType("gif") || "image/gif");
    res.setHeader("Content-Disposition", `attachment; filename="capture.gif"`);
    fs.createReadStream(gifPath).pipe(res);
  } catch (e) {
    console.error("API /api/gif error:", e);
    res.status(500).send("Erreur durant la génération du GIF");
  }
});

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", d => err += d.toString());
    p.on("close", code => code === 0 ? resolve() : reject(new Error(err || "ffmpeg failed")));
  });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Web2GIF prêt sur :" + PORT));
