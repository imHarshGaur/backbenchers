# Gameplay repair audit

The reported primary failure was Dots & Boxes refusing a line drawn within the six-second turn. The original board handler only considered a small circle around an edge's midpoint on pointer-down; dragging from dot to dot never submitted an edge. The six-second timeout then drew a bot move, making it appear that the game controlled the player's turn.

| Game / flow | Defect | Repair and regression coverage |
|---|---|---|
| Dots input | Dot-to-dot dragging did nothing; off-center taps missed | Recognize adjacent-dot drags, two dot taps, and the full edge. Test at 600px and 300px board scales. |
| Dots timing | Every local match silently used six-second auto-moves | Default web local matches to Relaxed; Timed is an explicit setting. A 120-second idle human turn makes no move in Relaxed. A valid drag at five seconds succeeds in Blitz and resets the next turn's deadline. |
| Dots completion | Existing smoke checks only drew one midpoint edge | Exercise all four edges, gold score and bonus turn, a full 6x6 match, payout and double-stakes rematch through UI controls. |
| Board input | A gesture could survive a timeout/cancel and apply to the next seat | Bind pending gestures to pointer and actor; clear input on turns, snapshots, cancellation, rematch, pause, and backgrounding. |
| Pen release | Flick used the last move event, not the actual release coordinate | Use release position. Test a release without an intermediate move, a short pull, a second pointer, cancelled input and timeout. |
| Pen aiming | Preview was a fixed straight line unrelated to class power or hazards | Calculate the displayed preview using the actual rules on a disposable clone; verify it cannot alter health, position, hazards or turn count. |
| RMCS bluff | Adding bet markup replaced the already-bound swap button | Insert markup without destroying listeners; activate the actual swap button while bet controls are present. |
| RMCS turn ownership | Local players could accuse on behalf of a bot Mantri | Disable accusation cards on bot turns; label the actor clearly. |
| RMCS pacing | A bot guessed before the human could open their private bluff | Allow an eight-second interrogation window before a bot guess; pause local timing while the private chooser/chit is open. |
| RMCS scoring | Negative side-bet scores rendered as `+-50` | Render signed point deltas correctly; verify the score is applied once. |
| Shared timing | Background tabs/private screens consumed time inconsistently | Freeze clocks by elapsed wall time, add Pause/Resume, and require an explicit local quit before refund. |
| Setup | Editing the roster erased typed names | Preserve entered names as player/bot counts change. |
| Packaging | Partial Google Fonts URL corrupted `:root` styles | Strip the complete import line and validate both generated stylesheets plus launch-button colors. |

## Verification

- 59 local Node tests pass, including animation timing, growing ink, portal gaps, landing/input locks, pause/resume, bot pacing, reduced motion, match settlement, and barrel grabs alongside existing per-game, packaging, rules, schema and socket checks.
- UI checks load the exact generated `dist/index.html`; they run its scripts and handlers in JSDOM. Canvas painting is stubbed, so these establish state transitions and input geometry, not visual quality or physical-device event delivery.
- Chromium CI checks cover actual pointer delivery, the hosted bundle at phone width, box completion, pen release, chit swap, and launch colors. The managed workspace did not expose its supported desktop tool, so no new local browser playthrough is claimed.
- Pure C# rules were unchanged. Unity's development UI was not reworked or retested in the editor during this web gameplay repair.
- The online service retains authoritative timed play. The private hosted Site remains a bots/pass-and-play edition; it does not host the Node WebSocket server.
