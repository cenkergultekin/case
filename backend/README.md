# Imageflow Backend

Node.js + Express backend service for image processing with fal.ai integration.

## Features

- **Image Upload**: Single and multiple file upload with validation
- **File Storage**: Local file system storage with organized structure
- **Pipeline Persistence**: Firebase Firestore stores image metadata, processed versions, and hierarchy per authenticated user
- **AI Processing**: Integration with fal.ai for various image operations:
  - Image enhancement
  - Background removal
  - Image upscaling
  - Style transfer
  - Variation generation
- **RESTful API**: Clean, documented endpoints
- **Error Handling**: Comprehensive error handling and validation
- **Security**: CORS, Helmet, and input validation

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **File Upload**: Multer
- **AI Service**: fal.ai SDK
- **Validation**: Joi
- **Security**: Helmet, CORS
- **Development**: tsx for hot reload

## API Endpoints

### Health Check
- `GET /api/health` - Service health status

### Image Operations (Requires Firebase Auth token)
- `POST /api/images/upload` - Upload single image
- `POST /api/images/upload-multiple` - Upload multiple images
- `POST /api/images/process/:imageId` - Process image with AI
- `GET /api/images/:imageId` - Get image metadata
- `GET /api/images` - List images with pagination
- `DELETE /api/images/:imageId` - Delete image
- `GET /api/images/processed` - List processed versions with filters

### Static Files
- `GET /uploads/:filename` - Serve uploaded files

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment setup**:
   Copy `.env.example` to `.env` and configure:
   ```env
   FAL_SUBSCRIBER_KEY=your_fal_ai_key
   BACKEND_PORT=4000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000

   # Firebase Admin (Service Account)
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your_project_id.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

3. **Development**:
   ```bash
   npm run dev
   ```

4. **Production**:
   ```bash
   npm run build
   npm start
   ```

## Project Structure

```
src/
├── server.ts              # Main server setup
├── middleware/
│   └── errorHandler.ts    # Error handling middleware
├── routes/
│   ├── healthRoutes.ts    # Health check endpoints
│   └── imageRoutes.ts     # Image operation endpoints
├── services/
│   ├── ImageService.ts    # Core image processing logic
│   ├── FalAIService.ts    # fal.ai integration
│   └── FileStorageService.ts # File storage management
└── validators/
    └── imageValidator.ts  # Input validation
```

## Usage Examples

### Upload Image
```bash
curl -X POST http://localhost:4000/api/images/upload \
  -F "image=@path/to/image.jpg" \
  -F "description=My test image"
```

### Process Image
```bash
curl -X POST http://localhost:4000/api/images/process/IMAGE_ID \
  -H "Content-Type: application/json" \
  -d '{"operation": "remove-background"}'
```

### List Images
```bash
curl "http://localhost:4000/api/images?page=1&limit=10"
```

## Configuration

The service supports the following environment variables:

- `FAL_SUBSCRIBER_KEY` - fal.ai API key (required)
- `BACKEND_PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment mode
- `FRONTEND_URL` - Frontend URL for CORS
- `BASE_URL` - Base URL for file serving
- `UPLOAD_DIR` - Upload directory path
- `MAX_FILE_SIZE` - Maximum file size in bytes
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` - Firebase Admin credentials used for Auth + Firestore

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "stack": "Error stack (development only)"
}
```

## Security

- File type validation (JPEG, PNG, WebP, GIF only)
- File size limits (10MB default)
- Input sanitization and validation
- CORS protection
- Security headers via Helmet
