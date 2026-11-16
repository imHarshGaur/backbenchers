const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const errors = [];
  async function pageAt(url, viewport = { width: 1440, height: 1050 }) {
    const p = await browser.newPage({ viewport });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(url);
    return p;
  }
  async function leave(p) {
    await p.click("#back-play");
    await p.click("#quit-game");
  }
  async function dragBoard(p, a, b, during) {
    const box = await p.locator("#board").boundingBox();
    await p.mouse.move(
      box.x + (a.x * box.width) / 600,
      box.y + (a.y * box.height) / 600,
    );
    await p.mouse.down();
    await p.mouse.move(
      box.x + (b.x * box.width) / 600,
      box.y + (b.y * box.height) / 600,
      { steps: 8 },
    );
    if (during) await during();
    await p.mouse.up();
  }
  async function tapBoard(p, x, y) {
    const b = await p.locator("#board").boundingBox();
    await p.mouse.click(b.x + (x * b.width) / 600, b.y + (y * b.height) / 600);
  }
  const page = await pageAt("http://127.0.0.1:3000");
  await page.locator("h1").waitFor();
  fs.mkdirSync("work", { recursive: true });
  await page.screenshot({ path: "work/desktop.png", fullPage: true });
  await page.click("#daily");
  assert.equal(await page.locator("#balance").textContent(), "1,100");
  await page.click("#daily");
  assert.equal(await page.locator("#balance").textContent(), "1,100");
  // Dots: use the exact dot-to-dot gesture that was missing in the original UI.
  await page.click('[data-game="dots"]');
  await page.selectOption("#bots", "0");
  await page.click("#start-local");
  await dragBoard(page, { x: 70, y: 70 }, { x: 70 + 460 / 3, y: 70 });
  assert.equal(await page.evaluate(() => game.edges["h:0:0"]), "0");
  await tapBoard(page, 70 + 460 / 3, 110); // near the endpoint rather than midpoint
  await tapBoard(page, 70, 70 + 460 / 3);
  await tapBoard(page, 70 + 460 / 3, 70 + 460 / 3);
  await dragBoard(page, { x: 70, y: 70 }, { x: 70, y: 70 + 460 / 3 });
  assert.equal(await page.evaluate(() => game.boxes[0]), "1");
  assert.equal(await page.evaluate(() => game.turn), 1);
  await page.waitForTimeout(6500);
  assert.equal(await page.evaluate(() => Object.keys(game.edges).length), 4);
  await leave(page);
  // Pen: input, invalid short release, and a completed shot.
  await page.click('[data-game="pen"]');
  await page.selectOption("#bots", "0");
  await page.click("#start-local");
  await tapBoard(page, 300, 95);
  assert.equal(await page.evaluate(() => game.turns), 0);
  await dragBoard(page, { x: 300, y: 95 }, { x: 300, y: 50 }, async () => {
    assert.equal(await page.locator("#power-value").textContent(), "32%");
    assert.equal(
      await page.locator("#power-meter").getAttribute("aria-valuenow"),
      "32",
    );
    assert.equal(
      await page.locator("#power-fill").evaluate((el) => el.style.width),
      "32%",
    );
  });
  assert.equal(await page.locator("#power-value").textContent(), "0%");
  assert.match(await page.locator("#last-shot").textContent(), /fired 32%/);
  assert.equal(await page.evaluate(() => game.turns), 1);
  await leave(page);
  // Chits: human-only private handoffs and a legal Mantri accusation.
  await page.click('[data-game="rmcs"]');
  await page.selectOption("#bots", "0");
  await page.click("#start-local");
  for (let i = 0; i < 4; i++) {
    await page.click("#reveal-chit");
    assert((await page.locator("#secret").textContent()).length > 0);
    await page.click("#hide-chit");
  }
  assert(
    await page
      .locator("#curtain")
      .evaluate((el) => el.classList.contains("hidden")),
  );
  assert.equal(await page.locator(".chit:not([disabled])").count(), 2);
  // Exercise the real bluff control without replacing its DOM after listeners bind.
  const chor = await page.evaluate(() => String(game.roles.indexOf("Chor")));
  await page.click("#private");
  await page.click(`[data-private="${chor}"]`);
  await page.click("#reveal-chit");
  await page.click("#swap-chit");
  assert.equal(await page.evaluate(() => game.swapUsed), true);
  await page.locator(".chit:not([disabled])").first().click();
  assert(await page.locator("#next-round").isVisible());
  await leave(page);
  // Mobile board coordinates and the exact hosted artifact.
  const mobile = await pageAt("http://127.0.0.1:3000/site.html", {
    width: 390,
    height: 844,
  });
  await mobile.click('[data-game="dots"]');
  assert.equal(await mobile.locator("#mode option").count(), 1);
  await mobile.selectOption("#bots", "0");
  await mobile.click("#start-local");
  await mobile.locator("#board").scrollIntoViewIfNeeded();
  await dragBoard(mobile, { x: 70, y: 70 }, { x: 70 + 460 / 3, y: 70 });
  assert.equal(await mobile.evaluate(() => game.edges["h:0:0"]), "0");
  assert(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await mobile.screenshot({ path: "work/mobile-game.png", fullPage: true });
  const offline = await pageAt("http://127.0.0.1:3000/play.html");
  await offline.context().setOffline(true);
  await offline.click('[data-game="dots"]');
  assert.equal(
    await offline.locator("#start-local").textContent(),
    "Launch game →",
  );
  assert.equal(
    await offline
      .locator("#start-local")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(42, 81, 69)",
  );
  assert.equal(
    await offline
      .locator("html")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--green").trim(),
      ),
    "#2a5145",
  );
  await offline.selectOption("#bots", "0");
  await offline.click("#start-local");
  await dragBoard(offline, { x: 70, y: 70 }, { x: 70 + 460 / 3, y: 70 });
  assert.equal(await offline.evaluate(() => game.edges["h:0:0"]), "0");
  const net = await pageAt("http://127.0.0.1:3000");
  await net.click('[data-game="dots"]');
  await net.selectOption("#mode", "online");
  await net.click("#create-room");
  await net.locator(".name-code").waitFor();
  await net.click("#fill");
  await net.click("#ready");
  await net.click("#launch");
  await net.locator("#board").waitFor();
  assert(
    await net
      .locator(".play-heading .eyebrow")
      .textContent()
      .then((t) => t.includes("CLASSROOM")),
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "Browser checks passed: dots gestures and box completion, relaxed timer, pen input, chit bluff, phone-sized hosted build, offline file, online room.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
