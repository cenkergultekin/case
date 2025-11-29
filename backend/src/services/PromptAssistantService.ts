import { FirebasePipelineRepository } from './FirebasePipelineRepository';
import { FileStorageService } from './FileStorageService';
import { OpenRouterService, PromptAssistantResult } from './OpenRouterService';
import { createError } from '../middleware/errorHandler';

interface GenerateAssistantPromptOptions {
  targetAngles?: number[];
  userNotes?: string;
}

export class PromptAssistantService {
  private readonly pipelineRepository: FirebasePipelineRepository;
  private readonly fileStorageService: FileStorageService;
  private readonly openRouterService: OpenRouterService;
  private readonly embeddedPrompt?: string;

  constructor() {
    this.pipelineRepository = new FirebasePipelineRepository();
    this.fileStorageService = new FileStorageService();
    this.openRouterService = new OpenRouterService();
    this.embeddedPrompt = process.env.PROMPT_ASSISTANT_EMBEDDED_PROMPT;
  }

  async generatePrompt(
    userId: string,
    imageId: string,
    processedVersionId: string,
    options: GenerateAssistantPromptOptions = {}
  ): Promise<PromptAssistantResult & { referenceVersionId: string }> {
    const pipeline = await this.pipelineRepository.getPipeline(userId, imageId);
    if (!pipeline) {
      throw createError('Referans görsel bulunamadı', 404);
    }

    const processedVersion = pipeline.processedVersions?.find((version) => version.id === processedVersionId);
    if (!processedVersion) {
      throw createError('Kaynak olarak seçilen işlenmiş görsel bulunamadı', 404);
    }

    const [originalBuffer, processedBuffer] = await Promise.all([
      this.fileStorageService.getFile(pipeline.filename),
      this.fileStorageService.getFile(processedVersion.filename)
    ]);

    const originalMime = pipeline.mimetype || 'image/jpeg';
    const processedMime = 'image/jpeg';

    const originalDataUri = `data:${originalMime};base64,${originalBuffer.toString('base64')}`;
    const processedDataUri = `data:${processedMime};base64,${processedBuffer.toString('base64')}`;

    const assistantResult = await this.openRouterService.generatePrompt({
      originalImageData: originalDataUri,
      referenceImageData: processedDataUri,
      targetAngles: options.targetAngles,
      userNotes: options.userNotes,
      embeddedPrompt: this.embeddedPrompt
    });

    return {
      ...assistantResult,
      referenceVersionId: processedVersionId
    };
  }
}


