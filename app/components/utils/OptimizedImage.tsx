/**
 * 최적화된 이미지 컴포넌트
 * WebP 지원, 반응형 이미지, 지연 로딩
 */

import { useState, useEffect, useRef } from 'react';
import { cn } from '~/lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean; // LCP 이미지의 경우 true
  sizes?: string; // 반응형 이미지 크기
  quality?: number; // 1-100 (기본값: 85)
  format?: 'webp' | 'jpg' | 'png' | 'auto'; // 기본값: auto
  placeholder?: 'blur' | 'empty'; // 로딩 중 표시할 것
  blurDataURL?: string; // blur placeholder용 base64
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes,
  quality = 85,
  format = 'auto',
  placeholder = 'empty',
  blurDataURL,
  className,
  onLoad,
  onError,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(priority); // priority 이미지는 즉시 로드
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer를 통한 지연 로딩
  useEffect(() => {
    if (priority || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' } // 50px 전에 미리 로드
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isVisible]);

  // 최적화된 이미지 URL 생성
  const getOptimizedImageUrl = (originalSrc: string) => {
    // 외부 URL인 경우 그대로 반환
    if (originalSrc.startsWith('http')) {
      return originalSrc;
    }

    // 내부 이미지 최적화 서비스 URL 생성
    const params = new URLSearchParams();
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    params.set('q', quality.toString());
    
    if (format !== 'auto') {
      params.set('f', format);
    }

    return `/api/images?url=${encodeURIComponent(originalSrc)}&${params.toString()}`;
  };

  // WebP 지원 확인
  const [supportsWebP, setSupportsWebP] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkWebPSupport = () => {
      const webp = new Image();
      webp.onload = webp.onerror = () => {
        setSupportsWebP(webp.height === 2);
      };
      webp.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    };
    
    checkWebPSupport();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // srcSet 생성 (반응형 이미지)
  const createSrcSet = (baseSrc: string) => {
    if (!width) return undefined;
    
    const multipliers = [1, 1.5, 2, 3];
    return multipliers
      .map(multiplier => {
        const scaledWidth = Math.round(width * multiplier);
        const params = new URLSearchParams();
        params.set('w', scaledWidth.toString());
        if (height) params.set('h', Math.round(height * multiplier).toString());
        params.set('q', quality.toString());
        if (format !== 'auto') params.set('f', format);
        
        const url = `/api/images?url=${encodeURIComponent(baseSrc)}&${params.toString()}`;
        return `${url} ${scaledWidth}w`;
      })
      .join(', ');
  };

  // 에러 발생 시 폴백 이미지
  if (hasError) {
    return (
      <div 
        className={cn(
          'bg-gray-200 flex items-center justify-center text-gray-400',
          className
        )}
        style={{ width, height }}
        {...props}
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {/* Blur placeholder */}
      {placeholder === 'blur' && blurDataURL && !isLoaded && (
        <img
          src={blurDataURL}
          alt=""
          className={cn('absolute inset-0 w-full h-full object-cover', className)}
          aria-hidden="true"
        />
      )}

      {/* 실제 이미지 */}
      <img
        ref={imgRef}
        src={isVisible ? getOptimizedImageUrl(src) : undefined}
        srcSet={isVisible ? createSrcSet(src) : undefined}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={cn(
          'transition-opacity duration-300',
          {
            'opacity-0': !isLoaded && placeholder !== 'empty',
            'opacity-100': isLoaded || placeholder === 'empty'
          },
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />

      {/* 로딩 스피너 */}
      {!isLoaded && isVisible && placeholder === 'empty' && (
        <div className={cn(
          'absolute inset-0 flex items-center justify-center bg-gray-100',
          className
        )}>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}

// 특화된 컴포넌트들
export function AvatarImage({ src, alt, size = 40, ...props }: 
  OptimizedImageProps & { size?: number }) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-full object-cover', props.className)}
      sizes={`${size}px`}
      {...props}
    />
  );
}

export function ThumbnailImage({ src, alt, ...props }: OptimizedImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={300}
      height={200}
      className={cn('rounded-lg object-cover', props.className)}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      {...props}
    />
  );
}

export function HeroImage({ src, alt, ...props }: OptimizedImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={1920}
      height={1080}
      priority={true}
      className={cn('w-full h-auto object-cover', props.className)}
      sizes="100vw"
      {...props}
    />
  );
}