const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ui } = require("./helpers/ui.cjs");
const I = require("../web/input");
const G = require("../shared/core");
function edgeClick(u, key) {
  const { a, b } = I.edgePoints(u.state().size, key);
  u.tap((a.x + b.x) / 2, (a.y + b.y) / 2);
}
function deal(u) {
  while (u.state().phase === "reveal") {
    u.click("#reveal-chit");
    u.click("#hide-chit");
  }
}

test("Dots: dot-to-dot drag draws a line at desktop and phone scales", (t) => {
  const u = ui(t);
  u.start("dots");
  u.drag({ x: 70, y: 70 }, { x: 70 + 460 / 3, y: 70 });
  assert.equal(u.state().edges["h:0:0"], "0");
  u.scale(300);
  u.drag({ x: 70, y: 70 }, { x: 70, y: 70 + 460 / 3 });
  assert.equal(u.state().edges["v:0:0"], "1");
  assert.equal(u.state().turn, 0);
  assert.deepEqual(u.errors, []);
});
test("Dots: tap along the whole edge or select two adjacent dots", (t) => {
  const u = ui(t);
  u.start("dots");
  u.tap(101, 70);
  assert.equal(u.state().edges["h:0:0"], "0");
  u.tap(70, 70);
  u.tap(70, 70 + 460 / 3);
  assert.equal(u.state().edges["v:0:0"], "1");
});
test("Dots: default relaxed mode never auto-draws a human line", (t) => {
  const u = ui(t);
  u.start("dots", { bots: 1 });
  u.clock.tick(120000);
  assert.deepEqual(u.state().edges, {});
  assert.equal(u.state().turn, 0);
  assert.match(u.$("#timer").textContent, /Relaxed/);
  edgeClick(u, "h:0:0");
  u.clock.tick(1500);
  assert.equal(Object.keys(u.state().edges).length, 2);
  assert.equal(u.state().turn, 0);
  u.clock.tick(60000);
  assert.equal(Object.keys(u.state().edges).length, 2);
});
test("Dots: explicit Blitz timing draws exactly one timeout move and clears pending drag", (t) => {
  const u = ui(t);
  u.start("dots", { pace: "timed" });
  u.pointer("pointerdown", 70, 70);
  u.clock.tick(5900);
  assert.equal(Object.keys(u.state().edges).length, 0);
  u.clock.tick(200);
  assert.equal(Object.keys(u.state().edges).length, 1);
  u.pointer("pointerup", 223, 70);
  assert.equal(Object.keys(u.state().edges).length, 1);
  assert.match(u.$("#toast").textContent, /Time is up/);
});
test("Dots: a human can draw all four sides, claim gold, and keep the bonus turn", (t) => {
  const u = ui(t);
  u.start("dots");
  u.eval("game.star=0;game.bomb=8;");
  for (const key of ["h:0:0", "v:1:0", "h:0:1", "v:0:0"]) edgeClick(u, key);
  assert.equal(u.state().boxes[0], "1");
  assert.equal(u.state().players[1].score, 2);
  assert.equal(u.state().turn, 1);
  assert.match(u.$(".board-caption").textContent, /Go again/);
});
test("Dots: duplicate, diagonal, cancelled and outside gestures never spend a turn", (t) => {
  const u = ui(t);
  u.start("dots");
  u.drag({ x: 70, y: 70 }, { x: 223.33, y: 223.33 });
  assert.equal(Object.keys(u.state().edges).length, 0);
  u.pointer("pointerdown", 70, 70);
  u.pointer("pointercancel", 70, 70);
  u.pointer("pointerup", 223, 70);
  assert.equal(Object.keys(u.state().edges).length, 0);
  edgeClick(u, "h:0:0");
  edgeClick(u, "h:0:0");
  u.tap(590, 590);
  assert.equal(Object.keys(u.state().edges).length, 1);
  assert.equal(u.state().turn, 1);
});
test("Dots: complete a 6x6 match through controls and rematch without stale selections", (t) => {
  const u = ui(t);
  u.start("dots", { count: 3, stake: 25 });
  let n = 0;
  while (u.state().phase === "playing" && n++ < 100) {
    const s = u.state(),
      key = G.allEdges(s).find((k) => s.edges[k] === undefined);
    edgeClick(u, key);
  }
  assert.equal(u.state().phase, "finished");
  assert.equal(
    u.state().players.reduce((n, p) => n + p.score, 0),
    26,
  );
  const total = u.eval("Object.values(wallets).reduce((a,b)=>a+b)");
  assert.equal(total, 3000);
  u.click("#double");
  assert.equal(u.state().phase, "playing");
  assert.equal(u.eval("settings.stake"), 50);
  assert.deepEqual(u.state().edges, {});
  assert.equal(u.eval("selectedDot"), null);
});
test("All games: pause freezes bot and timed moves; resume and explicit quit work", (t) => {
  const u = ui(t);
  u.start("dots", { pace: "timed", bots: 1, stake: 50 });
  u.clock.tick(2000);
  u.click("#pause-game");
  u.clock.tick(60000);
  assert.equal(Object.keys(u.state().edges).length, 0);
  u.click("#resume-game");
  u.clock.tick(3900);
  assert.equal(Object.keys(u.state().edges).length, 0);
  u.clock.tick(200);
  assert.equal(Object.keys(u.state().edges).length, 1);
  u.click("#back-play");
  u.click("#quit-game");
  assert.equal(u.$("#balance").textContent, "1,000");
  assert(u.$('[data-game="dots"]'));
});

