/**
 * 한국형 통화 입력 컴포넌트
 * 원화 입력 및 표시를 위한 컴포넌트
 */

import * as React from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { cn } from '~/lib/utils';

export interface KrCurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number;
  onChange?: (value: number | undefined) => void;
  label?: string;
  error?: string;
  required?: boolean;
  min?: number;
  max?: number;
  showWonSymbol?: boolean;
  allowNegative?: boolean;
  decimalPlaces?: number;
}

export function KrCurrencyInput({
  value,
  onChange,
  label,
  error,
  required = false,
  min,
  max,
  showWonSymbol = true,
  allowNegative = false,
  decimalPlaces = 0,
  className,
  disabled,
  ...props
}: KrCurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState('');
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (value !== undefined && !focused) {
      setDisplayValue(formatCurrency(value, decimalPlaces));
    }
  }, [value, focused, decimalPlaces]);

  const formatCurrency = (num: number, decimals: number = 0): string => {
    if (decimals > 0) {
      return new Intl.NumberFormat('ko-KR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num);
    }
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const parseCurrency = (input: string): number | undefined => {
    // 숫자, 마이너스, 소수점만 남기기
    let cleaned = input.replace(/[^0-9.-]/g, '');
    
    // 마이너스 처리
    if (!allowNegative) {
      cleaned = cleaned.replace(/-/g, '');
    }
    
    // 소수점 처리
    if (decimalPlaces === 0) {
      cleaned = cleaned.replace(/\./g, '');
    } else {
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
      }
      if (parts[1] && parts[1].length > decimalPlaces) {
        cleaned = parts[0] + '.' + parts[1].slice(0, decimalPlaces);
      }
    }
    
    const parsed = parseFloat(cleaned);
    
    if (isNaN(parsed)) {
      return undefined;
    }
    
    // 범위 검증
    if (min !== undefined && parsed < min) return min;
    if (max !== undefined && parsed > max) return max;
    
    return parsed;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setDisplayValue(input);
    
    const parsed = parseCurrency(input);
    onChange?.(parsed);
  };

  const handleFocus = () => {
    setFocused(true);
    if (value !== undefined) {
      setDisplayValue(String(value));
    }
  };

  const handleBlur = () => {
    setFocused(false);
    if (value !== undefined) {
      setDisplayValue(formatCurrency(value, decimalPlaces));
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor="currency-input">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        {showWonSymbol && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            ₩
          </span>
        )}
        <Input
          id="currency-input"
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={showWonSymbol ? '0' : '0원'}
          className={cn(
            showWonSymbol && 'pl-8',
            error && 'border-destructive',
            className
          )}
          disabled={disabled}
          {...props}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

/**
 * 통화 표시 컴포넌트
 */
export interface KrCurrencyDisplayProps {
  value: number;
  showWonSymbol?: boolean;
  className?: string;
  size?: 'sm' | 'base' | 'lg' | 'xl';
  format?: 'short' | 'full';
}

export function KrCurrencyDisplay({
  value,
  showWonSymbol = true,
  className,
  size = 'base',
  format = 'full',
}: KrCurrencyDisplayProps) {
  const formatCurrency = () => {
    if (format === 'short') {
      if (value >= 100000000) {
        return `${(value / 100000000).toFixed(1)}억`;
      } else if (value >= 10000) {
        return `${(value / 10000).toFixed(1)}만`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}천`;
      }
    }
    
    return new Intl.NumberFormat('ko-KR').format(value);
  };

  const sizeClasses = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  return (
    <span className={cn(sizeClasses[size], className)}>
      {showWonSymbol && '₩'}
      {formatCurrency()}
      {!showWonSymbol && '원'}
    </span>
  );
}

/**
 * 한글 금액 표시 
 */
export function toKoreanCurrency(value: number): string {
  const units = ['원', '만', '억', '조'];
  const numbers = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  
  if (value === 0) return '영원';
  
  let result = '';
  let num = Math.abs(value);
  let unitIndex = 0;
  
  while (num > 0 && unitIndex < units.length) {
    const digit = num % 10000;
    if (digit > 0) {
      let digitStr = '';
      let tempDigit = digit;
      let pos = 0;
      
      while (tempDigit > 0) {
        const d = tempDigit % 10;
        if (d > 0) {
          const posUnit = ['', '십', '백', '천'][pos];
          digitStr = numbers[d] + posUnit + digitStr;
        }
        tempDigit = Math.floor(tempDigit / 10);
        pos++;
      }
      
      result = digitStr + units[unitIndex] + ' ' + result;
    }
    
    num = Math.floor(num / 10000);
    unitIndex++;
  }
  
  return (value < 0 ? '마이너스 ' : '') + result.trim();
}