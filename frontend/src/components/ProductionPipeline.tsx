'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Download, ChevronRight, Clock, Zap, Calendar, HardDrive, RotateCw, X, Eye, Loader2, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { getImageUrl, normalizeImageUrl } from '@/lib/api';
import { cn, formatFileSize } from '@/lib/utils';

interface ProcessedVersion {
  id: string;
  operation: string;
  aiModel: string;
  parameters: Record<string, any>;
  filename: string;
  url: string;
  size?: number;
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

interface ProcessingImage {
  id: string;
  startTime: number;
  angle?: number;
  sourceId: string;
  sourceVersionId?: string; // Optional: ID of the processed version used as source
}

interface ProductionPipelineProps {
  image: ImageData;
  onSelectAsSource: (versionId: string) => void;
  onBack: () => void;
  processingImages?: ProcessingImage[];
  onDeleteVersion?: (imageId: string, versionId: string) => Promise<void>;
}

export function ProductionPipeline({ image, onSelectAsSource, onBack, processingImages = [], onDeleteVersion }: ProductionPipelineProps) {
  const originalImageUrl = normalizeImageUrl(image.url, image.filename) || getImageUrl(image.filename);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string; filename?: string } | null>(null);
  const [processingStates, setProcessingStates] = useState<Map<string, ProcessingImage>>(new Map());
  const [newlyCompletedImages, setNewlyCompletedImages] = useState<Set<string>>(new Set());
  const [completionNotification, setCompletionNotification] = useState<{ count: number; timestamp: number } | null>(null);
  const [deletingVersions, setDeletingVersions] = useState<Set<string>>(new Set());
  const [deleteNotification, setDeleteNotification] = useState<{ message: string; timestamp: number } | null>(null);
  const [pendingDeleteVersion, setPendingDeleteVersion] = useState<{ imageId: string; versionId: string } | null>(null);
  const [newVersionTimestamps, setNewVersionTimestamps] = useState<Map<string, number>>(new Map());
  const previousProcessedVersionsRef = useRef<Set<string>>(new Set());
  const isInitialMountRef = useRef<boolean>(true);
  
