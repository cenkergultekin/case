import { createError } from '../middleware/errorHandler';

type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' } };

export interface GeneratePromptOptions {
  originalImageData: string;
  referenceImageData: string;
  targetAngles?: number[];
  userNotes?: string;
  embeddedPrompt?: string;
}

export interface PromptAssistantResult {
  prompt: string;
  model: string;
  latencyMs: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class OpenRouterService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.apiUrl = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
    this.model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-90b-vision-instruct';
    this.systemPrompt =
      process.env.PROMPT_ASSISTANT_SYSTEM_PROMPT ||
      [
        'You will receive two images in this exact order:',
        '1) Reference image (pre-rotation source).',
        '2) Generated image (supposedly rotated to the target degree) that must be corrected.',
        'Compare them and output a short English correction prompt (1–3 sentences) for img2img describing concrete fixes in the generated image.',
        'Pay special attention to whether the generated image really matches the requested rotation (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°) when compared to the original reference.',
        'If the angle is wrong, explicitly describe the concrete adjustments needed so that img2 reaches the target angle—never revert to the original, unrotated pose.',
        'Focus on pose, head angle, facial expression, body proportions, hands, wrinkles, framing, camera height, shadows, lighting, background details, and sharpness.',
        'Never mention identity, age, gender, hair, skin tone, or clothing style; never say “match the reference image”.',
        'Do not output analysis or bullet points; provide only the final correction prompt.',
        'Each sentence must describe tangible adjustments (e.g., angles, expression, lighting, background cleanup, framing).',
        'Avoid generic “improve the image” wording unless tied to a specific element (e.g., “enhance the sharpness of the face”).'
      ].join(' ');
  }

  async generatePrompt(options: GeneratePromptOptions): Promise<PromptAssistantResult> {
    if (!this.apiKey) {
      throw createError('OpenRouter API anahtarı tanımlı değil', 500);
    }

    const userContent = this.buildUserContent(options);
    const startedAt = Date.now();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://openrouter.ai',
          'X-Title': process.env.OPENROUTER_APP_NAME || 'ImageFlow Prompt Assistant'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature: 0.4,
          max_tokens: 320,
          top_p: 0.9
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('OpenRouter API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200)
        });
        throw createError(
          `OpenRouter isteği başarısız oldu: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`,
          response.status || 502
        );
      }

      const data = await response.json();
      const promptText = this.extractText(data?.choices?.[0]?.message?.content);

      if (!promptText) {
        console.error('OpenRouter returned empty response:', data);
        throw createError('OpenRouter boş bir yanıt döndürdü', 502);
      }

      const latency = Date.now() - startedAt;
      const usage = data?.usage || {};
      const reasoningTokens = (data?.usage as any)?.completion_tokens_details?.reasoning_tokens || 0;

      return {
        prompt: promptText.trim(),
        model: data?.model || this.model,
        latencyMs: Date.now() - startedAt,
        usage: data?.usage
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // Handle fetch errors (network issues, timeouts, etc.)
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        console.error(`⏱️ OpenRouter request timeout after ${Date.now() - startedAt}ms`);
        throw createError('OpenRouter isteği zaman aşımına uğradı. Lütfen tekrar deneyin.', 504);
      }
      
      if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.error(`🌐 OpenRouter network error:`, {
          message: error.message,
          code: error.code,
          url: this.apiUrl
        });
        throw createError('OpenRouter API\'sine bağlanılamadı. İnternet bağlantınızı kontrol edin.', 503);
      }

      // Re-throw if it's already a createError
      if (error.statusCode) {
        throw error;
      }

      // Unknown error
      console.error('OpenRouter unknown error:', error);
      throw createError(`OpenRouter isteği başarısız oldu: ${error.message || 'Bilinmeyen hata'}`, 500);
    }
  }

  private buildUserContent(options: GeneratePromptOptions): MessageContentPart[] {
    const instructionLines: string[] = [
      'The first image below is always the reference (img1). The second image is the generated output (img2) that needs corrections.',
      'Treat img1 as the unrotated source. Use the provided target angle(s) to reason how img2 should look after rotation, and describe the fixes img2 needs to truly appear at that degree.',
      'Compare them carefully and craft a short prompt (up to 3 sentences) that directly instructs img2img what to fix in img2.',
      'Mention concrete corrections only (angles, expression, proportions, lighting, shadows, framing, background cleanup, sharpness).',
      'Only call for additional rotation if img2 visibly deviates from the target degree—describe adjustments that finish the rotation rather than undoing it or snapping back to the original pose.',
      'Do not reference character identity details or restate that img2 should match img1.'
    ];

    if (options.targetAngles && options.targetAngles.length > 0) {
      instructionLines.push(
        `Target rotation relative to img1: ${options.targetAngles.join(', ')}°. Ensure img2 fully reflects this angle.`
      );
    }

    if (options.userNotes) {
      instructionLines.push(`Kullanıcı isteği (bağlama dahil et): ${options.userNotes}`);
    }

    if (options.embeddedPrompt) {
      instructionLines.push(`Sistem notu: ${options.embeddedPrompt}`);
    }

    const content: MessageContentPart[] = [
      { type: 'text', text: instructionLines.join(' ') },
      { type: 'image_url', image_url: { url: options.originalImageData, detail: 'low' } },
      { type: 'image_url', image_url: { url: options.referenceImageData, detail: 'low' } }
    ];

    return content;
  }

  private extractText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }
          if (typeof part === 'object' && part !== null && 'text' in part) {
            return (part as { text?: string }).text || '';
          }
          return '';
        })
        .join(' ')
        .trim();
    }

    if (content && typeof content === 'object' && 'text' in content) {
      return (content as { text?: string }).text || '';
    }

    return '';
  }
}


