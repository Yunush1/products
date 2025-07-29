import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { addUser, loginUser } from './user.controller.js';
// ✅ Express app
let users = JSON.parse(fs.readFileSync('data.json'));
const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Required when using ES Modules to get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files (like CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

const data = JSON.parse(fs.readFileSync('product.json'))

try {
    // ✅ GraphQL Schema and Resolvers
    const schema = buildSchema(`
        type Query {
            hello: String
            user: [Users]
            userById(id: Int): Users
            products: [Product]
            searchByName(name: String): [Product]
        }
        type Mutation {
            addUser(name: String, username: String, isBlocked: Boolean, role: String, permissions: [String]): Users
            updateUser(id: Int, name: String, username: String, isBlocked: Boolean, role: String, permissions: [String]): Users
        }

        type Product {
            id: Int
            name: String
            category: String
            image: String
            price: String
        }
        
        type Users {
            id:Int
            name:String
            username:String
            isBlocked:Boolean
            role:String
            permissions:[String]
        }
`);


    const root = {
        hello: () => 'Hello world!',
        products: () => data,
        user: () => {
            return users;
        },
        userById: ({ id }) => {
            return users.find(user => user.id === id);
        },
        addUser: ({ name, username, isBlocked, role, permissions }) => {
            const id = users.length + 1;
            const user = { id, name, username, isBlocked, role, permissions };
            return addUser(user);
        },
        updateUser({ id, name, username, isBlocked, role, permissions }) {
            const user = { id, name, username, isBlocked, role, permissions };
            return addUser(user);
        },
        searchByName: ({ name }) => {
            return data.filter(product => product.name.toLowerCase().includes(name.toLowerCase()));
        }
    };

    // ✅ GraphQL route
    app.use(
        '/graphql',
        graphqlHTTP({
            schema,
            rootValue: root,
            graphiql: true,
        })
    );

} catch (error) {
    console.log(error);
}


// ✅ HTTP server for GraphQL + Socket.IO
const server = http.createServer(app);

// ✅ Proper Socket.IO server setup with CORS
const io = new Server(server, {
    cors: {
        origin: '*', // Or restrict to your frontend: 'http://localhost:3000'
        methods: ['GET', 'POST'],
    },
});

// ✅ WebSocket connection handler
io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    socket.on('message', (msg) => {
        console.log('📩 Message from client:', msg);
        socket.emit('message', '✅ User connected successfully');
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
    });
});


// ✅ Root route
// Route to send HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'products.html'));
});

// ✅ Start server
const PORT = 4000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}/graphql`);
});


// import http from 'http';
// import WebSocket, { WebSocketServer } from 'ws';

// // Create HTTP server (optional, if needed for upgrade handling)
// const server = http.createServer();

// // Create WebSocket server
// const wss = new WebSocketServer({ server });

// wss.on('connection', function connection(ws) {
//   console.log('🟢 Client connected');

//   ws.on('message', function incoming(message) {
//     console.log('📩 Received:', message.toString());

//     // Echo back or send custom message
//     ws.send('✅ Server received: ' + message);
//   });

//   ws.on('close', () => {
//     console.log('🔴 Client disconnected');
//   });

//   ws.send('👋 Welcome to the WebSocket server!');
// });

// server.listen(4000, () => {
//   console.log('✅ WebSocket Server is running on ws://localhost:4000');
// });