test("Pen: release position determines power even without a pointer-move event", (t) => {
  const u = ui(t);
  u.start("pen");
  u.pointer("pointerdown", 300, 95);
  u.pointer("pointerup", 300, 55);
  assert.equal(u.state().turns, 1);
  assert.equal(u.state().turn, 1);
  assert(u.state().pens[0].y > 95);
});
test("Pen: short, cancelled, second-pointer and stale gestures do not fire", (t) => {
  const u = ui(t);
  u.start("pen", { pace: "timed" });
  u.tap(300, 95);
  assert.equal(u.state().turns, 0);
  assert.equal(u.eval("drag"), null);
  u.pointer("pointerdown", 300, 95);
  u.pointer("pointerup", 300, 50, { pointerId: 2 });
  assert.equal(u.state().turns, 0);
  u.pointer("pointercancel", 300, 50);
  assert.equal(u.eval("drag"), null);
  u.pointer("pointerdown", 300, 95);
  u.clock.tick(30100);
  const turns = u.state().turns;
  u.pointer("pointerup", 300, 50);
  assert.equal(u.state().turns, turns);
});
test("Pen: aim preview leaves all positions, lives and hazards unchanged", (t) => {
  const u = ui(t);
  u.start("pen");
  const before = u.state();
  u.pointer("pointerdown", 300, 95);
  u.pointer("pointermove", 300, 0);
  assert.deepEqual(u.state(), before);
  assert.deepEqual(u.errors, []);
});

