# WebSocket protocol v0.1

HTTP serves `/`, `/core.js`, `/app.js`, `/style.css`, `/play.html`, and `/health`. WebSockets connect to `/ws`. Use `wss://` behind your HTTPS reverse proxy in a remote deployment. Browser upgrades must have a matching host origin, or match `ALLOWED_ORIGIN` exactly when configured. Native clients may omit Origin.

## Session and room commands

```json
{"type":"hello","token":null}
```

The server replies with a cryptographically random bearer token. Store this privately and send it in the next `hello` to resume a seat. Browser storage is per tab; Unity stores it in PlayerPrefs. It is not an account or an encrypted secure-device credential.

```json
{"type":"session","token":"opaque-48-character-hex-bearer-token"}
```

The remaining examples are independent valid command shapes:

```json
{"type":"create","kind":"pen","name":"Asha","stake":50,"penClass":"ballpoint"}
```
```json
{"type":"join","code":"AB7K","name":"Kabir","penClass":"gel"}
```
```json
{"type":"ready","ready":true}
```
```json
{"type":"bots","count":4}
```
```json
{"type":"start","double":false}
```
```json
{"type":"next"}
```
```json
{"type":"leave"}
```

`bots.count` is a target total seat count, not a number to add. `start`, `bots`, and `next` are host-only. All seats must be ready to start or rematch. `next` is allowed only at an RMCS round result. `leave` is available in the lobby or after a completed match. A disconnect during a match invokes the bot policy; reconnect with the same token to reclaim control.

## Intent commands

The actor ID is bound to the session, never accepted from the client. `version` must equal the latest room version. A client does not submit its calculated score, role assignment, wallet, grid, or trajectory.

```json
{"type":"action","version":7,"action":{"type":"flick","dx":45,"dy":-60}}
```
```json
{"type":"action","version":8,"action":{"type":"edge","key":"h:1:2"}}
```
```json
{"type":"action","version":9,"action":{"type":"reveal"}}
```
```json
{"type":"action","version":10,"action":{"type":"guess","target":"3"}}
```
```json
{"type":"action","version":11,"action":{"type":"swap","target":"2"}}
```
```json
{"type":"action","version":12,"action":{"type":"bet","caught":true}}
```

Edge `h:x:y` runs from `(x,y)` to `(x+1,y)`; `v:x:y` runs to `(x,y+1)`. Pen coordinates use a 600×600 logical page. `dx,dy` represent the vector from the pulled-back pointer to the pen tip, not screen pixels or a velocity supplied to Unity physics.

## Room and PlayerState models

```json
{
  "type":"state",
  "you":"0",
  "room":{
    "code":"AB7K","host":"0","kind":"dots","stake":50,
    "version":8,"deadline":1794744006000,
    "players":[
      {"id":"0","name":"Asha","ready":true,"bot":false,"connected":true},
      {"id":"1","name":"Kabir","ready":true,"bot":false,"connected":true}
    ],
    "wallets":{"0":950,"1":950},"pot":100
  },
  "game":{
    "kind":"dots","phase":"playing","turn":0,"size":4,
    "players":[
      {"id":"0","name":"Asha","color":"#205eab","score":0},
      {"id":"1","name":"Kabir","color":"#b8433e","score":0}
    ],
    "edges":{},"boxes":{},"star":0,"bomb":5,"bombUsed":false,
    "winners":[],"last":"Join two dots. Close a box for another turn."
  }
}
```

`deadline` is Unix epoch milliseconds. Lobby snapshots have `game:null` and may omit `deadline`. `version` increments on every room update, including readiness and connectivity. Wallet keys and game player IDs use seat strings `"0"` through `"5"`. Seat IDs remain stable during a match; a lobby departure compacts the roster and updates sessions.

## PenRocketState

This example is the initial two-player board. The schema supports the complete 2–6 player roster on each snapshot.

```json
{
  "kind":"pen","phase":"playing","turn":0,"turns":0,"margin":28,
  "players":[
    {"id":"0","name":"Asha","color":"#205eab","score":0},
    {"id":"1","name":"Kabir","color":"#b8433e","score":0}
  ],
  "pens":[
    {"id":"0","x":300,"y":95,"type":"ballpoint","alive":true,"lives":1,"shield":false,"segments":[{"a":{"x":288,"y":113},"b":{"x":300,"y":95}}]},
    {"id":"1","x":300,"y":505,"type":"gel","alive":true,"lives":1,"shield":false,"segments":[{"a":{"x":288,"y":523},"b":{"x":300,"y":505}}]}
  ],
  "hazards":[
    {"kind":"coffee","x":300,"y":255,"r":38},
    {"kind":"portal","x":155,"y":380,"r":18},
    {"kind":"portal","x":445,"y":200,"r":18},
    {"kind":"shield","x":300,"y":410,"r":18,"used":false}
  ],
  "winners":[],"last":"Pull back from your pen. Release to flick."
}
```

## DotsState

The complete DotsState example appears in the envelope above. `edges` maps edge strings to the drawing seat. `boxes` maps flattened box IDs `y*(size-1)+x` to the owning seat. `star` and `bomb` are box IDs. An already claimed box retains its owner and its four edges through a bomb event.

## RMCSState (recipient-safe)

This is the view for Sipahi, seat `2`, during guessing. Raja and Mantri are public; the Chor and the recipient's role are null in the shared role list. The recipient gets its own role separately.

```json
{
  "kind":"rmcs","phase":"guess","round":1,"rounds":5,
  "players":[
    {"id":"0","name":"Asha","color":"#205eab","score":0},
    {"id":"1","name":"Kabir","color":"#b8433e","score":0},
    {"id":"2","name":"Meera","color":"#338477","score":0},
    {"id":"3","name":"Dev","color":"#a87517","score":0}
  ],
  "roles":["Raja","Mantri",null,null],"myRole":"Sipahi",
  "revealIndex":4,"guess":null,"roundScores":null,"bets":{"2":true},
  "swapUsed":false,"swapped":false,"history":[],"winners":[],
  "last":"Mera Mantri Kaun? Mantri: find the Chor!"
}
```

In `reveal`, every `roles` item is null. In `result` and `finished`, all role strings and score deltas become public. `history` contains only resolved rounds. Before resolution, `bets` includes only the recipient's own bet. The authoritative server keeps the full role list privately; it is never logged or broadcast by this implementation.

## Failures and synchronization

```json
{"type":"error","message":"Board changed; try again."}
```

Invalid intents do not advance the game or version. The client waits for or uses the latest state and retries through an explicit new action; it does not replay a stale state. An active session is replaced when another connection resumes its token. The browser reconnects automatically; Unity exposes a reconnect control. There is no account login, durable recovery after server restart, snapshot delta compression, or offline command queue in this milestone.

See `network.schema.json` for structural JSON definitions. Rule validation enforces cross-field semantics, turn ownership, valid edges, allowed target seats, and affordable stakes in addition to the schema.
