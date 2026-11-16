/* Presentation only. Motion follows the authoritative ink segments, including portal gaps. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PenRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const mix = (a, b, t) => a + (b - a) * t;
  const tau = Math.PI * 2;
  function motion(before, after, reduced = false) {
    if (
      !before ||
      before.kind !== "pen" ||
      after.kind !== "pen" ||
      after.turns !== before.turns + 1
    )
      return null;
    const index = before.turn,
      start = before.pens[index].segments.length;
    const path = after.pens[index].segments.slice(start);
    if (!path.length) return null;
    let length = 0;
    const steps = path.map((seg) => {
      const from = length;
      length += Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
      return { ...seg, from, to: length };
    });
    const events = [],
      hit = new Set();
    for (const seg of steps) {
      before.pens.forEach((enemy, i) => {
        if (
          i !== index &&
          enemy.alive &&
          !hit.has(i) &&
          enemy.segments.some((old) => cross(seg.a, seg.b, old.a, old.b))
        ) {
          hit.add(i);
          events.push({ index: i, x: seg.b.x, y: seg.b.y, distance: seg.to });
        }
      });
    }
    return {
      events,
      before: copy(before),
      after: copy(after),
      index,
      start,
      steps,
      length,
      duration: reduced ? 1 : Math.min(1400, 650 + length * 1.4),
      settle: reduced ? 0 : 280,
    };
  }
  function sample(m, elapsed) {
    const t = Math.max(0, Math.min(1, elapsed / m.duration));
    const distance = m.length * (1 - Math.pow(1 - t, 2));
    const state = copy(t >= 1 ? m.after : m.before);
    const p = state.pens[m.index];
    let angle =
      Math.atan2(
        m.steps[0].b.y - m.steps[0].a.y,
        m.steps[0].b.x - m.steps[0].a.x,
      ) -
      Math.PI / 2;
    if (t < 1) {
      for (const seg of m.steps) {
        if (distance <= seg.from) break;
        const f = Math.min(1, (distance - seg.from) / (seg.to - seg.from || 1));
        const b = { x: mix(seg.a.x, seg.b.x, f), y: mix(seg.a.y, seg.b.y, f) };
        p.segments.push({ a: seg.a, b });
        p.x = b.x;
        p.y = b.y;
        angle = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x) - Math.PI / 2;
        if (f < 1) break;
      }
      // Reveal damage and pickups only when the nib actually reaches them.
      for (const event of m.events)
        if (distance >= event.distance) {
          const enemy = state.pens[event.index];
          if (enemy.shield) enemy.shield = false;
          else {
            enemy.lives--;
            if (enemy.lives <= 0) enemy.alive = false;
          }
        }
      for (const seg of p.segments.slice(m.start)) {
        for (const h of state.hazards)
          if (
            h.kind === "shield" &&
            !h.used &&
            Math.hypot(seg.b.x - h.x, seg.b.y - h.y) < h.r
          ) {
            h.used = true;
            p.shield = true;
          }
      }
    } else {
      const seg = m.steps[m.steps.length - 1];
      angle = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x) - Math.PI / 2;
    }
    const settling = Math.min(
      1,
      Math.max(0, (elapsed - m.duration) / (m.settle || 1)),
    );
    state.margin = mix(m.before.margin, m.after.margin, settling);
    return {
      state,
      impacts: m.events
        .map((e) => ({
          ...e,
          age:
            (elapsed -
              m.duration *
                (1 - Math.sqrt(Math.max(0, 1 - e.distance / m.length)))) /
            450,
        }))
        .filter((e) => e.age >= 0 && e.age < 1),
      index: m.index,
      angle,
      progress: t,
      settling,
      done: elapsed >= m.duration + m.settle,
    };
  }
  function cross(a, b, c, d) {
    const orient = (p, q, r) =>
      (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const within = (p, q, r) =>
      r.x >= Math.min(p.x, q.x) - 1e-8 &&
      r.x <= Math.max(p.x, q.x) + 1e-8 &&
      r.y >= Math.min(p.y, q.y) - 1e-8 &&
      r.y <= Math.max(p.y, q.y) + 1e-8;
    const x = orient(a, b, c),
      y = orient(a, b, d),
      z = orient(c, d, a),
      w = orient(c, d, b);
    return (
      (x * y < -1e-8 && z * w < -1e-8) ||
      (Math.abs(x) < 1e-8 && within(a, b, c)) ||
      (Math.abs(y) < 1e-8 && within(a, b, d)) ||
      (Math.abs(z) < 1e-8 && within(c, d, a)) ||
      (Math.abs(w) < 1e-8 && within(c, d, b))
    );
  }
  function line(c, a, b, color, width = 1) {
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  function circle(c, x, y, r, fill, stroke, width = 1) {
    c.beginPath();
    c.arc(x, y, r, 0, tau);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.stroke();
    }
  }
  function paper(c, graph = false) {
    const g = c.createLinearGradient(0, 0, 600, 600);
    g.addColorStop(0, "#fffdf3");
    g.addColorStop(0.5, "#f9f4df");
    g.addColorStop(1, "#eee5ca");
    c.fillStyle = g;
    c.fillRect(0, 0, 600, 600);
    for (let y = 30; y < 600; y += graph ? 20 : 30)
      line(c, { x: 0, y }, { x: 600, y }, "#819da933", 0.8);
    if (graph)
      for (let x = 30; x < 600; x += 20)
        line(c, { x, y: 0 }, { x, y: 600 }, "#819da923", 0.8);
    // Deterministic fibres stay still while the pens move.
    c.fillStyle = "#84734a0c";
    for (let i = 0; i < 650; i++)
      c.fillRect((i * 137.39) % 600, (i * 71.17) % 600, 1, 0.6);
    line(c, { x: 43, y: 0 }, { x: 43, y: 600 }, "#c9786a66");
    line(c, { x: 46, y: 0 }, { x: 46, y: 600 }, "#c9786a22");
    for (let y = 55; y < 600; y += 98) {
      circle(c, 15, y, 5, "#c5b99d");
      circle(c, 15, y - 1, 4, "#7d7565");
      line(c, { x: 0, y: y - 2 }, { x: 16, y: y - 2 }, "#e7e6dd", 2.5);
    }
  }
  function pen(c, p, color, angle, active, moving) {
    c.save();
    c.translate(p.x, p.y);
    if (active) {
      circle(c, 0, 0, 25, color + "12", color + "55", 1.5);
      c.setLineDash([2, 5]);
      circle(c, 0, 0, 30, null, color + "66");
      c.setLineDash([]);
    }
    if (p.shield) {
      circle(c, 0, -6, 34, "#eac96c18", "#c6a44a99", 2);
    }
    c.rotate(angle);
    c.shadowColor = "#27342d55";
    c.shadowBlur = moving ? 10 : 5;
    c.shadowOffsetX = 3;
    c.shadowOffsetY = 4;
    const wide = p.type === "fountain" ? 7 : 5.5,
      length = p.type === "gel" ? 50 : 44;
    const body = c.createLinearGradient(-wide, 0, wide, 0);
    body.addColorStop(0, "#182f32");
    body.addColorStop(0.22, color);
    body.addColorStop(0.48, color);
    body.addColorStop(0.55, "#ffffffb0");
    body.addColorStop(0.68, color);
    body.addColorStop(1, "#1d353a");
    c.fillStyle = body;
    c.beginPath();
    c.roundRect(-wide, -length, wide * 2, length - 10, 4);
    c.fill();
    c.shadowColor = "transparent";
    c.fillStyle = p.type === "fountain" ? "#d6b864" : "#a6b4b6";
    c.beginPath();
    c.moveTo(-wide, -12);
    c.lineTo(wide, -12);
    c.lineTo(0, 0);
    c.closePath();
    c.fill();
    line(c, { x: 0, y: -10 }, { x: 0, y: 0 }, "#2c4146", 1);
    circle(c, 0, 0, 1.8, color);
    c.fillStyle = "#d5ded6";
    c.fillRect(-wide, -length + 5, wide * 2, 2);
    line(
      c,
      { x: wide - 2, y: -length + 6 },
      { x: wide - 2, y: -length + 20 },
      "#dae4de",
      2,
    );
    for (let y = -20; y < -12; y += 3)
      line(c, { x: -wide + 1, y }, { x: wide - 1, y }, "#132d3d55", 1);
    c.restore();
  }
  function draw(c, s, opts = {}) {
    paper(c);
    c.lineCap = "round";
    c.lineJoin = "round";
    const m = s.margin;
    c.fillStyle = "#bd624016";
    c.fillRect(0, 0, 600, m);
    c.fillRect(0, 600 - m, 600, m);
    c.fillRect(0, m, m, 600 - 2 * m);
    c.fillRect(600 - m, m, m, 600 - 2 * m);
    c.setLineDash([8, 7]);
    c.strokeStyle = "#bd6859aa";
    c.lineWidth = 1.5;
    c.strokeRect(m, m, 600 - 2 * m, 600 - 2 * m);
    c.setLineDash([]);
    c.fillStyle = "#b1856a";
    c.font = "8px sans-serif";
    c.textAlign = "right";
    c.fillText("STAY INSIDE THE MARGIN", 570, 18);
    for (const h of s.hazards) {
      if (h.used) continue;
      if (h.kind === "coffee") {
        circle(c, h.x, h.y, h.r, "#a66d3210", "#9f6a3538", 7);
        circle(c, h.x - 2, h.y + 1, h.r - 5, null, "#b5793c25", 2);
        for (let i = 0; i < 7; i++) {
          const a = i * 1.83;
          circle(
            c,
            h.x + Math.cos(a) * (h.r + 4 + i),
            h.y + Math.sin(a) * (h.r + 4 + i),
            1 + (i % 2),
            "#9c692e30",
          );
        }
        c.fillStyle = "#936e4d";
        c.font = "italic 10px Georgia";
        c.textAlign = "center";
        c.fillText("coffee", h.x, h.y + 3);
      } else if (h.kind === "portal") {
        const g = c.createRadialGradient(h.x - 4, h.y - 4, 1, h.x, h.y, h.r);
        g.addColorStop(0, "#203e40");
        g.addColorStop(0.65, "#426668");
        g.addColorStop(1, "#a3b5ac");
        circle(c, h.x, h.y, h.r + 3, "#e7ddc3", "#b8ad92");
        circle(c, h.x, h.y, h.r, g);
        circle(c, h.x, h.y, h.r - 6, null, "#a5d9d080", 1);
        c.fillStyle = "#d4e9db";
        c.font = "14px sans-serif";
        c.textAlign = "center";
        c.fillText("↗", h.x, h.y + 5);
      } else {
        c.save();
        c.translate(h.x, h.y);
        c.rotate(-0.13);
        c.shadowColor = "#89723e40";
        c.shadowBlur = 6;
        c.fillStyle = "#fffdf5";
        c.beginPath();
        c.roundRect(-12, -15, 24, 31, 5);
        c.fill();
        c.shadowColor = "transparent";
        c.fillStyle = "#b5c6a3";
        c.fillRect(-9, -20, 18, 7);
        c.fillStyle = "#8c9a69";
        c.font = "20px serif";
        c.textAlign = "center";
        c.fillText("◇", 0, 8);
        c.restore();
      }
    }
    for (const [i, p] of s.pens.entries()) {
      c.globalAlpha = p.alive ? 1 : 0.24;
      const color = s.players[i].color;
      for (const seg of p.segments) {
        line(c, seg.a, seg.b, color + "18", p.type === "fountain" ? 8 : 6);
        line(c, seg.a, seg.b, color, p.type === "fountain" ? 3.8 : 2.4);
      }
      c.globalAlpha = 1;
    }
    if (opts.preview) {
      c.setLineDash([3, 7]);
      for (const seg of opts.preview) line(c, seg.a, seg.b, "#366353aa", 1.8);
      c.setLineDash([]);
      const end = opts.preview.at(-1)?.b;
      if (end) {
        circle(c, end.x, end.y, 9, "#fff8dfaa", "#366353", 1.5);
        line(
          c,
          { x: end.x - 4, y: end.y },
          { x: end.x + 4, y: end.y },
          "#366353",
        );
        line(
          c,
          { x: end.x, y: end.y - 4 },
          { x: end.x, y: end.y + 4 },
          "#366353",
        );
      }
    }
    if (opts.drag) {
      line(c, opts.drag.start, opts.drag.end, "#bd8a4a", 2);
      circle(c, opts.drag.end.x, opts.drag.end.y, 6, "#faf3dd", "#bd8a4a", 2);
    }
    for (const [i, p] of s.pens.entries()) {
      const color = s.players[i].color,
        moving = opts.frame?.index === i;
      let angle = -0.3;
      if (p.segments.length > 1) {
        const seg = p.segments.at(-1);
        angle = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x) - Math.PI / 2;
      }
      if (moving) angle = opts.frame.angle;
      if (opts.drag && i === s.turn)
        angle =
          Math.atan2(
            opts.drag.start.y - opts.drag.end.y,
            opts.drag.start.x - opts.drag.end.x,
          ) -
          Math.PI / 2;
      c.globalAlpha = p.alive ? 1 : 0.25;
      pen(c, p, color, angle, p.alive && i === s.turn && !opts.frame, moving);
      c.globalAlpha = p.alive ? 1 : 0.45;
      c.font = "600 11px sans-serif";
      c.textAlign = "center";
      const name = s.players[i].name.slice(0, 15),
        w = c.measureText(name).width + 16,
        x = Math.max(w / 2 + 4, Math.min(596 - w / 2, p.x)),
        y = Math.max(20, Math.min(570, p.y + 35));
      c.fillStyle = "#fffdf0ed";
      c.beginPath();
      c.roundRect(x - w / 2, y - 11, w, 20, 10);
      c.fill();
      c.fillStyle = color;
      c.fillText(name, x, y + 3);
      c.globalAlpha = 1;
    }
    if (opts.frame) {
      const f = opts.frame,
        p = s.pens[f.index],
        color = s.players[f.index].color;
      if (f.progress < 1) {
        circle(c, p.x, p.y, 5, "#ffedb999", color + "66");
      }
      for (const hit of f.impacts || []) {
        const k = hit.age;
        c.globalAlpha = 1 - k;
        circle(c, hit.x, hit.y, 7 + k * 28, null, color, 2);
        for (let j = 0; j < 8; j++) {
          const a = (j * tau) / 8;
          circle(
            c,
            hit.x + Math.cos(a) * (5 + k * 34),
            hit.y + Math.sin(a) * (5 + k * 34),
            2 * (1 - k),
            color,
          );
        }
        c.globalAlpha = 1;
      }
    }
  }
  return { motion, sample, draw, paper };
});
