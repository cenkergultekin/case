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
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Seçili Açılar: <span className="text-primary font-semibold">
            {selectedAngles.length > 0 
              ? selectedAngles.map(a => getAngleLabel(a)).join(', ')
              : 'Hiçbiri'
            }
          </span>
        </label>
      </div>
      
      {/* Angle Buttons */}
      <div className="flex flex-wrap gap-2">
        {VALID_ANGLES.map((angle) => {
          const isSelected = selectedAngles.includes(angle);
          
          return (
            <button
              key={angle}
              type="button"
              onClick={() => toggleAngle(angle)}
              className={`
                px-4 py-2.5 rounded-lg text-sm font-medium transition-smooth min-w-[70px]
                ${isSelected
                  ? 'bg-primary text-white shadow-card hover:shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
                }
              `}
            >
              {getAngleLabel(angle)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
