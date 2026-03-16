import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  showValue?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onRatingChange,
  size = 'md',
  interactive = false,
  showValue = false,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  };

  const displayRating = hoverRating ?? rating;

  const handleClick = (starIndex: number, isHalf: boolean) => {
    if (!interactive || !onRatingChange) return;
    const newRating = isHalf ? starIndex + 0.5 : starIndex + 1;
    onRatingChange(newRating);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, starIndex: number) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    setHoverRating(isHalf ? starIndex + 0.5 : starIndex + 1);
  };

  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex items-center">
        {[0, 1, 2, 3, 4].map((starIndex) => {
          const fillPercentage = Math.min(1, Math.max(0, displayRating - starIndex)) * 100;

          return (
            <div
              key={starIndex}
              className={cn(
                'relative',
                interactive && 'cursor-pointer'
              )}
              onMouseMove={(e) => handleMouseMove(e, starIndex)}
              onMouseLeave={() => interactive && setHoverRating(null)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                handleClick(starIndex, x < rect.width / 2);
              }}
            >
              {/* Background star (empty) */}
              <Star
                className={cn(sizeClasses[size], 'text-muted-foreground/30')}
                strokeWidth={1.5}
              />
              {/* Filled star with clip */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fillPercentage}%` }}
              >
                <Star
                  className={cn(sizeClasses[size], 'text-yellow-500 fill-yellow-500')}
                  strokeWidth={1.5}
                />
              </div>
            </div>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-semibold text-foreground ms-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default StarRating;
