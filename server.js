/**
 * ╔══════════════════════════════════════╗
 * ║   Vōx — WebRTC Signaling Server     ║
 * ║   Run: node server.js               ║
 * ║   Requires: npm install ws          ║
 * ╚══════════════════════════════════════╝
 */

const { WebSocketServer } = require('ws');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// Railway (and most cloud hosts) inject PORT via environment variable.
// Fall back to 3000 for local development.
const PORT = process.env.PORT || 3000;

// ── HTTP: serve index.html ──────────────────────────────
const httpServer = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('index.html not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

// ── WebSocket Signaling ─────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

/**
 * rooms: Map<roomId, Map<peerId, { ws, name }>>
 */
const rooms = new Map();

let peerCounter = 0;

wss.on('connection', (ws) => {
  const peerId = `peer_${++peerCounter}`;
  ws.peerId = peerId;
  ws.roomId = null;

  log(`[+] ${peerId} connected`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    handleMessage(ws, msg);
  });

  ws.on('close', () => {
    handleLeave(ws);
    log(`[-] ${ws.peerId} disconnected`);
  });

  ws.on('error', (err) => log(`[!] ${ws.peerId} error: ${err.message}`));
});

function handleMessage(ws, msg) {
  switch (msg.type) {

    case 'join': {
      const { room, name } = msg;
      if (!room) return;

      if (!rooms.has(room)) rooms.set(room, new Map());
      const peers = rooms.get(room);

      if (peers.size >= 2) {
        safeSend(ws, { type: 'error', code: 'ROOM_FULL', message: 'Room is full (max 2 participants).' });
        return;
      }

      // Leave old room if any
      if (ws.roomId) handleLeave(ws);

      ws.roomId  = room;
      ws.peerName = name || `User ${peers.size + 1}`;
      peers.set(ws.peerId, { ws, name: ws.peerName });

      // Tell joiner who is already in the room
      const others = [...peers.values()]
        .filter(p => p.ws.peerId !== ws.peerId)
        .map(p => ({ id: p.ws.peerId, name: p.name }));

      safeSend(ws, { type: 'joined', peerId: ws.peerId, room, peers: others });

      // Notify existing peers
      broadcast(room, ws, { type: 'peer-joined', peerId: ws.peerId, name: ws.peerName });

      log(`[Room ${room}] ${ws.peerName} joined — ${peers.size}/2`);
      break;
    }

    case 'offer':
    case 'answer':
    case 'ice-candidate': {
      // Relay to target peer or broadcast to room
      if (msg.to) {
        const peer = findPeer(msg.to);
        if (peer) safeSend(peer, { ...msg, from: ws.peerId });
      } else if (ws.roomId) {
        broadcast(ws.roomId, ws, { ...msg, from: ws.peerId });
      }
      break;
    }

    case 'chat': {
      if (ws.roomId) {
        broadcast(ws.roomId, ws, {
          type: 'chat',
          from: ws.peerId,
          name: ws.peerName,
          text: msg.text,
          ts: Date.now(),
        });
      }
      break;
    }

    case 'media-state': {
      if (ws.roomId) {
        broadcast(ws.roomId, ws, {
          type: 'media-state',
          from: ws.peerId,
          name: ws.peerName,
          mic: msg.mic,
          cam: msg.cam,
        });
      }
      break;
    }

    case 'leave':
      handleLeave(ws);
      break;
  }
}

function handleLeave(ws) {
  const { roomId, peerId, peerName } = ws;
  if (!roomId) return;

  const peers = rooms.get(roomId);
  if (peers) {
    peers.delete(peerId);
    broadcast(roomId, ws, { type: 'peer-left', peerId, name: peerName });
    if (peers.size === 0) {
      rooms.delete(roomId);
      log(`[Room ${roomId}] empty, removed`);
    } else {
      log(`[Room ${roomId}] ${peerName} left — ${peers.size} remaining`);
    }
  }
  ws.roomId = null;
}

function broadcast(roomId, sender, msg) {
  const peers = rooms.get(roomId);
  if (!peers) return;
  for (const { ws } of peers.values()) {
    if (ws !== sender) safeSend(ws, msg);
  }
}

function findPeer(peerId) {
  for (const [, room] of rooms) {
    const p = room.get(peerId);
    if (p) return p.ws;
  }
  return null;
}

function safeSend(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function log(str) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${str}`);
}

httpServer.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║  🎥  Vōx running → http://localhost:${PORT}  ║`);
  console.log('╚══════════════════════════════════════╝\n');
});
