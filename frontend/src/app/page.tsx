'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ImageUpload } from '@/components/ImageUpload';
import { ImageProcessor } from '@/components/ImageProcessor';
import { ProductionPipeline } from '@/components/ProductionPipeline';
import { LandingPage } from '@/components/LandingPage';
import { Button } from '@/components/ui/Button';
import { AuthForm } from '@/components/AuthForm';
import { imageAPI, getImageUrl, normalizeImageUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Image as ImageIcon, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebaseClient';

interface ImageData {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
  uploadedAt: string;
  width?: number;
  height?: number;
  processedVersions?: any[];
}

type ViewMode = 'upload' | 'processing' | 'pipeline';

export default function Home() {
  const auth = useMemo(() => getFirebaseAuth(), []);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [selectedSourceVersionId, setSelectedSourceVersionId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [processingImages, setProcessingImages] = useState<Array<{ id: string; startTime: number; angle?: number; sourceId: string; sourceVersionId?: string }>>([]);
  const [showLanding, setShowLanding] = useState<boolean | null>(null); // null = auto-detect based on auth

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!currentUser) {
      setImages([]);
      setSelectedImage(null);
      setViewMode('upload');
      return;
    }

    loadImages();
  }, [currentUser]);

  const loadImages = async () => {
    try {
      if (!currentUser) return;
      const response = await imageAPI.listImages();
      const imagesList = response.data?.images || response.images || [];
      setImages(imagesList);
    } catch (error) {
      console.error('Failed to load images:', error);
      // Show user-friendly error
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
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

  const handleProcessingStart = (processingInfo: { angles: number[]; sourceId?: string; processingIds?: string[] }) => {
    // Use the provided sourceId (which could be a processed version ID or original image ID)
    // For source-based processing, sourceId will be the processed version ID
    // For original image processing, sourceId will be the original image ID
    // Use provided processingIds if available, otherwise generate them
    const ids = processingInfo.processingIds || processingInfo.angles.map((_, index) => `processing-${Date.now()}-${index}`);
    const newProcessingImages = processingInfo.angles.map((angle, index) => ({
      id: ids[index],
      startTime: Date.now(),
      angle,
      sourceId: processingInfo.sourceId || selectedImage?.id || '', // Use provided sourceId
      sourceVersionId: processingInfo.sourceId !== selectedImage?.id ? processingInfo.sourceId : undefined // Track if it's a version ID
    }));
    
    // Debug log
    console.log('🟢 handleProcessingStart called:', {
      processingInfo,
      newProcessingImages,
      selectedImageId: selectedImage?.id
    });
    
    setProcessingImages(prev => {
      const updated = [...prev, ...newProcessingImages];
      console.log('🟢 Processing images updated:', {
        prevCount: prev.length,
        newCount: updated.length,
        all: updated
      });
      return updated;
    });
  };

  const handleProcessingError = (processingIds: string[]) => {
    // Remove failed processing images
    setProcessingImages(prev => prev.filter(p => !processingIds.includes(p.id)));
  };

  const handleProcessComplete = (processedVersion: any) => {
    // Debug log
    console.log('🟢 handleProcessComplete called:', {
      processedVersion,
      selectedImageId: selectedImage?.id,
      currentProcessingCount: processingImages.length
    });
    
    // Normalize URL if it contains localhost
    if (processedVersion?.url && processedVersion.url.includes('localhost')) {
      processedVersion.url = normalizeImageUrl(processedVersion.url, processedVersion.filename);
    }
    
    // Functional state update to avoid closure issues with rapid sequential updates
    setSelectedImage(prev => {
      if (!prev) return prev;
      
      const updatedImage = {
        ...prev,
        processedVersions: [...(prev.processedVersions || []), processedVersion]
      };
      
      // Also update images array with the latest version
      setImages(images => images.map(img => 
        img.id === prev.id ? updatedImage : img
      ));
      
      // Remove completed processing images using functional update to get latest selectedImage
      // Use setTimeout to ensure processing state is visible before removal
      setTimeout(() => {
        setProcessingImages(processingPrev => {
          const sourceId = processedVersion.sourceImageId || processedVersion.sourceProcessedVersionId || prev.id;
          
          // Extract angle from processedVersion to match more accurately
          const versionAngle = processedVersion.parameters?.angle !== undefined 
            ? processedVersion.parameters.angle 
            : null;
          
          // Remove one processing image that matches the source and angle (if available)
          // Also match by original image id since we always use original image id as sourceId
          const matchingIndex = processingPrev.findIndex(p => {
            const sourceMatches = p.sourceId === sourceId || p.sourceId === prev.id;
            const angleMatches = versionAngle === null || p.angle === versionAngle || p.angle === undefined;
            return sourceMatches && angleMatches;
          });
          
          if (matchingIndex !== -1) {
            console.log('🟢 Removing processing image:', matchingIndex);
            return processingPrev.filter((_, index) => index !== matchingIndex);
          }
          return processingPrev;
        });
      }, 100); // Small delay to ensure UI updates first
      
      return updatedImage;
    });
    
    // Clear the selected source version after processing
    setSelectedSourceVersionId(null);
    // Note: Pipeline view is already switched in ImageProcessor's handleConfirmProcess
  };

  const handleSelectAsSource = (versionId: string) => {
    setSelectedSourceVersionId(versionId);
    setViewMode('processing');
  };

  const handleVersionDelete = async (imageId: string, versionId: string) => {
    try {
      await imageAPI.deleteProcessedVersion(imageId, versionId);
      
      // Wait for animation to complete (300ms) before updating state
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Update the selected image's processed versions
      if (selectedImage?.id === imageId) {
        const updatedVersions = (selectedImage.processedVersions || []).filter(
          v => v.id !== versionId
        );
        setSelectedImage({
          ...selectedImage,
          processedVersions: updatedVersions
        });
      }
      
      // Update images list
      setImages(prevImages => 
        prevImages.map(img => 
          img.id === imageId 
            ? { ...img, processedVersions: (img.processedVersions || []).filter(v => v.id !== versionId) }
            : img
        )
      );
    } catch (error) {
      console.error('Failed to delete version:', error);
      throw error;
    }
  };

  const handleImageDelete = (imageId: string) => {
    const remainingImages = images.filter(img => img.id !== imageId);
    setImages(remainingImages);
    
    if (selectedImage?.id === imageId) {
      // Silinen görsel seçili görseldi
      if (remainingImages.length > 0) {
        // Başka görsel varsa ilkini seç ve mevcut viewMode'da kal
        setSelectedImage(remainingImages[0]);
        // viewMode'u değiştirme, kaldığı yerde kalsın
      } else {
        // Hiç görsel kalmadıysa upload ekranına git
        setSelectedImage(null);
        setViewMode('upload');
      }
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle">
        <p className="text-sm text-gray-600">Oturum bilgileri yükleniyor…</p>
      </div>
    );
  }

  // Show landing page if not authenticated or if explicitly requested
  if (!currentUser) {
    // For unauthenticated users, show landing page by default
    // If showLanding is explicitly false, show auth form
    if (showLanding === false) {
      return <AuthForm />;
    }
    // Default: show landing page
    return (
      <LandingPage 
        onGetStarted={() => {
          // When "Hemen Başla" is clicked, show auth form
          setShowLanding(false);
        }} 
      />
    );
  }

  // Show landing page if authenticated user explicitly requests it
  if (showLanding === true && currentUser) {
    return (
      <LandingPage 
        onGetStarted={() => {
          // When "Hemen Başla" is clicked, go back to main app
          setShowLanding(null);
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="glass-strong border-b border-white/20 shadow-card">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLanding(true)}
                className="px-5 py-2.5 bg-white rounded-xl shadow-card border border-gray-200/50 hover:shadow-card-hover transition-smooth cursor-pointer"
                title="Ana Sayfaya Dön"
              >
                <h1 className="text-2xl font-bold text-gradient-purple">ImageFlow</h1>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-600 font-medium">AI Destekli Görsel İşleme</p>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Çıkış Yap
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Action Buttons */}
        <div className="mb-6 md:mb-8 flex items-center justify-end">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {images.length > 0 && (
              <Button
                onClick={() => setShowLibrary(!showLibrary)}
                variant="outline"
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <ImageIcon className="h-4 w-4" />
                <span>Kütüphane ({images.length})</span>
                {showLibrary ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            )}
            {selectedImage && (
              <Button
                onClick={() => {
                  setShowUpload(true);
                  // Modal açıldığında görünür hale getir
                  setTimeout(() => {
                    const modalElement = document.querySelector('[data-modal="upload"]');
                    if (modalElement) {
                      modalElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }, 100);
                }}
                className="shadow-card w-full sm:w-auto"
              >
                <Upload className="h-4 w-4 mr-2" />
                Yeni Görsel Yükle
              </Button>
            )}
          </div>
        </div>


        {viewMode === 'upload' && !selectedImage ? (
          /* Sadece Upload Bölümü - Görsel seçilmediğinde */
          <div className="relative flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Library Sidebar - Upload ekranında da görünür */}
            {images.length > 0 && (
              <div className={cn(
                "transition-smooth-200",
                showLibrary ? "w-full lg:w-80 opacity-100" : "w-0 opacity-0 overflow-hidden"
              )}>
                <div className="glass rounded-2xl shadow-card-hover border border-white/20 overflow-hidden">
                  <div className="bg-gradient-primary p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5"></div>
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 glass-dark rounded-xl flex items-center justify-center shadow-button">
                          <ImageIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white">Kütüphaneniz</h2>
                          <p className="text-white/90 text-sm font-medium">{images.length} görsel</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
                    <div className="space-y-3">
                      {images.map((img) => {
                        const imageUrl = getImageUrl(img.filename);
                        return (
                          <div
                            key={img.id}
                            className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer transition-smooth border glass-subtle border-white/30 hover:glass hover:border-white/50 hover:shadow-card hover:scale-[1.01]"
                            onClick={() => {
                              setSelectedImage(img);
                              setViewMode('processing');
                            }}
                          >
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
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 glass-strong p-2.5 border-t border-white/20">
                              <p className="text-gray-900 text-xs font-semibold truncate">
                                {img.originalName}
                              </p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[10px] text-gray-600">
                                  {(img.size / (1024 * 1024)).toFixed(1)} MB
                                  {img.width && img.height
                                    ? ` / ${((img.width * img.height) / 1_000_000).toFixed(1)} MP`
                                    : ''}
                                </span>
                                {img.processedVersions && img.processedVersions.length > 0 && (
                                  <span className="glass-subtle border border-primary/20 text-primary px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-minimal">
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
            )}
            
            {/* Upload Area */}
            <div className="flex-1">
              <ImageUpload
                onUploadComplete={handleUploadComplete}
              />
            </div>
          </div>
        ) : viewMode === 'processing' && selectedImage ? (
          /* AI Processing - Model seçimi ve açı seçimi */
          <div className="relative flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Library Sidebar - Açılıp Kapanabilir */}
            <div className={cn(
              "transition-smooth-200",
              showLibrary ? "w-full lg:w-80 opacity-100" : "w-0 opacity-0 overflow-hidden"
            )}>
              <div className="glass rounded-2xl shadow-card-hover border border-white/20 overflow-hidden">
                <div className="bg-gradient-primary p-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/5"></div>
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 glass-dark rounded-xl flex items-center justify-center shadow-button">
                        <ImageIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">Kütüphaneniz</h2>
                        <p className="text-white/90 text-sm font-medium">{images.length} görsel</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
                  <div className="space-y-3">
                    {images.map((img) => {
                      const imageUrl = getImageUrl(img.filename);
                      const isSelected = selectedImage?.id === img.id;
                      
                      return (
                        <div
                          key={img.id}
                          className={cn(
                            "group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer transition-smooth border",
                            isSelected
                              ? 'ring-2 ring-primary ring-offset-2 border-primary shadow-card-hover scale-[1.02]'
                              : 'glass-subtle border-white/30 hover:glass hover:border-white/50 hover:shadow-card hover:scale-[1.01]'
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
                              "absolute inset-0 transition-smooth flex items-center justify-center",
                              isSelected ? 'bg-primary/10' : 'group-hover:bg-black/5'
                            )}>
                              {isSelected && (
                                <div className="glass-strong text-primary px-3 py-1.5 rounded-xl text-xs font-bold shadow-button flex items-center gap-2 border border-primary/20">
                                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                  Seçili
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Info Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 glass-strong p-2.5 border-t border-white/20">
                            <p className="text-gray-900 text-xs font-semibold truncate">
                              {img.originalName}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-gray-600">
                                {(img.size / (1024 * 1024)).toFixed(1)} MB
                                {img.width && img.height
                                  ? ` / ${((img.width * img.height) / 1_000_000).toFixed(1)} MP`
                                  : ''}
                              </span>
                              {img.processedVersions && img.processedVersions.length > 0 && (
                                <span className="glass-subtle border border-primary/20 text-primary px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-minimal">
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
                onProcessingStart={handleProcessingStart}
                onProcessingError={handleProcessingError}
                onSourceVersionChange={(versionId) => setSelectedSourceVersionId(versionId)}
                {...(selectedSourceVersionId && { initialSelectedSourceVersion: selectedSourceVersionId })}
              />
            </div>
          </div>
        ) : viewMode === 'pipeline' && selectedImage ? (
          /* Production Pipeline View */
          <div className="relative flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Library Sidebar - Pipeline görünümünde de görünür */}
            <div className={cn(
              "transition-smooth-200",
              showLibrary ? "w-full lg:w-80 opacity-100" : "w-0 opacity-0 overflow-hidden"
            )}>
              <div className="glass rounded-2xl shadow-card-hover border border-white/20 overflow-hidden">
                <div className="bg-gradient-primary p-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/5"></div>
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 glass-dark rounded-xl flex items-center justify-center shadow-button">
                        <ImageIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">Kütüphaneniz</h2>
                        <p className="text-white/90 text-sm font-medium">{images.length} görsel</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
                  <div className="space-y-3">
                    {images.map((img) => {
                      const imageUrl = getImageUrl(img.filename);
                      const isSelected = selectedImage?.id === img.id;
                      
                      return (
                        <div
                          key={img.id}
                          className={cn(
                            "group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer transition-smooth border",
                            isSelected
                              ? 'ring-2 ring-primary ring-offset-2 border-primary shadow-card-hover scale-[1.02]'
                              : 'glass-subtle border-white/30 hover:glass hover:border-white/50 hover:shadow-card hover:scale-[1.01]'
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
                              "absolute inset-0 transition-smooth flex items-center justify-center",
                              isSelected ? 'bg-primary/10' : 'group-hover:bg-black/5'
                            )}>
                              {isSelected && (
                                <div className="glass-strong text-primary px-3 py-1.5 rounded-xl text-xs font-bold shadow-button flex items-center gap-2 border border-primary/20">
                                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                  Seçili
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Info Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 glass-strong p-2.5 border-t border-white/20">
                            <p className="text-gray-900 text-xs font-semibold truncate">
                              {img.originalName}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-gray-600">
                                {(img.size / (1024 * 1024)).toFixed(1)} MB
                              </span>
                              {img.processedVersions && img.processedVersions.length > 0 && (
                                <span className="glass-subtle border border-primary/20 text-primary px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-minimal">
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
            <div className="flex-1 min-w-0 w-full">
              <ProductionPipeline
                key={selectedImage.id}
                image={selectedImage}
                onSelectAsSource={handleSelectAsSource}
                onBack={() => setViewMode('processing')}
                onDeleteVersion={handleVersionDelete}
                processingImages={processingImages}
              />
            </div>
          </div>
        ) : null}

        {/* Upload Modal/Overlay */}
        {showUpload && (
          <div 
            className="fixed inset-0 glass-dark z-[100] animate-modal-backdrop"
            data-modal="upload"
          >
            <div 
              className="glass-strong rounded-2xl shadow-modal max-w-4xl w-[90%] md:w-full max-h-[90vh] overflow-y-auto border border-white/20 animate-modal-content"
              style={{
                position: 'fixed',
                top: '50vh',
                left: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="sticky top-0 glass-strong border-b border-white/20 p-5 flex items-center justify-between z-10">
                <h3 className="text-xl font-bold text-gray-900">Görsel Yükle</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowUpload(false);
                    // Modal kapatıldığında viewMode'u upload yap
                    if (!selectedImage || images.length === 0) {
                      setSelectedImage(null);
                      setViewMode('upload');
                    } else {
                      // Eğer görsel varsa processing moduna dön
                      setViewMode('processing');
                    }
                  }}
                  className="rounded-lg"
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