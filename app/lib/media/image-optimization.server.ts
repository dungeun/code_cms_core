// 이미지 최적화 처리 시스템

import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { cache } from "../cache/redis-cluster.server";

// 이미지 변환 옵션
interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  gravity?: 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest' | 'center';
  blur?: number;
  sharpen?: boolean;
  grayscale?: boolean;
}

// 이미지 메타데이터
interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
}

// 이미지 최적화 매니저
export class ImageOptimizer {
  private static readonly uploadDir = process.env.UPLOAD_DIR || './uploads';
  private static readonly cacheDir = path.join(this.uploadDir, 'cache');
  
  // 초기화
  static async initialize() {
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
  }
  
  // 이미지 업로드 및 최적화
  static async uploadAndOptimize(
    buffer: Buffer,
    filename: string,
    options: ImageTransformOptions = {}
  ): Promise<{
    originalPath: string;
    optimizedPath: string;
    metadata: ImageMetadata;
    variants: Record<string, string>;
  }> {
    const fileExt = path.extname(filename);
    const baseName = path.basename(filename, fileExt);
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    
    // 원본 파일 저장
    const originalPath = path.join(this.uploadDir, 'originals', `${hash}_${filename}`);
    await fs.mkdir(path.dirname(originalPath), { recursive: true });
    await fs.writeFile(originalPath, buffer);
    
    // 메타데이터 추출
    const metadata = await this.extractMetadata(buffer);
    
    // 기본 최적화 수행
    const optimizedBuffer = await this.optimizeImage(buffer, {
      quality: 80,
      format: 'webp',
      ...options
    });
    
    const optimizedPath = path.join(this.uploadDir, 'optimized', `${hash}_opt.webp`);
    await fs.mkdir(path.dirname(optimizedPath), { recursive: true });
    await fs.writeFile(optimizedPath, optimizedBuffer);
    
    // 다양한 크기 변형 생성
    const variants = await this.generateVariants(buffer, hash, baseName);
    
    return {
      originalPath,
      optimizedPath,
      metadata,
      variants
    };
  }
  
