'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
  label?: string;
  snapPoints?: number[]; // Checkpoint açıları (örn: [0, 45, 90, 135, 180, 225, 270, 315])
  snapThreshold?: number; // Snap için eşik değeri (varsayılan: 5 derece)
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ 
    className, 
    value, 
    onValueChange, 
    min = 0, 
    max = 360, 
    step = 5,
    showValue = true,
    label,
    snapPoints = [],
    snapThreshold = 5,
    ...props 
  }, ref) => {
    const snapToNearest = (val: number): number => {
      if (snapPoints.length === 0) return val;
      
      // En yakın checkpoint'i bul
      const nearest = snapPoints.reduce((prev, curr) => {
        const prevDiff = Math.abs(prev - val);
        const currDiff = Math.abs(curr - val);
        return currDiff < prevDiff ? curr : prev;
      });
      
      // Eşik değeri içindeyse snap et
      if (Math.abs(nearest - val) <= snapThreshold) {
        return nearest;
      }
      
      return val;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = Number(e.target.value);
      
      // Snap özelliği varsa uygula
      if (snapPoints.length > 0) {
        newValue = snapToNearest(newValue);
      }
      
      onValueChange?.(newValue);
    };

    const progress = ((value || 0) - min) / (max - min) * 100;
    const isSnapped = snapPoints.length > 0 && value !== undefined && 
      snapPoints.some(point => Math.abs(value - point) <= snapThreshold);

    return (
      <div className="w-full">
        {label && (
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            {showValue && (
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-lg font-semibold transition-smooth",
                  isSnapped ? "text-primary" : "text-gray-900"
                )}>
                  {value}°
                </span>
                {isSnapped && (
                  <span className="text-xs text-primary font-medium">✓</span>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Slider Track with Checkpoints */}
        <div className="relative mb-4">
          {/* Checkpoint markers on track */}
          {snapPoints.length > 0 && (
            <div className="absolute inset-0 flex items-center">
              <div className="relative w-full h-1 bg-gray-200 rounded-full">
                {snapPoints.map((point) => {
                  const position = ((point - min) / (max - min)) * 100;
                  const isActive = value !== undefined && Math.abs(value - point) <= snapThreshold;
                  return (
                    <div
                      key={point}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 top-1/2 transition-all duration-200"
                      style={{ left: `${position}%` }}
                    >
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full border-2 transition-smooth",
                          isActive 
                            ? "bg-primary border-primary scale-125 shadow-card" 
                            : "bg-white border-gray-300 hover:border-gray-400"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Slider Input */}
          <input
            type="range"
            ref={ref}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            className={cn(
              "relative w-full h-3 bg-transparent appearance-none cursor-pointer z-10",
              "focus:outline-none",
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6",
              "[&::-webkit-slider-thumb]:rounded-full",
              "[&::-webkit-slider-thumb]:bg-white",
              "[&::-webkit-slider-thumb]:border-[3px]",
              "[&::-webkit-slider-thumb]:border-primary",
              "[&::-webkit-slider-thumb]:shadow-card",
              "[&::-webkit-slider-thumb]:cursor-pointer",
              "[&::-webkit-slider-thumb]:transition-all",
              "[&::-webkit-slider-thumb]:duration-200",
              "[&::-webkit-slider-thumb]:hover:scale-125",
              "[&::-webkit-slider-thumb]:hover:shadow-lg",
              "[&::-webkit-slider-thumb]:active:scale-110",
              "[&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6",
              "[&::-moz-range-thumb]:rounded-full",
              "[&::-moz-range-thumb]:bg-white",
              "[&::-moz-range-thumb]:border-[3px]",
              "[&::-moz-range-thumb]:border-primary",
              "[&::-moz-range-thumb]:shadow-card",
              "[&::-moz-range-thumb]:cursor-pointer",
              "[&::-moz-range-thumb]:transition-all",
              "[&::-moz-range-thumb]:duration-200",
              "[&::-moz-range-thumb]:hover:scale-125",
              "[&::-moz-range-thumb]:active:scale-110",
              className
            )}
            style={{
              background: snapPoints.length === 0 
                ? `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${progress}%, #e5e7eb ${progress}%, #e5e7eb 100%)`
                : 'transparent'
            }}
            {...props}
          />
          
          {/* Progress bar overlay */}
          {snapPoints.length > 0 && (
            <div 
              className="absolute top-1/2 left-0 h-1 bg-primary rounded-full transition-smooth -translate-y-1/2 z-0"
              style={{ width: `${progress}%` }}
            />
          )}
        </div>
        
        {!label && showValue && (
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>{min}°</span>
            <span className="font-semibold text-gray-600">{value}°</span>
            <span>{max}°</span>
          </div>
        )}
      </div>
    );
  }
);

Slider.displayName = 'Slider';

export { Slider };

