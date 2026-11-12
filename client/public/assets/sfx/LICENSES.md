# Sound Effects Licenses (`client/public/assets/sfx/`)

## Status

External CC0 / Public Domain audio sample downloads are currently **pending** network access approval in this environment.

While no external sample files are bundled here yet:
- `client/src/audio/sfxManifest.ts` defines the full `SfxId` / `SfxAssetEntry` / `SFX_ASSETS` contract with `files: []` baseline entries and tuned `gain`, `rateJitter`, `cooldownMs`, and `loop` defaults.
- `client/src/audio/SoundEngine.ts` uses offline procedural Web Audio synthesis whenever a cue has no local audio files to decode.

## Planned CC0 / Public Domain Sources

When network downloads are approved and local `.ogg`/`.mp3`/`.wav` assets are populated into this directory, each file's exact source URL and license will be recorded in the table below:

| File | Cue (`SfxId`) | Source Pack / Page | License | Source URL |
| :--- | :--- | :--- | :--- | :--- |
| *(pending external download)* | — | Kenney.nl (Interface Sounds, Casino Audio, RPG Audio, Impact Sounds) / Wikimedia Commons / OpenGameArt | CC0 1.0 Universal / Public Domain | — |
