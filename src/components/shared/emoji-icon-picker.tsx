"use client";

import { cn } from "@/lib/utils";

interface EmojiIconPickerProps {
  icons: readonly string[];
  value: string;
  onChange: (icon: string) => void;
  label: string;
}

export function EmojiIconPicker({ icons, value, onChange, label }: EmojiIconPickerProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {icons.map((icon) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={value === icon}
          onClick={() => onChange(icon)}
          className={cn(
            "flex size-10 items-center justify-center rounded-full border text-lg transition-colors hover:bg-accent",
            value === icon ? "border-primary bg-accent" : "border-border"
          )}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
