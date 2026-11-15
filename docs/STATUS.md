# Milestone 0.1 status

## Verified in the development workspace

- **25 Node tests passed:** geometry, damage/shields, portal discontinuity, margins, multi-box closure, bomb invariants, bots, role sets, secrecy projections, scoring, bluff restrictions, escrow conservation/replay, wire-schema validation, real WebSocket join/ready/start/action/reconnect, and server-owned deadlines.
- **18 C# checks passed** using .NET 8 against the actual pure rule source in `unity/Assets/Backbencher/Scripts`: intersections, pen elimination, gold/extra turns, bots on every dots roster, role sets, wrong guesses/bets, one-time swaps, and payout conservation/replay.
- **Chromium smoke checks passed:** daily reward cannot be claimed twice on the same local date; pen drag advances turn; dots tap advances turn; all four private chit handoffs; legal Mantri target selection; next round; 390px mobile overflow; standalone bundle gameplay with the browser network disabled; online room creation, bot backfill, ready, and start.
- Desktop and mobile screenshots were visually inspected. Browser validation used automated Chromium; a shared desktop control tool was not available in this session.
- The standalone file is generated from the same web UI and shared rules used by the server, with optional external font loading removed. Direct `file://` navigation was blocked by the managed browser policy; the bundle was tested through `/play.html`, then with networking disabled. A local desktop browser should allow the downloaded file, but that exact file-origin flow was not verified here.

## Not yet verified

- Unity editor import, package resolution, generated scene/pipeline execution, native WebSocket behavior on target devices, Android build, IL2CPP, APK installation, and real-device touch/haptics.
- Unity UI rendering is source-provided and unverified in the Unity editor; only the engine-independent C# rules were compiled/executed here.
- Internet deployment, WSS termination, multiple remote users under poor network conditions, load capacity, long-running soak tests, account migration, or server restart persistence.
- Play Store signing/review, privacy disclosures, and production accessibility/localization.

## Deliberate first-milestone boundaries

- Online rooms and wallets are in-memory. A restart ends them. No paid or redeemable balances exist.
- The reconnect token is a bearer seat credential. There is no identity provider or account recovery.
- Offline profiles are device-local and editable by the device owner. Daily rewards use local date; they are not tamper-proof.
- The Unity screen is an IMGUI development harness. The browser contains the more finished art direction.
- Native Android APK generation is provided as an editor command, but no APK or signing key is included.
- Audio is procedural; production recordings, animated chit physics, trajectory interpolation, desk stickers, and paper themes are not implemented.
- Double-stake rematches work. Automatic round stake multipliers are not implemented.
- Online room settings use five RMCS rounds and no change-of-game control after creation. Create a new room for another game.
- Bots are legal, lightweight opponents. They are not an advanced strategy engine.

## Recommended next milestone

1. Import and play the Unity project; validate or adjust the URP scene setup against the pinned Unity release.
2. Build a development APK and run the three game flows plus network resume on physical Android devices.
3. Replace native IMGUI with the notebook/wood presentation and animate resolved trajectories/chits without altering authoritative results.
4. Add accounts, transactional coin persistence, room recovery, origin/TLS deployment configuration, and operational monitoring.
5. Run adversarial client tests, latency/soak testing, and multiplayer device QA before calling the product production-ready.
