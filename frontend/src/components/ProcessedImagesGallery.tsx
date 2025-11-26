'use client';

import React, { useState, useEffect } from 'react';
import { Filter, Download, Clock, Zap, Grid, List } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { imageAPI, getImageUrl } from '@/lib/api';

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
}

interface ProcessedImagesGalleryProps {
  onSelectAsSource?: (imageId: string, processedVersionId: string) => void;
}

export function ProcessedImagesGallery({ onSelectAsSource }: ProcessedImagesGalleryProps) {
  const [processedImages, setProcessedImages] = useState<ProcessedVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState({
    aiModel: '',
    minProcessingTime: '',
    maxProcessingTime: ''
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadProcessedImages();
  }, [page, filters]);

  const loadProcessedImages = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: any = { page, limit: 20 };
      
      if (filters.aiModel) params.aiModel = filters.aiModel;
      if (filters.minProcessingTime) params.minProcessingTime = Number(filters.minProcessingTime) * 1000;
      if (filters.maxProcessingTime) params.maxProcessingTime = Number(filters.maxProcessingTime) * 1000;

      const response = await imageAPI.listProcessedImages(params);
      setProcessedImages(response.data.processedImages);
      setTotalPages(response.data.totalPages);
    } catch (err) {
      console.error('Failed to load processed images:', err);
      setError('Failed to load processed images');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const downloadImage = (version: ProcessedVersion) => {
    const imageUrl = version.url?.includes('/api/uploads/') ? version.url : getImageUrl(version.filename);
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = version.filename;
    link.click();
  };

  const formatProcessingTime = (ms: number) => {
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getAIModelColor = (model: string) => {
    switch (model) {
      case 'flux': return 'bg-purple-100 text-purple-800';
      case 'seedream': return 'bg-green-100 text-green-800';
      case 'nano-banana': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-16 text-center shadow-xl border border-white/20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
        <p className="text-gray-600 font-medium text-lg">Loading gallery...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Filters Section */}
      <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Grid3x3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Processed Gallery</h2>
                <p className="text-white/80">Browse your AI generated masterpieces</p>
              </div>
            </div>
            <div className="flex bg-white/20 backdrop-blur-sm rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-white hover:bg-white/10'
                }`}
              >
                <Grid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-white hover:bg-white/10'
                }`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-b border-gray-100/50">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-bold text-gray-900 uppercase tracking-wider">Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 ml-1">AI Model</label>
              <select
                value={filters.aiModel}
                onChange={(e) => handleFilterChange('aiModel', e.target.value)}
                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              >
                <option value="">All Models</option>
                <option value="flux">Flux Pro</option>
                <option value="seedream">Seedream</option>
                <option value="nano-banana">Nano Banana</option>
                <option value="topaz">Topaz Upscale</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 ml-1">Min Time (s)</label>
              <input
                type="number"
                value={filters.minProcessingTime}
                onChange={(e) => handleFilterChange('minProcessingTime', e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 ml-1">Max Time (s)</label>
              <input
                type="number"
                value={filters.maxProcessingTime}
                onChange={(e) => handleFilterChange('maxProcessingTime', e.target.value)}
                placeholder="60"
                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              />
            </div>
          </div>
        </div>

        {/* Gallery Content */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700">
              <div className="w-2 h-2 bg-rose-500 rounded-full" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {processedImages.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Zap className="h-10 w-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Processed Images</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                Start processing your images with our AI models to build your gallery
              </p>
            </div>
          ) : (
            <>
              <div className={viewMode === 'grid' 
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' 
                : 'space-y-4'
              }>
                {processedImages.map((version) => (
                  <div
                    key={version.id}
                    className={`group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-200 hover:-translate-y-1 ${
                      viewMode === 'list' ? 'flex' : ''
                    }`}
                  >
                    {/* Image */}
                    <div className={`relative overflow-hidden bg-gray-100 ${
                      viewMode === 'grid' ? 'aspect-[3/4]' : 'w-48 h-32 flex-shrink-0'
                    }`}>
                      <img
                        src={version.url?.includes('/api/uploads/') ? version.url : getImageUrl(version.filename)}
                        alt={version.operation}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      
                      {/* Overlay Actions */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <div className="flex gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 bg-white text-gray-900 hover:bg-gray-100 border-0"
                            onClick={() => downloadImage(version)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                          {onSelectAsSource && (
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 border-0 text-white"
                              onClick={() => onSelectAsSource(version.sourceImageId || '', version.id)}
                            >
                              Use Source
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider ${getAIModelColor(version.aiModel)}`}>
                          {version.aiModel}
                        </span>
                        <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatProcessingTime(version.processingTimeMs)}
                        </span>
                      </div>
                      
                      <h4 className="font-bold text-gray-900 text-sm mb-1 capitalize truncate" title={version.operation.replace(/-/g, ' ')}>
                        {version.operation.replace(/-/g, ' ')}
                      </h4>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-gray-50">
                        <span>{new Date(version.createdAt).toLocaleDateString()}</span>
                        <span className="truncate max-w-[100px]" title={version.filename}>
                          #{version.filename.substring(0, 8)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-10">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-xl px-6"
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-medium text-gray-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-xl px-6"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
