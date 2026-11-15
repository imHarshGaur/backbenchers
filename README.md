# BACKBENCHER

**Last bench. First place.** A 2–6 player party-game starter built around Indian school-desk nostalgia: Pen Rocket, Chaukadi Blitz (Dots & Boxes), and Raja Mantri Chor Sipahi.

This repository contains a playable browser edition, an authoritative WebSocket room server, a Unity 6 C# project, and a single-file offline build. It is milestone **0.1**, a development foundation—not a production release or a signed Android APK.

## Play now

Download [`dist/backbencher.html`](dist/backbencher.html), then open it in a browser. All three offline games work without a server or installation. Use touch or a mouse; choose bots or pass-and-play. The standalone file has no required network assets.

For online rooms and the development UI:

```sh
npm ci
npm start
# Open http://localhost:3000
```

Friends on the same network can open `http://YOUR_LAN_IP:3000`. Create a room, share its four-character code, ready up, add bots if desired, and start. A shared internet deployment requires a Node host, HTTPS/WSS, and a reverse proxy supporting WebSockets. No service has been deployed by this commit.

## Unity / Android

1. Install **Unity 6000.0.62f1** with **Android Build Support**, SDK, NDK, and OpenJDK.
2. Add the `unity/` folder in Unity Hub. Let the URP and Newtonsoft packages resolve.
3. Run **Backbencher → Create playable scene**, then press **Play**. The command creates the scene, a URP 2D renderer and pipeline, and Android application settings.
4. Run **Backbencher → Build Android development APK** to produce `unity/Builds/Backbencher-dev.apk`.
5. For Unity online rooms, enter the running server's WebSocket URL. On an emulator use `ws://10.0.2.2:3000/ws`; on a phone use the computer's LAN address. For remote service use `wss://…/ws`.

The native prototype uses a programmatic IMGUI presentation so its controllers are immediately exercisable without authored scenes or paid assets. The polished notebook UI is in the web build. Unity editor/package import, touch on real Android hardware, IL2CPP, signing, and APK installation still need validation. A production Android build should use HTTPS/WSS and your own application identifier and signing configuration.

## What works

- **Pen Rocket:** drag-to-flick, permanent ink segments, inclusive line intersection, life elimination, three pen classes, shrinking margins, coffee deflection, teleport holes, and one-hit whitener shields.
- **Chaukadi Blitz:** 4×4 or 6×6 dot boards, extra turns, six-second auto-moves, double-value stars, and a one-use bomb that clears neighboring unclaimed edges.
- **RMCS:** four, five, or six players, privacy curtains, five/seven-round scoring offline, fifteen-second Mantri guesses, a once-per-match Chor swap, and ±50-point Chalk Bets. Online rooms currently use five rounds.
- **Rooms:** four-character codes, ready checks, host start, bot backfill, turn validation, monotonic state versions, private role projections, session resume, and disconnected-player bot turns.
- **Play economy:** entry escrow, conserved payouts, draw refunds, double-stake rematches, daily local reward, unlockable pen classes, and local win streaks. All coins are free play money with no purchase or redemption system.

## Architecture and contract

- [Architecture, folder structure, and state machines](docs/ARCHITECTURE.md)
- [Network messages and example JSON models](docs/PROTOCOL.md)
- [Machine-readable JSON Schema](docs/network.schema.json)
- [Rules decisions and acceptance criteria](docs/RULES.md)
- [Validation and release limitations](docs/STATUS.md)
- [Original project brief](docs/BRIEF.txt)

## Checks

```sh
npm test                                      # JS rules and live WebSocket integration
npm run build                                 # regenerate the checked-in single-file build
npm start                                     # keep running in another terminal
npm run test:browser                           # browser game flows, mobile, online room
# If Chromium is not at /usr/bin/chromium:
npx playwright install chromium
CHROMIUM_PATH="$(node -e "process.stdout.write(require('playwright').chromium.executablePath())")" npm run test:browser

dotnet run --project tests/dotnet/Rules.csproj  # pure C# rules; no Unity license needed
```

GitHub Actions runs the rules, C# checks, browser smoke suite, and a reproducible-build check. C# rule tests are independent of Unity and do not replace a Unity/Android build.

## Operational boundaries

Room state, room coins, and reconnect sessions live in one Node process and disappear on restart. Offline coins live on the device and can be edited by its owner. These are deliberate prototype choices; durable identity, transactional persistence, anti-abuse controls, deployment, observability, asset production, and device QA are the next release work. Online opponents' hidden chits are never sent to other clients; transport encryption is provided by WSS, not by embedding a decryption key in the app.
