# Compliance & launch notes

Not legal advice — a startup-realistic checklist. Have counsel skim it before
launch. Ecosphere is an **anonymous voice / user-generated-content app** (not a
wellness, health, or therapy product — don't position it as one). Its privacy
posture (anonymous, local-first, no sale, automated moderation, hard 18+ gate,
built-in deletion) does most of the heavy lifting; this captures the remaining
gaps and the wording to keep marketing + app-store listings safe.

## Audit summary

**Privacy strengths (already true in the product)**
- Anonymous by design; no name/photo/DOB/phone/location; no user search.
- Local-first storage; backend rows are RLS-scoped to the owner.
- No ads, no data sale/sharing, no third-party trackers/analytics SDKs.
- Voice is content, not biometric — no voiceprints, no voice ID.
- Real deletion: Settings → Erase Cloud Data + Clear Local Data.

**Gaps closed in this pass**
- "We don't profile you" section (no analysis/scoring/profiling of voice or content) + state privacy rights (CCPA/CPRA + other state laws): access/delete/opt-out, non-discrimination.
- Voice/biometric clarification (no voiceprints, no voice ID).
- "Not a crisis service" disclaimer in Terms + on the age gate, with crisis lines.
- Child-safety/CSAE stance + reporting path (NCMEC) — required for UGC apps in both app stores.
- Contact emails + governing-law placeholder.

> Note: even though this isn't a health app, people may talk about feelings on
> it, which can brush "consumer health data" laws (e.g., WA My Health My Data
> Act). The protection that matters is behavioral and already true: we don't
> analyze, profile, or sell content — so don't market it as wellness/therapy and
> don't add anything that infers mood/health.

**Still on you before launch (operational)**
- Point `privacy@`, `safety@`, `hello@ecosphere.app` (or your domain) at real monitored inboxes.
- Set `[your state]` as governing law in Terms.
- Confirm jurisdictions you'll serve (EU/UK adds GDPR/UK-GDPR duties; the current draft assumes U.S.-only).
- Fill Apple App Privacy + Google Data Safety to match the answers below.
- Keep `setup-all.sql` deletion behavior in sync with the policy text.

## Launch risks (ranked)

1. **Unscreened real voice to strangers** — already gated: group voice is private until the `moderate-audio` STT screen promotes it. Don't enable real group voice without it (see `docs/GROUP_ROOMS.md`).
2. **Crisis/self-harm content** — you are not a crisis service and not monitored live. Keep the disclaimer prominent (age gate + Terms + help bot) and keep 988/Samaritans/findahelpline surfaced.
3. **Don't drift into "wellness/therapy" positioning** — it's anonymous voice; do not imply treatment, healing, or clinical benefit (see marketing rules). Mispositioning is both a legal and an app-store-rejection risk.
4. **Minors** — hard 18+ gate is in; keep CSAE reporting reachable.

## App-store data-safety answers (Apple App Privacy / Google Data Safety)

| Data type | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Audio (voice recordings) | Yes, optional (user-initiated) | No (anonymous id only) | No | App functionality |
| User content (signals, reactions) | Yes | No | No | App functionality |
| Identifiers (anon account id) | Yes | — | No | App functionality / account |
| Email (only if Google sign-in) | Optional | Account only, never public | No | Account auth |
| Approx/precise location | No | — | — | — |
| Contacts | No | — | — | — |
| Usage/analytics, ads data | No | — | — | — |

- **Data sold/shared:** No. **Third-party SDKs:** None for ads/analytics.
- **Account deletion method:** in-app (Settings) — required by Apple; link it in the listing.
- **UGC apps (both stores):** include a content-moderation method, a report/block path, and a published CSAE stance — all present.

## Safe onboarding language (do / don't)

- ✅ "a space for expression and peer connection"
- ✅ "leave a signal, hear what others left"
- ✅ "not therapy, medical care, or a crisis service"
- ❌ "feel better," "heal," "reduce anxiety/depression," "therapy," "treatment," "safe space" (implies a guarantee)
- Keep the crisis line one tap away; never imply monitoring or rescue.

## Safe marketing language (do / don't)

- ✅ atmospheric/expressive framing: "anonymous late-night voices," "the unsent, the half-asleep," "somewhere out there, someone's still awake."
- ✅ outcome-neutral: "a place to be heard," "drift, listen, let go."
- ❌ health claims: "clinically proven," "improves mental health," "therapeutic," "reduces stress," "mental wellness solution."
- ❌ absolute safety/privacy guarantees: "100% anonymous," "completely safe," "your data is never at risk." Use "anonymous by design," "we store the minimum," "no ads, no data sale."
- ❌ don't position as wellness, therapy, or mental-health support at all — it's an anonymous voice app. Lead with voice + anonymity, not feelings-as-a-feature.

## App-store listing wording (safe template)

> Ecosphere is an anonymous, audio-first social space. Leave a ten-second voice
> signal, drift through what strangers left, and let it go. No names, no
> followers, no likes. For adults 18+. Ecosphere is not a crisis service.
