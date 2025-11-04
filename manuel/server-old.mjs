import { chromium } from "playwright";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegPath);

const URL = "https://huzounet.fr";
const OUT_DIR = "frames";
const OUT_MP4 = "scroll.mp4";
const WIDTH = 1280;
const HEIGHT = 720;
const STEP = 10;       // pixels par pas de scroll
const DELAY = 30;      // ms entre pas (laisse le temps aux animations)
const FPS = 30;

async function run() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(500); // petit temps pour stabiliser les animations

    // Mesure de la hauteur défilable
    const scrollHeight = await page.evaluate(() =>
        Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
        )
    );

    // Capture des frames pendant le scroll
    fs.mkdirSync(OUT_DIR, { recursive: true });
    let y = 0, i = 0;
    while (y < scrollHeight - HEIGHT) {
        await page.evaluate((_y) => window.scrollTo(0, _y), y);
        await page.waitForTimeout(DELAY);
        const buf = await page.screenshot({ fullPage: false });
        fs.writeFileSync(path.join(OUT_DIR, `frame${i}.png`), buf);
        i++;
        y += STEP;
    }
    // Dernière frame (tout en bas)
    await page.evaluate((_y) => window.scrollTo(0, _y), scrollHeight);
    await page.waitForTimeout(200);
    const last = await page.screenshot({ fullPage: false });
    fs.writeFileSync(path.join(OUT_DIR, `frame${i}.png`), last);

    await browser.close();

    // Assemblage en MP4
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(path.join(OUT_DIR, "frame%d.png"))
            .inputFPS(FPS)
            .withVideoCodec("libx264")
            .outputOptions(["-pix_fmt yuv420p"]) // compatibilité players
            .output(OUT_MP4)
            .on("end", resolve)
            .on("error", reject)
            .run();
    });

    console.log(`✅ Vidéo générée: ${OUT_MP4}`);
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