  // Track processing images and remove them when they complete
  useEffect(() => {
    const currentVersions = image.processedVersions || [];
    const currentVersionIds = new Set(currentVersions.map(v => v.id));
    const previousVersionIds = previousProcessedVersionsRef.current;
    
    // On initial mount, mark all existing versions as "seen" to prevent them from being marked as "new"
    if (isInitialMountRef.current) {
      currentVersionIds.forEach(id => previousVersionIds.add(id));
      previousProcessedVersionsRef.current = previousVersionIds;
      isInitialMountRef.current = false;
      // Don't return early - we still need to sync processingImages
    }
    
    // Find newly completed images by comparing with previous versions
    const newlyCompleted = new Set<string>();
    currentVersions.forEach(version => {
      if (!previousVersionIds.has(version.id)) {
        // Extract angle from the new version
        const extractAngle = (params: Record<string, any>): number | null => {
          // First, check if angle is directly stored in parameters
          if (params.angle !== undefined && params.angle !== null) {
            return Number(params.angle);
          }
          
          // Fallback: extract from prompt
          const prompt = params.prompt;
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
          return fallbackMatch ? parseInt(fallbackMatch[1]) : null;
        };
        const versionAngle = version.parameters ? extractAngle(version.parameters) : null;
        const versionSourceId = version.sourceImageId || version.sourceProcessedVersionId || image.id;
        
        // Mark as newly completed for fade-in animation
        newlyCompleted.add(version.id);
        
        // Remove a matching processing image (same source and angle)
        setProcessingStates(prev => {
          const updated = new Map(prev);
          // Find and remove one processing image that matches
          for (const [id, processing] of prev.entries()) {
            if (processing.sourceId === versionSourceId && 
                (versionAngle === null || processing.angle === versionAngle || processing.angle === undefined)) {
              updated.delete(id);
              break; // Remove only one matching processing image
            }
          }
          return updated;
        });
      }
    });
    
    if (newlyCompleted.size > 0) {
      setNewlyCompletedImages(newlyCompleted);
      
      // Mark new versions with timestamp for "Yeni" badge (15 seconds)
      const now = Date.now();
      setNewVersionTimestamps(prev => {
        const updated = new Map(prev);
        newlyCompleted.forEach(id => {
          updated.set(id, now);
        });
        return updated;
      });
      
      // Remove "Yeni" badge after 15 seconds
      newlyCompleted.forEach(id => {
        setTimeout(() => {
          setNewVersionTimestamps(prev => {
            const updated = new Map(prev);
            updated.delete(id);
            return updated;
          });
        }, 15000);
      });
      
      // Show completion notification with correct count
      setCompletionNotification({ count: newlyCompleted.size, timestamp: Date.now() });
      // Clear notification after 5 seconds
      setTimeout(() => {
        setCompletionNotification(null);
      }, 5000);
      // Clear the fade-in state after animation completes
      setTimeout(() => {
        setNewlyCompletedImages(prev => {
          const updated = new Set(prev);
          newlyCompleted.forEach(id => updated.delete(id));
          return updated;
        });
      }, 1000); // Match animation duration
    }
    
    // Add new processing images from prop
    // Always sync processingImages prop with processingStates Map
    setProcessingStates(prev => {
      const updated = new Map(prev);
      
      // Remove processing states that are no longer in the prop
      const propIds = new Set(processingImages.map(p => p.id));
      for (const [id] of prev.entries()) {
        if (!propIds.has(id)) {
          updated.delete(id);
        }
      }
      
      // Add new processing images from prop
      if (processingImages.length === 0) {
        return updated;
      }
      
      processingImages.forEach((processing) => {
        // Add processing if:
        // 1. It's for the original image (sourceId === image.id), OR
        // 2. It's for a processed version of this image (sourceVersionId exists and matches a version)
        const isForOriginalImage = processing.sourceId === image.id;
        const sourceVersionId = (processing as any).sourceVersionId;
        const isForProcessedVersion = sourceVersionId && 
          currentVersions.some(v => v.id === sourceVersionId);
        
        // Skip if not related to this image at all
        if (!isForOriginalImage && !isForProcessedVersion) {
          return;
        }
        
        // Only add if not already completed
        const isCompleted = currentVersions.some(v => {
          const vSourceId = v.sourceImageId || v.sourceProcessedVersionId || image.id;
          const vAngle = v.parameters?.angle !== undefined ? v.parameters.angle : null;
          
          // Match by source and angle (if angle is available)
          // For processed version sources, match by sourceVersionId
          const sourceMatches = sourceVersionId 
            ? vSourceId === sourceVersionId || v.sourceProcessedVersionId === sourceVersionId
            : vSourceId === processing.sourceId || vSourceId === image.id;
          const angleMatches = vAngle === null || processing.angle === vAngle || processing.angle === undefined;
          return sourceMatches && angleMatches;
        });
        
        // Always add if not completed - this ensures new processing shows up immediately
        // Force update even if already exists to ensure state is fresh
        if (!isCompleted) {
          updated.set(processing.id, {
            ...processing,
            startTime: processing.startTime || Date.now()
          });
        }
      });
      
      return updated;
    });
    
    previousProcessedVersionsRef.current = currentVersionIds;
  }, [image.processedVersions, processingImages, image.id]);

  // Update processing states in real-time to update progress and messages
  useEffect(() => {
    if (processingStates.size === 0) return;
    
    const interval = setInterval(() => {
      // Force re-render to update elapsed time and progress
      setProcessingStates(prev => new Map(prev));
    }, 100); // Update every 100ms for smooth progress
    
    return () => clearInterval(interval);
  }, [processingStates.size]);

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
  type SourceType = 'original' | 'reference';

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

  // Flatten tree for display (maintain hierarchy visually)
  interface FlattenedPipelineRow {
    source: { id: string; url: string; name: string; filename?: string };
    processed: ProcessedVersion[];
    level: number;
    sourceType: SourceType;
  }

  const flattenPipeline = (nodes: PipelineNode[], level: number = 0): FlattenedPipelineRow[] => {
    const rows: FlattenedPipelineRow[] = [];

    nodes.forEach(node => {
      const isOriginal = 'isOriginal' in node.version && node.version.isOriginal;

      const source = isOriginal
        ? {
            id: node.version.id,
            url: node.version.url,
            name: ('name' in node.version ? node.version.name : 'Original'),
            filename: image.filename
          }
        : {
            id: node.version.id,
            url: normalizeImageUrl((node.version as ProcessedVersion).url, (node.version as ProcessedVersion).filename),
            name: `${(node.version as ProcessedVersion).aiModel || 'AI'} - ${(node.version as ProcessedVersion).operation.replace(/-/g, ' ')}`,
            filename: (node.version as ProcessedVersion).filename
          };

      const processed = node.children.map(child => child.version as ProcessedVersion);
      const sourceType: SourceType = isOriginal ? 'original' : 'reference';

      if (processed.length > 0) {
        rows.push({ source, processed, level, sourceType });
        const childNodes = node.children.map(child => ({
          version: child.version,
          children: child.children
        }));
        rows.push(...flattenPipeline(childNodes, level + 1));
      } else if (isOriginal && (image.processedVersions || []).length > 0) {
        const directVersions = (image.processedVersions || []).filter(v => {
          return (
            !v.sourceProcessedVersionId ||
            v.sourceImageId === image.id ||
            (!v.sourceImageId && !v.sourceProcessedVersionId)
          );
        });
        if (directVersions.length > 0) {
          rows.push({ source, processed: directVersions, level, sourceType });
        }
      }
    });

    return rows;
  };

