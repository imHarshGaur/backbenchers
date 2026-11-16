const fs = require("node:fs");
const { Script } = require("node:vm");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const FakeTimers = require("@sinonjs/fake-timers");
function ui(t) {
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (e) => errors.push(e.message));
  const dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "../../dist/index.html"), "utf8"),
    {
      url: "https://game.example/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole: console,
    },
  );
  const w = dom.window;
  const run = (code) =>
    new Script(code).runInContext(dom.getInternalVMContext());
  const drawing = new Proxy(
    { measureText: () => ({ width: 30 }) },
    {
      get: (target, k) => (k in target ? target[k] : () => {}),
      set: (target, k, v) => ((target[k] = v), true),
    },
  );
  w.HTMLCanvasElement.prototype.getContext = () => drawing;
  let width = 600;
  w.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width,
    height: width,
    right: width,
    bottom: width,
  });
  w.HTMLCanvasElement.prototype.setPointerCapture = () => {};
  const clock = FakeTimers.withGlobal(w).install({
    now: 100000,
    toFake: [
      "Date",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
    ],
  });
  for (const script of w.document.querySelectorAll("script"))
    if (script.textContent.trim()) run(script.textContent);
  t.after(() => {
    clock.uninstall();
    dom.window.close();
  });
  const $ = (s) => w.document.querySelector(s);
  const click = (s) => {
    const el = $(s);
    if (!el) throw Error("Missing control: " + s);
    el.click();
  };
  const select = (s, v) => {
    const el = $(s);
    el.value = String(v);
    el.dispatchEvent(new w.Event("change", { bubbles: true }));
  };
  const pointer = (type, x, y, extra = {}) => {
    const event = new w.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, {
      clientX: (x * width) / 600,
      clientY: (y * width) / 600,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      ...extra,
    });
    const canvas = $("#board");
    canvas["on" + type]?.(event);
  };
  const tap = (x, y) => {
    pointer("pointerdown", x, y);
    pointer("pointerup", x, y);
  };
  const drag = (a, b) => {
    pointer("pointerdown", a.x, a.y);
    pointer("pointermove", b.x, b.y);
    pointer("pointerup", b.x, b.y);
  };
  const start = (
    kind,
    { bots = 0, count, pace = "relaxed", stake = 0 } = {},
  ) => {
    click(`[data-game="${kind}"]`);
    if (count) select("#count", count);
    select("#bots", bots);
    select("#stake", stake);
    if ($("#pace")) select("#pace", pace);
    click("#start-local");
  };
  const state = () => JSON.parse(run("JSON.stringify(game)"));
  return {
    w,
    $,
    click,
    select,
    pointer,
    tap,
    drag,
    start,
    state,
    clock,
    errors,
    scale: (n) => (width = n),
    eval: run,
  };
}
module.exports = { ui };
