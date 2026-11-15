# Rules decisions

The source brief is preserved in `BRIEF.txt`. These decisions remove ambiguities so the first build can be played and tested.

| Topic | Implemented rule |
|---|---|
| Six-player RMCS | Raja, Mantri, Sipahi, Chor, Daroga, Joker. The six-player list in the brief would total seven if Senapati were also retained. Senapati is used only in five-player matches. |
| Four/six player Dots | 4×4 dots for two players, 6×6 dots for three through six. Thus there are 9 or 25 boxes, not 16/36. |
| Pen cuts | Segment intersection includes endpoints and collinear overlap. Each opponent can be hit at most once per flick. |
| Pen lives | 1 life in two/three-player matches, 2 in four–six-player Royale. Fountain adds one life. Whitener absorbs a cut without consuming a life. |
| Red margin | Starts 28 units from the page edge; moves inward 16 units every third completed flick, capped at 285. Pen tips outside are eliminated immediately. If all are out, refund stakes. |
| Flick space | A 600×600 logical page, sampled in steps no longer than 5 units. Pull power is clamped to 15–140; slide factors are 2.65 ballpoint, 3.2 gel, 1.85 fountain. Gel curves 0.0025 radians per step. |
| Hazards | Coffee turns the trajectory 90 degrees at most once per flick. Portal travel creates no connecting ink segment. Whitener is a single-use board pickup. |
| Bomb | One marked bomb box per board. Claiming it clears neighboring unclaimed edges, while preserving every boundary needed by already-owned boxes. Bomb fires once. |
| Golden star | One randomly marked box gives 2 points instead of 1. Total score is 10 on a 4×4 grid or 26 on 6×6. |
| Side bets | Once per round per player, ±50 **score points** on catch/escape. They do not debit the coin wallet; this keeps the entry pot conserved and separate from round scoring. |
| Chit swap | A single swap per match, available to the current Chor. Can target any unrevealed role except Raja/Mantri. The swap is announced, but its two identities are not. Players can privately recheck their chit. |
| RMCS points | Correct: each role keeps its base points. Wrong: Mantri gets 0 and Chor gets 800; everyone else retains base points. Bets then add/subtract 50. |
| Timers | Dots 6s, Mantri 15s, pen 30s, online chit handoff 30s. Timeout uses a legal bot action. Offline private curtains pause the clock. |
| Coins | Free play currency only. Initial online/guest wallet 1,000; local host starts at 1,000; daily local reward +100. Initial online stake 0–1,000; subsequent doubles cap at 10,000. |
| Pen unlocks | Ballpoint free, gel 200, fountain 300 local coins. Guest players default to ballpoint; online player can select their equipped class. Server does not enforce purchases because these prototype unlocks are local. |
| Draws | Tied winners share integer coins; spare coins go in stable seat order. No-survivor pen outcome refunds all entrants. |
| Escalation | Explicit double-stakes rematches. Automatic within-match stake multipliers are deferred; no wallet balance is silently put at risk. |

## Bot policies

- **Dots:** prioritize completing boxes, favor gold, avoid giving opponents a three-sided box, randomly break ties.
- **Pen:** aim at the midpoint of a nearby opponent's ink trail with the selected class's slide factor. The bot is legal but intentionally simple; it does not optimize future margin survival.
- **RMCS:** privately acknowledge its chit, then choose uniformly among publicly unrevealed candidates when acting as Mantri. It does not choose using the Chor's hidden location.

## First milestone acceptance

- A user can finish each game offline, earn a conserved pot, and rematch.
- Two independent clients can join one room; only the current seat can submit a game move.
- A reconnected session retains its seat.
- Opponents' hidden role assignments never appear in recipient snapshots.
- A dots game completes with legal bots and the expected total score.
- The generated HTML runs its offline gameplay without network access after loading.
- C# pure rules implement and pass corresponding collision, scoring, role, and payout checks.

## Visual and audio treatment

The browser hub uses procedural notebook/wood illustrations, ruled pages, graph paper, folded chit cards, colored ink, and a stationery locker. Sound is synthesized, and supported devices receive short haptic pulses. Authored ASMR recordings, chit rigidbody/shuffle animation, pen motion interpolation, paper themes, stickers, and a polished native Unity presentation remain production-art work. The current game rules resolve a flick immediately; the UI renders its permanent trail and result.
