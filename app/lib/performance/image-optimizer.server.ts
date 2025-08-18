/**
 * 이미지 최적화 시스템
 * WebP 변환, 압축, 리사이징, CDN 통합
 */
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { getMetricsCollector } from '../monitoring/metrics-collector.server';
import { getRedisCluster } from '../redis/cluster.server';

/**
 * 이미지 최적화 매니저
 */
export class ImageOptimizer {
  private uploadDir = './public/uploads';
  private optimizedDir = './public/uploads/optimized';
  private metricsCollector = getMetricsCollector();
  private redis = getRedisCluster();

  // 지원되는 이미지 포맷
  private supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'svg'];
  
  // 압축 설정
  private compressionSettings = {
    jpeg: { quality: 85, progressive: true },
    webp: { quality: 85, effort: 4 },
    png: { compressionLevel: 8, adaptiveFiltering: true },
    avif: { quality: 80, effort: 4 },
  };

  constructor() {
    this.ensureDirectories();
  }

  /**
   * 디렉토리 확인 및 생성
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.optimizedDir, { recursive: true });
      await fs.mkdir(path.join(this.optimizedDir, 'thumbnails'), { recursive: true });
      await fs.mkdir(path.join(this.optimizedDir, 'webp'), { recursive: true });
      await fs.mkdir(path.join(this.optimizedDir, 'avif'), { recursive: true });
    } catch (error) {
      console.error('디렉토리 생성 실패:', error);
    }
  }

  /**
   * 이미지 최적화 (메인 메서드)
   */
  async optimizeImage(
    inputPath: string,
    options?: ImageOptimizationOptions
  ): Promise<OptimizationResult> {
    const start = performance.now();
    
    try {
      const inputStats = await fs.stat(inputPath);
      const originalSize = inputStats.size;
      
      // 이미지 정보 분석
      const metadata = await sharp(inputPath).metadata();
      
      if (!this.isValidImage(metadata)) {
        throw new Error('지원되지 않는 이미지 형식입니다');
      }

      const results: OptimizedImageInfo[] = [];
      
      // 기본 최적화 (원본 포맷)
      const optimizedOriginal = await this.optimizeFormat(
        inputPath, 
        metadata.format as string,
        options
      );
      results.push(optimizedOriginal);

      // WebP 변환 (항상 생성)
      if (metadata.format !== 'webp') {
        const webpResult = await this.convertToWebP(inputPath, options);
        results.push(webpResult);
      }

      // AVIF 변환 (고압축이 필요한 경우)
      if (options?.generateAVIF && metadata.format !== 'avif') {
        try {
          const avifResult = await this.convertToAVIF(inputPath, options);
          results.push(avifResult);
        } catch (error) {
          console.warn('AVIF 변환 실패:', error);
        }
      }

      // 썸네일 생성
      if (options?.generateThumbnails) {
        const thumbnails = await this.generateThumbnails(inputPath, options);
        results.push(...thumbnails);
      }

      // 총 최적화 시간 및 효과 계산
      const duration = performance.now() - start;
      const totalOptimizedSize = results.reduce((sum, r) => sum + r.size, 0);
      const compressionRatio = ((originalSize - totalOptimizedSize) / originalSize) * 100;

      // 메트릭 기록
      this.metricsCollector.recordFileUpload(
        metadata.format || 'unknown',
        originalSize,
        'success'
      );

      const result: OptimizationResult = {
        originalSize,
        optimizedImages: results,
        totalOptimizedSize,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
        processingTime: Math.round(duration),
        metadata: {
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: metadata.format || 'unknown',
          channels: metadata.channels || 0,
          hasAlpha: metadata.hasAlpha || false,
        },
      };

      console.log(`✅ 이미지 최적화 완료: ${path.basename(inputPath)}`);
      console.log(`   압축률: ${result.compressionRatio.toFixed(1)}%`);
      console.log(`   처리시간: ${result.processingTime}ms`);

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      this.metricsCollector.recordFileUpload(
        'unknown',
        0,
        'error'
      );

      console.error(`❌ 이미지 최적화 실패: ${inputPath}`, error);
      throw error;
    }
  }

  /**
   * 특정 포맷으로 최적화
   */
  private async optimizeFormat(
    inputPath: string,
    format: string,
    options?: ImageOptimizationOptions
  ): Promise<OptimizedImageInfo> {
    const outputFilename = this.generateOptimizedFilename(inputPath, format);
    const outputPath = path.join(this.optimizedDir, outputFilename);

    let pipeline = sharp(inputPath);

    // 리사이징 (필요한 경우)
    if (options?.maxWidth || options?.maxHeight) {
      pipeline = pipeline.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // 포맷별 최적화 적용
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg(this.compressionSettings.jpeg);
        break;
      case 'png':
        pipeline = pipeline.png(this.compressionSettings.png);
        break;
      case 'webp':
        pipeline = pipeline.webp(this.compressionSettings.webp);
        break;
      default:
        // 기본 설정 유지
        break;
    }

    await pipeline.toFile(outputPath);
    
    const stats = await fs.stat(outputPath);
    
    return {
      path: outputPath,
      filename: outputFilename,
      format: format,
      size: stats.size,
      url: `/uploads/optimized/${outputFilename}`,
      width: 0, // metadata에서 업데이트됨
      height: 0,
    };
  }

  /**
   * WebP 변환
   */
  private async convertToWebP(
    inputPath: string,
    options?: ImageOptimizationOptions
  ): Promise<OptimizedImageInfo> {
    const outputFilename = this.generateOptimizedFilename(inputPath, 'webp');
    const outputPath = path.join(this.optimizedDir, 'webp', outputFilename);

    let pipeline = sharp(inputPath);

    if (options?.maxWidth || options?.maxHeight) {
      pipeline = pipeline.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const metadata = await pipeline
      .webp(this.compressionSettings.webp)
      .toFile(outputPath);

    const stats = await fs.stat(outputPath);

    return {
      path: outputPath,
      filename: outputFilename,
      format: 'webp',
      size: stats.size,
      url: `/uploads/optimized/webp/${outputFilename}`,
      width: metadata.width,
      height: metadata.height,
    };
  }

  /**
   * AVIF 변환
   */
  private async convertToAVIF(
    inputPath: string,
    options?: ImageOptimizationOptions
  ): Promise<OptimizedImageInfo> {
    const outputFilename = this.generateOptimizedFilename(inputPath, 'avif');
    const outputPath = path.join(this.optimizedDir, 'avif', outputFilename);

    let pipeline = sharp(inputPath);

    if (options?.maxWidth || options?.maxHeight) {
      pipeline = pipeline.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const metadata = await pipeline
      .avif(this.compressionSettings.avif)
      .toFile(outputPath);

    const stats = await fs.stat(outputPath);

    return {
      path: outputPath,
      filename: outputFilename,
      format: 'avif',
      size: stats.size,
      url: `/uploads/optimized/avif/${outputFilename}`,
      width: metadata.width,
      height: metadata.height,
    };
  }

  /**
   * 썸네일 생성
   */
  private async generateThumbnails(
    inputPath: string,
    options?: ImageOptimizationOptions
  ): Promise<OptimizedImageInfo[]> {
    const thumbnailSizes = options?.thumbnailSizes || [
      { width: 150, height: 150, name: 'small' },
      { width: 300, height: 300, name: 'medium' },
      { width: 600, height: 400, name: 'large' },
    ];

    const thumbnails: OptimizedImageInfo[] = [];

    for (const size of thumbnailSizes) {
      try {
        const outputFilename = this.generateThumbnailFilename(
          inputPath, 
          size.name, 
          'webp'
        );
        const outputPath = path.join(
          this.optimizedDir, 
          'thumbnails', 
          outputFilename
        );

        const metadata = await sharp(inputPath)
          .resize(size.width, size.height, {
            fit: 'cover',
            position: 'center',
          })
          .webp(this.compressionSettings.webp)
          .toFile(outputPath);

        const stats = await fs.stat(outputPath);

        thumbnails.push({
          path: outputPath,
          filename: outputFilename,
          format: 'webp',
          size: stats.size,
          url: `/uploads/optimized/thumbnails/${outputFilename}`,
          width: metadata.width,
          height: metadata.height,
          variant: size.name,
        });
      } catch (error) {
        console.warn(`썸네일 생성 실패 (${size.name}):`, error);
      }
    }

    return thumbnails;
  }

  /**
   * 반응형 이미지 생성
   */
  async generateResponsiveImages(
    inputPath: string,
    options?: ResponsiveImageOptions
  ): Promise<ResponsiveImageSet> {
    const sizes = options?.sizes || [
      { width: 320, descriptor: '320w' },
      { width: 640, descriptor: '640w' },
      { width: 768, descriptor: '768w' },
      { width: 1024, descriptor: '1024w' },
      { width: 1280, descriptor: '1280w' },
      { width: 1920, descriptor: '1920w' },
    ];

    const formats = options?.formats || ['webp', 'jpeg'];
    const responsiveImages: ResponsiveImage[] = [];

    for (const format of formats) {
      for (const size of sizes) {
        try {
          const outputFilename = this.generateResponsiveFilename(
            inputPath,
            size.width,
            format
          );
          
          const outputPath = path.join(this.optimizedDir, outputFilename);

          const metadata = await sharp(inputPath)
            .resize(size.width, null, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            [format as keyof sharp.Sharp](
              this.compressionSettings[format as keyof typeof this.compressionSettings]
            )
            .toFile(outputPath);

          const stats = await fs.stat(outputPath);

          responsiveImages.push({
            url: `/uploads/optimized/${outputFilename}`,
            width: metadata.width || size.width,
            height: metadata.height || 0,
            format,
            size: stats.size,
            descriptor: size.descriptor,
          });
        } catch (error) {
          console.warn(`반응형 이미지 생성 실패 (${size.width}px, ${format}):`, error);
        }
      }
    }

    // srcset 문자열 생성
    const srcSets = formats.reduce((acc, format) => {
      const formatImages = responsiveImages.filter(img => img.format === format);
      acc[format] = formatImages
        .map(img => `${img.url} ${img.descriptor}`)
        .join(', ');
      return acc;
    }, {} as Record<string, string>);

    return {
      images: responsiveImages,
      srcSets,
      fallback: responsiveImages.find(img => img.format === 'jpeg')?.url || '',
    };
  }

  /**
   * 이미지 유효성 검증
   */
  private isValidImage(metadata: sharp.Metadata): boolean {
    if (!metadata.format) return false;
    if (!this.supportedFormats.includes(metadata.format.toLowerCase())) return false;
    if (!metadata.width || !metadata.height) return false;
    if (metadata.width > 10000 || metadata.height > 10000) return false; // 최대 크기 제한
    
    return true;
  }

  /**
   * 최적화된 파일명 생성
   */
  private generateOptimizedFilename(inputPath: string, format: string): string {
    const basename = path.basename(inputPath, path.extname(inputPath));
    const timestamp = Date.now();
    return `${basename}_${timestamp}.${format}`;
  }

  /**
   * 썸네일 파일명 생성
   */
  private generateThumbnailFilename(
    inputPath: string, 
    size: string, 
    format: string
  ): string {
    const basename = path.basename(inputPath, path.extname(inputPath));
    const timestamp = Date.now();
    return `${basename}_thumb_${size}_${timestamp}.${format}`;
  }

  /**
   * 반응형 이미지 파일명 생성
   */
  private generateResponsiveFilename(
    inputPath: string,
    width: number,
    format: string
  ): string {
    const basename = path.basename(inputPath, path.extname(inputPath));
    const timestamp = Date.now();
    return `${basename}_${width}w_${timestamp}.${format}`;
  }

  /**
   * 이미지 캐시 관리
   */
  async cacheImageInfo(imageId: string, info: OptimizationResult): Promise<void> {
    try {
      const cacheKey = `image:${imageId}`;
      await this.redis.setex(cacheKey, 3600, JSON.stringify(info)); // 1시간 캐시
    } catch (error) {
      console.warn('이미지 정보 캐싱 실패:', error);
    }
  }

  /**
   * 캐시된 이미지 정보 조회
   */
  async getCachedImageInfo(imageId: string): Promise<OptimizationResult | null> {
    try {
      const cacheKey = `image:${imageId}`;
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('이미지 캐시 조회 실패:', error);
      return null;
    }
  }

  /**
   * 이미지 정리 (오래된 최적화 이미지 삭제)
   */
  async cleanupOldImages(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<CleanupResult> {
    const now = Date.now();
    let deletedCount = 0;
    let freedBytes = 0;

    try {
      const dirs = [this.optimizedDir];
      const subdirs = ['webp', 'avif', 'thumbnails'];
      
      for (const subdir of subdirs) {
        dirs.push(path.join(this.optimizedDir, subdir));
      }

      for (const dir of dirs) {
        try {
          const files = await fs.readdir(dir);
          
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.isFile() && (now - stats.mtime.getTime()) > maxAge) {
              freedBytes += stats.size;
              await fs.unlink(filePath);
              deletedCount++;
            }
          }
        } catch (error) {
          console.warn(`디렉토리 정리 실패: ${dir}`, error);
        }
      }

      console.log(`🧹 이미지 정리 완료: ${deletedCount}개 파일 삭제, ${(freedBytes / 1024 / 1024).toFixed(2)}MB 확보`);
      
      return {
        deletedFiles: deletedCount,
        freedBytes,
        freedMB: Math.round((freedBytes / 1024 / 1024) * 100) / 100,
      };
    } catch (error) {
      console.error('이미지 정리 실패:', error);
      throw error;
    }
  }
}

// 인터페이스 정의
export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  generateWebP?: boolean;
  generateAVIF?: boolean;
  generateThumbnails?: boolean;
  thumbnailSizes?: Array<{
    width: number;
    height: number;
    name: string;
  }>;
  quality?: number;
}

