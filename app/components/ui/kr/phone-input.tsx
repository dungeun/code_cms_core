/**
 * 한국형 전화번호 입력 컴포넌트
 * 한국 전화번호 형식을 지원하는 입력 필드
 */

import * as React from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { cn } from '~/lib/utils';

export interface KrPhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
}

export function KrPhoneInput({
  value = '',
  onChange,
  label,
  error,
  required = false,
  className,
  disabled,
  ...props
}: KrPhoneInputProps) {
  const [phone, setPhone] = React.useState(value);
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    setPhone(value);
  }, [value]);

  const formatPhoneNumber = (input: string) => {
    // 숫자만 추출
    const numbers = input.replace(/[^0-9]/g, '');
    
    // 최대 11자리로 제한
    const limited = numbers.slice(0, 11);
    
    // 형식 적용
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    } else if (limited.length <= 10) {
      return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
    onChange?.(formatted);
  };

  const validatePhone = (phoneNumber: string) => {
    // 한국 전화번호 패턴 검증
    const mobilePattern = /^01[0-9]-[0-9]{3,4}-[0-9]{4}$/;
    const landlinePattern = /^0[2-6][0-9]?-[0-9]{3,4}-[0-9]{4}$/;
    const specialPattern = /^(15|16|18)[0-9]{2}-[0-9]{4}$/;
    
    return mobilePattern.test(phoneNumber) || 
           landlinePattern.test(phoneNumber) ||
           specialPattern.test(phoneNumber);
  };

  const isValid = phone ? validatePhone(phone) : true;

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor="phone-input">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <Input
          id="phone-input"
          type="tel"
          value={phone}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="010-1234-5678"
          className={cn(
            'pl-3',
            !isValid && phone && !focused && 'border-destructive',
            error && 'border-destructive',
            className
          )}
          disabled={disabled}
          {...props}
        />
      </div>
      {!isValid && phone && !focused && (
        <p className="text-sm text-destructive">
          올바른 전화번호 형식이 아닙니다.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

/**
 * 한국형 휴대폰 번호 입력 컴포넌트 (분할 입력)
 */
export interface KrMobileInputProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function KrMobileInput({
  value = '',
  onChange,
  label,
  error,
  required = false,
  className,
  disabled,
}: KrMobileInputProps) {
  const [part1, setPart1] = React.useState('');
  const [part2, setPart2] = React.useState('');
  const [part3, setPart3] = React.useState('');

  const part2Ref = React.useRef<HTMLInputElement>(null);
  const part3Ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (value) {
      const parts = value.split('-');
      setPart1(parts[0] || '');
      setPart2(parts[1] || '');
      setPart3(parts[2] || '');
    }
  }, [value]);

  const handlePartChange = (part: 'part1' | 'part2' | 'part3', val: string) => {
    const numericVal = val.replace(/[^0-9]/g, '');
    
    if (part === 'part1') {
      const limited = numericVal.slice(0, 3);
      setPart1(limited);
      if (limited.length === 3) {
        part2Ref.current?.focus();
      }
      updateFullValue(limited, part2, part3);
    } else if (part === 'part2') {
      const limited = numericVal.slice(0, 4);
      setPart2(limited);
      if (limited.length === 4) {
        part3Ref.current?.focus();
      }
      updateFullValue(part1, limited, part3);
    } else {
      const limited = numericVal.slice(0, 4);
      setPart3(limited);
      updateFullValue(part1, part2, limited);
    }
  };

  const updateFullValue = (p1: string, p2: string, p3: string) => {
    const parts = [p1, p2, p3].filter(Boolean);
    onChange?.(parts.join('-'));
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className={cn('flex items-center gap-2', className)}>
        <Input
          type="tel"
          value={part1}
          onChange={(e) => handlePartChange('part1', e.target.value)}
          placeholder="010"
          className="w-20"
          maxLength={3}
          disabled={disabled}
        />
        <span className="text-muted-foreground">-</span>
        <Input
          ref={part2Ref}
          type="tel"
          value={part2}
          onChange={(e) => handlePartChange('part2', e.target.value)}
          placeholder="1234"
          className="w-24"
          maxLength={4}
          disabled={disabled}
        />
        <span className="text-muted-foreground">-</span>
        <Input
          ref={part3Ref}
          type="tel"
          value={part3}
          onChange={(e) => handlePartChange('part3', e.target.value)}
          placeholder="5678"
          className="w-24"
          maxLength={4}
          disabled={disabled}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}