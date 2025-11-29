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
      require('dotenv').config({ path: '../.env' });
    }
    
    this.apiKey = process.env.FAL_KEY || process.env.FAL_SUBSCRIBER_KEY || '';
    if (this.apiKey) {
      fal.config({
        credentials: this.apiKey
      });
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
      if (!parameters.prompt || !parameters.prompt.trim()) {
        console.error('FalAIService - Prompt is missing or empty!', {
          operation,
          hasPrompt: !!parameters.prompt,
          promptLength: parameters.prompt?.length || 0,
          promptPreview: parameters.prompt?.substring(0, 100) || '(empty)',
          allParams: Object.keys(parameters)
        });
        throw createError('Prompt is required for AI image processing', 400);
      }

      // Convert buffer to base64 for fal.ai
      const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

      let result;
      
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
        case 'flux-multi-angles':
          result = await this.fluxMultiAngles(imageBase64, parameters);
          break;
        default:
          throw createError(`Unsupported operation: ${operation}`, 400);
      }

      // Handle different response formats
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
    
    return await fal.subscribe('fal-ai/nano-banana/edit', {
      input: {
        prompt: parameters.prompt,
        image_urls: imageUrls,
        ...parameters
      },
      logs: true,
      onQueueUpdate: () => {}
    });
  }

  /**
   * Flux 2 LoRA Multiple Angles Model
   * - Generates rotated views of the input image based on horizontal_angle
   * - horizontal_angle: float, expected rotation in degrees
   */
  private async fluxMultiAngles(imageBase64: string, parameters: Record<string, any>) {
    const horizontalAngle =
      typeof parameters.horizontal_angle === 'number'
        ? parameters.horizontal_angle
        : typeof parameters.angle === 'number'
          ? parameters.angle
          : undefined;

    return await fal.subscribe('fal-ai/flux-2-lora-gallery/multiple-angles', {
      input: {
        image_urls: [imageBase64],
        horizontal_angle: horizontalAngle,
        prompt: parameters.prompt,
        ...parameters
      },
      logs: true,
      onQueueUpdate: () => {}
    });
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
   * Download processed image from URL
   */
  private async downloadImageFromUrl(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw createError(`Failed to download processed image: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Get list of available AI models
   */
  async getAvailableOperations(): Promise<string[]> {
    return [
      'seedream-edit',    // Bytedance Seedream v4 - Advanced scene editing
      'flux-pro-kontext', // Flux Pro Kontext - Context-aware editing
      'nano-banana-edit', // Nano Banana Edit - Fast multi-image editing
      'flux-multi-angles' // Flux 2 LoRA multiple angles
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
      console.error('Fal.ai connection test failed:', error);
      return false;
    }
  }
}