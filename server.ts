import app from './app';
import { connectDB } from './src/config/db';
import { PORT } from './src/utils/constants';
import { startEmailPolling } from './src/services/emailPoller';
import { startContactPolling } from './src/services/contactPoller';
import { webSocketService } from './src/services/websocket.service';
import { createServer } from 'http';

const startServer = async () => {
  try {
    await connectDB();
    
    // Create HTTP server
    const server = createServer(app);
    
    // Initialize WebSocket service
    webSocketService.initialize(server);
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`WebSocket service initialized`);
    });
    
    // Start email polling in the background
    startEmailPolling();
    // Start contact polling in the background
    startContactPolling();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();