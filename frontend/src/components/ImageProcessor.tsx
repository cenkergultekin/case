'use client';

import React, { useRef, useState } from 'react';
import { Loader2, Download, Trash2, X, ArrowLeft } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Slider } from './ui/Slider';
import { AnglePicker } from './AnglePicker';
import { PromptAssistant } from './PromptAssistant';
import { imageAPI, getImageUrl, normalizeImageUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProcessedVersion {
  id: string;
  operation: string;
  aiModel: string;
  parameters: Record<string, any>;
  filename: string;
  url: string;
  createdAt: string;
  processingTimeMs: number;
  sourceImageId?: string;
  sourceProcessedVersionId?: string;
}

interface ImageData {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
  width?: number;
  height?: number;
  processedVersions?: ProcessedVersion[];
}

interface ImageProcessorProps {
  image: ImageData;
  onProcessComplete?: (processedVersion: ProcessedVersion) => void;
  onDelete?: (imageId: string) => void;
  initialSelectedSourceVersion?: string;
  onViewPipeline?: () => void;
  onProcessingStart?: (processingInfo: { angles: number[]; sourceId?: string; processingIds?: string[] }) => void;
  onProcessingError?: (processingIds: string[]) => void;
  onSourceVersionChange?: (versionId: string | null) => void;
}

// Checkpoint açıları - tüm modeller için ortak
const CHECKPOINT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const SEEDREAM_COST_USD = 0.03;
const NANO_COST_USD = 0.04;

const PROCESSING_OPERATIONS = [
  {
    id: 'seedream-edit',
    name: 'Seedream',
    description: 'Advanced scene editing with multiple image support',
    category: 'Edit',
    requiresPrompt: false,
    requiresAngle: true,
    parameters: {},
    details: 'Sahne kompozisyonu, obje ekleme/çıkarma, arka plan değişimi',
    strengths: {
      angle: 'Orta',
      character: 'Düşük',
      cost: 'Düşük'
    }
  },
  {
    id: 'nano-banana-edit',
    name: 'Nano Banana',
    description: 'Fast and efficient image editing with multi-image support',
    category: 'Edit',
    requiresPrompt: false,
    requiresAngle: true,
    parameters: {},
    details: 'Karakter döndürme, açı ayarı, görünüş dönüşümleri',
    strengths: {
      angle: 'Orta',
      character: 'Yüksek',
      cost: 'Orta'
    }
  },
  {
    id: 'flux-multi-angles',
    name: 'Flux 2 Multi Angles',
    description: 'Flux 2 LoRA modeli ile çoklu açı üretimi',
    category: 'Edit',
    requiresPrompt: false,
    requiresAngle: true,
    parameters: {},
    details: 'Horizontal angle (derece) üzerinden farklı görüş açıları üretir',
    strengths: {
      angle: 'Yüksek',
      character: 'Orta',
      cost: 'Değişken'
    }
  }
];

export function ImageProcessor({ image, onProcessComplete, onDelete, initialSelectedSourceVersion, onViewPipeline, onProcessingStart, onProcessingError, onSourceVersionChange }: ImageProcessorProps) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [showPromptInput, setShowPromptInput] = useState<boolean>(false);
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [angle, setAngle] = useState<number | null>(null);
  const [selectedAngles, setSelectedAngles] = useState<number[]>([]);
  const [selectedSourceVersion, setSelectedSourceVersion] = useState<string | null>(initialSelectedSourceVersion || null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [currentSourceAngle, setCurrentSourceAngle] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [pendingAngles, setPendingAngles] = useState<number[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ total: number; completed: number; current: number; progress: number } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [modalScrollPosition, setModalScrollPosition] = useState<number>(0);
  const confirmScrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const originalImageUrl = React.useMemo(() => getImageUrl(image.filename), [image.filename]);
  const selectedSourceVersionData = React.useMemo(() => {
    if (!selectedSourceVersion) return null;
    return image.processedVersions?.find(v => v.id === selectedSourceVersion) || null;
  }, [selectedSourceVersion, image.processedVersions]);
  const megaPixels = React.useMemo(() => {
    if (!image.width || !image.height) return null;
    return (image.width * image.height) / 1_000_000;
  }, [image.width, image.height]);
  const fluxCost = React.useMemo(() => {
    if (selectedOperation !== 'flux-multi-angles' || megaPixels === null) return null;
    return megaPixels * 0.021;
  }, [selectedOperation, megaPixels]);

  // Extract angle from version parameters
  const extractAngleFromVersion = (version: ProcessedVersion | undefined): number | null => {
    if (!version?.parameters) return null;
    
    // First, check if angle is directly stored in parameters
    if (version.parameters.angle !== undefined && version.parameters.angle !== null) {
      return Number(version.parameters.angle);
    }
    
    // Fallback: extract from prompt
    const prompt = version.parameters.prompt;
    if (!prompt) return null;
    
    // New format: "0° rotation" or "Rotate X° clockwise"
    if (prompt.includes('0° rotation') || prompt.match(/^0°\s/)) {
      return 0;
    }
    
    // Match "Rotate X° clockwise" pattern
    const angleMatch = prompt.match(/Rotate\s+(\d+)°\s+clockwise/i);
    if (angleMatch) {
      return parseInt(angleMatch[1]);
    }
    
    // Fallback: Try to extract any angle number at the start
    const fallbackMatch = prompt.match(/^(\d+)°\s/i);
    if (fallbackMatch) {
      return parseInt(fallbackMatch[1]);
    }
    
    return null;
  };

  // Sync initialSelectedSourceVersion with state and set current angle
  React.useEffect(() => {
    if (initialSelectedSourceVersion) {
      setSelectedSourceVersion(initialSelectedSourceVersion);
      const sourceVersion = image.processedVersions?.find(v => v.id === initialSelectedSourceVersion);
      const extractedAngle = extractAngleFromVersion(sourceVersion);
      if (extractedAngle !== null) {
        setCurrentSourceAngle(extractedAngle);
        setAngle(extractedAngle);
        setSelectedAngles([extractedAngle]);
      }
    }
  }, [initialSelectedSourceVersion, image.processedVersions]);

  // When showPromptInput opens and source version is selected, set angle to current source angle
  React.useEffect(() => {
    if (showPromptInput && selectedSourceVersion) {
      const sourceVersion = image.processedVersions?.find(v => v.id === selectedSourceVersion);
      const extractedAngle = extractAngleFromVersion(sourceVersion);
      if (extractedAngle !== null) {
        setCurrentSourceAngle(extractedAngle);
        setAngle(extractedAngle);
      } else {
        setCurrentSourceAngle(null);
        setAngle(null);
      }
    } else if (showPromptInput && !selectedSourceVersion) {
      // Original image, require manual angle selection
      setCurrentSourceAngle(null);
      setAngle(null);
      setSelectedAngles([]);
    }
  }, [showPromptInput, selectedSourceVersion, image.processedVersions]);


  const handleProcess = async (operation: string, parameters: Record<string, any>) => {
    setProcessing(operation);
    setError(null);
    setProcessingStartTime(Date.now());

    try {
      const requestBody = {
        operation,
        parameters,
        ...(selectedSourceVersion && { sourceProcessedVersionId: selectedSourceVersion })
      };
      
      const result = await imageAPI.processImage(image.id, requestBody.operation, requestBody.parameters, requestBody.sourceProcessedVersionId);
      onProcessComplete?.(result.data);
      setShowPromptInput(false);
      setPrompt('');
      setSelectedSourceVersion(null);
      setSelectedOperation('');
      setCurrentSourceAngle(null);
      setAngle(null);
      setSelectedAngles([]);
    } catch (err) {
      console.error('Processing failed:', err);
      setError(err instanceof Error ? err.message : 'İşleme başarısız');
    } finally {
      setProcessing(null);
      setProcessingStartTime(null);
    }
  };

  const handleOperationClick = (operation: any) => {
    if (operation.requiresAngle) {
      setSelectedOperation(operation.id);
      setShowPromptInput(true);
      // Angle will be set by useEffect based on source version
      // If no source version, kullanıcı manuel açı seçmelidir
    } else {
      handleProcess(operation.id, operation.parameters);
    }
  };

  const handlePromptSubmit = () => {
    // Eğer açı değiştirilmediyse (mevcut açıyla aynıysa), açı prompt'unu ekleme
    const effectiveAngles = selectedAngles.length > 0
      ? selectedAngles
      : angle !== null
        ? [angle]
        : (selectedSourceVersion && currentSourceAngle !== null ? [currentSourceAngle] : []);

    if (!selectedSourceVersion && effectiveAngles.length === 0) {
      setError('Lütfen açı seçin');
      return;
    }

    const angleChanged = currentSourceAngle === null || effectiveAngles.some(a => a !== currentSourceAngle);
    
    // Eğer ne açı değişti ne de prompt var, hata ver
    if (!angleChanged && !prompt.trim()) {
      setError('Lütfen açıyı değiştirin veya prompt ekleyin');
      return;
    }
    
    // Onay modalını göster - tüm seçili açıları kaydet
    setPendingAngles(effectiveAngles);
    setModalScrollPosition(window.scrollY);
    setShowConfirmModal(true);

    // Bileşenin üst kısmını görünür alana kaydırarak, fixed modalın
    // ekranda tam olarak görünmesini sağla (modal max 90vh olduğu için)
    setTimeout(() => {
      if (confirmScrollAnchorRef.current) {
        confirmScrollAnchorRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 50);
  };

  const handleConfirmProcess = async () => {
    // Tüm seçili açılar için işlem yap
    const anglesToProcess = pendingAngles.length > 0
      ? pendingAngles
      : angle !== null
        ? [angle]
        : (selectedSourceVersion && currentSourceAngle !== null ? [currentSourceAngle] : []);

    if (!selectedSourceVersion && anglesToProcess.length === 0) {
      setError('Lütfen açı seçin');
      return;
    }

    const angleChanged = currentSourceAngle === null || anglesToProcess.some(a => a !== currentSourceAngle);
    
    // Eğer ne açı değişti ne de prompt var, hata ver
    if (!angleChanged && !prompt.trim()) {
      setError('Lütfen açıyı değiştirin veya prompt ekleyin');
      return;
    }
    
    setShowConfirmModal(false);
    setProcessing(selectedOperation);
    setError(null);
    setProcessingStartTime(Date.now());
    
    // Generate processing IDs for tracking
    const processingIds = anglesToProcess.map((_, index) => `processing-${Date.now()}-${index}`);
    
    // Notify parent about processing start with IDs
    console.log('🟢 ImageProcessor: Calling onProcessingStart', {
      angles: anglesToProcess,
      sourceId: selectedSourceVersion || image.id,
      processingIds,
      hasCallback: !!onProcessingStart
    });
    
    onProcessingStart?.({
      angles: anglesToProcess,
      sourceId: selectedSourceVersion || image.id,
      processingIds
    });
    
    // Immediately switch to pipeline view
    onViewPipeline?.();
    
    // Batch progress tracking
    const totalAngles = anglesToProcess.length;
    setBatchProgress({ total: totalAngles, completed: 0, current: 0, progress: 0 });
    
    let hasError = false;
    const failedProcessingIds: string[] = [];
    
    try {
      // Her açı için ayrı istek gönder (sıralı olarak, her biri tamamlandığında callback çağır)
      // Paralel göndermek yerine sıralı gönderiyoruz çünkü çok fazla paralel istek network sorunlarına yol açabiliyor
      const results = [];
      
      for (let i = 0; i < anglesToProcess.length; i++) {
        const angleToProcess = anglesToProcess[i];
        
        // Update current progress
        setBatchProgress({ total: totalAngles, completed: i, current: i + 1, progress: (i / totalAngles) * 100 });
        
        // Backend'e açı ve custom prompt gönder (prompt generation backend'te yapılacak)
        const parameters = {}; // Empty parameters, backend will generate prompt from angle
        
        // Her açı için ayrı istek gönder
        const finalPrompt = prompt.trim() || undefined;
        
        // Eğer açı değişmediyse ama prompt varsa, mevcut açıyı gönder ki backend rotation prompt + custom prompt birleştirebilsin
        // Eğer açı değiştiyse, yeni açıyı gönder
        // Her durumda açıyı gönder ki backend prompt'u doğru şekilde oluşturabilsin
        const anglesToSend = [angleToProcess]; // Her zaman açıyı gönder
        
        // Validate selectedSourceVersion exists before sending
        const validSourceVersion = selectedSourceVersion && image.processedVersions?.some(v => v.id === selectedSourceVersion)
          ? selectedSourceVersion
          : null;
        
        const requestBody = {
          operation: selectedOperation,
          parameters,
          angles: anglesToSend,
          customPrompt: finalPrompt,
          ...(validSourceVersion && { sourceProcessedVersionId: validSourceVersion })
        };
        
        try {
          const imageStartTime = Date.now();
          const result = await imageAPI.processImage(
            image.id, 
            requestBody.operation, 
            requestBody.parameters, 
            requestBody.sourceProcessedVersionId,
            requestBody.angles,
            requestBody.customPrompt
          );
          results.push(result);
          
          // Her başarılı sonuç için hemen callback çağır (kullanıcı sonuçları görebilsin)
          // Handle different response formats (production vs development)
          // API returns: { success: true, data: ProcessedVersion } or just ProcessedVersion
          const processedVersion = result?.data || result;
          if (processedVersion && processedVersion.id) {
            // Normalize URL if it contains localhost
            if (processedVersion.url && (processedVersion.url.includes('localhost') || processedVersion.url.includes('127.0.0.1'))) {
              processedVersion.url = normalizeImageUrl(processedVersion.url, processedVersion.filename);
            }
            // Ensure all required fields are present
            const normalizedVersion = {
              ...processedVersion,
              url: processedVersion.url || normalizeImageUrl(undefined, processedVersion.filename)
            };
            onProcessComplete?.(normalizedVersion);
          } else {
            console.warn('Invalid processed version received:', processedVersion);
          }
          
          // Update completed progress
          setBatchProgress({ total: totalAngles, completed: i + 1, current: i + 1, progress: ((i + 1) / totalAngles) * 100 });
          
          // Bir sonraki istekten önce kısa bir bekleme (rate limiting için)
          if (i < anglesToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms bekleme
          }
        } catch (err) {
          console.error(`Processing failed for angle ${angleToProcess}:`, err);
          hasError = true;
          failedProcessingIds.push(processingIds[i]);
          // Bir açı başarısız olsa bile diğerlerini denemeye devam et
          setError(`Açı ${angleToProcess}° için işlem başarısız: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
          // Update progress even on error
          setBatchProgress({ total: totalAngles, completed: i + 1, current: i + 2, progress: ((i + 1) / totalAngles) * 100 });
        }
      }
      
      // UI'ı temizle
      setShowPromptInput(false);
      setPrompt('');
      setSelectedSourceVersion(null);
      setSelectedOperation('');
      setCurrentSourceAngle(null);
      setAngle(null);
      setSelectedAngles([]);
      setPendingAngles([]);
      setBatchProgress(null);
    } catch (err) {
      console.error('Processing failed:', err);
      hasError = true;
      setError(err instanceof Error ? err.message : 'İşleme başarısız');
      setBatchProgress(null);
      // Remove all processing states on error
      onProcessingError?.(processingIds);
    } finally {
      // Remove failed processing states
      if (hasError && failedProcessingIds.length > 0) {
        onProcessingError?.(failedProcessingIds);
      }
      setProcessing(null);
      setProcessingStartTime(null);
    }
  };

  const handleDelete = () => {
    setModalScrollPosition(window.scrollY);
    setShowDeleteModal(true);
    // Modal açıldığında görünür hale getir
    setTimeout(() => {
      const modalElement = document.querySelector('[data-modal="delete"]');
      if (modalElement) {
        modalElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const confirmDelete = async () => {
    try {
      await imageAPI.deleteImage(image.id);
      onDelete?.(image.id);
      setShowDeleteModal(false);
    } catch (err) {
      console.error('Delete failed:', err);
      setError(err instanceof Error ? err.message : 'Delete failed');
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="glass rounded-2xl shadow-card-hover border border-white/20 overflow-hidden">
      <div ref={confirmScrollAnchorRef} className="bg-gradient-primary p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">AI İşleme</h2>
            <p className="text-white/90 text-xs font-medium">Görsellerinizi AI ile dönüştürün</p>
          </div>
          <div className="flex items-center gap-2">
            {image.processedVersions && image.processedVersions.length > 0 && onViewPipeline && (
              <Button
                variant="outline"
                size="sm"
                onClick={onViewPipeline}
                className="glass-dark border-white/30 text-white hover:glass-strong hover:border-white/50 text-xs px-2 py-1 h-7"
              >
                Pipeline
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-white hover:glass-dark h-7 w-7 p-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-4">
          {/* Image Preview - Compact */}
          <div className="relative aspect-[4/3] max-h-64 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 mx-auto w-full max-w-md">
            {(() => {
              // If source version is selected, show that image, otherwise show original
              if (selectedSourceVersion) {
                const sourceVersion = image.processedVersions?.find(v => v.id === selectedSourceVersion);
                if (sourceVersion) {
                  const imageUrl = normalizeImageUrl(sourceVersion.url, sourceVersion.filename);
                  return (
                    <img
                      src={imageUrl}
                      alt={sourceVersion.operation}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  );
                }
              }
              return (
                <img
                  src={getImageUrl(image.filename)}
                  alt={image.originalName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              );
            })()}
          </div>

          {/* Image Info - Minimal */}
          <div className="pb-3 border-b border-gray-200">
            {selectedSourceVersion ? (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      Kaynak
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSourceVersion(null);
                      setCurrentSourceAngle(null);
                      setAngle(null);
                      setSelectedAngles([]);
                      onSourceVersionChange?.(null);
                    }}
                    className="text-[10px] px-2 py-0.5 h-6"
                  >
                    <ArrowLeft className="h-2.5 w-2.5 mr-1" />
                    Orijinal
                  </Button>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 truncate">
                  {image.processedVersions?.find(v => v.id === selectedSourceVersion)?.operation.replace(/-/g, ' ') || 'İşlenmiş'}
                </h4>
              </>
            ) : (
              <>
                <h4 className="text-sm font-semibold text-gray-900 truncate">{image.originalName}</h4>
                <p className="text-xs text-gray-600 mt-1">
                  {Math.round(image.size / 1024)} KB
                  {image.width && image.height
                    ? ` / ${((image.width * image.height) / 1_000_000).toFixed(1)} MP`
                    : ''}
                </p>
              </>
            )}
          </div>

          {/* Processing Operations - Compact */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-2">AI Modelleri</h4>
            <div className="grid grid-cols-1 gap-2">
              {PROCESSING_OPERATIONS.map((op) => {
                const isEditModel = op.category === 'Edit';
                
                return (
                  <Button
                    key={op.id}
                    variant="outline"
                    className={cn(
                      "w-full h-auto p-2.5 flex items-center gap-2 justify-start",
                      isEditModel && !processing && "bg-purple-50/50 border-purple-200 hover:bg-purple-50 hover:border-purple-300",
                      isEditModel && processing === op.id && "border-purple-400 bg-purple-50",
                    )}
                    onClick={() => handleOperationClick(op)}
                    disabled={processing !== null}
                  >
                    <div className="flex flex-col gap-0.5 flex-1 items-start">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900">{op.name}</span>
                        {op.id === 'nano-banana-edit' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 rounded">
                            En İyi
                          </span>
                        )}
                      </div>
                      {'strengths' in op && (
                        <div className="flex flex-wrap gap-1 text-[9px] text-gray-600">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
                            Açı: <span className="font-semibold">{(op as any).strengths.angle}</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
                            Karakter: <span className="font-semibold">{(op as any).strengths.character}</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
                            Maliyet: <span className="font-semibold">{(op as any).strengths.cost}</span>
                          </span>
                        </div>
                      )}
                    </div>
                    {processing === op.id && (
                      <Loader2 className={cn(
                        "h-3.5 w-3.5 animate-spin flex-shrink-0 text-purple-600"
                      )} />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Modern Angle Selection Modal */}
          {showPromptInput && (
            <div className="space-y-3 p-4 glass rounded-xl border border-white/20 shadow-card">
              {/* Header - Sadeleştirilmiş */}
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-gray-900">
                  {PROCESSING_OPERATIONS.find(op => op.id === selectedOperation)?.name}
                </h4>
              </div>

              {/* Selected Angles Display - Compact */}
              {selectedAngles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedAngles.map((angle) => {
                    const labels: Record<number, string> = {
                      0: '0° (Ön)', 45: '45°', 90: '90°', 135: '135°',
                      180: '180° (Arka)', 225: '225°', 270: '270°', 315: '315°'
                    };
                    return (
                      <span
                        key={angle}
                        className="px-2.5 py-1 text-xs font-semibold bg-gradient-primary text-white rounded shadow-card border border-primary/30"
                      >
                        {labels[angle] || `${angle}°`}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Model Cost Info - Compact */}
              {selectedOperation === 'flux-multi-angles' && megaPixels !== null && fluxCost !== null && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1.5 text-[10px] text-purple-900 flex items-center justify-between">
                  <span>
                    Maliyet: <span className="font-semibold">${fluxCost.toFixed(3)} - ₺{(fluxCost * 42.5).toFixed(2)}</span>
                  </span>
                  <span className="text-[9px] text-purple-700">
                    {megaPixels.toFixed(2)} MP
                  </span>
                </div>
              )}
              {selectedOperation === 'seedream-edit' && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1.5 text-[10px] text-purple-900 flex items-center justify-between">
                  <span>
                    Maliyet: <span className="font-semibold">${SEEDREAM_COST_USD.toFixed(2)} - ₺{(SEEDREAM_COST_USD * 42.5).toFixed(2)}</span>
                  </span>
                  <span className="text-[9px] text-purple-700">
                    Sabit
                  </span>
                </div>
              )}
              {selectedOperation === 'nano-banana-edit' && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1.5 text-[10px] text-purple-900 flex items-center justify-between">
                  <span>
                    Maliyet: <span className="font-semibold">${NANO_COST_USD.toFixed(2)} - ₺{(NANO_COST_USD * 42.5).toFixed(2)}</span>
                  </span>
                  <span className="text-[9px] text-purple-700">
                    Sabit
                  </span>
                </div>
              )}

              {/* Modern 3D Angle Picker - Compact */}
              <div className="space-y-3">
                {/* Current Angle Badge */}
                {currentSourceAngle !== null && (
                  <div className="flex items-center justify-center">
                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded">
                      Mevcut Açı: {currentSourceAngle}°
                    </span>
                  </div>
                )}
                
                <AnglePicker
                  value={selectedAngles}
                  onAngleChange={(angles) => {
                    setSelectedAngles(angles);
                    setAngle(angles.length > 0 ? angles[0] : null);
                  }}
                  className={cn(processing !== null && "opacity-50 pointer-events-none")}
                />
              </div>

              {/* Prompt Assistant */}
              {selectedSourceVersion && selectedSourceVersionData && (
                <PromptAssistant
                  imageId={image.id}
                  originalImageUrl={originalImageUrl}
                  selectedVersion={selectedSourceVersionData}
                  allProcessedVersions={image.processedVersions || []}
                  prompt={prompt}
                  onPromptChange={setPrompt}
                  angles={selectedAngles}
                  disabled={processing !== null}
                />
              )}
              
              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handlePromptSubmit}
                  disabled={processing !== null}
                  className="flex-1"
                >
                  Görseli İşle
                </Button>
                <Button
                  variant="outline"
                    onClick={() => {
                      setShowPromptInput(false);
                      setPrompt('');
                      setAngle(null);
                      setSelectedAngles([]);
                      setError(null);
                      setSelectedSourceVersion(null);
                      setSelectedOperation('');
                      setCurrentSourceAngle(null);
                    }}
                  disabled={processing !== null}
                >
                  İptal
                </Button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}


        </div>
      </div>

      {/* Process Confirmation Modal */}
      {showConfirmModal && (
        <div 
          className="fixed inset-0 glass-dark z-[100] animate-modal-backdrop"
          data-modal="confirm"
        >
          <div 
            className="glass-strong rounded-2xl shadow-modal max-w-md w-[90%] md:w-full p-6 space-y-5 border border-white/20 animate-modal-content"
            style={{
              position: 'fixed',
              top: '50vh',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <h3 className="text-lg font-bold text-gray-900">
              İşlemi Onaylayın
            </h3>
            <div className="space-y-4">
              <div className="glass-subtle rounded-xl p-4 space-y-3 border border-white/20">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-gray-700">Seçili Açılar:</span>
                  <div className="flex flex-wrap gap-2">
                    {pendingAngles.map(a => {
                      const labels: Record<number, string> = {
                        0: 'Ön', 45: '45°', 90: '90°', 135: '135°',
                        180: 'Arka', 225: '225°', 270: '270°', 315: '315°'
                      };
                      return (
                        <span 
                          key={a}
                          className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-semibold border border-primary/20"
                        >
                          {labels[a] || `${a}°`}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {/* Cost Information */}
                {selectedOperation === 'flux-multi-angles' && megaPixels !== null && fluxCost !== null && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700">Tahmini Maliyet:</span>
                    <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-xs text-purple-900">
                      <span className="font-semibold">${fluxCost.toFixed(3)} - ₺{(fluxCost * 42.5).toFixed(2)}</span>
                      <span className="text-purple-700 ml-2">({megaPixels.toFixed(2)} MP)</span>
                    </div>
                  </div>
                )}
                {selectedOperation === 'seedream-edit' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700">Tahmini Maliyet:</span>
                    <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-xs text-purple-900">
                      <span className="font-semibold">${SEEDREAM_COST_USD.toFixed(2)} - ₺{(SEEDREAM_COST_USD * 42.5).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {selectedOperation === 'nano-banana-edit' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-gray-700">Tahmini Maliyet:</span>
                    <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-xs text-purple-900">
                      <span className="font-semibold">${NANO_COST_USD.toFixed(2)} - ₺{(NANO_COST_USD * 42.5).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {prompt.trim() && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700 flex-shrink-0">Ek Prompt:</span>
                    <span className="text-sm text-gray-600 text-right">
                      {prompt.trim()}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600">
                Bu ayarlarla işlemi başlatmak istediğinizden emin misiniz?
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleConfirmProcess}
                className="flex-1"
              >
                Onayla ve İşle
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
              >
                İptal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 glass-dark z-[100] animate-modal-backdrop"
          data-modal="delete"
        >
          <div 
            className="glass-strong rounded-2xl shadow-modal max-w-md w-[90%] md:w-full p-6 space-y-5 border border-white/20 animate-modal-content"
            style={{
              position: 'fixed',
              top: '50vh',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Görseli Sil
                </h3>
                <p className="text-sm text-gray-600">
                  Bu görseli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm işlenmiş versiyonlar da silinecektir.
                </p>
              </div>
            </div>
            
            <div className="glass-subtle rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  <img
                    src={getImageUrl(image.filename)}
                    alt={image.originalName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {image.originalName}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {Math.round(image.size / 1024)} KB
                  </p>
                  {image.processedVersions && image.processedVersions.length > 0 && (
                    <p className="text-xs text-red-600 font-medium mt-1">
                      +{image.processedVersions.length} işlenmiş versiyon
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={confirmDelete}
                variant="destructive"
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Evet, Sil
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1"
              >
                İptal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

