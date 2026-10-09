# Live voice channels (beta)

Real people talking in real time, anonymously, one voice at a time.

## How it works

- **Channels:** three fixed channels in Channels → *Live voice · beta*: after hours, open mic, night shift. Up to 8 people per channel.
- **One mic:** reuses the carrier-room turn reducer. You arrive listen-only, request the mic, and wait in line. The speaker's turn is capped at 45 s.
- **Push-to-talk:** the speaker's mic only sends sound while "hold to talk" is held. The browser asks for mic permission only when you get the mic.
- **Keeper:** whoever has been in the channel longest. The keeper can cut the mic or remove a voice; a removed voice can't request the mic again in that session.
- **Everyone:** can mute any voice for themselves, or report it (logged to `activity_events` as `signal_reported` with `live: true`, and the voice is muted for the reporter).
- **Consent screen:** before the first join it covers the rules: not pre-screened, not recorded, no personal info, 18+, not a crisis service.
- **Transport:** WebRTC audio goes straight between devices, from the speaker to each listener. Signaling and presence use Supabase Realtime (`live_<channel>`), carrying only random session keys. Nothing is stored.
- **Signed messages:** every client makes a fresh P-256 key on join and publishes the public half in presence. Every state, action, audio offer and reaction is signed, and receivers drop anything that doesn't verify against the sender's key. Nobody can speak as the keeper or as anyone else, and a session key claimed twice in presence is not trusted.

## Turning it on

It's off for everyone by default.

- `?livevoice=1` turns it on for that browser (uses Supabase Realtime when configured).
- `?livevoice=local` uses a same-browser test bus, so two tabs can talk without a backend.
- `?livevoice=0` turns it off again.

## Testing with two phones

1. Open the site with `?livevoice=1` on both phones.
2. On both, go to Channels → after hours.
3. On phone A, request the mic, then hold to talk. Phone B should hear it.

## Known limits before a public launch

- **No TURN server.** Calls use public STUN only, so some strict networks (some cellular carriers, corporate Wi-Fi) won't connect. Add a TURN service (for example Twilio Network Traversal or Cloudflare Calls TURN) before launch.
- **Peer-to-peer mesh.** The speaker uploads one stream per listener, which is fine for 8 people. Bigger rooms need an SFU (for example LiveKit).
- **Removal is per session.** Session keys are random, so a removed person can rejoin by reloading. Tie keys to the signed-in account and keep a server-side ban list before launch.
- **Reports have no audio.** Nothing is recorded, so reviewers only see the reason and the channel. Live audio is not screened. Moderation relies on the keeper, mute and report.