  // 이미지 메타데이터 추출
  static async extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const stats = await image.stats();
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
      hasAlpha: metadata.hasAlpha || false
    };
  }
  
  // 이미지 최적화
  static async optimizeImage(
    buffer: Buffer,
    options: ImageTransformOptions
  ): Promise<Buffer> {
    let image = sharp(buffer);
    
    // 크기 조정
    if (options.width || options.height) {
      image = image.resize(options.width, options.height, {
        fit: options.fit || 'cover',
        position: options.gravity || 'center'
      });
    }
    
    // 효과 적용
    if (options.blur) {
      image = image.blur(options.blur);
    }
    
    if (options.sharpen) {
      image = image.sharpen();
    }
    
    if (options.grayscale) {
      image = image.grayscale();
    }
    
    // 포맷 변환 및 압축
    switch (options.format) {
      case 'jpeg':
        image = image.jpeg({ quality: options.quality || 80 });
        break;
      case 'png':
        image = image.png({ compressionLevel: 9 });
        break;
      case 'webp':
        image = image.webp({ quality: options.quality || 80 });
        break;
      case 'avif':
        image = image.avif({ quality: options.quality || 50 });
        break;
      default:
        image = image.webp({ quality: options.quality || 80 });
    }
    
    return await image.toBuffer();
  }
  
  // 다양한 크기 변형 생성 (반응형)
  static async generateVariants(
    buffer: Buffer,
    hash: string,
    baseName: string
  ): Promise<Record<string, string>> {
    const variants: Record<string, string> = {};
    
    // 반응형 크기 정의
    const sizes = [
      { name: 'thumbnail', width: 150, height: 150 },
      { name: 'small', width: 320, height: 240 },
      { name: 'medium', width: 768, height: 576 },
      { name: 'large', width: 1200, height: 900 },
      { name: 'xlarge', width: 1920, height: 1080 }
    ];
    
    for (const size of sizes) {
      try {
        const variantBuffer = await this.optimizeImage(buffer, {
          width: size.width,
          height: size.height,
          format: 'webp',
          quality: 80,
          fit: 'cover'
        });
        
        const variantPath = path.join(
          this.uploadDir,
          'variants',
          `${hash}_${size.name}.webp`
        );
        
        await fs.mkdir(path.dirname(variantPath), { recursive: true });
        await fs.writeFile(variantPath, variantBuffer);
        
        variants[size.name] = variantPath;
      } catch (error) {
        console.error(`Failed to generate ${size.name} variant:`, error);
      }
    }
    
    return variants;
  }
  
  // 동적 이미지 변환 (캐시 포함)
  static async transform(
    imagePath: string,
    options: ImageTransformOptions
  ): Promise<Buffer> {
    // 캐시 키 생성
    const cacheKey = `image:${crypto
      .createHash('md5')
      .update(imagePath + JSON.stringify(options))
      .digest('hex')}`;
    
    // 캐시 확인
    const cached = await cache.get(cacheKey);
    if (cached) {
      return Buffer.from(cached, 'base64');
    }
    
    try {
      // 원본 이미지 읽기
      const buffer = await fs.readFile(imagePath);
      
      // 변환 수행
      const transformedBuffer = await this.optimizeImage(buffer, options);
      
      // 캐시 저장 (1시간)
      await cache.set(cacheKey, transformedBuffer.toString('base64'), {
        ttl: 3600
      });
      
      return transformedBuffer;
    } catch (error) {
      console.error('Image transformation failed:', error);
      throw new Error('Failed to transform image');
    }
  }
  
  // 이미지 정보 가져오기
  static async getImageInfo(imagePath: string): Promise<ImageMetadata | null> {
    try {
      const buffer = await fs.readFile(imagePath);
      return await this.extractMetadata(buffer);
    } catch (error) {
      console.error('Failed to get image info:', error);
      return null;
    }
  }
  
  // 이미지 삭제 (모든 변형 포함)
  static async deleteImage(hash: string): Promise<void> {
    const patterns = [
      path.join(this.uploadDir, 'originals', `${hash}_*`),
      path.join(this.uploadDir, 'optimized', `${hash}_*`),
      path.join(this.uploadDir, 'variants', `${hash}_*`)
    ];
    
    for (const pattern of patterns) {
      try {
        const files = await fs.readdir(path.dirname(pattern));
        const matchingFiles = files.filter(file => 
          file.startsWith(path.basename(pattern).replace('*', ''))
        );
        
        for (const file of matchingFiles) {
          await fs.unlink(path.join(path.dirname(pattern), file));
        }
      } catch (error) {
        console.error(`Failed to delete files matching ${pattern}:`, error);
      }
    }
    
    // 캐시에서도 삭제
    await cache.deletePattern(`image:*${hash}*`);
  }
  
  // 통계 정보 수집
  static async getStats(): Promise<{
    totalFiles: number;
    totalSize: string;
    formatDistribution: Record<string, number>;
    avgFileSize: number;
  }> {
    try {
      const files = await fs.readdir(path.join(this.uploadDir, 'optimized'));
      let totalSize = 0;
      const formatCounts: Record<string, number> = {};
      
      for (const file of files) {
        const filePath = path.join(this.uploadDir, 'optimized', file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        
        const ext = path.extname(file).slice(1);
        formatCounts[ext] = (formatCounts[ext] || 0) + 1;
      }
      
      return {
        totalFiles: files.length,
        totalSize: this.formatFileSize(totalSize),
        formatDistribution: formatCounts,
        avgFileSize: files.length > 0 ? totalSize / files.length : 0
      };
    } catch (error) {
      console.error('Failed to get image stats:', error);
      return {
        totalFiles: 0,
        totalSize: '0 B',
        formatDistribution: {},
        avgFileSize: 0
      };
    }
  }
  
  // 파일 크기 포맷팅
  private static formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// React 컴포넌트에서 사용할 이미지 URL 생성
export function generateImageUrl(
  hash: string,
  variant: string = 'medium',
  format: string = 'webp'
): string {
  return `/api/images/${hash}/${variant}.${format}`;
}

// 반응형 이미지 소스셋 생성
export function generateResponsiveImageSrcSet(hash: string): {
  srcSet: string;
  sizes: string;
} {
  const variants = ['small', 'medium', 'large', 'xlarge'];
  const widths = [320, 768, 1200, 1920];
  
  const srcSet = variants
    .map((variant, index) => 
      `${generateImageUrl(hash, variant)} ${widths[index]}w`
    )
    .join(', ');
  
  const sizes = [
    '(max-width: 320px) 320px',
    '(max-width: 768px) 768px', 
    '(max-width: 1200px) 1200px',
    '1920px'
  ].join(', ');
  
  return { srcSet, sizes };
}

// 초기화 실행
ImageOptimizer.initialize();