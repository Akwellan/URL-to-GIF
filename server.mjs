// server.mjs (ESM)
import express from "express";
import { chromium } from "playwright";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

ffmpeg.setFfmpegPath(ffmpegPath);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossiers
const PUBLIC_DIR = path.join(__dirname, "public");
const OUT_DIR = path.join(__dirname, "videos");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ------- Logiciel de scroll / capture -------
async function autoScroll(page, totalMs, smooth = true) {
    const scrollable = await page.evaluateHandle(() => {
        const isScrollable = (el) => {
            if (!el) return false;
            const cs = getComputedStyle(el);
            return (cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight;
        };
        const cand = Array.from(document.querySelectorAll("*")).find(isScrollable);
        return cand || document.scrollingElement || document.documentElement || document.body;
    });

    await scrollable.evaluate((el, { totalMs, smooth }) => {
        const start = performance.now();
        const startY = el.scrollTop || 0;
        const endY = el.scrollHeight - el.clientHeight;
        const ease = (t) => (smooth ? (1 - Math.cos(Math.PI * t)) / 2 : t);
        if (endY <= 0) return;

        return new Promise((resolve) => {
            function step(now) {
                const t = Math.min(1, (now - start) / totalMs);
                el.scrollTop = startY + (endY - startY) * ease(t);
                if (t < 1) requestAnimationFrame(step);
                else resolve();
            }
            requestAnimationFrame(step);
        });
    }, { totalMs, smooth });

    await scrollable.dispose();
}

function uniqueName(prefix, ext) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${prefix}-${stamp}${ext}`;
}

async function runCapture({ url, width, height, durationMs, smooth }, onLog) {
    const log = (m) => onLog?.(m);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width, height },
        recordVideo: { dir: OUT_DIR, size: { width, height } }
    });
    const page = await context.newPage();

    try {
        log(`Navigation vers ${url}…`);
        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForTimeout(800);

        log(`Défilement ${durationMs}ms (smooth=${smooth})…`);
        await autoScroll(page, durationMs, smooth);
        await page.waitForTimeout(300);

        const video = page.video();
        await page.close();
        const webmAbs = await video.path();           // .webm auto-généré par Playwright dans OUT_DIR
        await context.close();
        await browser.close();
        log(`WebM : ${webmAbs}`);

        // Noms uniques pour éviter l’écrasement
        const base = path.basename(webmAbs, path.extname(webmAbs));
        const mp4Abs = path.join(OUT_DIR, uniqueName(`${base}`, ".mp4"));
        const gifAbs = path.join(OUT_DIR, uniqueName(`${base}`, ".gif"));

        // MP4 (x264, qualité)
        await new Promise((resolve, reject) => {
            ffmpeg(webmAbs)
                .outputOptions(["-c:v libx264", "-crf 18", "-pix_fmt yuv420p", "-movflags +faststart"])
                .save(mp4Abs)
                .on("end", resolve)
                .on("error", reject);
        });
        log(`MP4 : ${mp4Abs}`);

        // GIF (palette pour la qualité)
        await new Promise((resolve, reject) => {
            ffmpeg(webmAbs)
                .outputOptions([
                    "-filter_complex",
                    "fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
                    "-loop 0"
                ])
                .save(gifAbs)
                .on("end", resolve)
                .on("error", reject);
        });
        log(`GIF : ${gifAbs}`);

        const sizes = {
            webm: fs.statSync(webmAbs).size + " o",
            mp4: fs.statSync(mp4Abs).size + " o",
            gif: fs.statSync(gifAbs).size + " o",
        };

        const rel = (p) => "/videos/" + path.basename(p);
        return { webmPath: rel(webmAbs), mp4Path: rel(mp4Abs), gifPath: rel(gifAbs), sizes };
    } catch (e) {
        try { await context.close(); } catch {}
        try { await browser.close(); } catch {}
        throw e;
    }
}

// ------- App Express (ESM) -------
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use("/videos", express.static(OUT_DIR));
app.use("/", express.static(PUBLIC_DIR)); // sert public/index.html

function writeEvent(res, obj) {
    res.write(JSON.stringify(obj) + "\n"); // NDJSON
}

app.post("/api/scroll", async (req, res) => {
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    const { url, width = 1280, height = 720, durationMs = 15000, smooth = true } = req.body || {};
    if (!url || !/^https?:\/\//i.test(url)) {
        writeEvent(res, { type: "error", message: "URL invalide" });
        return res.end();
    }
    try {
        const payload = await runCapture(
            { url, width: +width, height: +height, durationMs: +durationMs, smooth: !!smooth },
            (msg) => writeEvent(res, { type: "log", message: msg })
        );
        writeEvent(res, { type: "result", payload });
        res.end();
    } catch (e) {
        writeEvent(res, { type: "error", message: String(e?.message || e) });
        res.end();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ UI dispo : http://localhost:${PORT}`);
});
