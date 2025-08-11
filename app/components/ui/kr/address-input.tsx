/**
 * 한국형 주소 입력 컴포넌트
 * 카카오 우편번호 검색 API를 통한 주소 입력
 */

import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { cn } from '~/lib/utils';

export interface KrAddress {
  postalCode: string;
  roadAddress: string;
  jibunAddress: string;
  detailAddress: string;
  extraAddress?: string;
  buildingName?: string;
  sido?: string;
  sigungu?: string;
  dong?: string;
}

export interface KrAddressInputProps {
  value?: KrAddress;
  onChange?: (address: KrAddress) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function KrAddressInput({
  value,
  onChange,
  label = '주소',
  required = false,
  disabled = false,
  className,
}: KrAddressInputProps) {
  const [address, setAddress] = React.useState<KrAddress>(
    value || {
      postalCode: '',
      roadAddress: '',
      jibunAddress: '',
      detailAddress: '',
    }
  );
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (value) {
      setAddress(value);
    }
  }, [value]);

  const handleAddressSearch = () => {
    if (disabled) return;
    
    // Daum 우편번호 서비스 호출
    if (typeof window !== 'undefined' && (window as any).daum?.Postcode) {
      new (window as any).daum.Postcode({
        oncomplete: function(data: any) {
          const newAddress: KrAddress = {
            postalCode: data.zonecode,
            roadAddress: data.roadAddress,
            jibunAddress: data.jibunAddress,
            detailAddress: '',
            extraAddress: data.extraAddress,
            buildingName: data.buildingName,
            sido: data.sido,
            sigungu: data.sigungu,
            dong: data.bname,
          };
          
          setAddress(newAddress);
          onChange?.(newAddress);
          setIsOpen(false);
        },
        width: '100%',
        height: '100%',
      }).embed(document.getElementById('daum-postcode-container'));
      
      setIsOpen(true);
    } else {
      console.warn('Daum Postcode 스크립트가 로드되지 않았습니다.');
    }
  };

  const handleDetailAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = { ...address, detailAddress: e.target.value };
    setAddress(newAddress);
    onChange?.(newAddress);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      <div className="flex gap-2">
        <Input
          value={address.postalCode}
          placeholder="우편번호"
          readOnly
          disabled={disabled}
          className="w-32"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAddressSearch}
          disabled={disabled}
        >
          <Search className="h-4 w-4 mr-2" />
          주소 검색
        </Button>
      </div>
      
      {address.roadAddress && (
        <>
          <Input
            value={address.roadAddress}
            placeholder="도로명 주소"
            readOnly
            disabled={disabled}
          />
          
          <Input
            value={address.jibunAddress}
            placeholder="지번 주소"
            readOnly
            disabled={disabled}
            className="text-muted-foreground"
          />
          
          <Input
            value={address.detailAddress}
            onChange={handleDetailAddressChange}
            placeholder="상세 주소를 입력하세요"
            disabled={disabled}
          />
        </>
      )}
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg h-[600px] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>주소 검색</DialogTitle>
            <DialogDescription>
              찾으시는 주소를 검색해주세요.
            </DialogDescription>
          </DialogHeader>
          <div id="daum-postcode-container" className="w-full h-full" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * 간단한 주소 표시 컴포넌트
 */
export interface KrAddressDisplayProps {
  address: KrAddress;
  showPostalCode?: boolean;
  showJibun?: boolean;
  className?: string;
}

export function KrAddressDisplay({
  address,
  showPostalCode = true,
  showJibun = false,
  className,
}: KrAddressDisplayProps) {
  if (!address.roadAddress && !address.jibunAddress) {
    return null;
  }

  return (
    <div className={cn('space-y-1', className)}>
      {showPostalCode && address.postalCode && (
        <p className="text-sm text-muted-foreground">({address.postalCode})</p>
      )}
      <p className="text-sm">
        {address.roadAddress} {address.detailAddress}
      </p>
      {showJibun && address.jibunAddress && (
        <p className="text-sm text-muted-foreground">
          (지번) {address.jibunAddress} {address.detailAddress}
        </p>
      )}
    </div>
  );
}

/**
 * 주소 유효성 검증
 */
export function validateKrAddress(address: KrAddress): boolean {
  return !!(address.postalCode && address.roadAddress && address.detailAddress);
}

/**
 * 주소를 문자열로 변환
 */
export function formatKrAddress(address: KrAddress, type: 'full' | 'short' = 'full'): string {
  if (type === 'short') {
    return `${address.roadAddress} ${address.detailAddress}`.trim();
  }
  
  return `(${address.postalCode}) ${address.roadAddress} ${address.detailAddress}`.trim();
}