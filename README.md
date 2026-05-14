# Vōx · Video Call App

Encrypted peer-to-peer video calling. No accounts. No media servers.
Your video goes directly between browsers via WebRTC.

## Quick Start

```bash
# 1. Install the one dependency (WebSocket server)
npm install

# 2. Start the signaling server
node server.js

# 3. Open in your browser
# → http://localhost:3000
```

## How to make a call

1. Open `http://localhost:3000` in your browser
2. Enter your name and a Room ID (or click **Generate**)
3. Click **Join Room**
4. Share the invite link with your contact (click the room pill or 🔗 button)
5. When they join the same room, the call connects automatically

## Features

| Feature | Details |
|---|---|
| Video & Audio | Full HD via WebRTC |
| Screen Sharing | Replace your camera with your screen |
| In-call Chat | P2P via WebRTC DataChannel (falls back to WebSocket) |
| Mute / Camera off | Toggle anytime, remote peer sees your state |
| Call timer | Shows duration once connected |
| Invite link | One click to copy a shareable URL with room pre-filled |
| Keyboard shortcuts | `Alt+M` mute, `Alt+C` camera, `Alt+K` chat |

## Architecture

```
Browser A ──┐                    ┌── Browser B
            │  WebSocket         │
            └──► server.js ◄────┘
                 (signaling only: offer/answer/ICE)

After handshake:
Browser A ◄──────────── direct P2P ────────────► Browser B
                   (video, audio, chat)
```

The signaling server (`server.js`) only relays small JSON messages to set up the connection.
**No video or audio ever touches the server.**

## Running on a network (LAN or internet)

**LAN**: Both users open `http://<your-ip>:3000` — works out of the box.

**Internet**: Deploy `server.js` to any Node.js host (Railway, Render, Fly.io, VPS).
Then update `WS_URL` in `index.html`:

```js
const WS_URL = 'wss://your-server.com';  // use wss:// for HTTPS hosts
```

For users behind strict NATs, add TURN server credentials to `ICE` in `index.html`:

```js
const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ]
};
```

## Room capacity

Rooms hold a maximum of 2 participants (one-to-one call).
The server rejects a third connection attempt with an error message.

## License

MIT
"# videoapp" 
