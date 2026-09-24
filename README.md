# Recipe Book (QVAC)

Save recipes with ingredients and instructions, search them, and cook hands-free: **Cooking mode**
shows one big step at a time, and the app can **read each step aloud** so you don't have to touch the
screen with messy hands.

The voice is generated **on your own computer** using [QVAC](https://github.com/tetherto/qvac), Tether's
open-source AI SDK. No API key, no cloud service, and your recipes never leave your machine.

![screenshot](screenshot.png)

## SDK version

`@qvac/sdk` **0.19.0** (declared in `package.json`)

Functions used: `loadModel` and `textToSpeech`, with the `TTS_MINI_V1_EN_PARLER_TTS_Q8_0` voice model (Parler TTS).

## Install

You need [Node.js](https://nodejs.org) **22.17 or newer** and about 1 GB of free disk space for the voice model.

```bash
git clone https://github.com/YOUR-USERNAME/qvac-recipe-book.git
cd qvac-recipe-book
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3007** in your browser.

The first start downloads the voice model, which can take several minutes. Recipes work while it loads.
Click **Add a sample recipe**, open it, and press a speaker button or **Cooking mode**.

## How it works

- Recipes are saved in your browser's local storage. **Download backup** exports them as a JSON file.
- When you press a speaker button, the page sends that text to the local server. `server.js` calls QVAC's `textToSpeech`, wraps the raw sound samples in a WAV header, and sends the audio back.
- Audio is cached in the page, and Cooking mode prepares the next step in the background so it starts quickly.
- The server listens on `127.0.0.1`, so only your own computer can reach it.

## License

MIT
