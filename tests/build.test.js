const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const postcss = require("postcss");

for (const file of ["backbencher.html", "index.html"]) {
  test(`${file}: standalone CSS retains theme tokens and visible launch styling`, () => {
    const html = fs.readFileSync(path.join(__dirname, "../dist", file), "utf8");
    const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    const sheet = postcss.parse(css);
    // The old semicolon-based font-import stripping left a URL fragment before :root.
    assert.equal(sheet.nodes[0].type, "rule");
    assert.equal(sheet.nodes[0].selector, ":root");
    const tokens = Object.fromEntries(
      sheet.nodes[0].nodes.map((n) => [n.prop, n.value]),
    );
    assert.equal(tokens["--green"], "#2a5145");
    assert.equal(tokens["--paper"], "#f4f0e7");
    assert(tokens["--body"].includes("sans-serif"));
    assert(!css.includes("fonts.googleapis.com"));
    const launch = sheet.nodes.find(
      (n) => n.type === "rule" && n.selector === ".panel #start-local",
    );
    const declarations = Object.fromEntries(
      launch.nodes.map((n) => [n.prop, n.value]),
    );
    assert.equal(declarations.background, "#2a5145");
    assert.equal(declarations.color, "#fff");
    assert.match(html, /button\(["']start-local["'],\s*["']Launch game →["']/);
  });
}
