'use client';

import React, { useState } from 'react';
import { Loader2, Download, Trash2, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Slider } from './ui/Slider';
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
 * Nano-Banana Prompt Generator with Angle Mapping
 * @param {string} referenceImage - Görselin kaynağı/adı (örn: "image_0.png")
 * @param {number} inputDegree - İstenen açı (örn: 90, 270, 45)
 * @returns {string} - AI servisine gönderilecek hazır prompt string'i
 */
const generateRotationPrompt = (referenceImage: string, inputDegree: number): string => {
  // 1. Derece - Anlamsal Yön Haritası (Semantic Map)
  const angleMappings: Record<number, string> = {
    0: "front view, looking at camera",
    45: "three-quarter view facing right",
    90: "side profile facing right",
    135: "rear three-quarter view facing right",
    180: "back view",
    225: "rear three-quarter view facing left",
    270: "side profile facing left",
    315: "three-quarter view facing left"
  };

  // 2. En yakın tanımlı açıyı bulma (Snap to nearest angle)
  const validAngles = Object.keys(angleMappings).map(Number);
  
  // Gelen açıyı 0-360 arasına normalize et
  let normalizedDegree = inputDegree % 360;
  if (normalizedDegree < 0) normalizedDegree += 360;

  const closestAngle = validAngles.reduce((prev, curr) => {
    return (Math.abs(curr - normalizedDegree) < Math.abs(prev - normalizedDegree) ? curr : prev);
  });

  // 3. Prompt İnşası (Nano-Style)
  const directionKeyword = angleMappings[closestAngle];
  
  return `${referenceImage}, ${directionKeyword}, full body shot, consistent character, same model, keep identity, same attire, maintain body proportions.`;
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
  }
];

