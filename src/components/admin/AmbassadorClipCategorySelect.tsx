import React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AMBASSADOR_CLIP_SELECT_GROUPS,
  type AmbassadorClipCategory,
  isAmbassadorClipCategory,
} from "@/lib/championAmbassadorClipCategories";

const SENTINEL = "__none__";

type Props = {
  value: AmbassadorClipCategory | null;
  onChange: (v: AmbassadorClipCategory | null) => void;
  isRTL: boolean;
  /** When true, first option is a non-value placeholder (maps to null). */
  allowUnset: boolean;
  id?: string;
};

const AmbassadorClipCategorySelect: React.FC<Props> = ({
  value,
  onChange,
  isRTL,
  allowUnset,
  id,
}) => {
  const selectValue =
    value && isAmbassadorClipCategory(value) ? value : SENTINEL;

  const unsetLabel = isRTL ? "اختر نوع المقطع…" : "Select clip type…";
  const dir = isRTL ? "rtl" : "ltr";

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => {
        if (v === SENTINEL) onChange(null);
        else onChange(v as AmbassadorClipCategory);
      }}
    >
      <SelectTrigger id={id} className="w-full" dir={dir}>
        <SelectValue placeholder={unsetLabel} />
      </SelectTrigger>
      <SelectContent className="max-h-[min(70vh,420px)]" dir={dir}>
        {allowUnset && (
          <SelectItem value={SENTINEL} className="text-muted-foreground">
            {unsetLabel}
          </SelectItem>
        )}
        {AMBASSADOR_CLIP_SELECT_GROUPS.map((g) => (
          <SelectGroup key={g.heading.en}>
            <SelectLabel className="text-[10px] font-semibold text-foreground">
              {isRTL ? g.heading.ar : g.heading.en}
            </SelectLabel>
            {g.options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-sm">
                {isRTL ? o.line.ar : o.line.en}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};

export default AmbassadorClipCategorySelect;
