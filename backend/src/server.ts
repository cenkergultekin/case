import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { join } from 'path';
import { errorHandler } from './middleware/errorHandler';
import { imageRoutes } from './routes/imageRoutes';
import { healthRoutes } from './routes/healthRoutes';

// Load environment variables
// Try backend/.env first, then root .env, then default
dotenv.config({ path: '.env' });
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || process.env.BACKEND_PORT || 4000;

// Security middleware - Static files için daha esnek ayarlar
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false
}));
app.use(compression());

// CORS configuration
// Support multiple origins (comma-separated) or single origin
const getAllowedOrigins = (): string[] => {
  const frontendUrl = process.env.FRONTEND_URL;
  const origins: string[] = [];
  
  // Always allow localhost for development/testing
  origins.push('http://localhost:3000');
  
  if (frontendUrl) {
    // Support comma-separated origins for multiple environments
    const urlOrigins = frontendUrl.split(',').map(url => url.trim());
    origins.push(...urlOrigins);
  }
  
  // Remove duplicates
  return [...new Set(origins)];
};

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = getAllowedOrigins();
    // Allow requests with no origin (like mobile apps or curl requests)
    // Always allow localhost for development/testing
    // Always allow Vercel domains
    const isVercelDomain = origin?.includes('.vercel.app') || origin?.includes('vercel.app');
    if (!origin || allowedOrigins.includes(origin) || origin?.startsWith('http://localhost:') || isVercelDomain) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads - CORS headers ile
// Use the same upload directory path as FileStorageService
const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

// Proxy endpoint for Firebase Storage files (to avoid CORS issues)
// This must come BEFORE express.static middleware
app.get('/api/uploads/:filename', async (req, res, next) => {
  const { filename } = req.params;
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  
  // Set CORS headers
  if (!origin || allowedOrigins.includes(origin) || origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:')) {
    res.setHeader('Access-Control-Allow-Origin', origin || allowedOrigins[0] || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  } else if (process.env.NODE_ENV === 'production') {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  }
  
  // Check if Firebase Storage is enabled
  const useFirebaseStorage = process.env.USE_FIREBASE_STORAGE === 'true';
  
  if (useFirebaseStorage) {
    try {
      const { FirebaseStorageService } = await import('./services/FirebaseStorageService');
      const storageService = new FirebaseStorageService();
      const buffer = await storageService.getFile(filename);
      
      // Determine content type from filename
      const ext = filename.split('.').pop()?.toLowerCase();
      const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                          ext === 'png' ? 'image/png' : 
                          ext === 'webp' ? 'image/webp' : 
                          ext === 'gif' ? 'image/gif' : 'application/octet-stream';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
      res.send(buffer);
      return;
    } catch (error) {
      console.error(`Failed to get file from Firebase Storage: ${filename}`, error);
      // Fall through to local filesystem check
    }
  }
  
  // Fallback to local filesystem
  const filePath = join(uploadDir, filename);
  const fs = await import('fs/promises');
  
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      res.status(404).json({ success: false, message: 'File not found' });
      return;
    }
    
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                        ext === 'png' ? 'image/png' : 
                        ext === 'webp' ? 'image/webp' : 
                        ext === 'gif' ? 'image/gif' : 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    
    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);
  } catch (error) {
    res.status(404).json({ success: false, message: 'File not found' });
  }
});

// Root route - Welcome message
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Backend API is running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      images: '/api/images',
      uploads: '/api/uploads'
    },
    timestamp: new Date().toISOString()
  });
});

// API root route - API information
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ImageFlow API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      images: '/api/images',
      uploads: '/api/uploads'
    },
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/images', imageRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

export default app;
