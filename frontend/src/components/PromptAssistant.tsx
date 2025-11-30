'use client';

import React from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { imageAPI, getImageUrl, normalizeImageUrl } from '@/lib/api';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';

interface ProcessedVersion {
  id: string;
  operation: string;
  aiModel: string;
  parameters: Record<string, any>;
  filename: string;
  url: string;
  createdAt: string;
  sourceImageId?: string;
  sourceProcessedVersionId?: string;
}

interface PromptAssistantProps {
  imageId: string;
  originalImageUrl: string;
  selectedVersion: ProcessedVersion;
  allProcessedVersions?: ProcessedVersion[]; // For nested source support
  prompt: string;
  onPromptChange: (value: string) => void;
  angles: number[];
  disabled?: boolean;
}

type AssistantStatus = 'idle' | 'loading' | 'typing' | 'error';

export function PromptAssistant({
  imageId,
  originalImageUrl,
  selectedVersion,
  allProcessedVersions = [],
  prompt,
  onPromptChange,
  angles,
  disabled
}: PromptAssistantProps) {
  const [assistantStatus, setAssistantStatus] = React.useState<AssistantStatus>('idle');
  const [userIdea, setUserIdea] = React.useState<string>('');
  const [assistantOutput, setAssistantOutput] = React.useState<string>(prompt);
  const [error, setError] = React.useState<string | null>(null);
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const referenceImageUrl = React.useMemo(() => {
    if (!selectedVersion) return '';
    return normalizeImageUrl(selectedVersion.url, selectedVersion.filename);
  }, [selectedVersion]);

  // For nested source support: if selected version has its own source, use that as "original"
  const actualOriginalImageUrl = React.useMemo(() => {
    // If selected version has a sourceProcessedVersionId, find that version
    if (selectedVersion.sourceProcessedVersionId && allProcessedVersions.length > 0) {
      const sourceVersion = allProcessedVersions.find(v => v.id === selectedVersion.sourceProcessedVersionId);
      if (sourceVersion) {
        return normalizeImageUrl(sourceVersion.url, sourceVersion.filename);
      }
    }
    // Otherwise, use the original image
    return originalImageUrl;
  }, [selectedVersion, allProcessedVersions, originalImageUrl]);

  const currentAngleLabel = React.useMemo(() => {
    const angleFromParams = selectedVersion?.parameters?.angle;
    if (typeof angleFromParams === 'number') {
      return `${angleFromParams}°`;
    }
    return null;
  }, [selectedVersion]);

  const clearTypingInterval = React.useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  const animatePrompt = React.useCallback(
    (text: string) => {
      clearTypingInterval();
      if (!text) {
        setAssistantOutput('');
        onPromptChange('');
        setAssistantStatus('idle');
        return;
      }

      setAssistantStatus('typing');
      let index = 0;

      const step = () => {
        index += 1;
        const nextValue = text.slice(0, index);
        setAssistantOutput(nextValue);
        onPromptChange(nextValue);

        if (index < text.length) {
          typingTimeoutRef.current = setTimeout(step, 18 + Math.random() * 24);
        } else {
          typingTimeoutRef.current = null;
          setAssistantStatus('idle');
        }
      };

      step();
    },
    [clearTypingInterval, onPromptChange]
  );

  const handleGeneratePrompt = async () => {
    if (!selectedVersion || disabled) {
      return;
    }

    clearTypingInterval();
    setError(null);
    setAssistantStatus('loading');

    try {
      const requestPayload: {
        sourceProcessedVersionId: string;
        angles?: number[];
        userNotes?: string;
      } = {
        sourceProcessedVersionId: selectedVersion.id
      };
      
      if (angles && angles.length > 0) {
        requestPayload.angles = angles;
      }
      
      if (userIdea.trim()) {
        requestPayload.userNotes = userIdea.trim();
      }
      
      const response = await imageAPI.generateSmartPrompt(imageId, requestPayload);

      const assistantText: string =
        response?.data?.prompt ||
        response?.prompt ||
        '';

      animatePrompt(assistantText);
    } catch (err) {
      console.error('Prompt assistant failed:', err);
      setError(err instanceof Error ? err.message : 'Akıllı asistan şu anda yanıt veremiyor.');
      setAssistantStatus('error');
    }
  };

  React.useEffect(() => {
    return () => {
      clearTypingInterval();
    };
  }, [clearTypingInterval]);

  React.useEffect(() => {
    setAssistantOutput(prompt || '');
  }, [prompt, selectedVersion?.id]);

  React.useEffect(() => {
    setUserIdea('');
    setError(null);
    clearTypingInterval();
    setAssistantStatus('idle');
  }, [selectedVersion?.id, clearTypingInterval]);

  return (
    <div className="space-y-4 p-4 rounded-2xl border border-dashed border-primary/30 bg-white/60 shadow-inner">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <h5 className="text-sm font-semibold text-gray-900">Akıllı Prompt Asistanı</h5>
            <p className="text-xs text-gray-500">
              Seçtiğiniz işlenmiş görsele göre ek talimat önerir.
            </p>
          </div>
        </div>
        {assistantStatus === 'loading' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-2 border-amber-300 rounded-lg shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">OpenRouter&apos;a istek gönderiliyor...</span>
          </div>
        )}
        {assistantStatus === 'typing' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border-2 border-blue-300 rounded-lg shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Metin yazdırılıyor...</span>
          </div>
        )}
        {assistantStatus === 'error' && (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full border border-red-300 bg-red-50 text-red-600">
            Tekrar deneyin
          </span>
        )}
        {assistantStatus === 'idle' && (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
            Hazır
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[{ label: 'Orijinal', url: actualOriginalImageUrl }, { label: 'Kaynak', url: referenceImageUrl }].map(
          ({ label, url }) => (
            <div key={label} className="space-y-2">
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                {label}
              </div>
              <div className="aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                {url ? (
                  <img
                    src={url}
                    alt={`${label} görseli`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    Görsel bulunamadı
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-700 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          İstediğiniz değişiklik
        </label>
        <textarea
          value={userIdea}
          onChange={(e) => setUserIdea(e.target.value)}
          placeholder="Örn: yüzü daha sinematik ışıkla aydınlat, saçlara parıltı ekle, kırmızı deri mont olsun"
          className="w-full min-h-[70px] px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/40 transition-smooth resize-none bg-white"
          disabled={disabled || assistantStatus === 'loading'}
        />
        {angles && angles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {angles.map((angle) => (
              <span
                key={angle}
                className="px-2 py-0.5 text-[11px] font-semibold bg-primary/10 text-primary rounded-lg border border-primary/20"
              >
                {angle}°
              </span>
            ))}
          </div>
        )}
        {currentAngleLabel && (
          <p className="text-[11px] text-gray-500">
            Kaynağın mevcut açısı: <span className="font-semibold">{currentAngleLabel}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleGeneratePrompt}
          className="flex-1 sm:flex-none sm:px-5"
          disabled={disabled || assistantStatus === 'loading' || assistantStatus === 'typing'}
        >
          {assistantStatus === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Asistan çalışıyor
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Asistanı Çalıştır
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-700">Ek Prompt (asistan çıktısı)</label>
        <div className="relative">
          {assistantStatus === 'typing' && (
            <div className="absolute top-2 right-2 text-[11px] text-primary/70 animate-pulse">
              Yazdırılıyor...
            </div>
          )}
          <textarea
            value={assistantOutput}
            onChange={(e) => {
              setAssistantOutput(e.target.value);
              onPromptChange(e.target.value);
            }}
            placeholder="Asistanın ürettiği metin burada görünecek. Dilerseniz düzenleyebilirsiniz."
            className={cn(
              'w-full min-h-[120px] px-3 py-3 text-sm border rounded-xl focus:ring-2 focus:ring-primary/40 transition-smooth resize-none bg-white',
              assistantStatus === 'error'
                ? 'border-red-300'
                : 'border-gray-200'
            )}
            disabled={assistantStatus === 'loading' || assistantStatus === 'typing' || disabled}
          />
        </div>
        <p className="text-[11px] text-gray-500">
          Bu metin işlem sırasında açı prompt&apos;una otomatik olarak eklenecek.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}


