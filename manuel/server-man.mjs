import { chromium } from "playwright";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegPath);

const URL = "https://www.groupeicare.com/";
const WIDTH = 1280;
const HEIGHT = 720;
const SCROLL_DURATION_MS = 15000; // 15s de défilement
const SCROLL_EASE = true;         // scroll lissé
const OUT_DIR = "videos";         // dossier pour la vidéo WebM

async function autoScroll(page, totalMs, smooth = true) {
    // 1) Trouver le conteneur scrollable (fallback html/body)
    const scrollable = await page.evaluateHandle(() => {
        const isScrollable = (el) => {
            if (!el) return false;
            const cs = getComputedStyle(el);
            return (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
                el.scrollHeight > el.clientHeight;
        };
        const cand = Array.from(document.querySelectorAll("*")).find(isScrollable);
        return cand || document.scrollingElement || document.documentElement || document.body;
    });

    // 2) Évaluer SUR le handle (⚠️ un seul arg: un objet)
    await scrollable.evaluate((el, { totalMs, smooth }) => {
        const start = performance.now();
        const startY = el.scrollTop || 0;
        const endY   = el.scrollHeight - el.clientHeight;
        const ease   = (t) => smooth ? (1 - Math.cos(Math.PI * t)) / 2 : t;

        if (endY <= 0) return; // rien à scroller

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

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: WIDTH, height: HEIGHT },
        recordVideo: { dir: OUT_DIR, size: { width: WIDTH, height: HEIGHT } }
    });
    const page = await context.newPage();

    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    await autoScroll(page, SCROLL_DURATION_MS, SCROLL_EASE);
    await page.waitForTimeout(300);

    // Important: fermer la page pour flusher la vidéo
    const video = page.video();
    await page.close();
    const webmPath = await video.path(); // chemin du .webm généré
    await context.close();
    await browser.close();

    console.log("🎥 WebM:", webmPath);

    // MP4 de qualité
    const mp4Path = path.join(path.dirname(webmPath), "scroll.mp4");
    await new Promise((resolve, reject) => {
        ffmpeg(webmPath)
            .outputOptions([
                "-c:v libx264",
                "-crf 18",
                "-pix_fmt yuv420p",
                "-movflags +faststart"
            ])
            .save(mp4Path)
            .on("end", resolve)
            .on("error", reject);
    });
    console.log("✅ MP4:", mp4Path);

    // GIF (palette pour la qualité)
    const gifPath = path.join(path.dirname(webmPath), "scroll.gif");
    await new Promise((resolve, reject) => {
        ffmpeg(webmPath)
            .outputOptions([
                "-filter_complex",
                "fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
                "-loop 0"
            ])
            .save(gifPath)
            .on("end", resolve)
            .on("error", reject);
    });
    console.log("✅ GIF:", gifPath);
})().catch(e => {
    console.error(e);
    process.exit(1);
});
