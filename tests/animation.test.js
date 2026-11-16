const { test } = require("node:test");
const assert = require("node:assert/strict");
const G = require("../shared/core");
const R = require("../web/pen-renderer");
const { ui } = require("./helpers/ui.cjs");
const clone = (s) => JSON.parse(JSON.stringify(s));
function shot() {
  const before = G.newPen(["A", "B"]);
  before.hazards = [];
  const after = clone(before);
  G.flick(after, "0", 30, 0);
  return { before, after, m: R.motion(before, after) };
}
test("motion shows intermediate nib positions and grows ink without mutating rules", () => {
  const { before, after, m } = shot(),
    original = clone(m);
  const start = R.sample(m, 0),
    mid = R.sample(m, m.duration * 0.25),
    end = R.sample(m, m.duration + m.settle);
  assert.equal(start.state.pens[0].x, before.pens[0].x);
  assert(
    mid.state.pens[0].x > before.pens[0].x &&
      mid.state.pens[0].x < after.pens[0].x,
  );
  assert(mid.state.pens[0].segments.length > before.pens[0].segments.length);
  assert(mid.state.pens[0].segments.length < after.pens[0].segments.length);
  assert.deepEqual(end.state, after);
  assert(end.done);
  assert.deepEqual(m, original);
  assert.equal(R.motion(after, after), null);
  assert.equal(R.motion(before, { ...after, turns: 3 }), null);
});
test("portal motion follows separate ink segments and never paints the teleport gap", () => {
  const before = G.newPen(["A", "B"]);
  Object.assign(before.pens[0], { x: 100, y: 380, segments: [] });
  const after = clone(before);
  G.flick(after, "0", 40, 0);
  const m = R.motion(before, after);
  let jumped = false;
  for (let t = 0; t <= m.duration; t += 5) {
    const p = R.sample(m, t).state.pens[0];
    assert(p.x < 160 || p.x > 440);
    if (p.x > 440) jumped = true;
    assert(
      p.segments.every((s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) <= 5.01),
    );
  }
  assert(jumped);
});
test("damage becomes visible at the collision and the margin settles after travel", () => {
  const before = G.newPen(["A", "B"]);
  before.hazards = [];
  before.turns = 2;
  Object.assign(before.pens[0], { x: 100, y: 100, segments: [] });
  before.pens[1].segments = [{ a: { x: 150, y: 50 }, b: { x: 150, y: 150 } }];
  const after = clone(before);
  G.flick(after, "0", 40, 0);
  const m = R.motion(before, after);
  assert(R.sample(m, 0).state.pens[1].alive);
  assert(!R.sample(m, m.duration * 0.7).state.pens[1].alive);
  assert.equal(R.sample(m, m.duration * 0.7).state.margin, 28);
  assert.equal(R.sample(m, m.duration + m.settle).state.margin, 44);
});
test("pen flight locks input and starts the next turn clock only on landing", (t) => {
  const u = ui(t);
  u.start("pen", { pace: "timed" });
  u.drag({ x: 300, y: 95 }, { x: 300, y: 55 });
  assert(u.eval("penMotion !== null"));
  assert.equal(u.$("#board").dataset.motion, "flying");
  u.drag({ x: 300, y: 505 }, { x: 300, y: 470 });
  assert.equal(u.state().turns, 1);
  u.clock.tick(300);
  assert(
    u.eval(
      "penFrame.state.pens[0].y > 95 && penFrame.state.pens[0].y < game.pens[0].y",
    ),
  );
  u.clock.tick(1500);
  assert.equal(u.eval("penMotion"), null);
  assert.equal(u.eval("canPlay()"), true);
  assert(u.eval("deadline-Date.now() > 29000"));
  u.drag({ x: 300, y: 505 }, { x: 300, y: 470 });
  assert.equal(u.state().turns, 2);
  assert.deepEqual(u.errors, []);
});
test("pause freezes the pen and quit cancels queued animation frames", (t) => {
  const u = ui(t);
  u.start("pen");
  u.drag({ x: 300, y: 95 }, { x: 300, y: 55 });
  u.clock.tick(200);
  u.click("#pause-game");
  const p = u.eval("penFrame.state.pens[0].y");
  u.clock.tick(6000);
  assert.equal(u.eval("penFrame.state.pens[0].y"), p);
  u.click("#resume-game");
  u.clock.tick(200);
  assert(u.eval("penFrame.state.pens[0].y") > p);
  u.click("#back-play");
  u.click("#quit-game");
  u.clock.tick(3000);
  assert.equal(u.eval("penMotion"), null);
  assert(u.$('[data-game="pen"]'));
  assert.deepEqual(u.errors, []);
});
test("bot waits for human shot to land and then gets its own visible flight", (t) => {
  const u = ui(t);
  u.start("pen", { bots: 1 });
  u.drag({ x: 300, y: 95 }, { x: 300, y: 55 });
  u.clock.tick(1400);
  assert.equal(u.state().turns, 1);
  u.clock.tick(1500);
  assert.equal(u.state().turns, 2);
  assert(u.eval("penMotion!==null"));
  assert.equal(u.eval("canPlay()"), false);
});
test("winning shot finishes visually before results and settles exactly once", (t) => {
  const u = ui(t);
  u.start("pen", { stake: 50 });
  u.eval(
    "game.hazards=[];Object.assign(game.pens[0],{x:100,y:100});game.pens[1].segments=[{a:{x:150,y:50},b:{x:150,y:150}}];renderGame();",
  );
  u.drag({ x: 100, y: 100 }, { x: 60, y: 100 });
  assert.equal(u.state().phase, "finished");
  assert(!u.$(".result-banner"));
  assert.equal(u.eval("settled"), true);
  const balance = u.$("#balance").textContent;
  u.clock.tick(2000);
  assert(u.$(".result-banner"));
  assert.equal(u.$("#balance").textContent, balance);
  u.click("#rematch");
  assert.equal(u.eval("penFrame"), null);
  assert.equal(u.state().turns, 0);
});
test("reduced motion completes promptly with the identical authoritative result", (t) => {
  const { m, after, before } = shot();
  const reduced = R.motion(before, after, true);
  assert(R.sample(reduced, 16).done);
  assert.deepEqual(R.sample(reduced, 16).state, after);
  const u = ui(t);
  u.w.matchMedia = () => ({ matches: true });
  u.start("pen");
  u.drag({ x: 300, y: 95 }, { x: 300, y: 55 });
  u.clock.tick(32);
  assert.equal(u.eval("penMotion"), null);
  assert.equal(u.state().turns, 1);
});

test("grabbing the pen barrel uses pull distance from the grab point, and a tap never fires", (t) => {
  const u = ui(t);
  u.start("pen");
  u.tap(290, 60);
  assert.equal(u.state().turns, 0);
  u.pointer("pointerdown", 290, 60);
  assert.equal(u.$("#power-value").textContent, "0%");
  u.pointer("pointermove", 360, 60);
  assert.equal(u.$("#power-value").textContent, "50%");
  u.pointer("pointerup", 360, 60);
  assert.equal(u.state().turns, 1);
  assert.equal(u.$("#last-shot").textContent, "Benchmate 1 fired 50%");
});
