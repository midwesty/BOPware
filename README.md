# BOPware Deck v0.0.1
## Better Off Published LLC

---

## DIRECTORY STRUCTURE

```
bopware-deck/
├── index.html              ← Main entry point — open this in browser or Electron
│
├── css/
│   └── main.css            ← All styles, themes, animations
│
├── js/
│   ├── audio.js            ← Audio manager (reads from data/audio.json)
│   ├── boot.js             ← Boot sequence controller
│   ├── deck.js             ← Main UI: home screen, taskbar, library, apps
│   ├── notestick.js        ← Sticky note app
│   ├── state.js            ← Global state, settings, localStorage save system
│   ├── themes.js           ← Theme switcher (reads from data/settings.json)
│   └── windows.js          ← App window manager (drag, resize, fullscreen)
│
├── data/
│   ├── apps.json           ← Game manifest — add/edit games here
│   ├── audio.json          ← All audio file paths — edit for new SFX/music
│   ├── boot-messages.json  ← Boot messages, transmissions, lore text
│   ├── notestick-eggs.json ← Easter egg messages for NoteStick app
│   └── settings.json       ← Theme definitions and default settings
│
├── assets/
│   ├── audio/
│   │   ├── sfx/            ← Drop SFX files here (see data/audio.json for names)
│   │   └── music/
│   │       ├── ambient_*.mp3       ← Home screen ambient music
│   │       ├── boot_theme.mp3      ← Boot sequence music
│   │       └── player/             ← BOP Media player tracks
│   │           ├── track_01.mp3
│   │           └── track_02.mp3
│   └── images/
│       ├── thumbs/         ← Game thumbnail images (160x100px recommended)
│       │   ├── spaced.png
│       │   ├── grablab.png
│       │   ├── mutantmusician.png
│       │   ├── gamebuddy.png
│       │   ├── surviveall.png
│       │   └── classified.png
│       ├── icons/          ← System app icons
│       └── album_art/      ← BOP Media album artwork
│
└── apps/
    ├── spaced/
    │   └── index.html      ← Replace with your real game
    ├── grablab/
    │   └── index.html
    ├── mutantmusician/
    │   └── index.html
    ├── gamebuddy/
    │   └── index.html
    └── surviveall/
        └── index.html
```

---

## ADDING A NEW GAME

1. Create a folder in `/apps/yourGameId/`
2. Add your `index.html` (and any other game files) to that folder
3. Open `data/apps.json` and add an entry to the `"games"` array:

```json
{
  "id": "yourGameId",
  "title": "Your Game Title",
  "developer": "BOPware",
  "version": "0.1.0",
  "genre": "Arcade",
  "tags": ["arcade", "action"],
  "description": "Full description shown in info panel.",
  "shortDesc": "Short one-liner",
  "thumbnail": "assets/images/thumbs/yourgame.png",
  "thumbnailPlaceholderColor": "#0a0a1a",
  "path": "apps/yourGameId/index.html",
  "featured": false,
  "isNew": true,
  "dateAdded": "2026-01-01",
  "lastPlayed": null,
  "playCount": 0,
  "unlocked": true,
  "hidden": false,
  "pinned": false,
  "row": 1
}
```

4. Add a 160×100px thumbnail PNG to `assets/images/thumbs/`
5. Done — reload the deck

---

## ADDING AUDIO

All audio is mapped in `data/audio.json`.

**To add SFX:** Drop your MP3 into `assets/audio/sfx/` and make sure the filename matches what's in `audio.json` under `sfx.*.*`

**To add music to BOP Media player:**
1. Drop MP3 into `assets/audio/music/player/`
2. Add an entry to the `music.player.tracks` array in `data/audio.json`

**To add ambient home screen music:**
1. Drop MP3 into `assets/audio/music/`
2. Add to `music.ambient` array in `audio.json`

---

## ADDING BOOT MESSAGES

Edit `data/boot-messages.json`:

- `messages.first_boot` — shown only on very first launch ever
- `messages.post_update` — shown after a firmware version change (set `triggerVersion` to match the new `firmwareVersion` field)
- `messages.random` — pool of randomized messages. Set `weight` (higher = more common)
- `transmissions.deckMessages` — in-game messages delivered to Transmissions app

Set `trigger` on transmissions to:
- `"first_boot"` — delivered on first boot
- `"post_update"` — delivered after update
- `"random"` — 30% chance per boot

---

## GAME ↔ DECK COMMUNICATION

Games run in iframes. They can talk to the deck via `postMessage`:

**Save data from your game:**
```javascript
window.parent.postMessage({
  type: 'SAVE',
  appId: 'yourGameId',
  payload: { level: 3, score: 1500 }
}, '*');
```

**Request save data on load:**
The deck will send a LOAD message when the game opens. Listen for it:
```javascript
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'LOAD') {
    const saveData = e.data.payload;
    // restore your game state
  }
});
```

**localStorage namespace (if games save directly):**
Use: `bopware_app_YOURGAMEID_KEYNAME` to avoid collisions.

---

## KEYBOARD SHORTCUTS

- `` ` `` or `~` — Exit current game / return to deck
- `↑ ↑ ↓ ↓ ← → ← → B A` — Konami code Easter egg

---

## THEMES

Available in Settings. Can be changed at any time:
- **CRT Green** (default)
- **Pip-Boy Amber**
- **Game Boy**
- **Cold Blue**
- **Blood Red**
- **Technicolor**
- **Clean White**

Add more themes by editing `data/settings.json` → `themes` array.

---

## ELECTRON PACKAGING (FUTURE)

This project uses only relative paths and no server dependencies.
To package with Electron:
1. `npm install electron`
2. Create `main.js` pointing to `index.html`
3. `electron .`

No code changes needed.

---

## SAVE SYSTEM NAMESPACING

All saves are in localStorage with prefix `bopware_deck_`:
- `bopware_deck_settings` — user settings
- `bopware_deck_gameData` — per-game play counts, last played
- `bopware_deck_favorites` — favorited game IDs
- `bopware_deck_noteSticks` — saved sticky notes
- `bopware_deck_transmissions` — received messages
- `bopware_deck_bootLog` — boot history
- `bopware_deck_app_{gameId}_{key}` — individual game saves

---

*BOPware Deck v0.0.1 — Better Off Published LLC*
*"Est. Unknown"*
