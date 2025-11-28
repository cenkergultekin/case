'use client';

import React, { useState, useEffect } from 'react';

interface AnglePickerProps {
  value?: number | number[];
  onAngleChange?: (angles: number[]) => void;
  className?: string;
}

const VALID_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function AnglePicker({ 
  value = 0, 
  onAngleChange,
  className = ''
}: AnglePickerProps) {
  const [selectedAngles, setSelectedAngles] = useState<number[]>(
    Array.isArray(value) ? value : [value]
  );

  useEffect(() => {
    if (Array.isArray(value)) {
      setSelectedAngles(value);
    } else {
      setSelectedAngles([value]);
    }
  }, [value]);

  const toggleAngle = (angle: number) => {
    setSelectedAngles(prev => {
      const newAngles = prev.includes(angle)
        ? prev.filter(a => a !== angle)
        : [...prev, angle].sort((a, b) => a - b);
      // Callback'i setTimeout ile async hale getir (render sırasında çağrılmasını önle)
      setTimeout(() => {
        onAngleChange?.(newAngles);
      }, 0);
      return newAngles;
    });
  };

  const getAngleLabel = (angleValue: number): string => {
    const labels: Record<number, string> = {
      0: 'Ön',
      45: '45°',
      90: '90°',
      135: '135°',
      180: 'Arka',
      225: '225°',
      270: '270°',
      315: '315°'
    };
    return labels[angleValue] || `${angleValue}°`;
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Angle Buttons */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {VALID_ANGLES.map((angle) => {
          const isSelected = selectedAngles.includes(angle);
          
          return (
            <button
              key={angle}
              type="button"
              onClick={() => toggleAngle(angle)}
              className={`
                w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                flex items-center justify-center relative overflow-hidden
                ${isSelected
                  ? 'bg-gradient-primary text-white shadow-card hover:shadow-card-hover border border-primary/30'
                  : 'bg-white/60 backdrop-blur-sm text-gray-700 hover:bg-white border border-gray-200 hover:border-primary/30 hover:shadow-minimal'
                }
              `}
            >
              {isSelected && (
                <div className="absolute inset-0 bg-white/10"></div>
              )}
              <span className="relative z-10">{getAngleLabel(angle)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