test("RMCS: privacy handoffs and visible result scoring work across all five rounds", (t) => {
  const u = ui(t);
  u.start("rmcs");
  for (let round = 1; round <= 5; round++) {
    deal(u);
    assert.equal(u.state().phase, "guess");
    assert.equal(u.$("#curtain").classList.contains("hidden"), true);
    const chor = String(u.state().roles.indexOf("Chor"));
    u.click(`[data-chit="${chor}"]`);
    assert.equal(u.state().history.length, round);
    if (round < 5) u.click("#next-round");
  }
  assert.equal(u.state().phase, "finished");
  assert.equal(
    u.state().players.reduce((s, p) => s + p.score, 0),
    11500,
  );
  u.click("#rematch");
  assert.equal(u.state().round, 1);
  assert.equal(u.state().history.length, 0);
});
test("RMCS: bluff button still works when side-bet controls are rendered", (t) => {
  const u = ui(t);
  u.start("rmcs");
  deal(u);
  u.eval('game.roles=["Raja","Mantri","Sipahi","Chor"];renderGame();');
  u.click("#private");
  u.click('[data-private="3"]');
  u.click("#reveal-chit");
  assert(u.$("#bet-yes"));
  assert(u.$("#swap-chit"));
  u.select("#swap-target", "2");
  u.click("#swap-chit");
  assert.equal(u.state().roles[2], "Chor");
  assert.equal(u.state().swapUsed, true);
  assert.equal(u.$("#curtain").classList.contains("hidden"), true);
});
test("RMCS: player cannot guess for a bot, and has time to use their bluff", (t) => {
  const u = ui(t);
  u.start("rmcs", { bots: 3 });
  u.click("#reveal-chit");
  u.click("#hide-chit");
  u.clock.tick(4300);
  assert.equal(u.state().phase, "guess");
  u.eval('game.roles=["Chor","Mantri","Sipahi","Raja"];renderGame();');
  assert.equal(u.$('[data-chit="2"]').disabled, true);
  u.click('[data-chit="2"]');
  assert.equal(u.state().phase, "guess");
  u.clock.tick(2000);
  assert.equal(u.state().phase, "guess");
  u.click("#private");
  u.click('[data-private="0"]');
  u.clock.tick(30000);
  assert.equal(u.state().phase, "guess");
  u.click("#reveal-chit");
  u.click("#hide-chit");
  u.clock.tick(8100);
  assert.equal(u.state().phase, "result");
});
test("Setup: changing player/bot counts preserves entered names", (t) => {
  const u = ui(t);
  u.click('[data-game="dots"]');
  u.$(".player-name").value = "Harsh";
  u.select("#count", "4");
  assert.equal(u.$(".player-name").value, "Harsh");
  u.select("#bots", "0");
  assert.equal(u.$(".player-name").value, "Harsh");
});
test("Dots: a valid drag before six seconds is accepted and resets the Blitz clock", (t) => {
  const u = ui(t);
  u.start("dots", { pace: "timed" });
  u.clock.tick(5000);
  u.drag({ x: 70, y: 70 }, { x: 70 + 460 / 3, y: 70 });
  assert.equal(u.state().edges["h:0:0"], "0");
  assert.equal(u.state().turn, 1);
  u.clock.tick(5000);
  assert.equal(Object.keys(u.state().edges).length, 1);
});
test("Pen: finish a match using drag controls and start a clean rematch", (t) => {
  const u = ui(t);
  u.start("pen", { count: 4, stake: 25 });
  let moves = 0;
  while (u.state().phase === "playing" && moves++ < 100) {
    const s = u.state(),
      p = s.pens[s.turn],
      a = G.botAction(s);
    u.drag({ x: p.x, y: p.y }, { x: p.x - a.dx, y: p.y - a.dy });
  }
  assert.equal(u.state().phase, "finished");
  assert.equal(u.eval("Object.values(wallets).reduce((a,b)=>a+b)"), 4000);
  u.click("#rematch");
  assert.equal(u.state().turns, 0);
  assert(u.state().pens.every((p) => p.alive));
  assert.equal(u.eval("drag"), null);
});
test("RMCS: a lost bet displays a negative score correctly and is applied only once", (t) => {
  const u = ui(t);
  u.start("rmcs");
  deal(u);
  u.eval('game.roles=["Raja","Mantri","Sipahi","Chor"];renderGame();');
  u.click("#private");
  u.click('[data-private="3"]');
  u.click("#reveal-chit");
  u.click("#bet-no");
  u.click('[data-chit="3"]');
  assert.equal(u.state().roundScores[3], -50);
  assert.match(u.$('[data-chit="3"]').textContent, /-50 PTS/);
  assert.doesNotMatch(u.$('[data-chit="3"]').textContent, /\+-/);
});
