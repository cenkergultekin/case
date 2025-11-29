'use client';

import React from 'react';
import { Button } from './ui/Button';
import { 
  Sparkles, 
  Zap, 
  RotateCw, 
  Image as ImageIcon, 
  Wand2, 
  ArrowRight,
  CheckCircle2,
  Layers,
  DollarSign,
  Target,
  GitBranch,
  RefreshCw,
  Eye,
  Upload,
  Play,
  Download,
  ArrowDown,
  ArrowRight as ArrowRightIcon,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="bg-gradient-subtle min-h-screen">
      {/* Hero Section - 100vh */}
      <section className="relative overflow-hidden min-h-screen flex items-center justify-center px-4 snap-start">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-6xl md:text-8xl font-bold text-gradient-purple mb-8 leading-[1.1] pb-6 pt-2">
            ImageFlow
          </h1>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">AI Destekli Görsel İşleme</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 text-balance">
            Görsellerinizi
            <span className="text-gradient-purple"> Farklı Açılardan</span>
            <br />
            Üretin
          </h2>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto text-balance">
            Karakter tutarlılığını koruyarak, AI modelleri ile görsellerinizi 8 farklı açıdan üretin. 
            Akıllı asistan desteği ile profesyonel sonuçlar elde edin.
          </p>
          
          <Button
            size="lg"
            onClick={onGetStarted}
            className="text-lg px-8 py-6 shadow-card-hover"
          >
            Hemen Başla
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Features Section - Visual Workflow */}
      <section className="py-16 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Nasıl Çalışır?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Gerçek UI elementleriyle görsel iş akışı
            </p>
          </div>

          {/* Compact Visual Workflow */}
          <div className="glass rounded-2xl p-6 border border-white/20 shadow-card space-y-6">
            <div className="flex items-start gap-6 justify-center flex-wrap md:flex-nowrap">
              {/* Step 1: Upload */}
              <div className="flex-shrink-0 w-48">
                <div className="glass-subtle rounded-lg p-3 border border-white/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-xs">1</span>
                    </div>
                    <h3 className="text-xs font-bold text-gray-900">Yükle</h3>
                  </div>
                  <div className="aspect-[4/3] rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center mb-1.5">
                    <Upload className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-[10px] text-gray-600 text-center">JPG, PNG, WebP</p>
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center pt-6">
                <ArrowRightIcon className="h-5 w-5 text-primary" />
              </div>

              {/* Step 2: Model Selection */}
              <div className="flex-shrink-0 w-48">
                <div className="glass-subtle rounded-lg p-3 border border-white/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-xs">2</span>
                    </div>
                    <h3 className="text-xs font-bold text-gray-900">Model</h3>
                  </div>
                  <div className="space-y-1.5 mb-1.5">
                    <div className="glass rounded p-1.5 border border-white/20">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Zap className="h-3 w-3 text-amber-600" />
                        <span className="text-[10px] font-semibold text-gray-900">Nano</span>
                      </div>
                      <div className="flex gap-0.5">
                        <span className="px-1 py-0.5 text-[9px] rounded bg-amber-100 text-amber-700 font-semibold">Yüksek</span>
                      </div>
                    </div>
                    <div className="glass rounded p-1.5 border border-white/20">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Target className="h-3 w-3 text-purple-600" />
                        <span className="text-[10px] font-semibold text-gray-900">Flux</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center pt-6">
                <ArrowRightIcon className="h-5 w-5 text-primary" />
              </div>

              {/* Step 3: Angle Selection */}
              <div className="flex-shrink-0 w-48">
                <div className="glass-subtle rounded-lg p-3 border border-white/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-xs">3</span>
                    </div>
                    <h3 className="text-xs font-bold text-gray-900">Açı</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mb-1.5">
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                      <button
                        key={angle}
                        className={cn(
                          "aspect-square rounded text-[9px] font-semibold transition-smooth",
                          angle === 90 
                            ? "bg-primary text-white" 
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-500 text-center">Otomatik</p>
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center pt-6">
                <ArrowRightIcon className="h-5 w-5 text-primary" />
              </div>

              {/* Step 4: Process */}
              <div className="flex-shrink-0 w-48">
                <div className="glass-subtle rounded-lg p-3 border border-white/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-xs">4</span>
                    </div>
                    <h3 className="text-xs font-bold text-gray-900">İşle</h3>
                  </div>
                  <div className="aspect-[4/3] rounded-lg bg-gradient-primary/10 border-2 border-primary/20 flex flex-col items-center justify-center mb-1.5">
                    <Loader2 className="h-5 w-5 text-primary animate-spin mb-1" />
                    <p className="text-[10px] font-semibold text-primary">İşleniyor</p>
                  </div>
                  <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full w-3/4 bg-primary rounded-full" />
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center pt-6">
                <ArrowRightIcon className="h-5 w-5 text-primary" />
              </div>

              {/* Step 5: Results */}
              <div className="flex-shrink-0 w-48">
                <div className="glass-subtle rounded-lg p-3 border border-white/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-xs">5</span>
                    </div>
                    <h3 className="text-xs font-bold text-gray-900">Sonuç</h3>
                  </div>
                  <div className="aspect-[4/3] rounded-lg bg-gray-100 border border-gray-200 mb-1.5 relative group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                      <div className="flex gap-1.5">
                        <button className="w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center hover:bg-white">
                          <Eye className="h-3.5 w-3.5 text-gray-900" />
                        </button>
                        <button className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90">
                          <GitBranch className="h-3.5 w-3.5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-500 text-center">Pipeline</p>
                </div>
              </div>
            </div>
          </div>

          {/* Kaynak Görsel ile Devam Et - Detaylı Akış + Akıllı Asistan */}
          <div className="mt-12">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-2">
                <GitBranch className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Kaynak Görsel</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1.5">
                Kaynak Görsel ile Devam Et
              </h3>
              <p className="text-sm text-gray-600 max-w-2xl mx-auto">
                Üretilen görselinizi referans olarak yaparak üretim mi yapmak istiyorsunuz?
              </p>
            </div>

            <div className="glass rounded-xl p-5 border border-white/20 shadow-card max-w-5xl mx-auto space-y-5">
              <div className="flex items-start justify-center gap-6 flex-wrap md:flex-nowrap">
                {/* Source Selection */}
                <div className="flex-shrink-0">
                  <div className="glass-subtle rounded-lg p-3 border-2 border-primary/30 w-32">
                    <div className="flex items-center gap-1.5 mb-2">
                      <GitBranch className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-bold text-gray-900">Kaynak Seç</span>
                    </div>
                    <div className="w-24 h-24 rounded-lg bg-gray-100 border-2 border-dashed border-blue-300 flex items-center justify-center mb-1">
                      <ImageIcon className="h-8 w-8 text-blue-400" />
                    </div>
                    <p className="text-[9px] text-gray-600 text-center">Pipeline&apos;dan</p>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center pt-8">
                  <ArrowRightIcon className="h-5 w-5 text-primary" />
                </div>

                {/* Two Paths */}
                <div className="flex-1 grid md:grid-cols-2 gap-3 min-w-0">
                  {/* Path 1: Direct */}
                  <div className="glass-subtle rounded-lg p-3 border border-white/20">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 text-[9px] font-bold">1</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-900">Doğrudan</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-700">
                        <RotateCw className="h-3 w-3 text-primary flex-shrink-0" />
                        <span>Açı seç</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-700">
                        <Play className="h-3 w-3 text-primary flex-shrink-0" />
                        <span>İşle</span>
                      </div>
                    </div>
                  </div>

                  {/* Path 2: Assistant */}
                  <div className="glass-subtle rounded-lg p-3 border border-white/20">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-5 h-5 rounded bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-purple-600 text-[9px] font-bold">2</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-900">Asistan</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-700">
                        <Wand2 className="h-3 w-3 text-primary flex-shrink-0" />
                        <span>Analiz et</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-700">
                        <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
                        <span>Prompt üret</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-700">
                        <Play className="h-3 w-3 text-primary flex-shrink-0" />
                        <span>İşle</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center pt-8">
                  <ArrowRightIcon className="h-5 w-5 text-primary" />
                </div>

                {/* Pipeline Result */}
                <div className="flex-shrink-0">
                  <div className="glass-subtle rounded-lg p-3 border border-white/20 w-32">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-bold text-gray-900">Pipeline</span>
                    </div>
                    <div className="w-24 h-24 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <Layers className="h-8 w-8 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Akıllı Asistanın Amacı - Kaynak Görsel Akışı ile birlikte */}
              <div className="glass rounded-xl p-4 border border-white/20 shadow-card max-w-3xl mx-auto">
                <div className="flex items-start gap-3 mb-3">
                  <Wand2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Akıllı Asistanın Amacı</h3>
                    <p className="text-xs text-gray-600 mb-2">
                      Kaynak görsel seçildiğinde, asistan otomatik olarak devreye girer ve görsellerinizi analiz eder.
                    </p>
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-5 h-5 rounded bg-primary text-white flex items-center justify-center text-[9px] font-bold">1</div>
                      <h4 className="text-[10px] font-semibold text-gray-900">Açı Kontrolü</h4>
                    </div>
                    <p className="text-[9px] text-gray-600">
                      Hedef açıya gerçekten ulaşılıp ulaşılmadığını kontrol eder ve düzeltme önerir.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-5 h-5 rounded bg-primary text-white flex items-center justify-center text-[9px] font-bold">2</div>
                      <h4 className="text-[10px] font-semibold text-gray-900">Kalite Analizi</h4>
                    </div>
                    <p className="text-[9px] text-gray-600">
                      Poz, ifade, ışık, gölge ve arka plan gibi detayları analiz eder.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-5 h-5 rounded bg-primary text-white flex items-center justify-center text-[9px] font-bold">3</div>
                      <h4 className="text-[10px] font-semibold text-gray-900">Prompt Üretimi</h4>
                    </div>
                    <p className="text-[9px] text-gray-600">
                      Somut düzeltme önerileri, kullanıcı notları ile birleştirilerek optimize edilmiş prompt oluşturur.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Models + Source Image + Modular */}
      <section className="py-16 px-4 bg-gradient-subtle">
        <div className="max-w-6xl mx-auto w-full">
          {/* AI Models - Compact */}
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              AI Modelleri
            </h2>
            <p className="text-sm text-gray-600 max-w-xl mx-auto">
              Her modelin kendine özgü güçlü yönleri var
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {/* Seedream */}
            <div className="glass rounded-xl p-4 border border-white/20 shadow-card hover:shadow-card-hover transition-smooth">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Seedream</h3>
                  <p className="text-[10px] text-gray-500">Yüksek Çözünürlük</p>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Açı</span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold text-[10px]">Orta</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Tutarlılık</span>
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold text-[10px]">Düşük</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Maliyet</span>
                  <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold text-[10px]">Düşük</span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-[10px] text-gray-500">
                  $0.03 - ₺1.28
                </p>
              </div>
            </div>

            {/* Nano Banana */}
            <div className="glass rounded-xl p-4 border-2 border-primary/30 shadow-card hover:shadow-card-hover transition-smooth relative">
              <div className="absolute top-2 right-2">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">
                  Önerilen
                </span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Nano Banana</h3>
                  <p className="text-[10px] text-gray-500">En İyi Performans</p>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Açı</span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold text-[10px]">Orta</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Tutarlılık</span>
                  <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold text-[10px]">Yüksek</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Maliyet</span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold text-[10px]">Orta</span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-[10px] text-gray-500">
                  $0.04 - ₺1.70
                </p>
              </div>
            </div>

            {/* Flux 2 */}
            <div className="glass rounded-xl p-4 border border-white/20 shadow-card hover:shadow-card-hover transition-smooth">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Target className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Flux 2</h3>
                  <p className="text-[10px] text-gray-500">Hassas Açı</p>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Açı</span>
                  <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold text-[10px]">Yüksek</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Tutarlılık</span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold text-[10px]">Orta</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Maliyet</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold text-[10px]">Değişken</span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-[10px] text-gray-500">
                  MP × $0.021
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* CTA Section - Compact */}
      <section className="py-6 px-4 bg-gradient-primary text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-2">
            Hemen Başlayın
          </h2>
          <p className="text-sm text-white/90 mb-4 max-w-xl mx-auto">
            Görsellerinizi AI ile dönüştürmeye başlamak için sadece birkaç saniye sürer.
          </p>
          <Button
            size="default"
            onClick={onGetStarted}
            className="bg-white text-primary hover:bg-white/90 text-sm px-5 py-3 shadow-card-hover mb-3"
          >
            Hemen Başla
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-white/70">
            Bu bir TRYPIX projesidir.
          </p>
        </div>
      </section>
    </div>
  );
}

