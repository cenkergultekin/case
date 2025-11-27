import { fal } from '@fal-ai/client';
import { createError } from '../middleware/errorHandler';

export interface FalAIProcessResult {
  data: Buffer;
  metadata: Record<string, any>;
  requestId?: string;
}

/**
 * Fal.ai Service for AI Image Processing
 * 
 * Supported Models:
 * - Seedream v4 Edit: Advanced scene editing with multiple image support
 * - Flux Pro Kontext: Context-aware image editing with high precision  
 * - Nano Banana Edit: Fast and efficient multi-image editing
 */
export class FalAIService {
  private apiKey: string;

  constructor() {
    // Configure fal.ai client with API key
    // Load environment variables if not already loaded
    if (!process.env.FAL_KEY && !process.env.FAL_SUBSCRIBER_KEY) {
      const path = require('path');
      const dotenv = require('dotenv');
      
      // Try multiple locations for .env file
      const envPaths = [
        path.resolve(process.cwd(), '.env'),           // backend/.env
        path.resolve(process.cwd(), '..', '.env'),     // root/.env (parent directory)
        path.resolve(__dirname, '..', '..', '.env'),   // relative to this file
      ];
      
      let envLoaded = false;
      for (const envPath of envPaths) {
        const result = dotenv.config({ path: envPath });
        if (!result.error) {
          console.log('✅ .env file loaded from:', envPath);
          envLoaded = true;
          break;
        }
      }
      
      if (!envLoaded) {
        console.warn('⚠️  .env file not found in any of these locations:');
        envPaths.forEach(p => console.warn('   -', p));
      }
    }
    
    this.apiKey = process.env.FAL_KEY || process.env.FAL_SUBSCRIBER_KEY || '';
    
    if (!this.apiKey) {
      console.error('❌ FAL_KEY or FAL_SUBSCRIBER_KEY not found in environment variables');
      console.error('Please add FAL_KEY=your-api-key to your .env file');
    }
    
    if (this.apiKey) {
      fal.config({
        credentials: this.apiKey
      });
      console.log('✅ Fal.ai configured successfully with key:', this.apiKey.substring(0, 10) + '...');
    }
  }

