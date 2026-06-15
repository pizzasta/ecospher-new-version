# Echosphere Rhythm App

Echosphere is a Vite + React audio-first prototype for recording short signals, replaying saved echoes, and exploring generated rhythm/sound previews.

## People-Ready Notes

- Real user recordings are captured with MediaRecorder and stored through Supabase when the app is configured.
- Demo listening rooms, relics, archives, and ambient previews use generated Web Audio tones unless a saved audio URL exists.
- The app needs a browser with microphone, MediaRecorder, and Web Audio support for the full experience.
- Supabase credentials and bucket names are configured through the VITE_SUPABASE_* variables in .env.example.

## Local Development

```sh
npm install
npm run dev
```

## Verification

```sh
npm run build
npm run lint
```
