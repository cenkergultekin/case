'use client';

import React, { useState, useEffect } from 'react';
import { ImageUpload } from '@/components/ImageUpload';
import { ImageProcessor } from '@/components/ImageProcessor';
import { ProductionPipeline } from '@/components/ProductionPipeline';
import { Button } from '@/components/ui/Button';
import { imageAPI, getImageUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Image as ImageIcon, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageData {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
  processedVersions?: any[];
}

type ViewMode = 'upload' | 'processing' | 'pipeline';

export default function Home() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [selectedSourceVersionId, setSelectedSourceVersionId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const response = await imageAPI.listImages();
      setImages(response.data.images || []);
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  };

  const handleUploadComplete = (newImages: ImageData[]) => {
    setImages(prev => [...newImages, ...prev]);
    if (newImages.length === 1) {
      setSelectedImage(newImages[0]);
      setShowUpload(false);
      setViewMode('processing');
    }
  };

  const handleProcessComplete = (processedVersion: any) => {
    if (selectedImage) {
      const updatedImage = {
        ...selectedImage,
        processedVersions: [...(selectedImage.processedVersions || []), processedVersion]
      };
      setSelectedImage(updatedImage);
      setImages(prev => prev.map(img => 
        img.id === selectedImage.id ? updatedImage : img
      ));
      // Clear the selected source version after processing
      setSelectedSourceVersionId(null);
      // Switch to pipeline view after processing
      setViewMode('pipeline');
    }
  };

  const handleSelectAsSource = (versionId: string) => {
    setSelectedSourceVersionId(versionId);
    setViewMode('processing');
  };

  const handleImageDelete = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    if (selectedImage?.id === imageId) {
      setSelectedImage(null);
      setShowUpload(true);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50">
      {/* Header */}
      <header className="bg-transparent border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">ImageFlow v1</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 lg:py-12">
        {/* Action Buttons */}
        <div className="mb-6 md:mb-8 lg:mb-12 flex items-center justify-end">
          {selectedImage && (
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowUpload(true)}
                className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white shadow-lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                Yeni Görsel Yükle
              </Button>
              <Button
                onClick={() => setShowLibrary(!showLibrary)}
                variant="outline"
                className="bg-white/60 backdrop-blur-sm border-white/20 shadow-lg flex items-center gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                <span>Kütüphane</span>
                {showLibrary ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>


        {viewMode === 'upload' && !selectedImage ? (
          /* Sadece Upload Bölümü - Görsel seçilmediğinde */
          <div className="max-w-4xl mx-auto">
            <ImageUpload
              onUploadComplete={handleUploadComplete}
              multiple={true}
              maxFiles={5}
            />
          </div>
        ) : viewMode === 'processing' && selectedImage ? (
          /* AI Processing - Model seçimi ve açı seçimi */
          <div className="relative flex gap-6">
            {/* Library Sidebar - Açılıp Kapanabilir */}
            <div className={cn(
              "transition-all duration-300 ease-in-out",
              showLibrary ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden"
            )}>
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                        <ImageIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">Your Library</h2>
                        <p className="text-white/80">{images.length} images available</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 max-h-[calc(100vh-300px)] overflow-y-auto">
                  <div className="space-y-4">
                    {images.map((img) => {
                      const imageUrl = getImageUrl(img.filename);
                      const isSelected = selectedImage?.id === img.id;
                      
                      return (
                        <div
                          key={img.id}
                          className={cn(
                            "group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300",
                            isSelected
                              ? 'ring-4 ring-blue-500 shadow-xl scale-[1.02]'
                              : 'hover:shadow-lg hover:scale-[1.02] border-2 border-transparent hover:border-blue-300'
                          )}
                          onClick={() => {
                            setSelectedImage(img);
                            setViewMode('processing');
                          }}
                        >
                          {/* Image */}
                          <div className="w-full h-full bg-gray-100 relative">
                            <img
                              src={imageUrl}
                              alt={img.originalName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-50">
                              <ImageIcon className="h-12 w-12 text-gray-300" />
                            </div>
                            
                            {/* Selection Overlay */}
                            <div className={cn(
                              "absolute inset-0 transition-colors duration-300 flex items-center justify-center",
                              isSelected ? 'bg-blue-500/20' : 'group-hover:bg-black/10'
                            )}>
                              {isSelected && (
                                <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
                                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                  Seçili
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Info Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-2 border-t border-white/20">
                            <p className="text-gray-900 text-xs font-bold truncate">
                              {img.originalName}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] font-medium text-gray-500">
                                {(img.size / (1024 * 1024)).toFixed(1)} MB
                              </span>
                              {img.processedVersions && img.processedVersions.length > 0 && (
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  {img.processedVersions.length}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Processing - Merkeze/Sağa */}
            <div className="flex-1">
              <ImageProcessor
                key={`${selectedImage.id}-${selectedSourceVersionId}`}
                image={selectedImage}
                onProcessComplete={handleProcessComplete}
                onDelete={handleImageDelete}
                onViewPipeline={() => setViewMode('pipeline')}
                {...(selectedSourceVersionId && { initialSelectedSourceVersion: selectedSourceVersionId })}
              />
            </div>
          </div>
        ) : viewMode === 'pipeline' && selectedImage ? (
          /* Production Pipeline View */
          <div className="relative flex gap-6">
            {/* Library Sidebar - Pipeline görünümünde de görünür */}
            <div className={cn(
              "transition-all duration-300 ease-in-out",
              showLibrary ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden"
            )}>
              <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                        <ImageIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">Your Library</h2>
                        <p className="text-white/80">{images.length} images available</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 max-h-[calc(100vh-300px)] overflow-y-auto">
                  <div className="space-y-4">
                    {images.map((img) => {
                      const imageUrl = getImageUrl(img.filename);
                      const isSelected = selectedImage?.id === img.id;
                      
                      return (
                        <div
                          key={img.id}
                          className={cn(
                            "group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300",
                            isSelected
                              ? 'ring-4 ring-blue-500 shadow-xl scale-[1.02]'
                              : 'hover:shadow-lg hover:scale-[1.02] border-2 border-transparent hover:border-blue-300'
                          )}
                          onClick={() => {
                            setSelectedImage(img);
                            // Pipeline görünümünde kal, sadece görsel değişsin
                            // selectedImage değiştiği için ProductionPipeline otomatik güncellenecek (key prop sayesinde)
                          }}
                        >
                          {/* Image */}
                          <div className="w-full h-full bg-gray-100 relative">
                            <img
                              src={imageUrl}
                              alt={img.originalName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-50">
                              <ImageIcon className="h-12 w-12 text-gray-300" />
                            </div>
                            
                            {/* Selection Overlay */}
                            <div className={cn(
                              "absolute inset-0 transition-colors duration-300 flex items-center justify-center",
                              isSelected ? 'bg-blue-500/20' : 'group-hover:bg-black/10'
                            )}>
                              {isSelected && (
                                <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
                                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                  Seçili
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Info Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-2 border-t border-white/20">
                            <p className="text-gray-900 text-xs font-bold truncate">
                              {img.originalName}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] font-medium text-gray-500">
                                {(img.size / (1024 * 1024)).toFixed(1)} MB
                              </span>
                              {img.processedVersions && img.processedVersions.length > 0 && (
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  {img.processedVersions.length}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Production Pipeline - Merkeze/Sağa */}
            <div className="flex-1">
              <ProductionPipeline
                key={selectedImage.id}
                image={selectedImage}
                onSelectAsSource={handleSelectAsSource}
                onBack={() => setViewMode('processing')}
              />
            </div>
          </div>
        ) : null}

        {/* Upload Modal/Overlay */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
                <h3 className="text-xl font-bold text-gray-900">Görsel Yükle</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowUpload(false);
                    if (images.length === 0) {
                      setSelectedImage(null);
                    }
                  }}
                  className="rounded-full hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-6">
                <ImageUpload
                  onUploadComplete={(newImages) => {
                    handleUploadComplete(newImages);
                    setShowUpload(false);
                  }}
                  multiple={true}
                  maxFiles={5}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}