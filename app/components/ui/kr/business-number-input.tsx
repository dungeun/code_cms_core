/**
 * 한국형 사업자등록번호 입력 컴포넌트
 * 10자리 사업자등록번호 입력 및 검증
 */

import * as React from 'react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Button } from '~/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '~/lib/utils';

export interface KrBusinessNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string;
  onChange?: (value: string, isValid: boolean) => void;
  label?: string;
  error?: string;
  required?: boolean;
  autoValidate?: boolean;
  onValidate?: (businessNumber: string) => Promise<boolean>;
}

export function KrBusinessNumberInput({
  value = '',
  onChange,
  label,
  error,
  required = false,
  autoValidate = true,
  onValidate,
  className,
  disabled,
  ...props
}: KrBusinessNumberInputProps) {
  const [businessNumber, setBusinessNumber] = React.useState(value);
  const [isValid, setIsValid] = React.useState<boolean | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    setBusinessNumber(value);
  }, [value]);

  const formatBusinessNumber = (input: string) => {
    // 숫자만 추출
    const numbers = input.replace(/[^0-9]/g, '');
    
    // 최대 10자리로 제한
    const limited = numbers.slice(0, 10);
    
    // 형식 적용 (xxx-xx-xxxxx)
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 5) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 5)}-${limited.slice(5)}`;
    }
  };

  const validateBusinessNumber = (businessNumber: string): boolean => {
    // 하이픈 제거
    const numbers = businessNumber.replace(/-/g, '');
    
    if (numbers.length !== 10) return false;
    
    // 사업자등록번호 체크섬 검증
    const checkSum = [1, 3, 7, 1, 3, 7, 1, 3, 5];
    let sum = 0;
    
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers[i]) * checkSum[i];
    }
    
    sum += Math.floor((parseInt(numbers[8]) * 5) / 10);
    const checkDigit = (10 - (sum % 10)) % 10;
    
    return checkDigit === parseInt(numbers[9]);
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatBusinessNumber(e.target.value);
    setBusinessNumber(formatted);
    
    const isLocalValid = validateBusinessNumber(formatted);
    
    if (formatted.replace(/-/g, '').length === 10) {
      if (autoValidate && onValidate) {
        setIsValidating(true);
        try {
          const isServerValid = await onValidate(formatted);
          setIsValid(isLocalValid && isServerValid);
          onChange?.(formatted, isLocalValid && isServerValid);
        } catch (error) {
          setIsValid(isLocalValid);
          onChange?.(formatted, isLocalValid);
        } finally {
          setIsValidating(false);
        }
      } else {
        setIsValid(isLocalValid);
        onChange?.(formatted, isLocalValid);
      }
    } else {
      setIsValid(null);
      onChange?.(formatted, false);
    }
  };

  const getValidationIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (isValid === true) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (isValid === false) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    return null;
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor="business-number-input">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <Input
          id="business-number-input"
          type="text"
          value={businessNumber}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="123-45-67890"
          className={cn(
            'pr-10',
            isValid === false && !focused && 'border-destructive',
            error && 'border-destructive',
            className
          )}
          disabled={disabled}
          {...props}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {getValidationIcon()}
        </div>
      </div>
      {isValid === false && !focused && (
        <p className="text-sm text-destructive">
          유효하지 않은 사업자등록번호입니다.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

/**
 * 법인등록번호 입력 컴포넌트 (13자리)
 */
export interface KrCorporateNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string;
  onChange?: (value: string, isValid: boolean) => void;
  label?: string;
  error?: string;
  required?: boolean;
}

export function KrCorporateNumberInput({
  value = '',
  onChange,
  label,
  error,
  required = false,
  className,
  disabled,
  ...props
}: KrCorporateNumberInputProps) {
  const [corporateNumber, setCorporateNumber] = React.useState(value);
  const [isValid, setIsValid] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setCorporateNumber(value);
  }, [value]);

  const formatCorporateNumber = (input: string) => {
    // 숫자만 추출
    const numbers = input.replace(/[^0-9]/g, '');
    
    // 최대 13자리로 제한
    const limited = numbers.slice(0, 13);
    
    // 형식 적용 (xxxxxx-xxxxxxx)
    if (limited.length <= 6) {
      return limited;
    } else {
      return `${limited.slice(0, 6)}-${limited.slice(6)}`;
    }
  };

  const validateCorporateNumber = (corporateNumber: string): boolean => {
    // 하이픈 제거
    const numbers = corporateNumber.replace(/-/g, '');
    
    if (numbers.length !== 13) return false;
    
    // 법인등록번호 체크디짓 검증
    const checkSum = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
    let sum = 0;
    
    for (let i = 0; i < 12; i++) {
      sum += parseInt(numbers[i]) * checkSum[i];
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    
    return checkDigit === parseInt(numbers[12]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCorporateNumber(e.target.value);
    setCorporateNumber(formatted);
    
    const valid = validateCorporateNumber(formatted);
    setIsValid(formatted.replace(/-/g, '').length === 13 ? valid : null);
    onChange?.(formatted, valid);
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor="corporate-number-input">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <Input
          id="corporate-number-input"
          type="text"
          value={corporateNumber}
          onChange={handleChange}
          placeholder="123456-1234567"
          className={cn(
            'pr-10',
            isValid === false && 'border-destructive',
            error && 'border-destructive',
            className
          )}
          disabled={disabled}
          {...props}
        />
        {isValid !== null && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>
      {isValid === false && (
        <p className="text-sm text-destructive">
          유효하지 않은 법인등록번호입니다.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}