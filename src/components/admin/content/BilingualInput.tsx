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
  readOnlyAr?: boolean;
  readOnlyEn?: boolean;
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
  readOnlyAr = false,
  readOnlyEn = false,
}) => {
  return (
    <div className={cn('space-y-4', className)} dir="ltr">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 order-1 sm:order-2">
          <Label className="text-sm font-medium" dir="rtl">
            {labelAr}
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

        <div className="space-y-2 order-2 sm:order-1">
          <Label className="text-sm font-medium" dir="ltr">
            {labelEn}
          </Label>
          {isTextarea ? (
            <Textarea
              value={valueEn}
              onChange={(e) => onChangeEn(e.target.value)}
              placeholder={placeholderEn}
              dir="ltr"
              rows={rows}
              readOnly={readOnlyEn}
            />
          ) : (
            <Input
              value={valueEn}
              onChange={(e) => onChangeEn(e.target.value)}
              placeholder={placeholderEn}
              dir="ltr"
              readOnly={readOnlyEn}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default BilingualInput;
