import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  
  // MongoDB connection options
  options: {
    // Set to true to automatically reconnect if connection is lost
    autoReconnect: true,
    
    // Connection timeout (ms)
    connectTimeoutMS: 10000,
    
    // Socket timeout (ms)
    socketTimeoutMS: 45000,
    
    // Maximum number of connections in the pool
    maxPoolSize: process.env.NODE_ENV === 'production' ? 100 : 10,
    
    // Minimum number of connections in the pool
    minPoolSize: process.env.NODE_ENV === 'production' ? 5 : 1,
    
    // Maximum time (ms) that a connection can remain idle in the pool
    maxIdleTimeMS: 30000,
    
    // Maximum time (ms) a thread can wait for a connection
    waitQueueTimeoutMS: 10000,
    
    // Write concern
    writeConcern: process.env.NODE_ENV === 'production' ? 'majority' : 'local',
    
    // Read preference
    readPreference: process.env.NODE_ENV === 'production' ? 'primaryPreferred' : 'primary',
    
    // Retry writes if they fail
    retryWrites: true,
    
    // Retry reads if they fail
    retryReads: true,
    
    // Enable SSL/TLS for secure connections
    ssl: process.env.NODE_ENV === 'production',
    
    // Validate MongoDB server certificate
    sslValidate: process.env.NODE_ENV === 'production',
    
    // Heartbeat frequency (ms)
    heartbeatFrequencyMS: 10000,
  },
}));
