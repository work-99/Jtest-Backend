import app from './app';
import { connectDB } from './src/config/db';
import { PORT } from './src/utils/constants';
import { startEmailPolling } from './src/services/emailPoller';
import { startContactPolling } from './src/services/contactPoller';

const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
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