  const pipelines = flattenPipeline(pipelineTree);

  // Fallback: If no hierarchical structure found, show all versions with original as source
  if (pipelines.length === 0 && image.processedVersions && image.processedVersions.length > 0) {
    pipelines.push({
      source: { id: image.id, url: originalImageUrl, name: 'Orijinal', filename: image.filename },
      processed: image.processedVersions,
      level: 0,
      sourceType: 'original'
    });
  }

  // Calculate active processing count and progress (for this base image)
  // processingStates is kept in sync with processingImages and cleared when
  // corresponding processed versions arrive, so it reliably reflects "live" jobs.
  const activeProcessing = Array.from(processingStates.values());
  const activeProcessingCount = activeProcessing.length;
  
  // Calculate average progress for all active processing (15 seconds = 100%)
  const calculateProgress = (startTime: number): number => {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const progress = Math.min((elapsedSeconds / 15) * 100, 100);
    return Math.round(progress);
  };
  
  const averageProgress = activeProcessingCount > 0
    ? Math.round(activeProcessing.reduce((sum, p) => sum + calculateProgress(p.startTime), 0) / activeProcessingCount)
    : 0;
  
  // Determine message based on progress
  const getProcessingMessage = (progress: number): string => {
    if (progress < 20) return "Görsel üretiliyor, bu biraz zaman alabilir...";
    if (progress < 70) return "Görsel işleniyor...";
    return "Az kaldı...";
  };
  const containerMaxHeight = 'calc(100vh - 120px)';
  const scrollSectionMaxHeight = 'calc(100vh - 240px)';

