import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface BilingualInputProps {
  labelEn: string;
  labelAr: string;
  valueEn: string;
  valueAr: string;
  onChangeEn: (value: string) => void;
  onChangeAr: (value: string) => void;
  isTextarea?: boolean;
  placeholderEn?: string;
  placeholderAr?: string;
  className?: string;
  rows?: number;
}

const BilingualInput: React.FC<BilingualInputProps> = ({
  labelEn,
  labelAr,
  valueEn,
  valueAr,
  onChangeEn,
  onChangeAr,
  isTextarea = false,
  placeholderEn,
  placeholderAr,
  className,
  rows = 3,
}) => {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {labelEn} <span className="text-muted-foreground">(English)</span>
        </Label>
        {isTextarea ? (
          <Textarea
            value={valueEn}
            onChange={(e) => onChangeEn(e.target.value)}
            placeholder={placeholderEn}
            dir="ltr"
            rows={rows}
          />
        ) : (
          <Input
            value={valueEn}
            onChange={(e) => onChangeEn(e.target.value)}
            placeholder={placeholderEn}
            dir="ltr"
          />
        )}
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {labelAr} <span className="text-muted-foreground">(العربية)</span>
        </Label>
        {isTextarea ? (
          <Textarea
            value={valueAr}
            onChange={(e) => onChangeAr(e.target.value)}
            placeholder={placeholderAr}
            dir="rtl"
            rows={rows}
          />
        ) : (
          <Input
            value={valueAr}
            onChange={(e) => onChangeAr(e.target.value)}
            placeholder={placeholderAr}
            dir="rtl"
          />
        )}
      </div>
    </div>
  );
};

export default BilingualInput;
