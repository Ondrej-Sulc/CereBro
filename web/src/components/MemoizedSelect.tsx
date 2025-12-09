'use client';

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Option {
  value: string;
  label: string;
}

interface MemoizedSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: Option[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}

export const MemoizedSelect = React.memo(function MemoizedSelect({
  value,
  onValueChange,
  placeholder,
  options,
  required,
  disabled,
  className,
  contentClassName,
}: MemoizedSelectProps) {
  return (
    <Select onValueChange={onValueChange} value={value} required={required} disabled={disabled}>
      <SelectTrigger className={cn("min-h-[2.25rem]", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.required === nextProps.required &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.className === nextProps.className &&
    prevProps.contentClassName === nextProps.contentClassName &&
    JSON.stringify(prevProps.options) === JSON.stringify(nextProps.options)
  );
});
