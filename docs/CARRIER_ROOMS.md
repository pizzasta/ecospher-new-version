# Carrier Rooms

One frequency, one carrier at a time. The whole anti-chaos model is *physics*:
only one signal holds the frequency cleanly, so turn-taking is the medium, not a
moderation chore. Anonymous sigils + colors only — no names, no faces, no
counts on faces. Rooms are ephemeral: when the carriers go quiet, the frequency
fades.

This documents the architecture and the exact two-device test to validate the
live turn-state before relying on it.

## Architecture (three layers)

```
CarrierRoom.tsx ──renders──┐
                           │  local sim turn engine (deterministic rotation)
                           │  + live presence + live reactions
carrierRoomLive.ts ────────┤  transport: Supabase Realtime (presence + broadcast)
                           │  keeper = single authority
carrierTurnState.ts ───────┘  pure reducer: the shared room state
```

### 1. `src/lib/carrierTurnState.ts` — the authority (pure)
A pure reducer for the shared state:

```ts
RoomState { mode, hushed, carrier, second, queue }
reduceRoom(state, action)  // request | grant | yield | leave | advance | clear | hush | mode
```

There is **no server arbiter**. The **keeper** (room creator) holds this state,
applies every participant's action through the reducer, and broadcasts the
result. This keeps turn-state authoritative and consistent without a backend
function. It's exhaustively unit-tested (`carrierTurnState.test.ts`).

### 2. `src/lib/carrierRoomLive.ts` — the transport (config-guarded)
`joinCarrierRoom(roomId, me, handlers)` opens a Supabase Realtime channel
`carrier_<roomId>` using **presence + broadcast only** — no DB rows, nothing
identifying on the wire (presence keys are random `p_xxxxxxxx`).

- **Presence** → the live participant list (`onPeers`). Each peer carries only
  `{ sigil, color }`.
- **Broadcast `action`** → a client's intent; the **keeper** applies it via
  `reduceRoom` and re-broadcasts state.
- **Broadcast `state`** → the keeper's authoritative `RoomState`; clients render it.
- **Broadcast `reaction`** → ephemeral `∿ / ◌` pulses.

With no backend (`isSupabaseConfigured === false`) it returns `null` and the
room runs entirely on its local engine.

### 3. `src/components/CarrierRoom.tsx` — the room
Renders the three-zone layout (carrier / queue / drift), the keeper panel (flow
selector + clear/hush), and the participant controls. Today it drives the
*visible* turn engine from a deterministic local simulation, and layers the live
channel on top for **real presence** ("live · N", green-dotted sigils) and
**real reactions**. The reducer + transport are wired and ready to take over the
turn-state the moment there are real peers (see "Switching to live turn-state").

## Flow modes (keeper picks)

| Mode | Behavior |
|---|---|
| **queue** | request → line → auto hand-off when the carrier passes |
| **round-robin** | the carrier auto-comes to everyone in turn (a "you" slot sits in the ring) |
| **keeper-led** | request raises your signal; you go live only when the keeper **grants** it |
| **open drift** | up to **two** carriers at once; join as the second without queueing |
| **listen-only** | no live carrier, just the ambient band |

## Mute & turn rules

- **Listener floor** — you arrive muted, always; you must hold the carrier to be heard.
- **Self-mute** — one tap, always available while holding.
- **Drift auto-mute** — background the tab and your signal drops to static; you leave the line.
- **Time cap** — your turn caps at `YOUR_CAP_MS` (90s) with a draining ring, then yields.
- **Dead air** — sim carriers rotate on `HOLD_MS` (24s); a real impl would yield on prolonged silence.
- **Keeper: clear the frequency** — drops the current carrier(s), promotes the queue.
- **Keeper: hush all** — returns the room to the ambient bed.
- The keeper can never *un*-mute anyone — consent only flows one way.

## Privacy / anonymity

- Presence + broadcast only; **no database rows** for turn-state, so nothing
  persists and nothing is attributable.
- On the wire: random presence key + `{ sigil, color }` and the room's turn-state
  (which references only those keys). No user id, name, email, or audio metadata.
- Ephemeral by design: the channel is the room; when everyone leaves, it's gone.

## Enabling the live layer

No migration is required — presence + broadcast need only that the project has
**Realtime enabled** (on by default) and the app is configured with
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Anonymous sign-in (already used
elsewhere) is enough to open a channel.

## Two-device validation test

Use two browsers / a normal + incognito window — call them **A** (opens the
room first, so A is the keeper) and **B**.

1. **Presence** — A opens Rooms → "98.1 · quiet hours". B opens the same room.
   - [ ] Both headers show **live · 2**; each sees the other's sigil with a green
         dot in the "drifting here" row.
2. **Reactions (live)** — A taps `∿ resonate`.
   - [ ] B sees a reaction pulse appear within ~1s (and vice-versa).
3. **Leave** — B closes the tab.
   - [ ] A's count drops back to **live · 1** within a few seconds (presence sync).
4. **(After the live turn-state swap — see below)** — B taps "request the carrier".
   - [ ] B enters A's broadcast queue; when the carrier passes, B becomes the
         carrier on **both** screens.
   - [ ] A (keeper) taps "clear the frequency" → the carrier drops on both screens.
   - [ ] A taps "hush all" → both screens show the hushed/ambient state.

Steps 1–3 validate the shipped scaffolding (presence + reactions). Step 4
validates full turn-state once it's switched on.

## Switching to live turn-state (next build)

The reducer + transport already carry everything; the remaining change is in
`CarrierRoom.tsx`:

1. Keep a `RoomState` from `onState` (clients) or from the keeper's local
   reducer (the transport already maintains `keeperState`).
2. Derive the carrier/queue/drift **from that `RoomState`** instead of the local
   simulation when a session exists.
3. Route the existing controls (`request`, `yield`, `grant`, `clear`, `hush`,
   `mode`) through `session.send({ type, key })` instead of local `setState`.
4. Fall back to the local sim when `session === null` (no backend).

This is intentionally deferred because it can only be verified with two real
peers on a live Supabase — which the build environment can't reach.

## Real audio (future)

Presence/broadcast handles *turn-state*; actual voice needs a media transport
(WebRTC SFU, or LiveKit / Daily / Agora). When added, the carrier's mic streams
to listeners while the same turn-state decides **who** may stream, and the
existing screen-before-public moderation (see `docs/GROUP_ROOMS.md`) gates it.
