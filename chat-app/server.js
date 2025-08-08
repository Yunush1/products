// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// __dirname is available in CommonJS, but we can define it for consistency
const _dirname = path.resolve();

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: "http://localhost:3000", // Your frontend URL
  credentials: true,
  methods: ["GET", "POST"]
};

app.use(cors(corsOptions));

const io = socketIo(server, {
  cors: corsOptions
});

// MongoDB connection
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';
const MONGODB_URI = 'mongodb+srv://alpha:alpha123@cluster0.lbrzmtv.mongodb.net/chatapp?retryWrites=true&w=majority'
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

app.use(session(sessionConfig));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chats.html'));
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Room Schema
const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPrivate: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const Room = mongoose.model('Room', roomSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  content: { type: String },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  messageType: { 
    type: String, 
    enum: ['text', 'image', 'file'], 
    default: 'text' 
  },
  fileName: { type: String },
  fileUrl: { type: String },
  fileSize: { type: Number },
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images and common file types
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Routes

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();

    // Set session
    req.session.userId = user._id;
    req.session.username = user.username;

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update online status
    user.isOnline = true;
    await user.save();

    // Set session
    req.session.userId = user._id;
    req.session.username = user.username;

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/logout', requireAuth, async (req, res) => {
  try {
    // Update user offline status
    await User.findByIdAndUpdate(req.session.userId, {
      isOnline: false,
      lastSeen: new Date()
    });

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ message: 'Logout successful' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/users", requireAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

// Create room
app.post('/api/rooms', requireAuth, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;

    const room = new Room({
      name,
      description,
      isPrivate: isPrivate || false,
      createdBy: req.session.userId,
      participants: [req.session.userId]
    });

    await room.save();
    await room.populate('participants', 'username avatar isOnline');

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's rooms
app.get('/api/rooms', requireAuth, async (req, res) => {
  try {
    const rooms = await Room.find({
      participants: req.session.userId
    })
    .populate('participants', 'username avatar isOnline')
    .populate('createdBy', 'username')
    .sort({ updatedAt: -1 });

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join room
app.post('/api/rooms/:roomId/join', requireAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!room.participants.includes(req.session.userId)) {
      room.participants.push(req.session.userId);
      await room.save();
    }

    await room.populate('participants', 'username avatar isOnline');
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get room messages
app.get('/api/rooms/:roomId/messages', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const room = await Room.findById(req.params.roomId);
    if (!room || !room.participants.includes(req.session.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.find({ room: req.params.roomId })
      .populate('sender', 'username avatar')
      .populate('replyTo')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload file
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      fileName: req.file.originalname,
      fileUrl: fileUrl,
      fileSize: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO connection handling
io.use((socket, next) => {
  const sessionMiddleware = session(sessionConfig);
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  const userId = socket.request.session.userId;
  if (!userId) {
    socket.disconnect();
    return;
  }

  // Join user to their personal room
  socket.join(`user_${userId}`);

  // Handle joining rooms
  socket.on('join_room', async (roomId) => {
    try {
      const room = await Room.findById(roomId);
      if (room && room.participants.includes(userId)) {
        socket.join(roomId);
        socket.emit('joined_room', roomId);
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { roomId, content, messageType = 'text', fileName, fileUrl, fileSize, replyTo } = data;

      // Verify user is in the room
      const room = await Room.findById(roomId);
      if (!room || !room.participants.includes(userId)) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Create message
      const message = new Message({
        content,
        sender: userId,
        room: roomId,
        messageType,
        fileName,
        fileUrl,
        fileSize,
        replyTo
      });

      await message.save();
      await message.populate('sender', 'username avatar');
      
      if (replyTo) {
        await message.populate('replyTo');
      }

      // Update room's last activity
      room.updatedAt = new Date();
      await room.save();

      // Broadcast message to room
      io.to(roomId).emit('new_message', message);
    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle message editing
  socket.on('edit_message', async (data) => {
    try {
      const { messageId, content } = data;

      const message = await Message.findById(messageId);
      if (!message || message.sender.toString() !== userId) {
        socket.emit('error', { message: 'Cannot edit this message' });
        return;
      }

      message.content = content;
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();
      await message.populate('sender', 'username avatar');

      io.to(message.room.toString()).emit('message_edited', message);
    } catch (error) {
      socket.emit('error', { message: 'Failed to edit message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (roomId) => {
    socket.to(roomId).emit('user_typing', { userId, username: socket.request.session.username });
  });

  socket.on('typing_stop', (roomId) => {
    socket.to(roomId).emit('user_stopped_typing', { userId });
  });

  // Update user online status
  User.findByIdAndUpdate(userId, { isOnline: true }).exec();

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    // Update user offline status
    await User.findByIdAndUpdate(userId, {
      isOnline: false,
      lastSeen: new Date()
    });

    // Notify rooms about user going offline
    const userRooms = await Room.find({ participants: userId });
    userRooms.forEach(room => {
      socket.to(room._id.toString()).emit('user_offline', { userId });
    });
  });
});

// Create uploads and public directories if they don't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;