export function ImageProcessor({ image, onProcessComplete, onDelete, initialSelectedSourceVersion, onViewPipeline }: ImageProcessorProps) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [showPromptInput, setShowPromptInput] = useState<boolean>(false);
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [angle, setAngle] = useState<number>(0);
  const [selectedSourceVersion, setSelectedSourceVersion] = useState<string | null>(initialSelectedSourceVersion || null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [currentSourceAngle, setCurrentSourceAngle] = useState<number | null>(null);

  // Extract angle from version parameters
  const extractAngleFromVersion = (version: ProcessedVersion | undefined): number | null => {
    if (!version?.parameters?.prompt) return null;
    
    const prompt = version.parameters.prompt;
    // Try to extract angle from prompt
    const angleMatch = prompt.match(/(\d+)\s*(?:degree|deg|°)/i);
    if (angleMatch) {
      return parseInt(angleMatch[1]);
    }
    
    // Try semantic matches
    if (prompt.includes('front view')) return 0;
    if (prompt.includes('three-quarter view facing right')) return 45;
    if (prompt.includes('side profile facing right')) return 90;
    if (prompt.includes('rear three-quarter view facing right')) return 135;
    if (prompt.includes('back view')) return 180;
    if (prompt.includes('rear three-quarter view facing left')) return 225;
    if (prompt.includes('side profile facing left')) return 270;
    if (prompt.includes('three-quarter view facing left')) return 315;
    
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
      setError(err instanceof Error ? err.message : 'Processing failed');
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
      // Upscale doesn't need prompt or angle, process immediately
      handleProcess(operation.id, {});
    } else {
      handleProcess(operation.id, operation.parameters);
    }
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
    
    let finalPrompt = '';
    if (angleChanged) {
      // Açı değiştirildi, açı prompt'unu ekle
      const rotationPrompt = generateRotationPrompt(sourceFilename, angle);
      finalPrompt = rotationPrompt;
    }
    
    // Eğer kullanıcı prompt girmişse ve source version varsa, birleştir
    if (selectedSourceVersion && prompt.trim()) {
      if (finalPrompt) {
        finalPrompt = `${finalPrompt}, ${prompt.trim()}`;
      } else {
        finalPrompt = prompt.trim();
      }
    }
    
    // Eğer ne açı değişti ne de prompt var, hata ver
    if (!angleChanged && !prompt.trim()) {
      setError('Lütfen açıyı değiştirin veya prompt ekleyin');
      return;
    }
    
    const parameters = { prompt: finalPrompt };
    handleProcess(selectedOperation, parameters);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this image?')) {
      try {
        await imageAPI.deleteImage(image.id);
        onDelete?.(image.id);
      } catch (err) {
        console.error('Delete failed:', err);
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">AI İşleme</h2>
              <p className="text-white/80 text-sm">Görsellerinizi AI ile dönüştürün</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {image.processedVersions && image.processedVersions.length > 0 && onViewPipeline && (
              <Button
                variant="outline"
                size="sm"
                onClick={onViewPipeline}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30"
              >
                Pipeline'ı Görüntüle
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="space-y-6 md:space-y-8 lg:space-y-10">
          {/* Image Preview */}
          <div className="relative aspect-video border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
            {(() => {
              // If source version is selected, show that image, otherwise show original
              if (selectedSourceVersion) {
                const sourceVersion = image.processedVersions?.find(v => v.id === selectedSourceVersion);
                if (sourceVersion) {
                  return (
                    <img
                      src={sourceVersion.url?.includes('/api/uploads/') ? sourceVersion.url : getImageUrl(sourceVersion.filename)}
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
          <div className="pb-4 border-b border-gray-100">
            {selectedSourceVersion ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    Using Processed Version as Source
                  </span>
                </div>
                <h4 className="font-medium text-gray-900 truncate">
                  {image.processedVersions?.find(v => v.id === selectedSourceVersion)?.operation.replace(/-/g, ' ') || 'Processed'}
                </h4>
              </>
            ) : (
              <>
                <h4 className="font-medium text-gray-900 truncate">{image.originalName}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round(image.size / 1024)} KB • {image.mimetype.split('/')[1].toUpperCase()}
                </p>
              </>
            )}
          </div>

          {/* Processing Operations */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">AI Modelleri</h4>
            <div className="grid grid-cols-1 gap-2">
              {PROCESSING_OPERATIONS.map((op) => {
                const isUpscale = op.id === 'topaz-upscale';
                const isEditModel = op.category === 'Edit';
                
                return (
                  <Button
                    key={op.id}
                    variant="outline"
                    className={cn(
                      "w-full h-auto p-3 flex items-center gap-3 transition-all",
                      // Edit modelleri için mor tonları
                      isEditModel && !processing && "bg-purple-50 border-purple-200 hover:border-purple-400 hover:bg-purple-100",
                      isEditModel && processing === op.id && "border-purple-400 bg-purple-100",
                      // Upscale için yeşil tonları
                      isUpscale && !processing && "bg-green-50 border-green-200 hover:border-green-400 hover:bg-green-100",
                      isUpscale && processing === op.id && "border-green-400 bg-green-100"
                    )}
                    onClick={() => handleOperationClick(op)}
                    disabled={processing !== null}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium text-gray-900">{op.name}</span>
                      {op.id === 'nano-banana-edit' && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-md">
                          En İyi
                        </span>
                      )}
                    </div>
                    {processing === op.id && (
                      <Loader2 className={cn(
                        "h-4 w-4 animate-spin",
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
            <div className="space-y-6 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* Header - Sadeleştirilmiş */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white",
                  PROCESSING_OPERATIONS.find(op => op.id === selectedOperation)?.category === 'Edit' 
                    ? "bg-gradient-to-r from-purple-500 to-pink-500" 
                    : "bg-gradient-to-r from-green-500 to-blue-500"
                )}>
                  {PROCESSING_OPERATIONS.find(op => op.id === selectedOperation)?.category === 'Edit' ? 'ED' : 'EN'}
                </div>
                <h4 className="font-semibold text-gray-900 text-lg">
                  {PROCESSING_OPERATIONS.find(op => op.id === selectedOperation)?.name}
                </h4>
              </div>

              {/* Modern Angle Slider */}
              <div className="space-y-6 py-4">
                {/* Current Angle Badge */}
                {currentSourceAngle !== null && (
                  <div className="flex items-center justify-center mb-2">
                    <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 rounded-full">
                      Mevcut Açı: {currentSourceAngle}°
                    </span>
                  </div>
                )}
                
                <Slider
                  value={angle}
                  onValueChange={setAngle}
                  min={0}
                  max={360}
                  step={5}
                  label="Döndürme Açısı"
                  showValue={true}
                  snapPoints={CHECKPOINT_ANGLES}
                  snapThreshold={5}
                  disabled={processing !== null}
                />
                
                {/* Checkpoint labels - minimal */}
                <div className="relative w-full">
                  <div className="flex justify-between text-xs text-gray-500">
                    {CHECKPOINT_ANGLES.map((checkpoint) => {
                      const isActive = Math.abs(angle - checkpoint) <= 5;
                      const isCurrentAngle = currentSourceAngle !== null && Math.abs(currentSourceAngle - checkpoint) <= 5;
                      const labels: Record<number, string> = {
                        0: 'Front',
                        45: '¾R',
                        90: 'Right',
                        135: '¾R',
                        180: 'Back',
                        225: '¾L',
                        270: 'Left',
                        315: '¾L'
                      };
                      return (
                        <div
                          key={checkpoint}
                          className={cn(
                            "text-center transition-all duration-200 relative",
                            isActive ? "text-blue-600 font-semibold scale-110" : "text-gray-400"
                          )}
                        >
                          <div className="text-[10px]">{labels[checkpoint]}</div>
                          {isCurrentAngle && !isActive && (
                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                              <span className="px-1.5 py-0.5 text-[8px] font-medium bg-blue-100 text-blue-600 rounded border border-blue-200">
                                Current
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
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
                    className="w-full min-h-[100px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                    disabled={processing !== null}
                  />
                  <p className="text-xs text-gray-500">
                    Bu, döndürme açısı ile birleştirilecektir. Sadece açıyı değiştirmek için boş bırakın.
                  </p>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handlePromptSubmit}
                  disabled={processing !== null}
                  className="flex-1 h-11 text-base font-medium"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Processing...
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
                      setError(null);
                      setSelectedSourceVersion(null);
                      setSelectedOperation('');
                      setCurrentSourceAngle(null);
                    }}
                  disabled={processing !== null}
                  className="h-11 px-6"
                >
                  İptal
                </Button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Processing Timer */}
          {processing && processingStartTime && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-blue-700">
                  Processing... {Math.floor((Date.now() - processingStartTime) / 1000)}s
                </span>
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}