  const downloadImageFile = async (fileUrl: string, fallbackName: string) => {
    const safeFileName = fallbackName?.trim() ? fallbackName : `gorsel-${Date.now()}.png`;
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to download image', error);
      alert('Görsel indirilemedi. Lütfen tekrar deneyin.');
    }
  };

  const preview = previewImage;
  const previewModal = (() => {
    if (!preview) {
      return null;
    }

    return (
      <div 
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer"
        style={{
          animation: 'fadeIn 200ms ease-out'
        }}
        onClick={() => setPreviewImage(null)}
      >
        <div 
          className="relative max-w-4xl w-full max-h-[90vh] flex flex-col cursor-default"
          style={{
            animation: 'modalSlideIn 300ms ease-out'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{preview.name}</p>
              <p className="text-white/60 text-xs mt-1">Görsel dışına tıklayarak kapatabilirsiniz</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 ml-4 flex-shrink-0"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Image Container */}
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden flex-1 flex items-center justify-center min-h-0">
            <img
              src={preview.url}
              alt={preview.name}
              className="max-w-full max-h-[calc(90vh-180px)] w-auto h-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center mt-4">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                downloadImageFile(preview.url, preview.filename ?? preview.name);
              }}
              className="shadow-card"
            >
              <Download className="h-4 w-4 mr-2" />
              İndir
            </Button>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div
      className="glass rounded-2xl shadow-card-hover border border-white/20 w-full max-w-full flex flex-col overflow-hidden"
      style={{ maxHeight: containerMaxHeight }}
    >
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

      {/* Processing Notification Banner */}
      {activeProcessingCount > 0 && (
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20 px-6 py-4 flex items-center gap-4 animate-fade-in">
          <div className="relative flex-shrink-0">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
            {/* Progress Ring */}
            <svg className="absolute inset-0 h-12 w-12 transform -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="text-primary/30"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - averageProgress / 100)}`}
                className="text-primary transition-all duration-1000 ease-out"
              />
            </svg>
            {/* Percentage Text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">{averageProgress}%</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {getProcessingMessage(averageProgress)}
            </p>
            <div className="mt-2">
              <div className="h-1.5 bg-primary/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${averageProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completion Notification */}
      {completionNotification && (
        <div className="bg-gradient-to-r from-green-50 via-green-50/80 to-green-50 border-b-2 border-green-300 px-6 py-5 flex items-center gap-4 animate-fade-in shadow-lg">
          <div className="h-14 w-14 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-green-900">
              Görsel üretildi!
            </p>
            <p className="text-sm text-green-700 mt-0.5">
              {completionNotification.count === 1 
                ? '1 adet sunuldu' 
                : `${completionNotification.count} adet sunuldu`}
            </p>
          </div>
        </div>
      )}

      {/* Delete Notification */}
      {deleteNotification && (
        <div className="bg-gradient-to-r from-red-50 via-red-50/80 to-red-50 border-b-2 border-red-300 px-6 py-5 flex items-center gap-4 animate-fade-in shadow-lg">
          <div className="h-14 w-14 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-red-900">
              {deleteNotification.message}
            </p>
          </div>
        </div>
      )}

      <div
        className="p-4 sm:p-6 overflow-x-hidden overflow-y-auto flex-1 custom-scrollbar"
        style={{ maxHeight: scrollSectionMaxHeight }}
      >
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
            <div 
              className="space-y-2 overflow-y-auto custom-scrollbar"
              style={{
                maxHeight: 'calc(5 * (60px + 8px))', // İlk 5 görsel için yükseklik (her görsel ~60px + gap 8px)
              }}
            >
              {/* Reference Image */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl glass-subtle hover:glass transition-smooth border-2 border-primary/30 shadow-minimal hover:shadow-card bg-gradient-to-r from-primary/5 to-primary/10">
                <div 
                  className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-smooth relative border-2 border-primary/40"
                  onClick={(e) => {
                    // Only open preview if clicking directly on the image container, not on buttons
                    if ((e.target as HTMLElement).closest('button')) {
                      return;
                    }
                    setPreviewImage({ 
                      url: originalImageUrl, 
                      name: `Referans - ${image.originalName}`,
                      filename: image.filename 
                    });
                  }}
                >
                  <img
                    src={originalImageUrl}
                    alt="Reference"
                    className="w-full h-full object-cover pointer-events-none"
                    onError={(e) => {
                      if (process.env.NODE_ENV === 'development') {
                        console.error('ProductionPipeline: Failed to load reference image:', {
                          originalUrl: image.url,
                          normalizedUrl: originalImageUrl,
                          filename: image.filename,
                          attemptedSrc: e.currentTarget.src
                        });
                      }
                      e.currentTarget.style.display = 'none';
                    }}
                    onLoad={() => {
                      if (process.env.NODE_ENV === 'development') {
                        console.log('ProductionPipeline: Reference image loaded successfully:', originalImageUrl);
                      }
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-bold text-white bg-gradient-primary rounded-md shadow-card border border-primary/30">
                      REFERANS
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 truncate mt-1">{image.originalName}</p>
                </div>
              </div>

              {/* Generated Versions - Sorted by date (newest first), all visible but scrollable */}
              {(() => {
                const allVersions = [...(image.processedVersions || [])];
                // Sort by createdAt (newest first)
                allVersions.sort((a, b) => {
                  const dateA = new Date(a.createdAt).getTime();
                  const dateB = new Date(b.createdAt).getTime();
                  return dateB - dateA;
                });
                
                return allVersions.map((version) => {
                // Extract angle from parameters.angle first, then from prompt
                const extractAngle = (params: Record<string, any>): string | null => {
                  // First, check if angle is directly stored in parameters
                  if (params.angle !== undefined && params.angle !== null) {
                    return String(params.angle);
                  }
                  
                  // Fallback: extract from prompt
                  const prompt = params.prompt;
                  if (!prompt) return null;
                  
                  // New format: "0° rotation" or "Rotate X° clockwise"
                  if (prompt.includes('0° rotation') || prompt.match(/^0°\s/)) {
                    return '0';
                  }
                  
                  // Match "Rotate X° clockwise" pattern
                  const angleMatch = prompt.match(/Rotate\s+(\d+)°\s+clockwise/i);
                  if (angleMatch) {
                    return angleMatch[1];
                  }
                  
                  // Fallback: Try to extract any angle number at the start
                  const fallbackMatch = prompt.match(/^(\d+)°\s/i);
                  return fallbackMatch ? fallbackMatch[1] : null;
                };
                const angle = version.parameters ? extractAngle(version.parameters) : null;

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
                
                // Get file size from metadata if available
                const estimatedSize = typeof version.size === 'number'
                  ? formatFileSize(version.size)
                  : 'Boyut bilgisi yok';

                const isDeleting = deletingVersions.has(version.id);
                const isNew = newVersionTimestamps.has(version.id);
                
                return (
                  <div
                    key={version.id}
                    className={cn(
                      "rounded-xl glass-subtle hover:glass transition-all duration-300 ease-in-out overflow-hidden border border-white/20 shadow-minimal hover:shadow-card",
                      isDeleting && "opacity-0 scale-95 -translate-x-4 pointer-events-none"
                    )}
                  >
                    {/* Main Row */}
                    <div
                      className="flex items-center gap-3 p-2.5 cursor-pointer"
                      onClick={(e) => {
                        // Don't expand if clicking on the image
                        if ((e.target as HTMLElement).closest('.image-preview-container')) {
                          return;
                        }
                        setExpandedVersionId(isExpanded ? null : version.id);
                      }}
                    >
                      <div 
                        className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-smooth image-preview-container relative"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          // Only open preview if clicking directly on the image container, not on buttons
                          if ((e.target as HTMLElement).closest('button')) {
                            return;
                          }
                          const imageUrl = normalizeImageUrl(version.url, version.filename);
                          setPreviewImage({ 
                            url: imageUrl, 
                            name: `${version.operation} - ${angle || 'processed'}°`,
                            filename: version.filename 
                          });
                        }}
                      >
                        <img
                          src={normalizeImageUrl(version.url, version.filename)}
                          alt={version.operation}
                          className="w-full h-full object-cover pointer-events-none"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">Üretilen</span>
                          {isNew && (
                            <span className={cn(
                              "px-2 py-0.5 text-[10px] font-bold text-white rounded-md shadow-card border border-primary/30",
                              "bg-gradient-primary animate-new-badge"
                            )}>
                              YENİ
                            </span>
                          )}
                          {angle && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-md border border-primary/20">
                              {angle}°
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          {version.size ? formatFileSize(version.size) : 'Boyut bilgisi yok'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {formattedDate}
                        </span>
                        {onDeleteVersion && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setPendingDeleteVersion({ imageId: image.id, versionId: version.id });
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600 transition-smooth"
                            title="Görseli Sil"
                            disabled={deletingVersions.has(version.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-gray-400 transition-smooth",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <div 
                      className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                      )}
                    >
                      <div className="px-3 pb-3 pt-3 border-t border-gray-200 bg-gray-50">
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
                              const imageUrl = normalizeImageUrl(version.url, version.filename);
                              setPreviewImage({ 
                                url: imageUrl, 
                                name: `${version.operation} - ${angle || 'processed'}°`,
                                filename: version.filename 
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
                              const imageUrl = normalizeImageUrl(version.url, version.filename);
                            downloadImageFile(imageUrl, version.filename);
                            }}
                          >
                            <Download className="h-3 w-3 mr-1.5" />
                            İndir
                          </Button>
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
                        </div>
                      </div>
                    </div>
                  </div>
                );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Pipeline View */}
        <div className="w-full overflow-x-hidden overflow-y-visible">
          <h4 className="font-semibold text-gray-900 mb-4 text-sm">
            Üretim Hattı
            {(image.processedVersions || []).length > 0 && (
              <span className="text-gray-600 font-normal ml-2">
                ({(image.processedVersions || []).length} {image.processedVersions && image.processedVersions.length > 1 ? 'görsel' : 'versiyon'})
              </span>
            )}
          </h4>

          {pipelines.length === 0 && processingStates.size === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-gray-600">Henüz işlenmiş versiyon yok</p>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8 w-full overflow-visible">
              {/* Show placeholder pipeline if processing but no pipelines yet */}
              {pipelines.length === 0 && processingStates.size > 0 && (
                <div className="relative">
                  {/* Level Label */}
                  <div className="mb-3">
                    <span className="px-3 py-1.5 text-xs font-bold text-white bg-gradient-primary rounded-lg shadow-card border border-primary/30 uppercase tracking-wide">
                      REFERANS
                    </span>
                  </div>

                  {/* Pipeline Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full">
                    {/* Source Image */}
                    <div className="flex-shrink-0">
                      <div 
                        className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 rounded-xl overflow-visible bg-gray-50 border-3 border-primary shadow-card hover-lift cursor-pointer hover:border-primary relative"
                        style={{ borderWidth: '3px' }}
                        onClick={(e) => {
                          // Only open preview if clicking directly on the image container, not on buttons
                          if ((e.target as HTMLElement).closest('button')) {
                            return;
                          }
                          setPreviewImage({ 
                            url: originalImageUrl, 
                            name: 'Orijinal',
                            filename: image.filename 
                          });
                        }}
                      >
                        <div className="w-full h-full overflow-hidden rounded-xl">
                          <img
                            src={originalImageUrl}
                            alt="Original"
                            className="w-full h-full object-cover pointer-events-none"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-center">
                        <span className="px-2.5 py-1 text-xs font-bold text-white bg-gradient-primary rounded-md shadow-card border border-primary/30 inline-block">
                          Orijinal
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center flex-shrink-0 hidden sm:flex">
                      <ChevronRight className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 text-gray-300" />
                    </div>

                    {/* Processed Versions - Horizontal Grid */}
                    <div className="flex items-start gap-2 sm:gap-3 md:gap-4 flex-1 overflow-x-auto overflow-y-visible pb-6 pt-3 px-3 w-full min-w-0">
                      {/* Processing Placeholders - Original image only */}
                      {Array.from(processingStates.values())
                        .filter(processing => processing.sourceId === image.id && !processing.sourceVersionId)
                        .map((processing) => {
                          const elapsedSeconds = Math.floor((Date.now() - processing.startTime) / 1000);
                          const showAlmostThere = elapsedSeconds >= 10;
                          const angle = processing.angle;
                          
                          return (
                            <div
                              key={`processing-${processing.id}`}
                              className="group relative flex-shrink-0 p-1"
                            >
                              <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-300 shadow-card relative animate-placeholder-pulse">
                                {/* Blurred Background with Source Image */}
                                <div className="absolute inset-0 blur-md opacity-50">
                                  <img
                                    src={originalImageUrl}
                                    alt="Processing"
                                    className="w-full h-full object-cover scale-110"
                                  />
                                </div>
                                
                                {/* Processing Overlay */}
                                <div className="absolute inset-0 bg-gray-900/30 flex flex-col items-center justify-center">
                                  <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 text-white animate-spin mb-2" />
                                  <p className="text-white text-xs sm:text-sm font-semibold">
                                    {showAlmostThere ? 'Az kaldı...' : 'İşleniyor'}
                                  </p>
                                </div>
                                
                                {/* Angle Badge - Bottom Left (only if angle exists) */}
                                {angle !== undefined && (
                                  <div className="absolute bottom-2 left-2">
                                    <span className="px-2 py-0.5 text-[9px] font-semibold bg-primary text-white rounded-md shadow-card">
                                      {angle}°
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
              
      {pipelines.map((pipeline, pipelineIndex) => {
                const indentLevel = Math.min(pipeline.level, 4);
                const indentPx = pipeline.level === 0 ? 0 : 16 + indentLevel * 12;
                return (
                  <div
                    key={pipelineIndex}
                    className="relative rounded-2xl bg-white/70 p-4 shadow-card border border-gray-100 mt-3"
                    style={{ marginLeft: indentPx }}
                  >
                    {pipeline.level > 0 && (
                      <span className="absolute -left-2 top-6 bottom-6 w-1 rounded-full bg-gradient-to-b from-blue-200 to-primary/40 hidden sm:block" />
                    )}

                    {/* Level Label */}
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "px-3 py-1.5 text-[11px] font-bold rounded-lg uppercase tracking-wide shadow-card",
                          pipeline.sourceType === 'original'
                            ? "bg-gradient-primary text-white border border-primary/30"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        )}
                      >
                        {pipeline.sourceType === 'original' ? 'Ana Referans' : 'Kaynak Referans'}
                      </span>
                    </div>

                    {/* Pipeline Row */}
                    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full">
                      {/* Source Image */}
                      <div className="flex-shrink-0">
                        <div 
                          className={cn(
                            "w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 rounded-xl overflow-visible shadow-card hover-lift cursor-pointer relative bg-white",
                            pipeline.sourceType === 'original'
                              ? "border-3 border-primary/80 hover:border-primary"
                              : "border-2 border-dashed border-blue-200 bg-blue-50/60 hover:border-blue-400"
                          )}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button')) {
                              return;
                            }
                          setPreviewImage({
                            url: pipeline.source.url,
                            name: pipeline.source.name,
                            ...(pipeline.source.filename ? { filename: pipeline.source.filename } : {})
                          });
                          }}
                        >
                          <div className="w-full h-full overflow-hidden rounded-xl">
                            <img
                              src={normalizeImageUrl(pipeline.source.url, pipeline.source.filename)}
                              alt={pipeline.source.name}
                              className="w-full h-full object-cover pointer-events-none"
                              onError={(e) => {
                                if (process.env.NODE_ENV === 'development') {
                                  console.error('ProductionPipeline: Failed to load source image:', {
                                    originalUrl: pipeline.source.url,
                                    normalizedUrl: normalizeImageUrl(pipeline.source.url, pipeline.source.filename),
                                    filename: pipeline.source.filename,
                                    attemptedSrc: e.currentTarget.src
                                  });
                                }
                                e.currentTarget.style.display = 'none';
                              }}
                              onLoad={() => {
                                if (process.env.NODE_ENV === 'development') {
                                  console.log('ProductionPipeline: Source image loaded successfully:', normalizeImageUrl(pipeline.source.url, pipeline.source.filename));
                                }
                              }}
                            />
                          </div>
                        </div>
                        {pipeline.level === 0 && (
                          <div className="mt-2 text-center">
                            <span className="px-2.5 py-1 text-xs font-bold text-white bg-gradient-primary rounded-md shadow-card border border-primary/30 inline-block">
                              Orijinal
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Processed Versions - Wrap Grid */}
                      <div className="flex-1 w-full">
                        <div className="flex flex-wrap gap-3 md:gap-4 w-full">
                      {/* Processed Images First */}
                      {pipeline.processed.map((version, versionIndex) => {
                        // Check if there are processing placeholders for this version
                        const versionProcessing = Array.from(processingStates.values())
                          .filter(p => p.sourceVersionId === version.id);
                        // Extract angle from parameters.angle first, then from prompt
                        const extractAngle = (params: Record<string, any>): string | null => {
                          // First, check if angle is directly stored in parameters
                          if (params.angle !== undefined && params.angle !== null) {
                            return String(params.angle);
                          }
                          
                          // Fallback: extract from prompt
                          const prompt = params.prompt;
                          if (!prompt) return null;
                          
                          // New format: "0° rotation" or "Rotate X° clockwise"
                          if (prompt.includes('0° rotation') || prompt.match(/^0°\s/)) {
                            return '0';
                          }
                          
                          // Match "Rotate X° clockwise" pattern
                          const angleMatch = prompt.match(/Rotate\s+(\d+)°\s+clockwise/i);
                          if (angleMatch) {
                            return angleMatch[1];
                          }
                          
                          // Fallback: Try to extract any angle number at the start
                          const fallbackMatch = prompt.match(/^(\d+)°\s/i);
                          return fallbackMatch ? fallbackMatch[1] : null;
                        };
                        const angle = version.parameters ? extractAngle(version.parameters) : null;

                        return (
                          <div
                            key={version.id}
                            className="group relative flex-shrink-0 p-1 basis-[48%] sm:basis-[32%] md:basis-[24%] lg:basis-[20%] min-w-[140px] overflow-hidden"
                          >
                            {/* Preview - Taller Card */}
                            <div 
                              className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-gray-50 border-2 border-gray-200 shadow-card hover:border-primary hover-lift relative cursor-pointer"
                              onClick={(e) => {
                                // Only open preview if clicking directly on the image container, not on buttons
                                if ((e.target as HTMLElement).closest('button')) {
                                  return;
                                }
                                const imageUrl = normalizeImageUrl(version.url, version.filename);
                                setPreviewImage({ 
                                  url: imageUrl, 
                                  name: `${version.operation} - ${angle || 'processed'}°`,
                                  filename: version.filename 
                                });
                              }}
                            >
                              <div className="w-full h-full overflow-hidden rounded-xl">
                                <img
                                  src={normalizeImageUrl(version.url, version.filename)}
                                  alt={version.operation}
                                  className={cn(
                                    "w-full h-full object-cover pointer-events-none",
                                    newlyCompletedImages.has(version.id) && "animate-fadeInBlur"
                                  )}
                                  onError={(e) => {
                                    const normalizedUrl = normalizeImageUrl(version.url, version.filename);
                                    const currentSrc = e.currentTarget.src;
                                    
                                    // Try to reload with normalized URL if different
                                    if (normalizedUrl && normalizedUrl !== currentSrc && normalizedUrl !== version.url) {
                                      e.currentTarget.src = normalizedUrl;
                                      return; // Don't hide yet, let it try the normalized URL
                                    }
                                    
                                    // If already tried normalized URL or no alternative, hide the image
                                    if (currentSrc === normalizedUrl || !normalizedUrl) {
                                      e.currentTarget.style.display = 'none';
                                      // Log error only in development
                                      if (process.env.NODE_ENV === 'development') {
                                        console.error('Failed to load processed image:', {
                                          original: version.url,
                                          normalized: normalizedUrl,
                                          filename: version.filename,
                                          attemptedSrc: currentSrc
                                        });
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <div className="absolute inset-1 bg-black/0 group-hover:bg-black/20 transition-smooth flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none rounded-xl">
                                <div className="flex flex-col gap-1 pointer-events-auto w-full px-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white hover:bg-white text-[11px] px-2 py-1 shadow-card w-full justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const imageUrl = normalizeImageUrl(version.url, version.filename);
                                      downloadImageFile(imageUrl, version.filename);
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                    İndir
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white hover:bg-white text-[11px] px-2 py-1 shadow-card w-full justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectAsSource(version.id);
                                    }}
                                  >
                                    Kaynak Olarak Kullan
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Angle Badge - Top Left (only if angle exists) */}
                              {angle && (
                                <div className="absolute top-2 left-2 z-20 pointer-events-none">
                                  <span className="px-2 py-0.5 text-[9px] font-semibold bg-primary text-white rounded-md shadow-card">
                                    {angle}°
                                  </span>
                                </div>
                              )}
                              
                              {/* Operation Info - Bottom Right */}
                              <div className="absolute bottom-2 right-2 z-10 bg-black/70 px-2 py-1 rounded-md">
                                <p className="text-[9px] font-medium text-white capitalize">
                                  {version.operation.replace(/-/g, ' ')}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Processing Placeholders - After processed images */}
                      {Array.from(processingStates.values())
                        .filter(processing => {
                          // For level 0 (original), match if sourceId is the original image id and no sourceVersionId
                          if (pipeline.level === 0) {
                            return processing.sourceId === image.id && !processing.sourceVersionId;
                          }
                          // For other levels, match if sourceVersionId matches the pipeline source id
                          // (processed versions are the source for next level processing)
                          return processing.sourceVersionId === pipeline.source.id;
                        })
                        .map((processing) => {
                          const elapsedSeconds = Math.floor((Date.now() - processing.startTime) / 1000);
                          const showAlmostThere = elapsedSeconds >= 10;
                          const angle = processing.angle;
                          
                          return (
                            <div
                              key={`processing-${processing.id}`}
                              className="group relative flex-shrink-0 basis-[48%] sm:basis-[32%] md:basis-[24%] lg:basis-[20%] min-w-[140px]"
                            >
                              <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-300 shadow-card relative animate-placeholder-pulse">
                                {/* Blurred Background with Source Image */}
                                <div className="absolute inset-0 blur-md opacity-50">
                                  <img
                                    src={pipeline.source.url}
                                    alt="Processing"
                                    className="w-full h-full object-cover scale-110"
                                  />
                                </div>
                                
                                {/* Processing Overlay */}
                                <div className="absolute inset-0 bg-gray-900/30 flex flex-col items-center justify-center">
                                  <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 text-white animate-spin mb-2" />
                                  <p className="text-white text-xs sm:text-sm font-semibold">
                                    {showAlmostThere ? 'Az kaldı...' : 'İşleniyor'}
                                  </p>
                                </div>
                                
                                {/* Angle Badge - Bottom Left (only if angle exists) */}
                                {angle !== undefined && (
                                  <div className="absolute bottom-2 left-2 z-10">
                                    <span className="px-2 py-0.5 text-[9px] font-semibold bg-primary text-white rounded-md shadow-card">
                                      {angle}°
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewModal}

      {/* Delete Confirmation Modal */}
      {pendingDeleteVersion && (
        <div 
          className="fixed inset-0 glass-dark z-[100] animate-modal-backdrop"
          data-modal="delete-version"
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
                  Bu görseli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={async () => {
                  if (!pendingDeleteVersion) return;
                  
                  const { imageId, versionId } = pendingDeleteVersion;
                  
                  // Start deletion animation
                  setDeletingVersions(prev => new Set(prev).add(versionId));
                  setPendingDeleteVersion(null);
                  
                  try {
                    await onDeleteVersion?.(imageId, versionId);
                    
                    // Show success notification
                    setDeleteNotification({ 
                      message: 'Görsel başarıyla silindi', 
                      timestamp: Date.now() 
                    });
                    
                    // Remove from deleting state after animation
                    setTimeout(() => {
                      setDeletingVersions(prev => {
                        const updated = new Set(prev);
                        updated.delete(versionId);
                        return updated;
                      });
                    }, 300); // Match animation duration
                    
                    // Clear notification after 3 seconds
                    setTimeout(() => {
                      setDeleteNotification(null);
                    }, 3000);
                  } catch (error) {
                    // Remove from deleting state on error
                    setDeletingVersions(prev => {
                      const updated = new Set(prev);
                      updated.delete(versionId);
                      return updated;
                    });
                    alert('Görsel silinirken bir hata oluştu.');
                  }
                }}
                variant="destructive"
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Evet, Sil
              </Button>
              <Button
                variant="outline"
                onClick={() => setPendingDeleteVersion(null)}
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

