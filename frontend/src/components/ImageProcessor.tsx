'use client';

import React, { useState } from 'react';
import { Loader2, Download, Trash2, X, HelpCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Slider } from './ui/Slider';
import { AnglePicker } from './AnglePicker';
import { imageAPI, getImageUrl } from '@/lib/api';
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
  processedVersions?: ProcessedVersion[];
}

interface ImageProcessorProps {
  image: ImageData;
  onProcessComplete?: (processedVersion: ProcessedVersion) => void;
  onDelete?: (imageId: string) => void;
  initialSelectedSourceVersion?: string;
  onViewPipeline?: () => void;
}

/**
 * AI Model Prompt Generator with Angle Mapping
 * Tüm AI modelleri için (Seedream, Nano-Banana, Flux-Pro-Kontext) ortak prompt generator
 * @param {string} referenceImage - Görselin kaynağı/adı (artık prompt'ta kullanılmıyor, geriye uyumluluk için tutuldu)
 * @param {number} inputDegree - İstenen açı (örn: 90, 270, 45)
 * @returns {string} - AI servisine gönderilecek hazır prompt string'i (sadece metin, referans görsel image_urls'de gönderilir)
 */
const generateRotationPrompt = (
  referenceImage: string, 
  inputDegree: number
): string => {
  // 1. Derece - Anlamsal Yön Haritası (Semantic Map)
  // Model dikey eksen etrafında döner, karakter kameraya bakmaz
  const angleMappings: Record<number, { prompt: string }> = {
    0: {
      prompt: "Frontal view. Same pose, clothing, identity. Keep exact reference appearance."
    },
    45: {
      prompt: "Rotate 45° clockwise. Right front quarter view. Same pose, clothing, identity. Keep exact reference appearance."
    },
    90: {
      prompt: "Rotate 90° clockwise. Right side profile. Same pose, clothing, identity. Keep exact reference appearance."
    },
    135: {
      prompt: "Rotate 135° clockwise. Right back quarter view. Same pose, clothing, identity. Keep exact reference appearance."
    },
    180: {
      prompt: "Rotate 180°. Back view. Same pose, clothing, identity. Keep exact reference appearance."
    },
    225: {
      prompt: "Rotate 225° clockwise. Left back quarter view. Same pose, clothing, identity. Keep exact reference appearance."
    },
    270: {
      prompt: "Rotate 270° clockwise. Left side profile. Same pose, clothing, identity. Keep exact reference appearance."
    },
    315: {
      prompt: "Rotate 315° clockwise. Left front quarter view. Same pose, clothing, identity. Keep exact reference appearance."
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
  // Referans görsel adı prompt'tan çıkarıldı - görsel image_urls array'inde gönderilir
  // Kısa prompt - Fal.ai API uzun prompt'larda Forbidden hatası verebilir
  const directionKeyword = angleMappings[closestAngle].prompt;
  
  // Sadece açı bilgisi döndür - gereksiz tekrarları kaldır
  return directionKeyword;
};

// Checkpoint açıları - tüm modeller için ortak
const CHECKPOINT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const PROCESSING_OPERATIONS = [
  {
    id: 'seedream-edit',
    name: 'Seedream',
    description: 'Advanced scene editing with multiple image support',
    category: 'Edit',
    requiresPrompt: false,
    requiresAngle: true,
    parameters: {},
    details: 'Scene composition, object addition/removal, background changes'
  },
  {
    id: 'nano-banana-edit',
    name: 'Nano Banana',
    description: 'Fast and efficient image editing with multi-image support',
    category: 'Edit',
    requiresPrompt: false,
    requiresAngle: true,
    parameters: {},
    details: 'Character rotation, angle adjustments, view transformations'
  },
  {
    id: 'topaz-upscale',
    name: 'Upscale',
    description: 'AI-powered image upscaling for higher resolution',
    category: 'Enhance',
    requiresPrompt: false,
    requiresAngle: false,
    parameters: {},
    details: 'Resolution enhancement, quality improvement, print preparation'
  },
];

export function ImageProcessor({ image, onProcessComplete, onDelete, initialSelectedSourceVersion, onViewPipeline }: ImageProcessorProps) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [showPromptInput, setShowPromptInput] = useState<boolean>(false);
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [angle, setAngle] = useState<number>(0);
  const [selectedAngles, setSelectedAngles] = useState<number[]>([0]);
  const [selectedSourceVersion, setSelectedSourceVersion] = useState<string | null>(initialSelectedSourceVersion || null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [currentSourceAngle, setCurrentSourceAngle] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [pendingAngles, setPendingAngles] = useState<number[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ total: number; completed: number; current: number; progress: number } | null>(null);
  const [showRotationInfo, setShowRotationInfo] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showUpscaleModal, setShowUpscaleModal] = useState<boolean>(false);
  const [modalScrollPosition, setModalScrollPosition] = useState<number>(0);

  // Extract angle from version parameters
  const extractAngleFromVersion = (version: ProcessedVersion | undefined): number | null => {
    if (!version?.parameters?.prompt) return null;
    
    const prompt = version.parameters.prompt;
    // Try to extract angle from prompt - look for "Rotate the model by X°" or "No rotation" (0°)
    if (prompt.includes('No rotation') || prompt.includes('Same pose as reference')) {
      return 0;
    }
    const angleMatch = prompt.match(/Rotate the model by (\d+)°/i);
    if (angleMatch) {
      return parseInt(angleMatch[1]);
    }
    
    // Fallback: Try to extract any angle number
    const fallbackMatch = prompt.match(/(\d+)\s*(?:degree|deg|°)/i);
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
        setAngle(0);
      }
    } else if (showPromptInput && !selectedSourceVersion) {
      // Original image, no current angle
      setCurrentSourceAngle(null);
      setAngle(0);
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
      // If no source version, it will default to 0
    } else if (operation.id === 'topaz-upscale') {
      // Show confirmation modal for upscale
      setSelectedOperation(operation.id);
      handleUpscaleClick();
    } else {
      handleProcess(operation.id, operation.parameters);
    }
  };

  const handleUpscaleClick = () => {
    setModalScrollPosition(window.scrollY);
    setShowUpscaleModal(true);
    // Modal açıldığında görünür hale getir
    setTimeout(() => {
      const modalElement = document.querySelector('[data-modal="upscale"]');
      if (modalElement) {
        modalElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const confirmUpscale = () => {
    setShowUpscaleModal(false);
    handleProcess(selectedOperation, {});
  };

  const handlePromptSubmit = () => {
    // Hangi görseli kullanacağımızı belirle
    let sourceFilename = image.filename;
    if (selectedSourceVersion) {
      const sourceVersion = image.processedVersions?.find(v => v.id === selectedSourceVersion);
      if (sourceVersion) {
        sourceFilename = sourceVersion.filename;
      }
    }
    
    // Eğer açı değiştirilmediyse (mevcut açıyla aynıysa), açı prompt'unu ekleme
    const angleChanged = currentSourceAngle === null || angle !== currentSourceAngle;
    
    // Eğer ne açı değişti ne de prompt var, hata ver
    if (!angleChanged && !prompt.trim()) {
      setError('Lütfen açıyı değiştirin veya prompt ekleyin');
      return;
    }
    
    // Onay modalını göster - tüm seçili açıları kaydet
    setPendingAngles(selectedAngles.length > 0 ? selectedAngles : [angle]);
    setModalScrollPosition(window.scrollY);
    setShowConfirmModal(true);
    // Modal açıldığında scroll pozisyonunu koru ama modal görünür olsun
    setTimeout(() => {
      const modalElement = document.querySelector('[data-modal="confirm"]');
      if (modalElement) {
        modalElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleConfirmProcess = async () => {
    // Hangi görseli kullanacağımızı belirle
    let sourceFilename = image.filename;
    if (selectedSourceVersion) {
      const sourceVersion = image.processedVersions?.find(v => v.id === selectedSourceVersion);
      if (sourceVersion) {
        sourceFilename = sourceVersion.filename;
      }
    }
    
    // Tüm seçili açılar için işlem yap
    const anglesToProcess = pendingAngles.length > 0 ? pendingAngles : [angle];
    const angleChanged = currentSourceAngle === null || !anglesToProcess.includes(currentSourceAngle || -1);
    
    // Eğer ne açı değişti ne de prompt var, hata ver
    if (!angleChanged && !prompt.trim()) {
      setError('Lütfen açıyı değiştirin veya prompt ekleyin');
      return;
    }
    
    setShowConfirmModal(false);
    setProcessing(selectedOperation);
    setError(null);
    setProcessingStartTime(Date.now());
    
    // Batch progress tracking
    const totalAngles = anglesToProcess.length;
    setBatchProgress({ total: totalAngles, completed: 0, current: 0, progress: 0 });
    
    try {
      // Her açı için ayrı istek gönder (sıralı olarak, her biri tamamlandığında callback çağır)
      // Paralel göndermek yerine sıralı gönderiyoruz çünkü çok fazla paralel istek network sorunlarına yol açabiliyor
      const results = [];
      
      for (let i = 0; i < anglesToProcess.length; i++) {
        const angleToProcess = anglesToProcess[i];
        
        // Update current progress
        setBatchProgress({ total: totalAngles, completed: i, current: i + 1, progress: (i / totalAngles) * 100 });
        
        // Her açı için prompt oluştur
        let finalPrompt = '';
        if (angleChanged) {
          const rotationPrompt = generateRotationPrompt(sourceFilename, angleToProcess);
          finalPrompt = rotationPrompt;
        }
        
        // Eğer kullanıcı prompt girmişse, birleştir
        if (prompt.trim()) {
          if (finalPrompt) {
            finalPrompt = `${finalPrompt}, ${prompt.trim()}`;
          } else {
            finalPrompt = prompt.trim();
          }
        }
        
        const parameters = { prompt: finalPrompt };
        
        // Her açı için ayrı istek gönder
        const requestBody = {
          operation: selectedOperation,
          parameters,
          ...(selectedSourceVersion && { sourceProcessedVersionId: selectedSourceVersion })
        };
        
        try {
          const imageStartTime = Date.now();
          const result = await imageAPI.processImage(image.id, requestBody.operation, requestBody.parameters, requestBody.sourceProcessedVersionId);
          results.push(result);
          
          // Her başarılı sonuç için hemen callback çağır (kullanıcı sonuçları görebilsin)
          onProcessComplete?.(result.data);
          
          // Update completed progress
          setBatchProgress({ total: totalAngles, completed: i + 1, current: i + 1, progress: ((i + 1) / totalAngles) * 100 });
          
          // Bir sonraki istekten önce kısa bir bekleme (rate limiting için)
          if (i < anglesToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms bekleme
          }
        } catch (err) {
          console.error(`Processing failed for angle ${angleToProcess}:`, err);
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
      setSelectedAngles([0]);
      setPendingAngles([]);
      setBatchProgress(null);
    } catch (err) {
      console.error('Processing failed:', err);
      setError(err instanceof Error ? err.message : 'İşleme başarısız');
      setBatchProgress(null);
    } finally {
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
      <div className="bg-gradient-primary p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">AI İşleme</h2>
            <p className="text-white/90 text-sm font-medium">Görsellerinizi AI ile dönüştürün</p>
          </div>
          <div className="flex items-center gap-2">
            {image.processedVersions && image.processedVersions.length > 0 && onViewPipeline && (
              <Button
                variant="outline"
                size="sm"
                onClick={onViewPipeline}
                className="glass-dark border-white/30 text-white hover:glass-strong hover:border-white/50"
              >
                Pipeline'ı Görüntüle
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-white hover:glass-dark"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-6">
          {/* Image Preview */}
          <div className="relative aspect-video border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
            {(() => {
              // If source version is selected, show that image, otherwise show original
              if (selectedSourceVersion) {
                const sourceVersion = image.processedVersions?.find(v => v.id === selectedSourceVersion);
                if (sourceVersion) {
                  const imageUrl = sourceVersion.url?.includes('/api/uploads/') ? sourceVersion.url : getImageUrl(sourceVersion.filename);
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
          <div className="pb-5 border-b border-gray-200">
            {selectedSourceVersion ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                    İşlenmiş Versiyon Kaynak Olarak Kullanılıyor
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900 truncate">
                  {image.processedVersions?.find(v => v.id === selectedSourceVersion)?.operation.replace(/-/g, ' ') || 'İşlenmiş'}
                </h4>
              </>
            ) : (
              <>
                <h4 className="font-semibold text-gray-900 truncate">{image.originalName}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {Math.round(image.size / 1024)} KB • {image.mimetype.split('/')[1].toUpperCase()}
                </p>
              </>
            )}
          </div>

          {/* Processing Operations */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">AI Modelleri</h4>
            <div className="grid grid-cols-1 gap-2.5">
              {PROCESSING_OPERATIONS.map((op) => {
                const isUpscale = op.id === 'topaz-upscale';
                const isEditModel = op.category === 'Edit';
                
                return (
                  <Button
                    key={op.id}
                    variant="outline"
                    className={cn(
                      "w-full h-auto p-3.5 flex items-center gap-3 justify-start",
                      // Edit modelleri için mor tonları
                      isEditModel && !processing && "bg-purple-50/50 border-purple-200 hover:bg-purple-50 hover:border-purple-300",
                      isEditModel && processing === op.id && "border-purple-400 bg-purple-50",
                      // Upscale için yeşil tonları
                      isUpscale && !processing && "bg-green-50/50 border-green-200 hover:bg-green-50 hover:border-green-300",
                      isUpscale && processing === op.id && "border-green-400 bg-green-50"
                    )}
                    onClick={() => handleOperationClick(op)}
                    disabled={processing !== null}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium text-gray-900">{op.name}</span>
                      {op.id === 'nano-banana-edit' && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-md">
                          En İyi
                        </span>
                      )}
                    </div>
                    {processing === op.id && (
                      <Loader2 className={cn(
                        "h-4 w-4 animate-spin flex-shrink-0",
                        isEditModel && "text-purple-600",
                        isUpscale && "text-green-600"
                      )} />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Modern Angle Selection Modal */}
          {showPromptInput && (
            <div className="space-y-5 p-6 glass rounded-2xl border border-white/20 shadow-card">
              {/* Header - Sadeleştirilmiş */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white",
                  PROCESSING_OPERATIONS.find(op => op.id === selectedOperation)?.category === 'Edit' 
                    ? "bg-purple-600" 
                    : "bg-green-600"
                )}>
                  {PROCESSING_OPERATIONS.find(op => op.id === selectedOperation)?.category === 'Edit' ? 'ED' : 'EN'}
                </div>
                <h4 className="font-semibold text-gray-900">
                  {PROCESSING_OPERATIONS.find(op => op.id === selectedOperation)?.name}
                </h4>
              </div>

              {/* Rotation Info Panel */}
              <div className="p-3.5 glass-strong rounded-xl border border-white/20 shadow-minimal">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Dönüş Bilgisi:</span>
                    <button
                      type="button"
                      onClick={() => setShowRotationInfo(!showRotationInfo)}
                      className={cn(
                        "p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-smooth",
                        showRotationInfo && "text-primary bg-primary/10"
                      )}
                      title="Dönüş açıları hakkında bilgi"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </div>
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
                            className="px-2 py-1 text-xs font-semibold bg-primary/10 text-primary rounded-md border border-primary/20"
                          >
                            {labels[angle] || `${angle}°`}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Rotation Info Details */}
                {showRotationInfo && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 animate-fade-in">
                    <p className="text-xs text-gray-600">
                      Model dikey eksen etrafında döner. Karakter kameraya bakmaz, orijinal bakış yönünü korur.
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
                        const labels: Record<number, string> = {
                          0: 'Ön', 45: '45°', 90: '90°', 135: '135°',
                          180: 'Arka', 225: '225°', 270: '270°', 315: '315°'
                        };
                        const descriptions: Record<number, string> = {
                          0: 'Ön görünüm',
                          45: 'Sağ ön çapraz',
                          90: 'Sağ profil',
                          135: 'Sağ arka çapraz',
                          180: 'Arka görünüm',
                          225: 'Sol arka çapraz',
                          270: 'Sol profil',
                          315: 'Sol ön çapraz'
                        };
                        return (
                          <div key={angle} className="space-y-1">
                            <div className="aspect-square bg-gray-100 rounded border border-gray-200 flex flex-col items-center justify-center overflow-hidden p-1">
                              <div className="text-[10px] font-semibold text-gray-700">{labels[angle]}</div>
                              <div className="text-[8px] text-gray-500 text-center">{descriptions[angle]}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modern 3D Angle Picker */}
              <div className="space-y-4">
                {/* Current Angle Badge */}
                {currentSourceAngle !== null && (
                  <div className="flex items-center justify-center">
                    <span className="px-3 py-1.5 text-xs font-semibold bg-primary/10 text-primary border border-primary/20 rounded-lg">
                      Mevcut Açı: {currentSourceAngle}°
                    </span>
                  </div>
                )}
                
                <AnglePicker
                  value={selectedAngles}
                  onAngleChange={(angles) => {
                    setSelectedAngles(angles);
                    setAngle(angles[0] || 0);
                  }}
                  className={cn(processing !== null && "opacity-50 pointer-events-none")}
                />
              </div>

              {/* Custom Prompt Input - Only show if source version is selected */}
              {selectedSourceVersion && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Ek Prompt (İsteğe Bağlı)
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ek talimatlar girin (örn: 'güneş gözlüğü takıyor', 'gülümsüyor', 'kırmızı arka plan')"
                    className="w-full min-h-[100px] px-4 py-3 border border-gray-200 rounded-lg focus-ring resize-none text-sm"
                    disabled={processing !== null}
                  />
                  <p className="text-xs text-gray-600">
                    Bu, döndürme açısı ile birleştirilecektir. Sadece açıyı değiştirmek için boş bırakın.
                  </p>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handlePromptSubmit}
                  disabled={processing !== null}
                  className="flex-1"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      İşleniyor...
                    </>
                  ) : (
                    'Görseli İşle'
                  )}
                </Button>
                <Button
                  variant="outline"
                    onClick={() => {
                      setShowPromptInput(false);
                      setPrompt('');
                      setAngle(0);
                      setSelectedAngles([0]);
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

          {/* Processing Timer & Batch Progress */}
          {processing && processingStartTime && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg animate-fade-in space-y-3">
              {batchProgress && batchProgress.total > 1 ? (
                <>
                  {/* Batch Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 font-medium">
                        Toplu Üretim: {batchProgress.completed}/{batchProgress.total} tamamlandı
                      </span>
                      <span className="text-primary font-semibold">
                        {Math.round(batchProgress.progress)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-gradient-primary h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${batchProgress.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      Şu an işleniyor: {batchProgress.current}. görsel ({batchProgress.total} açıdan)
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-gray-700 font-medium">
                    İşleniyor...
                  </span>
                </div>
              )}
            </div>
          )}


        </div>
      </div>

      {/* Process Confirmation Modal */}
      {showConfirmModal && (
        <div 
          className="fixed inset-0 glass-dark z-[100] animate-fade-in"
          data-modal="confirm"
        >
          <div 
            className="glass-strong rounded-2xl shadow-modal max-w-md w-[90%] md:w-full p-6 space-y-5 border border-white/20"
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
                {pendingAngles.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Dönüş Açıları:</span>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {pendingAngles.map((angle) => {
                        const labels: Record<number, string> = {
                          0: '0°', 45: '45°', 90: '90°', 135: '135°',
                          180: '180°', 225: '225°', 270: '270°', 315: '315°'
                        };
                        return (
                          <span
                            key={angle}
                            className="px-2 py-1 text-xs font-semibold bg-primary/10 text-primary rounded-md"
                          >
                            {labels[angle] || `${angle}°`}
                          </span>
                        );
                      })}
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

      {/* Upscale Confirmation Modal */}
      {showUpscaleModal && (
        <div 
          className="fixed inset-0 glass-dark z-[100] animate-fade-in"
          data-modal="upscale"
        >
          <div 
            className="glass-strong rounded-2xl shadow-modal max-w-md w-[90%] md:w-full p-6 space-y-5 border border-white/20"
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
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Kalite Yükseltme
                </h3>
                <p className="text-sm text-gray-600">
                  Bu görselin çözünürlüğünü AI ile yükseltmek istediğinizden emin misiniz? İşlem birkaç saniye sürebilir.
                </p>
              </div>
            </div>
            
            <div className="glass-subtle rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {(() => {
                    if (selectedSourceVersion) {
                      const sourceVersion = image.processedVersions?.find(v => v.id === selectedSourceVersion);
                      if (sourceVersion) {
                        const imageUrl = sourceVersion.url?.includes('/api/uploads/') ? sourceVersion.url : getImageUrl(sourceVersion.filename);
                        return (
                          <img
                            src={imageUrl}
                            alt={sourceVersion.operation}
                            className="w-full h-full object-cover"
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
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    );
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    Upscale İşlemi
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AI-Powered
                    </span>
                    <span>•</span>
                    <span>Yüksek Kalite</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={confirmUpscale}
                className="flex-1"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Evet, Yükselt
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowUpscaleModal(false)}
                className="flex-1"
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
          className="fixed inset-0 glass-dark z-[100] animate-fade-in"
          data-modal="delete"
        >
          <div 
            className="glass-strong rounded-2xl shadow-modal max-w-md w-[90%] md:w-full p-6 space-y-5 border border-white/20"
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

