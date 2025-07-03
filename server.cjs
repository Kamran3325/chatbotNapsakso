// server.cjs (Reaksiya funksiyası SİLİNMİŞ versiya)
require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

let users = {};
let messages = [];

app.use(express.static('public'));

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fayl seçilməyib' });
  
  cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
    if (error || !result) return res.status(500).json({ error: 'Şəkil yüklənə bilmədi.' });
    res.json({ secure_url: result.secure_url });
  }).end(req.file.buffer);
});

io.on('connection', (socket) => {
  socket.emit('chat-tarixcesi', messages);

  socket.on('yeni-istifadeci-qosuldu', (name) => {
    users[socket.id] = { name, id: socket.id };
    socket.broadcast.emit('sistem-mesaji', `${name} söhbətə qoşuldu.`);
    io.emit('istifadeci_siyahisi_yenilendi', Object.values(users));
  });

  socket.on('yeni-mesaj', (messageData) => {
    const newMessage = {
      id: uuidv4(),
      type: messageData.type || 'text',
      user: users[socket.id],
      content: messageData.content,
      timestamp: new Date(),
      replyTo: messageData.replyTo || null,
      // reactions: {} -> BU HİSSƏ SİLİNDİ
    };
    messages.push(newMessage);
    io.emit('mesaj-geldi', newMessage);
  });

  // --- YENİ-REAKSİYA BLOKU TAMAMİLƏ SİLİNDİ ---

  socket.on('yaziram', () => socket.broadcast.emit('kimse_yazir', users[socket.id]));
  socket.on('yazma_dayandi', () => socket.broadcast.emit('yazma_dayandi', users[socket.id]));
  
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      delete users[socket.id];
      socket.broadcast.emit('sistem-mesaji', `${user.name} söhbətdən ayrıldı.`);
      io.emit('istifadeci_siyahisi_yenilendi', Object.values(users));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT} portunda işləyir...`));