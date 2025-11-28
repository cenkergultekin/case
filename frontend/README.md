# Imageflow Frontend

Modern Next.js frontend for AI-powered image processing with a clean, intuitive interface.

## Features

- **Drag & Drop Upload**: Intuitive file upload with drag-and-drop support
- **Multiple File Support**: Upload up to 5 images simultaneously
- **Real-time Processing**: Live status updates during AI processing
- **Image Gallery**: Browse and manage uploaded images
- **AI Operations**: Easy access to various image processing operations
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Modern UI**: Clean, professional interface with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Custom component library
- **File Upload**: react-dropzone
- **HTTP Client**: Axios + Firebase Auth token injection
- **Icons**: Lucide React

## Components

### Core Components
- `ImageUpload` - Drag & drop file upload interface
- `ImageProcessor` - AI processing operations panel
- `Button` - Reusable button component
- `Card` - Container component for content sections

### Features
- File type validation (JPEG, PNG, WebP, GIF)
- File size validation (10MB limit)
- Upload progress indication
- Error handling and user feedback
- Image metadata display
- Processing history tracking

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment setup**:
   Create `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:4000/api
   NEXT_PUBLIC_FIREBASE_API_KEY=your_web_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
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
├── app/
│   ├── globals.css        # Global styles and CSS variables
│   ├── layout.tsx         # Root layout component
│   └── page.tsx          # Main application page
├── components/
│   ├── ui/               # Reusable UI components
│   │   ├── Button.tsx
│   │   └── Card.tsx
│   ├── ImageUpload.tsx   # File upload component
│   └── ImageProcessor.tsx # AI processing interface
└── lib/
    ├── api.ts            # API client and endpoints
    └── utils.ts          # Utility functions
```

## Usage

### Upload Images
1. Drag and drop images onto the upload area
2. Or click to select files from your device
3. Images are automatically uploaded and appear in your library

### Process Images
1. Select an image from your library
2. Choose from available AI operations:
   - **Seedream Edit**: İleri seviye sahne düzenleme
   - **Nano Banana Edit**: Hızlı açı/duruş dönüşümleri
   - **Flux Pro Kontext**: Bağlamı koruyan nesne yerleştirme
3. View and download processed results

### Manage Images
- View image metadata (size, type, upload date)
- Track processing history
- Delete unwanted images
- Download processed versions

## API Integration

The frontend communicates with the backend through a clean API layer:

```typescript
// Upload single image
const result = await imageAPI.uploadImage(file, options);

// Process image
const processed = await imageAPI.processImage(imageId, 'remove-background');

// List images
const images = await imageAPI.listImages({ page: 1, limit: 10 });
```

## Styling

The application uses a custom design system built on Tailwind CSS:

- **Colors**: Semantic color palette with light/dark mode support
- **Components**: Consistent component styling with variants
- **Spacing**: Standardized spacing scale
- **Typography**: Clean, readable font hierarchy
- **Animations**: Subtle transitions and loading states

## Error Handling

- Network error detection and user feedback
- File validation with clear error messages
- Graceful degradation when backend is unavailable
- Loading states for all async operations

## Performance

- Optimized bundle size with Next.js
- Lazy loading of components
- Efficient re-rendering with React hooks
- Image optimization for uploads
- Responsive images for different screen sizes

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Progressive enhancement for older browsers