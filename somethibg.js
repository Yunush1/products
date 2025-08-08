// Private Chat Schema (add this after your existing schemas)
const privateChatSchema = new mongoose.Schema({
  participants: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  }],
  chatId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  lastMessage: { type: String },
  lastMessageTime: { type: Date },
  lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const PrivateChat = mongoose.model('PrivateChat', privateChatSchema);

// Private Message Schema (add this after your existing schemas)
const privateMessageSchema = new mongoose.Schema({
  content: { type: String },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chatId: { type: String, required: true },
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
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const PrivateMessage = mongoose.model('PrivateMessage', privateMessageSchema);

//kjdfgj 
// Private Chat Endpoints (add these after your existing routes)

// Create or get existing private chat
app.post('/api/private-chats', requireAuth, async (req, res) => {
  try {
    const { participantId } = req.body;
    const currentUserId = req.session.userId;

    if (participantId === currentUserId) {
      return res.status(400).json({ error: 'Cannot create chat with yourself' });
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create unique chat ID (sorted to ensure consistency)
    const sortedIds = [currentUserId, participantId].sort();
    const chatId = `${sortedIds[0]}_${sortedIds[1]}`;

    // Check if chat already exists
    let privateChat = await PrivateChat.findOne({ chatId })
      .populate('participants', 'username avatar isOnline lastSeen');

    if (!privateChat) {
      // Create new private chat
      privateChat = new PrivateChat({
        participants: [currentUserId, participantId],
        chatId: chatId
      });
      await privateChat.save();
      await privateChat.populate('participants', 'username avatar isOnline lastSeen');
    }

    res.json({ 
      chatId: privateChat.chatId,
      chat: privateChat
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's private chats
app.get('/api/private-chats', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const privateChats = await PrivateChat.find({
      participants: userId
    })
    .populate('participants', 'username avatar isOnline lastSeen')
    .populate('lastMessageSender', 'username')
    .sort({ updatedAt: -1 });

    res.json(privateChats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get private chat messages
app.get('/api/private-chats/:chatId/messages', requireAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.session.userId;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({ 
      chatId,
      participants: userId 
    });

    if (!privateChat) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await PrivateMessage.find({ chatId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Mark messages as read
    await PrivateMessage.updateMany(
      { 
        chatId, 
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      { 
        $push: { 
          readBy: { 
            user: userId, 
            readAt: new Date() 
          } 
        } 
      }
    );

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send private message
app.post('/api/private-chats/:chatId/messages', requireAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.session.userId;
    const { content, messageType = 'text', fileName, fileUrl, fileSize } = req.body;

    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({ 
      chatId,
      participants: userId 
    });

    if (!privateChat) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create message
    const message = new PrivateMessage({
      content,
      sender: userId,
      chatId,
      messageType,
      fileName,
      fileUrl,
      fileSize
    });

    await message.save();
    await message.populate('sender', 'username avatar');

    // Update private chat with last message info
    privateChat.lastMessage = content || (messageType === 'image' ? '📷 Image' : '📄 File');
    privateChat.lastMessageTime = message.createdAt;
    privateChat.lastMessageSender = userId;
    privateChat.updatedAt = new Date();
    await privateChat.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get private chat details
app.get('/api/private-chats/:chatId', requireAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.session.userId;

    const privateChat = await PrivateChat.findOne({ 
      chatId,
      participants: userId 
    }).populate('participants', 'username avatar isOnline lastSeen');

    if (!privateChat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(privateChat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete private chat
app.delete('/api/private-chats/:chatId', requireAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.session.userId;

    // Verify user is participant
    const privateChat = await PrivateChat.findOne({ 
      chatId,
      participants: userId 
    });

    if (!privateChat) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete all messages in this chat
    await PrivateMessage.deleteMany({ chatId });
    
    // Delete the chat
    await PrivateChat.deleteOne({ chatId });

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
  

// Add these private chat socket handlers to your existing socket.io connection handler

// Handle joining private chats
socket.on('join_private_chat', async (chatId) => {
  try {
    const userId = socket.request.session.userId;
    
    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({ 
      chatId,
      participants: userId 
    });

    if (privateChat) {
      socket.join(chatId);
      socket.emit('joined_private_chat', chatId);
    } else {
      socket.emit('error', { message: 'Access denied to private chat' });
    }
  } catch (error) {
    socket.emit('error', { message: 'Failed to join private chat' });
  }
});

// Handle sending private messages
socket.on('send_private_message', async (data) => {
  try {
    const userId = socket.request.session.userId;
    const { chatId, content, messageType = 'text', fileName, fileUrl, fileSize } = data;

    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({ 
      chatId,
      participants: userId 
    });

    if (!privateChat) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    // Create message
    const message = new PrivateMessage({
      content,
      sender: userId,
      chatId,
      messageType,
      fileName,
      fileUrl,
      fileSize
    });

    await message.save();
    await message.populate('sender', 'username avatar');

    // Update private chat with last message info
    privateChat.lastMessage = content || (messageType === 'image' ? '📷 Image' : '📄 File');
    privateChat.lastMessageTime = message.createdAt;
    privateChat.lastMessageSender = userId;
    privateChat.updatedAt = new Date();
    await privateChat.save();

    // Broadcast message to chat participants
    io.to(chatId).emit('new_private_message', message);

    // Emit to users who aren't currently in the chat room (for notifications)
    privateChat.participants.forEach(participantId => {
      if (participantId.toString() !== userId) {
        io.to(`user_${participantId}`).emit('new_private_message_notification', {
          chatId,
          message,
          sender: message.sender
        });
      }
    });
  } catch (error) {
    socket.emit('error', { message: 'Failed to send private message' });
  }
});

// Handle private chat typing indicators
socket.on('typing_start_private', (data) => {
  const { chatId, username } = data;
  socket.to(chatId).emit('user_typing', { 
    chatId, 
    userId: socket.request.session.userId, 
    username 
  });
});

socket.on('typing_stop_private', (data) => {
  const { chatId } = data;
  socket.to(chatId).emit('user_stopped_typing', { chatId });
});

// Handle marking messages as read
socket.on('mark_messages_read', async (data) => {
  try {
    const userId = socket.request.session.userId;
    const { chatId } = data;

    await PrivateMessage.updateMany(
      { 
        chatId, 
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      { 
        $push: { 
          readBy: { 
            user: userId, 
            readAt: new Date() 
          } 
        } 
      }
    );

    // Notify other participants that messages were read
    socket.to(chatId).emit('messages_read', { 
      chatId, 
      readBy: userId 
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
});
