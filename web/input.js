/* Coordinate helpers shared by pointer controls and interaction regression tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BackbenchInput = api;
})(globalThis, function () {
  function dotAt(size, p, radius = 18) {
    const step = 460 / (size - 1),
      x = Math.round((p.x - 70) / step),
      y = Math.round((p.y - 70) / step);
    return x >= 0 &&
      y >= 0 &&
      x < size &&
      y < size &&
      Math.hypot(p.x - (70 + x * step), p.y - (70 + y * step)) <= radius
      ? { x, y }
      : null;
  }
  function edgeBetween(a, b) {
    if (!a || !b || Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1)
      return null;
    return a.y === b.y
      ? `h:${Math.min(a.x, b.x)}:${a.y}`
      : `v:${a.x}:${Math.min(a.y, b.y)}`;
  }
  function edgePoints(size, key) {
    const [d, x, y] = key.split(":"),
      step = 460 / (size - 1),
      a = { x: 70 + Number(x) * step, y: 70 + Number(y) * step };
    return {
      a,
      b: { x: a.x + (d === "h" ? step : 0), y: a.y + (d === "v" ? step : 0) },
    };
  }
  function distance(p, a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy),
        ),
      );
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
  function edgeAt(size, p, tolerance = 22) {
    let best = null,
      min = tolerance;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        for (const d of ["h", "v"]) {
          if ((d === "h" && x === size - 1) || (d === "v" && y === size - 1))
            continue;
          const key = `${d}:${x}:${y}`,
            { a, b } = edgePoints(size, key),
            v = distance(p, a, b);
          if (v < min) {
            best = key;
            min = v;
          }
        }
    return best;
  }
  return { dotAt, edgeBetween, edgePoints, edgeAt };
});