export interface ResponsiveImageOptions {
  sizes?: Array<{
    width: number;
    descriptor: string;
  }>;
  formats?: string[];
}

export interface OptimizedImageInfo {
  path: string;
  filename: string;
  format: string;
  size: number;
  url: string;
  width: number;
  height: number;
  variant?: string;
}

export interface OptimizationResult {
  originalSize: number;
  optimizedImages: OptimizedImageInfo[];
  totalOptimizedSize: number;
  compressionRatio: number;
  processingTime: number;
  metadata: {
    width: number;
    height: number;
    format: string;
    channels: number;
    hasAlpha: boolean;
  };
}

export interface ResponsiveImage {
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
  descriptor: string;
}

export interface ResponsiveImageSet {
  images: ResponsiveImage[];
  srcSets: Record<string, string>;
  fallback: string;
}

export interface CleanupResult {
  deletedFiles: number;
  freedBytes: number;
  freedMB: number;
}

// 전역 이미지 최적화 인스턴스
let imageOptimizer: ImageOptimizer | null = null;

/**
 * 이미지 최적화 인스턴스 가져오기
 */
export function getImageOptimizer(): ImageOptimizer {
  if (!imageOptimizer) {
    imageOptimizer = new ImageOptimizer();
  }
  return imageOptimizer;
}

export default getImageOptimizer;