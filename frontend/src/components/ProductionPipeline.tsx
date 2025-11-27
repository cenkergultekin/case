'use client';

import React, { useState, useEffect } from 'react';
import { Download, ChevronRight, Clock, Zap, Calendar, HardDrive, RotateCw, X, Eye } from 'lucide-react';
import { Button } from './ui/Button';
import { getImageUrl } from '@/lib/api';
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

interface ProductionPipelineProps {
  image: ImageData;
  onSelectAsSource: (versionId: string) => void;
  onBack: () => void;
}

export function ProductionPipeline({ image, onSelectAsSource, onBack }: ProductionPipelineProps) {
  const originalImageUrl = getImageUrl(image.filename);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // ESC key to close preview
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewImage) {
        setPreviewImage(null);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [previewImage]);

  // Build hierarchical pipeline structure - all versions in one continuous pipeline
  interface PipelineNode {
    version: ProcessedVersion | { id: string; url: string; name: string; isOriginal: boolean };
    children: PipelineNode[];
  }

  // Find all versions that belong to the main pipeline (starting from original)
  const buildPipelineTree = (): PipelineNode[] => {
    const allVersions = image.processedVersions || [];
    const usedVersionIds = new Set<string>();
    const nodes: PipelineNode[] = [];

    // Start with original image
    const originalNode: PipelineNode = {
      version: {
        id: image.id,
        url: originalImageUrl,
        name: 'Original',
        isOriginal: true
      },
      children: []
    };

    // Recursive function to build tree
    const addChildren = (parentId: string, parentNode: PipelineNode) => {
      const children = allVersions.filter(
        v => {
          // Check if this version belongs to the parent
          const belongsToParent = 
            v.sourceImageId === parentId || 
            v.sourceProcessedVersionId === parentId ||
            // Fallback: if no source info, assume it's from original image
            (!v.sourceImageId && !v.sourceProcessedVersionId && parentId === image.id);
          
          return belongsToParent && !usedVersionIds.has(v.id);
        }
      );
      
      children.forEach(child => {
        usedVersionIds.add(child.id);
        const childNode: PipelineNode = {
          version: child,
          children: []
        };
        parentNode.children.push(childNode);
        // Recursively add children of this child
        addChildren(child.id, childNode);
      });
    };

    // Find direct children of original
    addChildren(image.id, originalNode);
    
    // Always push original node if there are any versions
    // Even if no children found, we'll show them in flattenPipeline fallback
    if (allVersions.length > 0) {
      nodes.push(originalNode);
    }

    return nodes;
  };

  const pipelineTree = buildPipelineTree();

  // Flatten tree for display (but maintain hierarchy visually)
  // Track which versions have already been shown as "processed" to avoid showing them again as "source"
  const shownAsProcessedIds = new Set<string>();
  
  const flattenPipeline = (nodes: PipelineNode[], level: number = 0): Array<{
    source: { id: string; url: string; name: string };
    processed: ProcessedVersion[];
    level: number;
  }> => {
    const result: Array<{
      source: { id: string; url: string; name: string };
      processed: ProcessedVersion[];
      level: number;
    }> = [];

    nodes.forEach(node => {
      const isOriginal = 'isOriginal' in node.version && node.version.isOriginal;
      
      // Skip if this version was already shown as a processed version in a previous level
      // (Don't show it again as source in a lower level)
      if (!isOriginal) {
        const versionId = (node.version as ProcessedVersion).id;
        if (shownAsProcessedIds.has(versionId)) {
          // This version was already shown as processed, skip showing it as source
          // But still process its children recursively
          const childNodes = node.children.map(child => ({
            version: child.version,
            children: child.children
          }));
          result.push(...flattenPipeline(childNodes, level));
          return;
        }
      }
      
      const source = isOriginal
        ? { id: node.version.id, url: node.version.url, name: node.version.name }
        : {
            id: node.version.id,
            url: (node.version as ProcessedVersion).url?.includes('/api/uploads/')
              ? (node.version as ProcessedVersion).url
              : getImageUrl((node.version as ProcessedVersion).filename),
            name: `${(node.version as ProcessedVersion).aiModel || 'AI'} - ${(node.version as ProcessedVersion).operation.replace(/-/g, ' ')}`
          };

      // Get all children (don't filter here, we'll filter duplicates)
      const processed = node.children.map(child => child.version as ProcessedVersion);

      // Mark processed versions as shown
      processed.forEach(version => {
        shownAsProcessedIds.add(version.id);
      });

      // Always add the node if it has children
      if (processed.length > 0) {
        result.push({ source, processed, level });
        // Recursively add children
        const childNodes = node.children.map(child => ({
          version: child.version,
          children: child.children
        }));
        result.push(...flattenPipeline(childNodes, level + 1));
      } else if (isOriginal && (image.processedVersions || []).length > 0) {
        // If original has no children in tree but there are versions, show them directly
        // This handles the case where sourceImageId/sourceProcessedVersionId might not be set correctly
        const directVersions = (image.processedVersions || []).filter(
          v => {
            // Include versions that either:
            // 1. Have no sourceProcessedVersionId (direct from original)
            // 2. Have sourceImageId matching the original image
            // 3. Have no source info at all (fallback)
            return !v.sourceProcessedVersionId || 
                   v.sourceImageId === image.id || 
                   (!v.sourceImageId && !v.sourceProcessedVersionId);
          }
        );
        if (directVersions.length > 0) {
          directVersions.forEach(version => {
            shownAsProcessedIds.add(version.id);
          });
          result.push({ source, processed: directVersions, level });
        }
      }
    });

    return result;
  };

  const pipelines = flattenPipeline(pipelineTree);

  // Fallback: If no hierarchical structure found, show all versions with original as source
  if (pipelines.length === 0 && image.processedVersions && image.processedVersions.length > 0) {
    pipelines.push({
      source: { id: image.id, url: originalImageUrl, name: 'Orijinal' },
      processed: image.processedVersions,
      level: 0
    });
  }

  return (
    <div className="glass rounded-2xl shadow-card-hover border border-white/20 overflow-hidden w-full max-w-full">
      <div className="bg-gradient-primary p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-white hover:glass-dark"
            >
              İşlemeye Dön
            </Button>
            <div className="border-l border-white/30 pl-3">
              <h2 className="text-lg font-bold text-white">Üretim Hattı</h2>
              <p className="text-white/90 text-sm font-medium">
                {(image.processedVersions || []).length} işlenmiş versiyon
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 overflow-x-hidden">
        {/* Batch Info Section */}
        {image.processedVersions && image.processedVersions.length > 1 && (
          <div className="mb-6 p-4 bg-gradient-primary/10 border border-primary/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Toplu Üretim: {image.processedVersions.length} görsel
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Aynı referans görselinden üretildi
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Listem Section */}
        <div className="mb-8">
          <h4 className="font-semibold text-gray-900 mb-3 text-sm">Listem</h4>
          <div className="glass-subtle rounded-xl border border-white/20 p-3 sm:p-4 shadow-card">
            <div className="space-y-2">
              {/* Reference Image */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl glass-subtle hover:glass transition-smooth border border-white/20 shadow-minimal hover:shadow-card">
                <div 
                  className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-smooth"
                  onClick={() => {
                    setPreviewImage({ 
                      url: originalImageUrl, 
                      name: `Referans - ${image.originalName}` 
                    });
                  }}
                >
                  <img
                    src={originalImageUrl}
                    alt="Reference"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-900">Referans</span>
                  <p className="text-xs text-gray-600 truncate">{image.originalName}</p>
                </div>
              </div>

              {/* Generated Versions */}
              {(image.processedVersions || []).map((version) => {
                const isUpscale = version.operation === 'topaz-upscale';
                // Extract angle from prompt - look for "Rotate the model by X°" or "No rotation" (0°)
                const extractAngle = (prompt: string): string | null => {
                  if (!prompt) return null;
                  if (prompt.includes('No rotation') || prompt.includes('Same pose as reference')) {
                    return '0';
                  }
                  const angleMatch = prompt.match(/Rotate the model by (\d+)°/i);
                  if (angleMatch) {
                    return angleMatch[1];
                  }
                  // Fallback: Try to extract any angle number
                  const fallbackMatch = prompt.match(/(\d+)\s*(?:degree|deg|°)/i);
                  return fallbackMatch ? fallbackMatch[1] : null;
                };
                const angle = version.parameters?.prompt ? extractAngle(version.parameters.prompt) : null;

                const displayName =
                  version.filename.split('_').pop()?.replace('.jpg', '') || version.filename;
                
                const isExpanded = expandedVersionId === version.id;
                const createdAt = new Date(version.createdAt);
                const formattedDate = createdAt.toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                // Get file size (we'll need to estimate or fetch it)
                const estimatedSize = version.filename ? '~2.5 MB' : 'Bilinmiyor';

                return (
                  <div
                    key={version.id}
                    className="rounded-xl glass-subtle hover:glass transition-smooth overflow-hidden border border-white/20 shadow-minimal hover:shadow-card"
                  >
                    {/* Main Row */}
                    <div
                      className="flex items-center gap-3 p-2.5 cursor-pointer"
                      onClick={() => {
                        setExpandedVersionId(isExpanded ? null : version.id);
                      }}
                    >
                      <div 
                        className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-smooth"
                        onClick={(e) => {
                          e.stopPropagation();
                          const imageUrl = version.url?.includes('/api/uploads/')
                            ? version.url
                            : getImageUrl(version.filename);
                          setPreviewImage({ 
                            url: imageUrl, 
                            name: `${version.operation} - ${angle || 'processed'}°` 
                          });
                        }}
                      >
                        <img
                          src={
                            version.url?.includes('/api/uploads/')
                              ? version.url
                              : getImageUrl(version.filename)
                          }
                          alt={version.operation}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">Üretilen</span>
                          {angle && (
                            <span className="text-xs font-medium text-primary">({angle}°)</span>
                          )}
                          {isUpscale && (
                            <span className="text-xs font-medium text-green-600">(Yükseltilmiş)</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate">({displayName})</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 capitalize">
                          {version.operation.replace(/-/g, ' ')}
                        </span>
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-gray-400 transition-smooth",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-3 border-t border-gray-200 bg-gray-50 animate-fade-in">
                        <div className="grid grid-cols-2 gap-3">
                          {/* AI Model */}
                          <div className="flex items-start gap-2">
                            <Zap className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-[10px] font-medium text-gray-600 uppercase">AI Modeli</p>
                              <p className="text-xs font-semibold text-gray-900 capitalize">
                                {version.aiModel || 'Bilinmiyor'}
                              </p>
                            </div>
                          </div>

                          {/* Processing Time */}
                          {version.processingTimeMs && (
                            <div className="flex items-start gap-2">
                              <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-[10px] font-medium text-gray-600 uppercase">İşleme Süresi</p>
                                <p className="text-xs font-semibold text-gray-900">
                                  {version.processingTimeMs < 1000 
                                    ? `${version.processingTimeMs}ms`
                                    : `${(version.processingTimeMs / 1000).toFixed(1)}s`
                                  }
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Angle */}
                          {angle && (
                            <div className="flex items-start gap-2">
                              <RotateCw className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-[10px] font-medium text-gray-600 uppercase">Açı</p>
                                <p className="text-xs font-semibold text-gray-900">{angle}°</p>
                              </div>
                            </div>
                          )}

                          {/* Created At */}
                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-[10px] font-medium text-gray-600 uppercase">Oluşturulma</p>
                              <p className="text-xs font-semibold text-gray-900">{formattedDate}</p>
                            </div>
                          </div>

                          {/* File Size */}
                          <div className="flex items-start gap-2">
                            <HardDrive className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-[10px] font-medium text-gray-600 uppercase">Dosya Boyutu</p>
                              <p className="text-xs font-semibold text-gray-900">{estimatedSize}</p>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              const imageUrl = version.url?.includes('/api/uploads/')
                                ? version.url
                                : getImageUrl(version.filename);
                              setPreviewImage({ 
                                url: imageUrl, 
                                name: `${version.operation} - ${angle || 'processed'}°` 
                              });
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1.5" />
                            Önizle
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              const imageUrl = version.url?.includes('/api/uploads/')
                                ? version.url
                                : getImageUrl(version.filename);
                              const link = document.createElement('a');
                              link.href = imageUrl;
                              link.download = version.filename;
                              link.click();
                            }}
                          >
                            <Download className="h-3 w-3 mr-1.5" />
                            İndir
                          </Button>
                          {!isUpscale && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectAsSource(version.id);
                                setExpandedVersionId(null);
                              }}
                            >
                              <RotateCw className="h-3 w-3 mr-1.5" />
                              Yeniden Üret
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pipeline View */}
        <div className="w-full overflow-x-hidden">
          <h4 className="font-semibold text-gray-900 mb-4 text-sm">
            Üretim Hattı
            {(image.processedVersions || []).length > 0 && (
              <span className="text-gray-600 font-normal ml-2">
                ({(image.processedVersions || []).length} {image.processedVersions && image.processedVersions.length > 1 ? 'görsel' : 'versiyon'})
              </span>
            )}
          </h4>

          {pipelines.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-gray-600">Henüz işlenmiş versiyon yok</p>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8 w-full">
              {pipelines.map((pipeline, pipelineIndex) => (
                <div
                  key={pipelineIndex}
                  className={cn(
                    "relative",
                    pipeline.level > 0 && "ml-12 pl-6 border-l-2 border-l-blue-200"
                  )}
                >
                  {/* Level Label */}
                  <div className="mb-3">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {pipeline.level === 0 ? 'Referans' : `Seviye ${pipeline.level + 1}`}
                    </span>
                  </div>

                  {/* Pipeline Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full">
                    {/* Source Image */}
                    <div className="flex-shrink-0">
                      <div 
                        className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 rounded-xl overflow-hidden bg-gray-50 border-2 border-gray-200 shadow-card hover-lift cursor-pointer hover:border-primary"
                        onClick={() => {
                          setPreviewImage({ 
                            url: pipeline.source.url, 
                            name: pipeline.source.name 
                          });
                        }}
                      >
                        <img
                          src={pipeline.source.url}
                          alt={pipeline.source.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      {pipeline.level === 0 && (
                        <p className="text-xs font-semibold text-gray-700 mt-2 text-center">
                          Orijinal
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center flex-shrink-0 hidden sm:flex">
                      <ChevronRight className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 text-gray-300" />
                    </div>

                    {/* Processed Versions - Horizontal Grid */}
                    <div className="flex items-start gap-2 sm:gap-3 md:gap-4 flex-1 overflow-x-auto pb-2 w-full min-w-0">
                      {pipeline.processed.map((version, versionIndex) => {
                        const isUpscale = version.operation === 'topaz-upscale';
                        // Extract angle from prompt - look for "Rotate the model by X°" or "No rotation" (0°)
                        const extractAngle = (prompt: string): string | null => {
                          if (!prompt) return null;
                          if (prompt.includes('No rotation') || prompt.includes('Same pose as reference')) {
                            return '0';
                          }
                          const angleMatch = prompt.match(/Rotate the model by (\d+)°/i);
                          if (angleMatch) {
                            return angleMatch[1];
                          }
                          // Fallback: Try to extract any angle number
                          const fallbackMatch = prompt.match(/(\d+)\s*(?:degree|deg|°)/i);
                          return fallbackMatch ? fallbackMatch[1] : null;
                        };
                        const angle = version.parameters?.prompt ? extractAngle(version.parameters.prompt) : null;

                        return (
                          <div
                            key={version.id}
                            className="group relative flex-shrink-0"
                          >
                            {/* Preview - Larger Square */}
                            <div 
                              className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 rounded-xl overflow-hidden bg-gray-50 border-2 border-gray-200 shadow-card hover:border-primary hover-lift relative cursor-pointer"
                              onClick={() => {
                                const imageUrl = version.url?.includes('/api/uploads/')
                                  ? version.url
                                  : getImageUrl(version.filename);
                                setPreviewImage({ 
                                  url: imageUrl, 
                                  name: `${version.operation} - ${angle || 'processed'}°` 
                                });
                              }}
                            >
                              <img
                                src={
                                  version.url?.includes('/api/uploads/')
                                    ? version.url
                                    : getImageUrl(version.filename)
                                }
                                alt={version.operation}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error('Failed to load processed image:', version.url);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-smooth flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <div className="flex flex-col gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white hover:bg-white text-xs px-3 py-1.5 shadow-card"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const imageUrl = version.url?.includes('/api/uploads/')
                                        ? version.url
                                        : getImageUrl(version.filename);
                                      const link = document.createElement('a');
                                      link.href = imageUrl;
                                      link.download = version.filename;
                                      link.click();
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                    İndir
                                  </Button>
                                  {!isUpscale && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="bg-white hover:bg-white text-xs px-3 py-1.5 shadow-card"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectAsSource(version.id);
                                      }}
                                    >
                                      Kaynak Olarak Kullan
                                    </Button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Angle Badge - Bottom Left (only if angle exists) */}
                              {angle && (
                                <div className="absolute bottom-2 left-2">
                                  <span className="px-2 py-0.5 text-[9px] font-semibold bg-primary text-white rounded-md shadow-card">
                                    {angle}°
                                  </span>
                                </div>
                              )}
                              
                              {/* Operation Info - Bottom Right */}
                              <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded-md">
                                <p className="text-[9px] font-medium text-white capitalize">
                                  {version.operation.replace(/-/g, ' ')}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-7xl max-h-[90vh] w-full cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute -top-12 right-0 text-white hover:bg-white/10 z-10"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-5 w-5 mr-2" />
              Kapat (ESC)
            </Button>

            {/* Image Name & Hint */}
            <div className="absolute -top-12 left-0">
              <p className="text-white font-medium text-sm">{previewImage.name}</p>
              <p className="text-white/60 text-xs mt-1">Görsel dışına tıklayarak kapatabilirsiniz</p>
            </div>

            {/* Image Container */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="w-full h-auto max-h-[85vh] object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            {/* Download Button */}
            <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewImage.url;
                  link.download = previewImage.name;
                  link.click();
                }}
                className="shadow-card"
              >
                <Download className="h-4 w-4 mr-2" />
                İndir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