  /**
   * Process image with selected AI model
   */
  async processImage(
    imageBuffer: Buffer,
    operation: string,
    parameters: Record<string, any> = {}
  ): Promise<FalAIProcessResult> {
    // Double-check API key at runtime
    const runtimeApiKey = process.env.FAL_KEY || process.env.FAL_SUBSCRIBER_KEY;
    
    if (!this.apiKey && !runtimeApiKey) {
      throw createError('FAL_KEY or FAL_SUBSCRIBER_KEY not configured', 500);
    }
    
    // Use runtime key if constructor key is missing
    const activeApiKey = this.apiKey || runtimeApiKey;
    if (activeApiKey && activeApiKey !== this.apiKey) {
      fal.config({
        credentials: activeApiKey
      });
      this.apiKey = activeApiKey;
    }

    try {
      // Log API key status (masked for security)
      console.log('🔑 API Key status:', {
        hasKey: !!activeApiKey,
        keyLength: activeApiKey?.length,
        keyPrefix: activeApiKey?.substring(0, 10) + '...',
        operation
      });

      // Validate prompt (not required for upscale)
      if (operation !== 'topaz-upscale') {
        if (!parameters.prompt || !parameters.prompt.trim()) {
          throw createError('Prompt is required for AI image processing', 400);
        }
      }

      // Convert buffer to base64 for fal.ai
      const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

      // Retry mechanism for fal.ai API calls (connection timeout issues)
      let result;
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          switch (operation) {
            case 'seedream-edit':
              result = await this.seedreamEdit(imageBase64, parameters);
              break;
            case 'flux-pro-kontext':
              result = await this.fluxProKontext(imageBase64, parameters);
              break;
            case 'nano-banana-edit':
              result = await this.nanoBananaEdit(imageBase64, parameters);
              break;
            case 'topaz-upscale':
              result = await this.topazUpscale(imageBase64, parameters);
              break;
            default:
              throw createError(`Unsupported operation: ${operation}`, 400);
          }
          // Success, break out of retry loop
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          
          // Detailed error logging with prompt info
          console.error(`❌ Fal.ai API error (attempt ${attempt}/${maxRetries}):`, {
            message: lastError.message,
            name: lastError.name,
            operation,
            prompt: parameters.prompt?.substring(0, 100) + '...',
            promptLength: parameters.prompt?.length,
            stack: lastError.stack?.split('\n').slice(0, 3).join('\n')
          });
          
          // Don't retry on certain errors (bad requests, auth errors, forbidden)
          if (error instanceof Error && (
            error.message.includes('400') || 
            error.message.includes('401') || 
            error.message.includes('403') ||
            error.message.includes('Forbidden') ||
            error.message.includes('Unauthorized') ||
            error.message.includes('Unsupported operation')
          )) {
            // For Forbidden errors, provide more context
            if (error.message.includes('Forbidden') || error.message.includes('403')) {
              throw createError(`Fal.ai API Forbidden (403): This may be due to API key permissions, content policy violation, or model access restrictions. Operation: ${operation}, Prompt length: ${parameters.prompt?.length || 0}`, 403);
            }
            throw error;
          }
          
          // Retry with exponential backoff for connection/timeout errors
          if (attempt < maxRetries) {
            const waitTime = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (!result) {
        throw createError(`Fal.ai API call failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`, 500);
      }

      // Handle different response formats
      // For images, extract image URL
      const imageUrl = this.extractImageUrl(result.data);
      const processedBuffer = await this.downloadImageFromUrl(imageUrl);

      return {
        data: processedBuffer,
        metadata: {
          operation,
          parameters,
          originalSize: imageBuffer.length,
          processedSize: processedBuffer.length,
          falResult: result.data
        },
        requestId: result.requestId
      };
    } catch (error) {
      console.error('FalAI processing error:', error);
      throw createError(`FalAI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Seedream v4 Edit Model
   * - Advanced AI scene editing with multiple image inputs
   * - Can handle complex scene modifications
   * - Supports multiple reference images
   * - Best for: Scene composition, object addition/removal, background changes
   */
  private async seedreamEdit(imageBase64: string, parameters: Record<string, any>) {
    const imageUrls = parameters.image_urls || [imageBase64];
    
    return await fal.subscribe('fal-ai/bytedance/seedream/v4/edit', {
      input: {
        prompt: parameters.prompt,
        image_urls: imageUrls,
        ...parameters
      },
      logs: true,
      timeout: 180000, // 3 minutes timeout
      onQueueUpdate: () => {}
    });
  }

  /**
   * Flux Pro Kontext Model
   * - Context-aware image editing with high precision
   * - Understands spatial relationships and object placement
   * - Excellent for adding objects in realistic contexts
   * - Best for: Object insertion, contextual modifications, realistic edits
   */
  private async fluxProKontext(imageBase64: string, parameters: Record<string, any>) {
    return await fal.subscribe('fal-ai/flux-pro/kontext', {
      input: {
        prompt: parameters.prompt,
        image_url: imageBase64,
        ...parameters
      },
      logs: true,
      timeout: 180000, // 3 minutes timeout
      onQueueUpdate: () => {}
    });
  }

  /**
   * Nano Banana Edit Model
   * - Fast and efficient image editing with multiple image support
   * - Optimized for quick transformations and scene modifications
   * - Supports multiple reference images for complex edits
   * - Best for: Quick edits, scene transformations, multi-image compositions
   */
  private async nanoBananaEdit(imageBase64: string, parameters: Record<string, any>) {
    const imageUrls = parameters.image_urls || [imageBase64];
    
    // Only include valid parameters for nano-banana model
    // Filter out any extra parameters that might cause Forbidden errors
    const cleanParameters: any = {
      prompt: parameters.prompt as string,
      image_urls: imageUrls as string[],
      // Set default num_images to 1 if not specified
      num_images: (parameters.num_images || 1) as number
    };
    
    // Only add seed if it's explicitly provided and valid
    if (parameters.seed !== undefined && parameters.seed !== null && typeof parameters.seed === 'number') {
      cleanParameters.seed = parameters.seed;
    }
    
    // Ensure image_urls is always an array of strings
    if (!Array.isArray(cleanParameters.image_urls)) {
      cleanParameters.image_urls = [cleanParameters.image_urls];
    }
    
    console.log('🔧 Nano-Banana parameters:', {
      promptLength: cleanParameters.prompt?.length,
      imageUrlsCount: cleanParameters.image_urls.length,
      num_images: cleanParameters.num_images,
      hasSeed: !!cleanParameters.seed
    });
    
    return await fal.subscribe('fal-ai/nano-banana/edit', {
      input: cleanParameters,
      logs: true,
      timeout: 180000, // 3 minutes timeout
      onQueueUpdate: () => {}
    });
  }

  /**
   * Topaz Upscale Model
   * - AI-powered image upscaling for higher resolution
   * - Enhances image quality while increasing dimensions
   * - Preserves details and reduces artifacts
   * - Best for: Resolution enhancement, quality improvement, print preparation
   */
  private async topazUpscale(imageInput: string, parameters: Record<string, any>) {
    return await fal.subscribe('fal-ai/topaz/upscale/image', {
      input: {
        image_url: imageInput,
        ...parameters
      },
      logs: true,
      timeout: 120000, // 2 minutes timeout for upscale (longer processing time)
      onQueueUpdate: () => {}
    });
  }

  /**
   * Process image with URL (for upscale operations)
   */
  async processImageWithUrl(
    imageUrl: string,
    operation: string,
    parameters: Record<string, any> = {}
  ): Promise<FalAIProcessResult> {
    // Ensure API key is set
    const activeApiKey = process.env.FAL_KEY || process.env.FAL_SUBSCRIBER_KEY;
    if (!activeApiKey) {
      throw createError('Fal.ai API key not found', 500);
    }

    if (this.apiKey !== activeApiKey) {
      fal.config({
        credentials: activeApiKey
      });
      this.apiKey = activeApiKey;
    }

    try {

      let result;
      
      switch (operation) {
        case 'topaz-upscale':
          result = await this.topazUpscale(imageUrl, parameters);
          break;
        default:
          throw createError(`Unsupported operation for URL processing: ${operation}`, 400);
      }


      // Handle different response formats
      const processedImageUrl = this.extractImageUrl(result.data);
      const processedBuffer = await this.downloadImageFromUrl(processedImageUrl);

      return {
        data: processedBuffer,
        metadata: {
          operation,
          parameters,
          originalUrl: imageUrl,
          processedSize: processedBuffer.length,
          falResult: result.data
        },
        requestId: result.requestId
      };
    } catch (error) {
      console.error('❌ FalAI processing error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        imageUrl,
        operation
      });
      throw createError(`FalAI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Extract image URL from fal.ai response
   */
  private extractImageUrl(responseData: any): string {
    if (responseData?.images && responseData.images.length > 0) {
      return responseData.images[0].url;
    } else if (responseData?.image) {
      return responseData.image.url;
    } else if (responseData?.url) {
      return responseData.url;
    } else {
      throw new Error('No image URL found in fal.ai response');
    }
  }

  /**
   * Download processed image from URL with retry mechanism
   */
  private async downloadImageFromUrl(url: string, retries: number = 5, delay: number = 2000): Promise<Buffer> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // 404 için özel mesaj - görsel henüz hazır olmayabilir
          if (response.status === 404) {
            throw new Error(`Image not found (404) - Image may not be ready yet. URL: ${url}`);
          }
          throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on abort (timeout) - ama 404 için retry yap (görsel henüz hazır olmayabilir)
        if (error instanceof Error && error.name === 'AbortError') {
          throw createError(`Failed to download processed image: Timeout after 30 seconds`, 500);
        }
        
        // 404 için de retry yap çünkü görsel henüz hazır olmayabilir
        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          const waitTime = delay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw createError(`Failed to download processed image after ${retries} attempts: ${lastError?.message || 'Unknown error'}`, 500);
  }

  /**
   * Get list of available AI models
   */
  async getAvailableOperations(): Promise<string[]> {
    return [
      'seedream-edit',    // Bytedance Seedream v4 - Advanced scene editing
      'flux-pro-kontext', // Flux Pro Kontext - Context-aware editing
      'nano-banana-edit', // Nano Banana Edit - Fast multi-image editing
      'topaz-upscale'     // Topaz Upscale - AI-powered image upscaling
    ];
  }

  /**
   * Test connection to fal.ai
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }
      
      // Test with a simple HTTP request to check authentication
      const response = await fetch('https://fal.run/fal-ai/fast-sdxl', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: {
            prompt: 'test connection'
          }
        })
      });
      
      const isConnected = response.status !== 401 && response.status !== 403;
      return isConnected;
    } catch (error) {
      return false;
    }
  }
}