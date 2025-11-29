'use client';
import axios from 'axios';
import { fetchIdToken } from '@/lib/authClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Helper function
export const getImageUrl = (filename: string) => {
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}/api/uploads/${filename}`;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      try {
        const token = await fetchIdToken();
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Failed to attach Firebase auth token:', error);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Image API functions
export const imageAPI = {
  // Upload single image
  uploadImage: async (file: File, options?: { tags?: string[]; description?: string; isPublic?: boolean }) => {
    const formData = new FormData();
    formData.append('image', file);
    
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
        }
      });
    }

    const response = await api.post('/images/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Upload multiple images
  uploadMultipleImages: async (files: File[], options?: { tags?: string[]; description?: string; isPublic?: boolean }) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });
    
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
        }
      });
    }

    const response = await api.post('/images/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Process image with fal.ai
  processImage: async (
    imageId: string, 
    operation: string, 
    parameters?: Record<string, any>, 
    sourceProcessedVersionId?: string,
    angles?: number[],
    customPrompt?: string
  ) => {
    const response = await api.post(`/images/process/${imageId}`, {
      operation,
      parameters: parameters || {},
      ...(sourceProcessedVersionId && { sourceProcessedVersionId }),
      ...(angles && { angles }),
      ...(customPrompt && { customPrompt })
    }, {
      timeout: 240000
    });
    return response.data;
  },

  // Generate smart prompt via OpenRouter assistant
  generateSmartPrompt: async (
    imageId: string,
    payload: {
      sourceProcessedVersionId: string;
      angles?: number[];
      userNotes?: string;
    }
  ) => {
    const response = await api.post(`/images/${imageId}/prompt-assistant`, payload, {
      timeout: 150000
    });
    return response.data;
  },

  // List processed images
  listProcessedImages: async (params?: { 
    page?: number; 
    limit?: number; 
    aiModel?: string; 
    minProcessingTime?: number;
    maxProcessingTime?: number;
  }) => {
    const response = await api.get('/images/processed', { params });
    return response.data;
  },

  // Get image by ID
  getImage: async (imageId: string) => {
    const response = await api.get(`/images/${imageId}`);
    return response.data;
  },

  // List images
  listImages: async (params?: { page?: number; limit?: number; filter?: string }) => {
    const response = await api.get('/images', { params });
    return response.data;
  },

  // Delete image
  deleteImage: async (imageId: string) => {
    const response = await api.delete(`/images/${imageId}`);
    return response.data;
  },

  // Delete processed version
  deleteProcessedVersion: async (imageId: string, versionId: string) => {
    const response = await api.delete(`/images/${imageId}/versions/${versionId}`);
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  }
};
