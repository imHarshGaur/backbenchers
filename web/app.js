/* UI adapter: the online client sends intents; only the server resolves rules. */
"use strict";
const G = Backbencher,
  $ = (s) => document.querySelector(s),
  app = $("#app");
const LOCAL_ONLY = globalThis.BACKBENCHER_LOCAL_ONLY === true;
const TITLES = {
  pen: "Pen Rocket",
  dots: "Chaukadi Blitz",
  rmcs: "Raja. Mantri. Chor.",
};
let screen = "home",
  game = null,
  kind = "pen",
  online = false,
  room = null,
  you = null,
  ws = null,
  deadline = 0,
  botAt = 0,
  curtainOpen = false,
  sound = true,
  audioContext = null,
  drag = null,
  selectedDot = null,
  dotGesture = null,
  hoverEdge = null,
  paused = false,
  clockPausedAt = null,
  privateContext = null,
  lastPenShot = null;
let settings = {
    count: 2,
    bots: 1,
    stake: 50,
    rounds: 5,
    timed: false,
    names: [],
    classes: [],
  },
  wallets = {},
  escrow = null,
  settled = false,
  profile;
try {
  profile = JSON.parse(localStorage.getItem("backbencher.profile")) || {};
} catch {
  profile = {};
}
profile = {
  coins: 1000,
  claimed: "",
  streak: 0,
  pen: "ballpoint",
  unlocks: ["ballpoint"],
  ...profile,
};
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function save() {
  try {
    localStorage.setItem("backbencher.profile", JSON.stringify(profile));
  } catch {}
  $("#balance").textContent = profile.coins.toLocaleString();
}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 3500);
}
function fx(type = "ink") {
  if (navigator.vibrate) navigator.vibrate(type === "win" ? [30, 35, 60] : 12);
  if (!sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const o = audioContext.createOscillator(),
      g = audioContext.createGain();
    o.connect(g);
    g.connect(audioContext.destination);
    o.type = type === "win" ? "sine" : "triangle";
    o.frequency.setValueAtTime(
      type === "win" ? 660 : 180,
      audioContext.currentTime,
    );
    o.frequency.exponentialRampToValueAtTime(
      type === "win" ? 990 : 80,
      audioContext.currentTime + 0.1,
    );
    g.gain.setValueAtTime(0.05, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);
    o.start();
    o.stop(audioContext.currentTime + 0.2);
  } catch {}
}
function button(id, text, cls = "primary") {
  return `<button id="${id}" class="${cls}">${text}</button>`;
}
function bind(id, fn) {
  const el = document.getElementById(id);
  if (el)
    el.onclick = () => {
      try {
        fn();
      } catch (e) {
        toast(e.message);
      }
    };
}
function heroArt() {
  return `<div class="hero-art" aria-hidden="true"><div class="hero-note"><i class="tape"></i><small>NOTE TO SELF / 03</small>Good friends.<br>Questionable aim.<br><b>Unforgettable games.</b><div style="text-align:right;font-size:23px;margin-top:12px">— the last bench ♡</div></div><div class="pen-prop"></div><span class="scribble">school’s out. game’s on. →</span></div>`;
}
const ART = {
  pen: `<svg viewBox="0 0 340 190" aria-hidden="true"><defs><pattern id="rule" width="340" height="25" patternUnits="userSpaceOnUse"><rect width="340" height="25" fill="#e8edde"/><path d="M0 24H340" stroke="#bbcbbc" stroke-width=".7"/></pattern></defs><rect width="340" height="190" fill="url(#rule)"/><path d="M48 0V190" stroke="#c78f7d" opacity=".6"/><path d="M72 160L151 113L212 134L258 52" fill="none" stroke="#34726d" stroke-width="3" stroke-linejoin="round"/><path d="M95 74L215 112L266 162" fill="none" stroke="#b25b45" stroke-width="2.5"/><circle cx="204" cy="111" r="17" fill="none" stroke="#b25b45" stroke-dasharray="3 6"/><g transform="translate(259 56) rotate(29)"><rect x="-6" y="-67" width="12" height="65" rx="3" fill="#2b5b4d"/><rect x="-4" y="-64" width="2" height="48" fill="#75a08b"/><path d="M-6-2H6L0 17Z" fill="#b0b6a6"/><path d="M-2 12L0 17L2 12" fill="#23392f"/></g><text x="64" y="47" fill="#8d9a7f" font-family="cursive" font-size="12" transform="rotate(-8 64 47)">aim. flick. survive.</text></svg>`,
  dots: `<svg viewBox="0 0 340 190" aria-hidden="true"><defs><pattern id="graph" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#e9e8dc"/><path d="M18 0H0V18" fill="none" stroke="#c6cebd" stroke-width=".6"/></pattern></defs><rect width="340" height="190" fill="url(#graph)"/><g transform="translate(85 36) rotate(-6 80 60)"><path d="M0 0H58V58H0Z" fill="#b8caba" fill-opacity=".6" stroke="#527a68" stroke-width="3"/><path d="M58 58H116V116H58Z" fill="#d8b89f" fill-opacity=".7" stroke="#ae7252" stroke-width="3"/><path d="M0 116V58M116 0H174V58H116M58 0V-22" stroke="#537b69" fill="none" stroke-width="3"/><g fill="#526153">${[0, 58, 116, 174].flatMap((x) => [0, 58, 116].map((y) => `<circle cx="${x}" cy="${y}" r="3.5"/>`)).join("")}</g><text x="20" y="39" font-family="cursive" font-size="29" fill="#61846c">A</text><text x="77" y="99" font-family="cursive" font-size="28" fill="#aa6c4e">B</text><text x="136" y="33" font-size="25" fill="#b49345">★</text></g></svg>`,
  rmcs: `<svg viewBox="0 0 340 190" aria-hidden="true"><rect width="340" height="190" fill="#dfc9a6"/><g stroke="#c0a17b" opacity=".35"><path d="M0 24Q100 13 340 28M0 63Q180 40 340 59M0 113Q150 130 340 112M0 158Q180 140 340 163" fill="none"/><path d="M50 0L40 190M280 0L292 190"/></g><g transform="translate(70 47) rotate(-13 60 50)"><rect x="3" y="5" width="95" height="87" fill="#765a3630"/><rect width="95" height="87" fill="#f4eedc"/><path d="M0 0L48 44L95 0M48 44V87" fill="none" stroke="#ded3b9"/><text x="20" y="66" font-family="cursive" font-size="23" fill="#8f8063">chor?</text></g><g transform="translate(178 35) rotate(13 50 60)"><rect x="3" y="5" width="99" height="110" fill="#765a3630"/><rect width="99" height="110" fill="#f6eed7"/><path d="M0 50H99" stroke="#d9c9a8"/><path d="M32 28L25 11L42 20L51 5L60 20L76 11L70 28Z" fill="#ba9141"/><text x="25" y="77" font-family="cursive" font-size="25" fill="#8c6c39">Raja</text><text x="31" y="96" font-family="sans-serif" font-size="8" letter-spacing="2" fill="#ac9975">1000 PTS</text></g></svg>`,
};
function home() {
  screen = "home";
  lastPenShot = null;
  clearBoardInput();
  paused = false;
  clockPausedAt = null;
  $("#pause-panel").classList.add("hidden");
  game = null;
  curtainOpen = false;
  privateContext = null;
  syncClockPause();
  $("#curtain").classList.add("hidden");
  app.innerHTML = `<section class="hero"><div><span class="eyebrow"><i class="live-dot"></i>THE BELL RANG. YOU DIDN’T LEAVE.</span><h1>Last bench.<br><em>First place.</em></h1><p>The games we played when the teacher wasn’t looking.<br>Same old friends. A little more at stake.</p></div>${heroArt()}</section><div class="section-label"><h2>PICK YOUR PERIOD</h2><span>Three classics. Zero boring lectures.</span></div><section class="games">${["pen", "dots", "rmcs"].map((k, i) => `<article class="game-card"><div class="game-art">${ART[k]}<span class="card-label">${["THE DESK DUEL", "ONE MORE LINE", "TRUST NO ONE"][i]}</span></div><div class="card-body"><div class="card-meta"><span>${k === "rmcs" ? "4–6" : "2–6"} BENCHMATES</span><span>${["→ SKILL", "⊞ STRATEGY", "♧ BLUFF"][i]}</span></div><h3>${TITLES[k]}</h3><p>${["Pull back. Let it fly. Slice their ink.<br>Be the last pen on the page.", "Connect the dots. Steal the square.<br>One tiny line can change everything.", "A folded chit. A familiar face.<br>Who’s hiding the Chor?"][i]}</p><button class="game-button" data-game="${k}"><span>${["FLICK A PEN", "CLAIM YOUR BOX", "PICK A CHIT"][i]}</span><span>→</span></button></div></article>`).join("")}</section><section class="lower-grid"><div class="room-strip"><span class="strip-icon">⌂</span><div class="strip-text"><b>${LOCAL_ONLY ? "One phone. The whole gang." : "Your gang. Your classroom."}</b><p>${LOCAL_ONLY ? "Play with bots or pass the phone to your benchmates." : "Get the bench back together in a private room."}</p></div>${button("room-home", LOCAL_ONLY ? "PLAY TOGETHER →" : "JOIN A ROOM →", "small-button")}</div><div class="reward-strip"><span class="strip-icon">▱</span><div class="strip-text"><b>Your daily tiffin is here.</b><p>Something good’s packed inside.</p></div>${button("daily", "OPEN +100 ✦", "small-button")}</div></section><div class="bottom-note"><span>✦ Play-money Chalk Coins. Bragging rights are real.</span><button id="locker">Open your stationery locker →</button></div>`;
  app
    .querySelectorAll("[data-game]")
    .forEach((el) => (el.onclick = () => setup(el.dataset.game)));
  bind("daily", claimDaily);
  bind("locker", locker);
  bind("room-home", () => (LOCAL_ONLY ? setup("rmcs") : setup("pen", true)));
  save();
}
function claimDaily() {
  const date = new Date().toLocaleDateString("en-CA");
  if (profile.claimed === date)
    return toast("Tiffin’s empty for today. Come back tomorrow.");
  profile.claimed = date;
  profile.coins += 100;
  save();
  fx("win");
  toast("+100 Chalk Coins. Tiffin time!");
}
function locker() {
  screen = "locker";
  app.innerHTML = `${button("back", "← Back to the desk", "back")}<div class="panel"><span class="eyebrow">THE STATIONERY LOCKER</span><h1>A pen with personality.</h1><p>Unlock a different flick. Your first pen is on us.</p><div class="locker">${[
    ["ballpoint", "Ballpoint", "Balanced glide. The dependable classmate.", 0],
    [
      "gel",
      "Gel pen",
      "Long slide with a gentle curve. Aim a little wider.",
      200,
    ],
    [
      "fountain",
      "Fountain pen",
      "Short slide. One extra life to hold your ground.",
      300,
    ],
  ]
    .map(
      ([id, title, desc, cost]) =>
        `<div class="locker-item ${profile.pen === id ? "selected" : ""}"><span class="strip-icon">✒</span><b>${title}</b><p>${desc}</p><button class="small-button" data-pen="${id}" data-cost="${cost}">${profile.pen === id ? "EQUIPPED" : profile.unlocks.includes(id) ? "EQUIP" : `UNLOCK · ${cost} ✦`}</button></div>`,
    )
    .join(
      "",
    )}</div><p class="fine">Paper themes and desk stickers are planned for a later milestone.</p></div>`;
  bind("back", home);
  app.querySelectorAll("[data-pen]").forEach(
    (el) =>
      (el.onclick = () => {
        const id = el.dataset.pen,
          cost = +el.dataset.cost;
        if (!profile.unlocks.includes(id)) {
          if (profile.coins < cost) return toast("Not enough Chalk Coins.");
          profile.coins -= cost;
          profile.unlocks.push(id);
        }
        profile.pen = id;
        save();
        locker();
      }),
  );
}
function setup(k, join = false) {
  if (LOCAL_ONLY) join = false;
  if (room) {
    screen = "lobby";
    return lobby();
  }
  kind = k;
  screen = "setup";
  const min = k === "rmcs" ? 4 : 2;
  app.innerHTML = `${button("back", "← Back to the desk", "back")}<section class="panel"><span class="eyebrow">AFTER-SCHOOL CLUB / ${k === "rmcs" ? "03" : k === "dots" ? "02" : "01"}</span><h1>${TITLES[k]}</h1><p>${k === "pen" ? "Flick your pen through rival ink trails. Stay inside the red margin." : k === "dots" ? "Close squares for points and a bonus turn. A gold star counts double." : "Pass secret chits, read the room, and find the Chor. No peeking."}</p><div class="form-grid"><label>Play style<select id="mode"><option value="offline">Pass & play · one device</option>${LOCAL_ONLY ? "" : `<option value="online" ${join ? "selected" : ""}>Online · private room</option>`}</select></label><label>Entry stake · Chalk Coins<select id="stake"><option value="0">Just for fun · 0</option><option value="25">25 coins each</option><option value="50" selected>50 coins each</option><option value="100">100 coins each</option></select></label><label>Benchmates<select id="count">${Array.from({ length: 7 - min }, (_, i) => `<option value="${i + min}">${i + min} players</option>`).join("")}</select></label><label>Bot seats<select id="bots">${Array.from({ length: min }, (_, i) => `<option ${i === min - 1 ? "selected" : ""}>${i}</option>`).join("")}</select></label>${k !== "rmcs" ? '<label id="pace-label">Turn pace<select id="pace"><option value="relaxed">Relaxed · no turn timer</option><option value="timed">Timed · Dots 6s / Pen 30s</option></select></label>' : ""}${k === "rmcs" ? '<label>Match length<select id="rounds"><option value="5">5 rounds</option><option value="7">7 rounds</option></select></label>' : ""}</div><div id="offline-names" class="names"></div><div id="online-fields" class="${join ? "" : "hidden"}"><label>Your name<input id="online-name" maxlength="20" value="Benchmate 1"></label><label>Room code · to join<input id="code" maxlength="4" placeholder="ABCD" autocapitalize="characters"></label></div><div class="button-row">${button("start-local", "Launch game →")}${button("create-room", "Create room →")}${button("join-room", "Join room →", "secondary")}</div><p class="fine" id="setup-note"></p></section>`;
  const savedNames = [];
  function names() {
    app
      .querySelectorAll(".player-name")
      .forEach((el, i) => (savedNames[i] = el.value));
    const n = +$("#count").value,
      b = +$("#bots").value;
    $("#offline-names").innerHTML = Array.from(
      { length: n - b },
      (_, i) =>
        `<label>Player ${i + 1}<input class="player-name" maxlength="20" value="${esc(savedNames[i] ?? `Benchmate ${i + 1}`)}"></label>`,
    ).join("");
  }
  function mode() {
    const net = $("#mode").value === "online";
    $("#offline-names").classList.toggle("hidden", net);
    $("#online-fields").classList.toggle("hidden", !net);
    $("#start-local").classList.toggle("hidden", net);
    $("#create-room").classList.toggle("hidden", !net);
    $("#join-room").classList.toggle("hidden", !net);
    $("#pace-label")?.classList.toggle("hidden", net);
    $("#setup-note").textContent = net
      ? "Room wallets start with 1,000 play coins. Share the room code with friends on this server."
      : "Pass-and-play trusts the device holder. Each guest starts with 1,000 play coins.";
  }
  $("#count").onchange = () => {
    const n = +$("#count").value;
    $("#bots").innerHTML = Array.from(
      { length: n },
      (_, i) => `<option ${i === n - 1 ? "selected" : ""}>${i}</option>`,
    ).join("");
    names();
  };
  $("#bots").onchange = names;
  $("#mode").onchange = mode;
  names();
  mode();
  bind("back", home);
  bind("start-local", () => {
    settings = {
      count: +$("#count").value,
      bots: +$("#bots").value,
      stake: +$("#stake").value,
      rounds: +($("#rounds")?.value || 5),
      timed: $("#pace")?.value === "timed",
      names: [...app.querySelectorAll(".player-name")].map(
        (el, i) => el.value.trim() || `Benchmate ${i + 1}`,
      ),
    };
    while (settings.names.length < settings.count)
      settings.names.push(`Bench Bot ${settings.names.length + 1}`);
    settings.classes = settings.names.map((_, i) =>
      i === 0 ? profile.pen : "ballpoint",
    );
    wallets = Object.fromEntries(
      settings.names.map((_, i) => [String(i), i === 0 ? profile.coins : 1000]),
    );
    online = false;
    startLocal();
  });
  const net = (t) => {
    const msg = {
      type: t,
      kind,
      name: $("#online-name").value,
      code: $("#code").value.toUpperCase(),
      stake: +$("#stake").value,
      penClass: profile.pen,
    };
    connect(() => send(msg));
  };
  bind("create-room", () => net("create"));
  bind("join-room", () => net("join"));
}
function startLocal(double = false) {
  const stake = double ? settings.stake * 2 : settings.stake;
  escrow = G.collect(
    wallets,
    settings.names.map((_, i) => String(i)),
    stake,
  );
  settings.stake = stake;
  profile.coins = wallets["0"];
  save();
  game = G.create(kind, settings.names, {
    classes: settings.classes,
    rounds: settings.rounds,
  });
  settled = false;
  lastPenShot = null;
  paused = false;
  closeCurtain();
  clearBoardInput();
  screen = "play";
  resetClock();
  renderGame();
}
function clearBoardInput() {
  drag = null;
  selectedDot = null;
  dotGesture = null;
  hoverEdge = null;
  updatePowerMeter();
}
function resetClock() {
  clearBoardInput();
  const duration =
    game.kind === "dots"
      ? 6000
      : game.kind === "rmcs" && game.phase === "guess"
        ? 15000
        : 30000;
  deadline =
    game.kind !== "rmcs" && !settings.timed ? Infinity : Date.now() + duration;
  botAt =
    Date.now() + (game.kind === "rmcs" && game.phase === "guess" ? 8000 : 1400);
  clockPausedAt = null;
  syncClockPause();
}
function syncClockPause() {
  const stop = !online && (paused || curtainOpen || document.hidden);
  if (stop && clockPausedAt === null) clockPausedAt = Date.now();
  if (!stop && clockPausedAt !== null) {
    const elapsed = Date.now() - clockPausedAt;
    deadline += elapsed;
    botAt += elapsed;
    clockPausedAt = null;
  }
}
function pauseGame() {
  if (online || !game || game.phase === "finished") return;
  paused = true;
  clearBoardInput();
  syncClockPause();
  $("#pause-panel").classList.remove("hidden");
  $("#resume-game").focus();
}
function resumeGame() {
  paused = false;
  syncClockPause();
  $("#pause-panel").classList.add("hidden");
  renderGame();
}
function isBot(id) {
  return !online && Number(id) >= settings.count - settings.bots;
}
function send(msg) {
  if (ws?.readyState !== WebSocket.OPEN)
    throw new Error("Room connection is offline.");
  ws.send(JSON.stringify(msg));
}
function connect(after) {
  if (LOCAL_ONLY)
    return toast("This edition supports bots and pass-and-play on one device.");
  if (ws?.readyState === WebSocket.OPEN) {
    after?.();
    return;
  }
  if (location.protocol === "file:")
    return toast(
      "For online rooms, run npm start and open http://localhost:3000.",
    );
  ws = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
  );
  ws.onopen = () => {
    let token;
    try {
      token = sessionStorage.getItem("backbencher.token");
    } catch {}
    send({ type: "hello", token });
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "session") {
      try {
        sessionStorage.setItem("backbencher.token", msg.token);
      } catch {}
      if (after) {
        const fn = after;
        after = null;
        fn();
      }
    } else if (msg.type === "error") toast(msg.message);
    else if (msg.type === "left") {
      online = false;
      room = null;
      game = null;
      home();
    } else if (msg.type === "state") {
      online = true;
      room = msg.room;
      you = msg.you;
      clearBoardInput();
      game = msg.game;
      if (curtainOpen) closeCurtain();
      deadline = room.deadline;
      kind = room.kind;
      if (game) {
        screen = "play";
        renderGame();
      } else {
        screen = "lobby";
        lobby();
      }
    }
  };
  ws.onclose = (event) => {
    if (event.code === 4001) {
      online = false;
      toast("This room is open in another tab. Use that tab to continue.");
      return;
    }
    if (online) {
      toast("Connection lost. Reconnecting…");
      setTimeout(() => {
        if (online) connect(null);
      }, 1800);
    }
  };
  ws.onerror = () =>
    toast("Couldn’t reach the room server. Start npm start first.");
}
function lobby() {
  screen = "lobby";
  app.innerHTML = `<div class="panel"><span class="eyebrow">YOUR PRIVATE CLASSROOM</span><h1>${TITLES[room.kind]}</h1><p>Pass this code to your benchmates.</p><div class="name-code">${esc(room.code)}</div><div class="button-row">${button("copy", "Copy invite →", "secondary")}</div><div class="roster">${room.players.map((p) => `<div class="player-row"><span>${esc(p.name)} ${p.id === you ? "(you)" : ""}${p.bot ? " · BOT" : ""}</span><span>${p.ready ? "✓ Ready" : "Getting settled"}</span></div>`).join("")}</div><p>${room.stake} Chalk Coins each · Room balance: ${room.wallets[you]}</p><div class="button-row">${button("ready", room.players.find((p) => p.id === you).ready ? "Not ready" : "I’m ready ✓")}${room.host === you ? button("fill", "Fill empty seats with bots", "secondary") + button("launch", "Start match →") : ""}${button("leave", "Leave room", "secondary")}</div><p class="fine">Ready up before each match. Disconnected players get a bot turn after a short grace period.</p></div>`;
  bind("ready", () =>
    send({
      type: "ready",
      ready: !room.players.find((p) => p.id === you).ready,
    }),
  );
  bind("fill", () =>
    send({
      type: "bots",
      count: Math.min(
        6,
        Math.max(kind === "rmcs" ? 4 : 2, room.players.length + 1),
      ),
    }),
  );
  bind("launch", () => send({ type: "start" }));
  bind("leave", () => send({ type: "leave" }));
  bind("copy", () => {
    const text = `Join my BACKBENCHER classroom: ${location.origin}/?room=${room.code} — room ${room.code}`;
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast("Invite copied."))
      .catch(() => toast(text));
  });
}
function act(a, id) {
  if (!game) return;
  try {
    if (online) {
      send({ type: "action", version: room.version, action: a });
      return;
    }
    const actor = id || G.actor(game);
    const shotName = game.players.find((p) => p.id === actor)?.name;
    G.action(game, actor, a);
    if (game.kind === "pen" && a.type === "flick")
      lastPenShot = {
        name: shotName,
        percent: shotPercent(a.dx, a.dy),
      };
    fx();
    if (!["swap", "bet"].includes(a.type)) resetClock();
    renderGame();
  } catch (e) {
    clearBoardInput();
    drawBoard();
    toast(e.message);
  }
}
function finishLocal() {
  if (!online && game.phase === "finished" && !settled) {
    G.settle(wallets, escrow, game.winners);
    settled = true;
    profile.coins = wallets["0"];
    profile.streak = game.winners.includes("0") ? profile.streak + 1 : 0;
    save();
    fx("win");
  }
}
function renderGame() {
  if (!game) return;
  finishLocal();
  const actor =
      online && game.kind === "rmcs"
        ? game.phase === "reveal"
          ? game.players[game.revealIndex]?.id
          : game.players[game.roles.indexOf("Mantri")]?.id
        : G.actor(game),
    current = game.players.find((p) => p.id === actor),
    done = game.phase === "finished",
    roundDone = game.phase === "result",
    pot = online ? room.pot : escrow.pot;
  const myTurn = online ? actor === you : !isBot(actor);
  const rolePublic = (i) =>
    game.kind === "rmcs" &&
    (["result", "finished"].includes(game.phase) ||
      (game.phase === "guess" && ["Raja", "Mantri"].includes(game.roles[i])));
  app.innerHTML = `${button("back-play", "← Back to the desk", "back")}${!online && !done ? button("pause-game", "Pause", "small-button") : ""}<div class="play-top"><div class="play-heading"><span class="eyebrow">${online ? `CLASSROOM ${room.code}` : "PASS & PLAY"} / ${game.kind === "rmcs" ? `ROUND ${game.round} OF ${game.rounds}` : "AFTER-SCHOOL CLUB"}</span><h1>${TITLES[game.kind]}</h1></div><div class="pot">✦ ${pot} ${done ? "paid out" : "in the pot"}</div></div>${
    done
      ? `<div class="result-banner"><span class="eyebrow">${game.kind === "rmcs" ? "CLASS TOPPER" : "LAST BELL"}</span><h2>${
          game.winners.length
            ? game.players
                .filter((p) => game.winners.includes(p.id))
                .map((p) => esc(p.name))
                .join(" & ") + " take the win!"
            : "The desk wins. Stakes refunded."
        }</h2><p>${esc(game.last)}</p>${online ? "" : `<p>Your wallet: ${profile.coins} ✦ ${profile.streak >= 3 ? "· Backbench Legend ★" : ""}</p>`}<div class="button-row" style="justify-content:center">${online ? button("again-ready", room.players.find((p) => p.id === you).ready ? "Ready ✓" : "Ready for rematch") + (room.host === you ? button("again-start", "Start rematch") + button("again-double", "Double stakes", "secondary") : "") + button("leave-finished", "Leave room", "secondary") : button("rematch", "Play again →") + button("double", "Double stakes →", "secondary")}</div></div>`
      : ""
  }<div class="play-layout"><div class="board-wrap"><div class="board-status" aria-live="polite"><strong>${done ? "Match finished" : roundDone ? "Round complete" : `${isBot(actor) ? "Bot turn" : "Your turn"}: ${esc(current?.name || "Benchmate")}`}</strong><span id="board-timer">${!online && game.kind !== "rmcs" && !settings.timed ? "Relaxed · no timer" : ""}</span></div><p class="board-instruction">${game.kind === "dots" ? "Drag between two adjacent dots, tap two dots, or tap anywhere along their connecting line." : game.kind === "pen" ? "Hold your highlighted pen, pull back, then release. Watch the power bar fill as you pull back. The dotted path shows your shot." : "Only Mantri chooses a suspect. Open your own chit privately to bluff or bet."}</p>${game.kind === "pen" ? powerMeterHTML() : ""}${game.kind === "rmcs" ? `<div class="chit-table">${game.players.map((p, i) => `<button class="chit ${rolePublic(i) ? "role-" + game.roles[i].toLowerCase() : ""}" data-chit="${p.id}" ${game.phase !== "guess" || !myTurn || ["Raja", "Mantri"].includes(game.roles[i]) ? "disabled" : ""}><small>${esc(p.name)}</small><strong>${rolePublic(i) ? game.roles[i] : "✉"}</strong>${game.roundScores ? `<small>${game.roundScores[i] >= 0 ? "+" : ""}${game.roundScores[i]} PTS</small>` : ""}</button>`).join("")}</div>` : '<canvas id="board" width="600" height="600" tabindex="0" aria-label="Game board. Use pointer or touch to play."></canvas>'}<div class="board-caption">${esc(game.last)}</div></div><aside class="side-panel"><div class="turn-card"><span class="eyebrow">${done ? "MATCH FINISHED" : roundDone ? "ROUND FINISHED" : myTurn ? "YOUR TURN" : isBot(actor) ? "BOT THINKING" : "AT THE BENCH"}</span><h3>${done ? "Well played." : roundDone ? "Fold & shuffle." : esc(current?.name || "Benchmate")}</h3><span class="timer" id="timer"></span>${game.kind === "rmcs" && !done && !roundDone ? `<div class="button-row">${button("private", game.phase === "reveal" ? "Open private chit" : "Private chit / bluff", "secondary")}</div>` : ""}${roundDone ? button("next-round", "Next round →") : ""}</div><div class="roster">${game.players.map((p, i) => `<div class="player-row ${p.id === actor ? "active" : ""}"><span><i class="color-dot" style="background:${p.color}"></i>${esc(p.name)}${online && p.id === you ? " · YOU" : ""}${isBot(p.id) ? " · BOT" : ""}</span><span>${game.kind === "pen" ? (game.pens[i].alive ? `${game.pens[i].shield ? "◈ " : ""}${"♥".repeat(game.pens[i].lives)}` : "OUT") : `${p.score} pts`}</span></div>`).join("")}</div><div class="rules">${game.kind === "pen" ? "<strong>Pull back. Release. Slice.</strong><br>Drag back from your pen to aim. Cross a rival ink trail to cut a life. Every 3 turns, the red margin shrinks.<br>◯ Coffee deflects · ◌ Holes teleport<br>◇ Whitener shields one hit." : game.kind === "dots" ? `<strong>Connect. Close. Claim.</strong><br>Tap between adjacent dots. Finish a box to go again. ${online || settings.timed ? "Blitz: 6 seconds per turn; timeout plays a line." : "Relaxed: take your time. Your lines are never drawn automatically."}<br>★ Gold = 2 points · ✳ Bomb clears nearby unclaimed lines.` : "<strong>Mera Mantri Kaun?</strong><br>Mantri has 15 seconds to tap the Chor. A wrong guess gives Chor 800 points.<br>Chor can swap once per match. Private Chalk Bets add or subtract 50 score points."}</div></aside></div>`;
  bind("pause-game", pauseGame);
  bind("back-play", () => {
    if (online) return toast("Finish the match, then leave from the lobby.");
    if (game.phase !== "finished") return pauseGame();
    home();
  });
  bind("again-ready", () => send({ type: "ready", ready: true }));
  bind("again-start", () => send({ type: "start" }));
  bind("again-double", () => send({ type: "start", double: true }));
  bind("leave-finished", () => send({ type: "leave" }));
  bind("rematch", () => startLocal());
  bind("double", () => startLocal(true));
  if (online && $("#next-round")) $("#next-round").disabled = room.host !== you;
  bind("next-round", () => {
    if (online) send({ type: "next" });
    else {
      G.nextRound(game);
      resetClock();
      renderGame();
    }
  });
  bind("private", () => {
    if (game.phase === "reveal") {
      const id = online ? you : actor;
      if (online && actor !== you)
        return toast("Wait until your turn to unfold.");
      openChit(id, true);
    } else if (online) openChit(you, false);
    else privateSelect();
  });
  if (game.kind === "rmcs") {
    app
      .querySelectorAll("[data-chit]")
      .forEach(
        (el) =>
          (el.onclick = () => act({ type: "guess", target: el.dataset.chit })),
      );
    if (
      game.phase === "reveal" &&
      (!online || actor === you) &&
      !isBot(actor) &&
      !curtainOpen
    )
      openChit(actor, true);
  } else {
    drawBoard();
    wireCanvas();
  }
  if (curtainOpen && (!game || !["reveal", "guess"].includes(game.phase)))
    closeCurtain();
}
function privateSelect() {
  curtainOpen = true;
  syncClockPause();
  $("#curtain").classList.remove("hidden");
  $("#curtain-title").textContent = "Who is holding the phone?";
  $("#curtain-copy").textContent =
    "Choose your name. Everyone else, look away.";
  $("#secret").classList.remove("hidden");
  $("#secret").innerHTML = game.players
    .filter((p) => !isBot(p.id))
    .map(
      (p) =>
        `<button class="secondary" data-private="${p.id}">${esc(p.name)}</button>`,
    )
    .join("");
  $("#reveal-chit").classList.add("hidden");
  $("#hide-chit").classList.remove("hidden");
  $("#hide-chit").textContent = "Return to the table";
  $("#hide-chit").onclick = () => {
    closeCurtain();
    renderGame();
  };
  document
    .querySelectorAll("[data-private]")
    .forEach((el) => (el.onclick = () => openChit(el.dataset.private, false)));
}
function closeCurtain() {
  curtainOpen = false;
  privateContext = null;
  syncClockPause();
  $("#curtain").classList.add("hidden");
  $("#secret").textContent = "";
  $("#secret").classList.add("hidden");
}
function openChit(id, dealing) {
  curtainOpen = true;
  privateContext = { id, dealing };
  syncClockPause();
  $("#curtain").classList.remove("hidden");
  $("#curtain-title").textContent =
    `Pass to ${game.players.find((p) => p.id === id).name}.`;
  $("#curtain-copy").textContent =
    "Everyone else, look away. Tap when the phone is yours.";
  $("#secret").classList.add("hidden");
  $("#secret").innerHTML = "";
  $("#reveal-chit").classList.remove("hidden");
  $("#hide-chit").classList.add("hidden");
  $("#reveal-chit").focus();
  $("#reveal-chit").onclick = () => {
    if (!game || !["reveal", "guess"].includes(game.phase))
      return closeCurtain();
    const role = online ? game.myRole : game.roles[Number(id)];
    $("#secret").classList.remove("hidden");
    $("#secret").innerHTML =
      `${esc(role)}<div style="font:12px var(--body);margin-top:10px">${G.ROLES[role]} points · keep it secret</div>`;
    $("#reveal-chit").classList.add("hidden");
    $("#hide-chit").classList.remove("hidden");
    $("#hide-chit").textContent = dealing ? "Fold & pass →" : "Fold & return →";
    if (!dealing && game.phase === "guess") {
      if (role === "Chor" && !game.swapUsed) {
        const targets = game.players.filter(
          (p, i) => p.id !== id && !["Raja", "Mantri"].includes(game.roles[i]),
        );
        $("#secret").insertAdjacentHTML(
          "beforeend",
          `<label style="margin-top:20px">Swap your chit with<select id="swap-target">${targets.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>${button("swap-chit", "Use one bluff card", "secondary")}`,
        );
        bind("swap-chit", () => {
          const target = $("#swap-target").value;
          closeCurtain();
          act({ type: "swap", target }, id);
        });
      }
      if (!Object.hasOwn(game.bets, id)) {
        $("#secret").insertAdjacentHTML(
          "beforeend",
          `<p style="font:12px var(--body)">Chalk Bet · ±50 score points</p>${button("bet-yes", "Caught", "secondary")} ${button("bet-no", "Escapes", "secondary")}`,
        );
        for (const [b, caught] of [
          ["bet-yes", true],
          ["bet-no", false],
        ])
          bind(b, () => {
            closeCurtain();
            act({ type: "bet", caught }, id);
          });
      }
    }
  };
  $("#hide-chit").onclick = () => {
    closeCurtain();
    if (dealing) act({ type: "reveal" }, id);
    else renderGame();
  };
}
function canPlay() {
  return (
    game?.phase === "playing" &&
    !paused &&
    !curtainOpen &&
    (!online || game.players[game.turn].id === you) &&
    !isBot(game.players[game.turn].id)
  );
}
function wireCanvas() {
  const canvas = $("#board");
  if (!canvas) return;
  const I = BackbenchInput;
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * 600) / r.width,
      y: ((e.clientY - r.top) * 600) / r.height,
    };
  };
  const dotRadius = () =>
    Math.min(
      24,
      (12 * 600) / Math.max(1, canvas.getBoundingClientRect().width),
    );
  function drawEdge(key) {
    if (!key) return;
    if (game.edges[key] !== undefined) {
      toast("That line is already drawn. Choose an empty edge.");
      selectedDot = null;
      drawBoard();
      return;
    }
    clearBoardInput();
    act({ type: "edge", key });
  }
  canvas.onpointerdown = (e) => {
    if (!canPlay() || e.isPrimary === false || e.button > 0) return;
    e.preventDefault();
    const p = point(e);
    canvas.setPointerCapture?.(e.pointerId);
    if (game.kind === "pen") {
      const pen = game.pens[game.turn];
      if (Math.hypot(p.x - pen.x, p.y - pen.y) > 45)
        return toast("Start on your highlighted pen, then pull back.");
      drag = {
        start: { x: pen.x, y: pen.y },
        end: p,
        pointerId: e.pointerId,
        actor: G.actor(game),
      };
      drawBoard();
    } else {
      const dot = I.dotAt(game.size, p, dotRadius());
      dotGesture = {
        pointerId: e.pointerId,
        actor: G.actor(game),
        dot,
        previous: selectedDot,
        edge: dot ? null : I.edgeAt(game.size, p),
      };
      if (dot) selectedDot = dot;
      hoverEdge = dotGesture.edge;
      drawBoard();
    }
  };
  canvas.onpointermove = (e) => {
    if (!canPlay()) return;
    const p = point(e);
    if (drag && drag.pointerId === e.pointerId) {
      drag.end = p;
      drawBoard();
    }
    if (game.kind === "dots") {
      const target = I.dotAt(game.size, p, dotRadius());
      hoverEdge = dotGesture?.dot
        ? I.edgeBetween(dotGesture.dot, target)
        : I.edgeAt(game.size, p);
      drawBoard();
    }
  };
  canvas.onpointerup = (e) => {
    const p = point(e);
    if (drag && drag.pointerId === e.pointerId) {
      const d = drag;
      clearBoardInput();
      if (!canPlay() || d.actor !== G.actor(game)) return drawBoard();
      act({ type: "flick", dx: d.start.x - p.x, dy: d.start.y - p.y });
      return;
    }
    if (!dotGesture || dotGesture.pointerId !== e.pointerId) return;
    const gesture = dotGesture;
    dotGesture = null;
    hoverEdge = null;
    if (!canPlay() || gesture.actor !== G.actor(game)) {
      clearBoardInput();
      return drawBoard();
    }
    const target = I.dotAt(game.size, p, dotRadius());
    if (gesture.dot) {
      const moved = I.edgeBetween(gesture.dot, target);
      const tapped =
        target && target.x === gesture.dot.x && target.y === gesture.dot.y;
      const key =
        moved || (tapped ? I.edgeBetween(gesture.previous, target) : null);
      if (key) return drawEdge(key);
      if (target) selectedDot = target;
      if (
        gesture.previous &&
        tapped &&
        !key &&
        (gesture.previous.x !== target.x || gesture.previous.y !== target.y)
      )
        toast("Choose a neighboring dot in the same row or column.");
      drawBoard();
      return;
    }
    if (gesture.edge && gesture.edge === I.edgeAt(game.size, p))
      drawEdge(gesture.edge);
    else drawBoard();
  };
  canvas.onpointercancel = () => {
    clearBoardInput();
    drawBoard();
  };
  canvas.onlostpointercapture = () => {
    if (drag || dotGesture) {
      clearBoardInput();
      drawBoard();
    }
  };
  canvas.onpointerleave = () => {
    if (!drag && !dotGesture) {
      hoverEdge = null;
      drawBoard();
    }
  };
  canvas.onkeydown = (e) => {
    if (game.kind !== "dots" || !canPlay()) return;
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (e.key === "Escape") {
      selectedDot = null;
      drawBoard();
      return;
    }
    if (!directions[e.key]) return;
    e.preventDefault();
    const from = selectedDot || { x: 0, y: 0 },
      [dx, dy] = directions[e.key],
      to = {
        x: G.clamp(from.x + dx, 0, game.size - 1),
        y: G.clamp(from.y + dy, 0, game.size - 1),
      };
    if (e.shiftKey) {
      drawEdge(I.edgeBetween(from, to));
    } else {
      selectedDot = to;
      drawBoard();
    }
  };
}
function shotPercent(dx, dy) {
  const pull = G.penPower(dx, dy);
  return pull >= 140 ? 100 : Math.min(99, Math.round((pull / 140) * 100));
}
function powerMeterHTML() {
  return `<section class="power-panel" aria-label="Pen Rocket power"><div class="power-heading"><span>ROCKET POWER</span><strong id="power-value">0%</strong></div><div id="power-meter" class="power-track" role="meter" aria-label="Flick power" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="Pull back to charge"><span id="power-fill" class="power-fill"></span><span class="power-ticks" aria-hidden="true"></span></div><div class="power-scale" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div><div class="power-details"><span id="power-label">Pull back to charge</span><span id="last-shot">${lastPenShot ? `${esc(lastPenShot.name)} fired ${lastPenShot.percent}%` : "More power. Longer slide."}</span></div></section>`;
}
function updatePowerMeter() {
  const meter = $("#power-meter");
  if (!meter) return;
  const pull = drag
    ? G.penPower(drag.start.x - drag.end.x, drag.start.y - drag.end.y)
    : 0;
  const percent = shotPercent(pull, 0);
  const level =
    percent === 100
      ? "max"
      : percent >= 75
        ? "high"
        : percent >= 40
          ? "medium"
          : percent > 0
            ? "low"
            : "idle";
  const label =
    game?.phase === "finished"
      ? "Match finished"
      : paused
        ? "Paused"
        : !drag
          ? isBot(G.actor(game))
            ? "Bot lining up a shot"
            : "Pull back to charge"
          : percent === 0
            ? "Pull back a little farther"
            : percent === 100
              ? "MAX POWER · release to fire"
              : percent >= 75
                ? "Heavy shot · release to fire"
                : percent >= 40
                  ? "Strong shot · release to fire"
                  : "Light shot · release to fire";
  meter.dataset.level = level;
  meter.setAttribute("aria-valuenow", String(percent));
  meter.setAttribute("aria-valuetext", `${percent}% · ${label}`);
  $("#power-value").textContent = `${percent}%`;
  $("#power-fill").style.width = `${percent}%`;
  $("#power-label").textContent = label;
}
function drawBoard() {
  const canvas = $("#board");
  if (!canvas || !game) return;
  updatePowerMeter();
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, 600, 600);
  c.fillStyle = "#fffcf1";
  c.fillRect(0, 0, 600, 600);
  c.lineCap = "round";
  c.lineJoin = "round";
  function line(a, b, color, width = 2) {
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
  if (game.kind === "pen") {
    for (let y = 30; y < 600; y += 30)
      line({ x: 0, y }, { x: 600, y }, "#c5d3d580", 1);
    line({ x: 50, y: 0 }, { x: 50, y: 600 }, "#c97c7180", 1);
    const m = game.margin;
    c.fillStyle = "#bd624011";
    c.fillRect(0, 0, 600, m);
    c.fillRect(0, 600 - m, 600, m);
    c.fillRect(0, m, m, 600 - 2 * m);
    c.fillRect(600 - m, m, m, 600 - 2 * m);
    c.strokeStyle = "#b85b4b";
    c.lineWidth = 2;
    c.setLineDash([7, 6]);
    c.strokeRect(m, m, 600 - 2 * m, 600 - 2 * m);
    c.setLineDash([]);
    for (const h of game.hazards) {
      if (h.used) continue;
      c.beginPath();
      c.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      c.strokeStyle =
        h.kind === "coffee"
          ? "#b18d6655"
          : h.kind === "portal"
            ? "#8e847e"
            : "#d9dbc9";
      c.lineWidth = h.kind === "coffee" ? 8 : 2;
      c.stroke();
      c.fillStyle = h.kind === "shield" ? "#fff" : "#736d5b";
      c.font = "21px serif";
      c.textAlign = "center";
      c.fillText(
        h.kind === "shield" ? "◇" : h.kind === "portal" ? "◌" : "",
        h.x,
        h.y + 7,
      );
    }
    for (const [i, p] of game.pens.entries()) {
      c.globalAlpha = p.alive ? 1 : 0.12;
      for (const seg of p.segments)
        line(
          seg.a,
          seg.b,
          game.players[i].color,
          p.type === "fountain" ? 4 : 2.5,
        );
      c.save();
      c.translate(p.x, p.y);
      if (p.alive && i === game.turn) {
        c.beginPath();
        c.arc(0, 0, 24, 0, Math.PI * 2);
        c.fillStyle = game.players[i].color + "18";
        c.fill();
      }
      c.fillStyle = game.players[i].color;
      c.fillRect(-5, -25, 10, 22);
      c.beginPath();
      c.moveTo(-5, -3);
      c.lineTo(5, -3);
      c.lineTo(0, 7);
      c.closePath();
      c.fill();
      if (p.shield) {
        c.strokeStyle = "#c5a64c";
        c.lineWidth = 2;
        c.strokeRect(-12, -31, 24, 45);
      }
      c.font = "12px sans-serif";
      c.textAlign = "center";
      c.fillText(game.players[i].name.slice(0, 15), 0, 23);
      c.restore();
      c.globalAlpha = 1;
    }
    if (drag) {
      const dx = drag.start.x - drag.end.x,
        dy = drag.start.y - drag.end.y,
        power = Math.hypot(dx, dy);
      if (power >= 4) {
        const preview = JSON.parse(JSON.stringify(game));
        const path = G.flick(preview, G.actor(preview), dx, dy);
        c.setLineDash([5, 5]);
        for (const seg of path) line(seg.a, seg.b, "#425d4b", 2);
        c.setLineDash([]);
      }
      line(drag.start, drag.end, "#c09d68", 2);
    }
  } else {
    const n = game.size,
      step = 460 / (n - 1);
    for (let y = 0; y < 600; y += 20)
      line({ x: 0, y }, { x: 600, y }, "#c9d6cf55", 0.8);
    for (let x = 0; x < 600; x += 20)
      line({ x, y: 0 }, { x, y: 600 }, "#c9d6cf55", 0.8);
    for (let y = 0; y < n - 1; y++)
      for (let x = 0; x < n - 1; x++) {
        const k = y * (n - 1) + x,
          owner = game.boxes[k],
          px = 70 + x * step,
          py = 70 + y * step;
        c.textAlign = "center";
        if (owner !== undefined) {
          c.fillStyle = G.COLORS[+owner] + "22";
          c.fillRect(px + 5, py + 5, step - 10, step - 10);
          c.fillStyle = G.COLORS[+owner];
          c.font = `${step * 0.5}px Caveat,cursive`;
          c.fillText(
            game.players[+owner].name[0].toUpperCase(),
            px + step / 2,
            py + step * 0.65,
          );
        } else if (k === game.star || (k === game.bomb && !game.bombUsed)) {
          c.fillStyle = k === game.star ? "#bfa04b" : "#b17960";
          c.font = "26px serif";
          c.fillText(
            k === game.star ? "★" : "✳",
            px + step / 2,
            py + step / 2 + 9,
          );
        }
      }
    for (const key of G.allEdges(game)) {
      const [d, x, y] = key.split(":"),
        a = { x: 70 + +x * step, y: 70 + +y * step },
        b = {
          x: a.x + (d === "h" ? step : 0),
          y: a.y + (d === "v" ? step : 0),
        };
      line(
        a,
        b,
        game.edges[key] !== undefined
          ? G.COLORS[+game.edges[key]]
          : key === hoverEdge
            ? G.COLORS[game.turn] + "99"
            : "#c7d1c3",
        game.edges[key] !== undefined || key === hoverEdge ? 5 : 2,
      );
    }
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        c.beginPath();
        c.arc(70 + x * step, 70 + y * step, 5, 0, Math.PI * 2);
        c.fillStyle =
          selectedDot?.x === x && selectedDot?.y === y
            ? G.COLORS[game.turn]
            : "#52665a";
        c.fill();
        if (selectedDot?.x === x && selectedDot?.y === y) {
          c.beginPath();
          c.arc(70 + x * step, 70 + y * step, 14, 0, Math.PI * 2);
          c.strokeStyle = G.COLORS[game.turn];
          c.lineWidth = 3;
          c.stroke();
        }
      }
  }
}
setInterval(() => {
  syncClockPause();
  if (
    screen !== "play" ||
    !game ||
    !["playing", "reveal", "guess"].includes(game.phase)
  )
    return;
  const remaining = Number.isFinite(deadline)
    ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    : null;
  if ($("#timer"))
    $("#timer").textContent =
      game.phase === "reveal"
        ? "Keep your chit secret."
        : clockPausedAt !== null
          ? "Paused"
          : remaining === null
            ? "Relaxed · no automatic moves"
            : `${remaining}s · ${game.kind === "rmcs" ? "Find the Chor" : game.kind === "dots" ? "Blitz: timeout draws a line" : "Take your shot"}`;
  if ($("#board-timer") && $("#timer"))
    $("#board-timer").textContent = $("#timer").textContent;
  if (online || clockPausedAt !== null) return;
  const id = G.actor(game);
  if ((isBot(id) && Date.now() >= botAt) || Date.now() >= deadline) {
    if (!isBot(id)) toast("Time is up — a legal move was played for you.");
    act(G.botAction(game), id);
  }
}, 100);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearBoardInput();
    if (curtainOpen && privateContext) {
      $("#secret").classList.add("hidden");
      $("#reveal-chit").classList.remove("hidden");
      $("#hide-chit").classList.add("hidden");
    }
    if (!online && game && game.phase !== "finished") pauseGame();
  }
  syncClockPause();
});
$("#resume-game").onclick = resumeGame;
$("#quit-game").onclick = () => {
  if (escrow && !escrow.settled) {
    G.settle(wallets, escrow, []);
    profile.coins = wallets["0"];
    save();
  }
  closeCurtain();
  home();
};
$("#home-link").onclick = (e) => {
  e.preventDefault();
  if (game && game.phase !== "finished")
    return toast("Finish your game or use Back to the desk.");
  if (room) return lobby();
  home();
};
$("#sound").onclick = () => {
  sound = !sound;
  $("#sound").textContent = sound ? "♫" : "♪";
  toast(sound ? "Sound on." : "Sound off.");
};
home();
const invite = new URLSearchParams(location.search).get("room");
if (invite && !LOCAL_ONLY) {
  setup("pen", true);
  $("#code").value = invite.slice(0, 4).toUpperCase();
}
