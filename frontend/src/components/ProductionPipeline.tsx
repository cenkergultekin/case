'use client';

import React, { useState } from 'react';
import { Download, ChevronRight, Clock, Zap, Calendar, HardDrive, RotateCw } from 'lucide-react';
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
      source: { id: image.id, url: originalImageUrl, name: 'Original' },
      processed: image.processedVersions,
      level: 0
    });
  }

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30"
            >
              İşlemeye Dön
            </Button>
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-white">Üretim Hattı</h2>
                <p className="text-white/80 text-sm">
                  {(image.processedVersions || []).length} işlenmiş versiyon
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 lg:p-8">
        {/* Listem Section */}
        <div className="mb-8">
          <h4 className="font-medium text-gray-900 mb-3">Listem</h4>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200 p-4">
            <div className="space-y-2">
              {/* Reference Image */}
              <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
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
                  <span className="text-sm font-semibold text-gray-900">Ref</span>
                  <p className="text-xs text-gray-500 truncate">{image.originalName}</p>
                </div>
              </div>

              {/* Generated Versions */}
              {(image.processedVersions || []).map((version) => {
                const isUpscale = version.operation === 'topaz-upscale';
                const angle = version.parameters?.prompt
                  ? version.parameters.prompt.match(/(\d+)\s*(?:degree|deg|°)/i)?.[1] ||
                    (version.parameters.prompt.includes('front view')
                      ? '0'
                      : version.parameters.prompt.includes('side profile')
                      ? '90'
                      : version.parameters.prompt.includes('back view')
                      ? '180'
                      : version.parameters.prompt.includes('three-quarter')
                      ? '45'
                      : null)
                  : null;

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
                const estimatedSize = version.filename ? '~2.5 MB' : 'Unknown';

                return (
                  <div
                    key={version.id}
                    className="rounded-lg bg-gray-50 hover:bg-gray-100 transition-all overflow-hidden"
                  >
                    {/* Main Row */}
                    <div
                      className="flex items-center gap-3 p-2 cursor-pointer"
                      onClick={() => {
                        setExpandedVersionId(isExpanded ? null : version.id);
                      }}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
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
                            <span className="text-xs font-medium text-blue-600">({angle}°)</span>
                          )}
                          {isUpscale && (
                            <span className="text-xs font-medium text-green-600">(Yükseltilmiş)</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">({displayName})</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 capitalize">
                          {version.operation.replace(/-/g, ' ')}
                        </span>
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-gray-400 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-2 pb-3 pt-2 border-t border-gray-200 bg-white/80 backdrop-blur-sm">
                        <div className="grid grid-cols-2 gap-3">
                          {/* AI Model */}
                          <div className="flex items-start gap-2">
                            <Zap className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase">AI Modeli</p>
                              <p className="text-xs font-semibold text-gray-900 capitalize">
                                {version.aiModel || 'Unknown'}
                              </p>
                            </div>
                          </div>

                          {/* Processing Time */}
                          {version.processingTimeMs && (
                            <div className="flex items-start gap-2">
                              <Clock className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase">İşleme Süresi</p>
                                <p className="text-xs font-semibold text-gray-900">
                                  {(version.processingTimeMs / 1000).toFixed(2)}s
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Angle */}
                          {angle && (
                            <div className="flex items-start gap-2">
                              <RotateCw className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase">Açı</p>
                                <p className="text-xs font-semibold text-gray-900">{angle}°</p>
                              </div>
                            </div>
                          )}

                          {/* Created At */}
                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase">Oluşturulma</p>
                              <p className="text-xs font-semibold text-gray-900">{formattedDate}</p>
                            </div>
                          </div>

                          {/* File Size */}
                          <div className="flex items-start gap-2">
                            <HardDrive className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase">Dosya Boyutu</p>
                              <p className="text-xs font-semibold text-gray-900">{estimatedSize}</p>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs h-8"
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
                              className="flex-1 text-xs h-8"
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
        <div>
          <h4 className="font-medium text-gray-900 mb-4 text-sm md:text-base">
            Üretim Hattı ({(image.processedVersions || []).length} versiyon)
          </h4>

          {pipelines.length === 0 ? (
            <div className="text-center py-12 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200">
              <p className="text-gray-500">Henüz işlenmiş versiyon yok</p>
            </div>
          ) : (
            <div className="space-y-8">
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
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      {pipeline.level === 0 ? 'Referans' : `Seviye ${pipeline.level + 1}`}
                    </span>
                  </div>

                  {/* Pipeline Row */}
                  <div className="flex items-center gap-6">
                    {/* Source Image */}
                    <div className="flex-shrink-0">
                      <div className="w-32 h-32 md:w-40 md:h-40 lg:w-56 lg:h-56 rounded-xl overflow-hidden bg-gray-100 border-2 md:border-3 border-gray-300 shadow-md hover:shadow-lg transition-shadow">
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
                        <p className="text-xs font-medium text-gray-700 mt-2 text-center">
                          Orijinal
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center flex-shrink-0">
                      <ChevronRight className="h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10 text-gray-400" />
                    </div>

                    {/* Processed Versions - Horizontal Grid */}
                    <div className="flex items-start gap-3 md:gap-4 lg:gap-6 flex-1 overflow-x-auto pb-2">
                      {pipeline.processed.map((version, versionIndex) => {
                        const isUpscale = version.operation === 'topaz-upscale';
                        const angle = version.parameters?.prompt
                          ? version.parameters.prompt.match(/(\d+)\s*(?:degree|deg|°)/i)?.[1] ||
                            (version.parameters.prompt.includes('front view') ? '0' :
                             version.parameters.prompt.includes('side profile') ? '90' :
                             version.parameters.prompt.includes('back view') ? '180' :
                             version.parameters.prompt.includes('three-quarter') ? '45' : null)
                          : null;

                        return (
                          <div
                            key={version.id}
                            className="group relative flex-shrink-0"
                          >
                            {/* Preview - Larger Square */}
                            <div className="w-32 h-32 md:w-40 md:h-40 lg:w-56 lg:h-56 rounded-xl overflow-hidden bg-gray-100 border-2 md:border-3 border-gray-300 shadow-md hover:border-blue-500 hover:shadow-lg transition-all relative">
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
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <div className="flex flex-col gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white/95 hover:bg-white text-xs px-3 py-1.5 h-auto shadow-md"
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
                                    <Download className="h-4 w-4 mr-1.5" />
                                    İndir
                                  </Button>
                                  {!isUpscale && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="bg-white/95 hover:bg-white text-xs px-3 py-1.5 h-auto shadow-md"
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
                                  <span className="px-1.5 py-0.5 text-[8px] font-bold bg-blue-500 text-white rounded shadow-md">
                                    {angle}°
                                  </span>
                                </div>
                              )}
                              
                              {/* Operation Info - Bottom Right */}
                              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded">
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
    </div>
  );
}

