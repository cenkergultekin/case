/**
 * Prompt Service
 * Handles prompt generation for AI image processing operations
 */
export class PromptService {
  /**
   * AI Model Prompt Generator with Angle Mapping
   * Tüm AI modelleri için (Seedream, Nano-Banana, Flux-Pro-Kontext) ortak prompt generator
   * @param {number} inputDegree - İstenen açı (örn: 90, 270, 45)
   * @returns {string} - AI servisine gönderilecek hazır prompt string'i
   */
  generateRotationPrompt(inputDegree: number): string {
    // 1. Derece - Anlamsal Yön Haritası (Semantic Map)
    // Model dikey eksen etrafında döner, karakter kameraya bakmaz
    const angleMappings: Record<number, { prompt: string }> = {
      0: {
        prompt: "FULL FRONTAL VIEW (0°). Perfectly symmetrical face and torso facing the camera. Both ears equally visible. Direct gaze at camera."
      },
      45: {
        prompt: "RIGHT FRONT THREE-QUARTER VIEW (45°). Oblique angle shot. Distinctly showing two planes of the body: the front torso and the right side profile simultaneously. Right shoulder prominent. The far left side of the body is foreshortened and partially hidden by perspective. Gaze directed right."
      },
      90: {
        prompt: "RIGHT SIDE PROFILE VIEW (90°). Strictly a side view. Only the right half of the body and face is visible. The nose points exactly 90 degrees to the right. No part of the left eye or left arm is visible. Flat depth."
      },
      135: {
        prompt: "RIGHT REAR THREE-QUARTER VIEW (135°). View from behind the right shoulder. Prominent view of the back of the head and right shoulder blade. Face is completely obscured (occluded) by the head angle."
      },
      180: {
        prompt: "FULL DORSAL VIEW (180°). Strictly from behind. View of the spine and back. Back of head only. No facial features visible whatsoever."
      },
      225: {
        prompt: "LEFT REAR THREE-QUARTER VIEW (225°). View from behind the left shoulder. Prominent view of the back of the head and left shoulder blade. Face is completely obscured (occluded) by the head angle."
      },
      270: {
        prompt: "LEFT SIDE PROFILE VIEW (270°). Strictly a side view. Only the left half of the body and face is visible. The nose points exactly 90 degrees to the left. No part of the right eye or right arm is visible. Flat depth."
      },
      315: {
        prompt: "LEFT FRONT THREE-QUARTER VIEW (315°). Oblique angle shot. Distinctly showing two planes of the body: the front torso and the left side profile simultaneously. Left shoulder prominent. The far right side of the body is foreshortened and partially hidden by perspective. Gaze directed left."
      }
    };
    // 2. En yakın tanımlı açıyı bulma (Snap to nearest angle)
    const validAngles = Object.keys(angleMappings).map(Number);
    
    // Gelen açıyı 0-360 arasına normalize et
    let normalizedDegree = inputDegree % 360;
    if (normalizedDegree < 0) normalizedDegree += 360;

    const closestAngle = validAngles.reduce((prev, curr) => {
      return (Math.abs(curr - normalizedDegree) < Math.abs(prev - normalizedDegree) ? curr : prev);
    });

    // 3. Prompt İnşası (Tüm AI Modelleri İçin Optimize Edilmiş)
    // Kısa prompt - Fal.ai API uzun prompt'larda Forbidden hatası verebilir
    const directionKeyword = angleMappings[closestAngle].prompt;
    
    // Sadece açı bilgisi döndür
    return directionKeyword;
  }

  /**
   * Generate final prompt by combining rotation prompt with custom prompt
   * @param {number} angle - Rotation angle
   * @param {string} customPrompt - Optional custom prompt from user
   * @returns {string} - Final combined prompt
   */
  generateFinalPrompt(angle: number, customPrompt?: string): string {
    let finalPrompt = '';
    
    // Generate rotation prompt
    const rotationPrompt = this.generateRotationPrompt(angle);
    finalPrompt = rotationPrompt;
    
    // Add custom prompt if provided
    if (customPrompt && customPrompt.trim()) {
      finalPrompt = `${finalPrompt}, ${customPrompt.trim()}`;
    }
    
    return finalPrompt;
  }
}

