import * as React from "react";
import { cn } from '@/lib/utils';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
  demoSkipIndex?: number;
  maxRetries?: number;
  lowBandwidth?: boolean;
  onLoad?: () => void;
  onError?: (error: string) => void;
  // Image-specific props
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
}

// Global concurrency manager
class ImageLoadManager {
  private activeLoads = 0;
  private maxConcurrent = 4;
  private queue: Array<() => void> = [];
  
  canLoad(): boolean {
    return this.activeLoads < this.maxConcurrent;
  }
  
  startLoad(callback: () => void): void {
    if (this.canLoad()) {
      this.activeLoads++;
      callback();
    } else {
      this.queue.push(callback);
    }
  }
  
  finishLoad(): void {
    this.activeLoads--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.activeLoads++;
        // Small stagger to avoid thundering herd
        setTimeout(next, Math.random() * 100);
      }
    }
  }
}

const loadManager = new ImageLoadManager();

// Fallback images
const FALLBACK_AVATAR = '/assets/img/avatar-fallback.png';
const FALLBACK_IMAGE = '/assets/img/fallback-400x300.png';

// Provider fallback utilities
const getAvatarFallbacks = (username: string): string[] => [
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
  `https://i.pravatar.cc/150?u=${encodeURIComponent(username)}`,
  FALLBACK_AVATAR
];

const getBrandLogoFallbacks = (domain: string): string[] => [
  `https://logo.clearbit.com/${domain}`,
  `/assets/logos/local-${domain.replace('.com', '').replace('.', '-')}.png`,
  '/assets/logos/default.png'
];

const getContentImageFallbacks = (seed: number, topic?: string): string[] => {
  const fallbacks = [];
  if (topic) {
    fallbacks.push(`https://source.unsplash.com/800x600/?${encodeURIComponent(topic)}`);
  }
  fallbacks.push(`https://picsum.photos/800/600?random=${seed}`);
  fallbacks.push(FALLBACK_IMAGE);
  return fallbacks;
};

// Demo mode check
const isDemoMode = () => {
  return import.meta.env.VITE_DEMO_LOW_BANDWIDTH === 'true' || 
         localStorage.getItem('demo_low_bandwidth') === 'true';
};

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className,
  fallback,
  demoSkipIndex,
  maxRetries = 3,
  lowBandwidth = false,
  onLoad,
  onError,
  width,
  height,
  loading = 'lazy',
  ...props
}) => {
  const [currentSrc, setCurrentSrc] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const [isInView, setIsInView] = React.useState(loading === 'eager');

  // Demo mode logic
  const shouldSkipInDemo = isDemoMode() && demoSkipIndex !== undefined && demoSkipIndex > 2;
  const effectiveLowBandwidth = lowBandwidth || shouldSkipInDemo;

  // Determine fallback sources based on src pattern
  const getFallbackSources = React.useCallback((originalSrc: string): string[] => {
    if (fallback) return [originalSrc, fallback];
    
    // Supabase storage URLs - use directly without fallbacks
    if (originalSrc.includes('supabase.co/storage')) {
      return [originalSrc];
    }
    
    // Brand logos
    if (originalSrc.includes('logo.clearbit.com')) {
      const domain = originalSrc.split('/').pop() || '';
      return getBrandLogoFallbacks(domain);
    }
    
    // Avatars
    if (originalSrc.includes('dicebear.com') || originalSrc.includes('pravatar.cc')) {
      const urlParams = new URLSearchParams(originalSrc.split('?')[1] || '');
      const seed = urlParams.get('seed') || urlParams.get('u') || 'default';
      return getAvatarFallbacks(seed);
    }
    
    // Content images
    if (originalSrc.includes('unsplash.com') || originalSrc.includes('picsum.photos')) {
      const randomSeed = Math.floor(Math.random() * 1000);
      let topic;
      if (originalSrc.includes('unsplash.com')) {
        const match = originalSrc.match(/\?(.+)/);
        topic = match ? match[1] : undefined;
      }
      return getContentImageFallbacks(randomSeed, topic);
    }
    
    return [originalSrc, FALLBACK_IMAGE];
  }, [fallback]);

  // Head check for URL validation (optional)
  const checkImageUrl = async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // Avoid CORS issues
      });
      
      clearTimeout(timeoutId);
      return response.ok || response.status === 0; // status 0 for no-cors
    } catch {
      // If HEAD fails, let the img element try anyway
      return true;
    }
  };

  // Load image with retry logic
  const loadImage = React.useCallback(async (srcToLoad: string, attempt: number = 0) => {
    if (effectiveLowBandwidth && attempt === 0) {
      // In low bandwidth mode, show placeholder immediately
      setCurrentSrc(FALLBACK_IMAGE);
      setIsLoading(false);
      return;
    }

    return new Promise<void>((resolve, reject) => {
      loadManager.startLoad(async () => {
        try {
          setIsLoading(true);
          setError(null);

          // Optional URL validation
          const isValidUrl = await checkImageUrl(srcToLoad);
          if (!isValidUrl && attempt === 0) {
            throw new Error('URL validation failed');
          }

          const img = new Image();
          
          img.onload = () => {
            loadManager.finishLoad();
            setCurrentSrc(srcToLoad);
            setIsLoading(false);
            setError(null);
            onLoad?.();
            resolve();
          };

          img.onerror = () => {
            loadManager.finishLoad();
            const errorMsg = `Failed to load image: ${srcToLoad}`;
            console.warn(`[SafeImage] ${errorMsg} (attempt ${attempt + 1})`);
            
            if (attempt < maxRetries) {
              // Exponential backoff
              const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
              setTimeout(() => {
                setRetryCount(prev => prev + 1);
                loadImage(srcToLoad, attempt + 1).then(resolve).catch(reject);
              }, delay);
            } else {
              setError(errorMsg);
              onError?.(errorMsg);
              reject(new Error(errorMsg));
            }
          };

          img.src = srcToLoad;
        } catch (err) {
          loadManager.finishLoad();
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          console.warn(`[SafeImage] ${errorMsg}`);
          setError(errorMsg);
          onError?.(errorMsg);
          reject(err);
        }
      });
    });
  }, [maxRetries, onLoad, onError, effectiveLowBandwidth]);

  // Try loading with fallbacks
  const loadWithFallbacks = React.useCallback(async () => {
    const sources = getFallbackSources(src);
    
    for (let i = 0; i < sources.length; i++) {
      try {
        await loadImage(sources[i]);
        return; // Success
      } catch {
        // Try next fallback
        if (i === sources.length - 1) {
          // All fallbacks failed, show final error state
          setCurrentSrc('');
          setIsLoading(false);
          setError('All image sources failed');
        }
      }
    }
  }, [src, getFallbackSources, loadImage]);

  // Intersection Observer for lazy loading
  React.useEffect(() => {
    if (loading === 'eager' || !imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loading]);

  // Load image when in view
  React.useEffect(() => {
    if (isInView && src) {
      loadWithFallbacks();
    }
  }, [isInView, src, loadWithFallbacks]);

  // Cleanup
  React.useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  if (effectiveLowBandwidth && !currentSrc) {
    return (
      <div 
        ref={imgRef}
        className={cn("bg-muted animate-pulse flex items-center justify-center", className)}
        style={{ width, height }}
        {...props}
      >
        <span className="text-muted-foreground text-xs">Image</span>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div 
          className={cn("bg-muted animate-pulse", className)}
          style={{ width, height }}
        />
      )}
      
      {currentSrc && (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          className={cn(className, isLoading && 'opacity-0')}
          width={width}
          height={height}
          {...props}
          onLoad={() => {
            setIsLoading(false);
            onLoad?.();
          }}
          onError={() => {
            console.warn(`[SafeImage] Image element failed for: ${currentSrc}`);
          }}
        />
      )}

      {error && !currentSrc && (
        <div 
          className={cn(
            "bg-muted flex items-center justify-center text-muted-foreground",
            className
          )}
          style={{ width, height }}
          {...props}
        >
          <span className="text-xs text-center px-2">
            {retryCount > 0 ? `Retrying... (${retryCount}/${maxRetries})` : 'Image unavailable'}
          </span>
        </div>
      )}
    </>
  );
};

// Vanilla JS fallback utility for non-React contexts
export const createSafeImageFallback = (img: HTMLImageElement, fallbackSrc: string) => {
  let attempts = 0;
  const maxAttempts = 3;
  
  const handleError = () => {
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(() => {
        img.src = img.src; // Retry same URL
      }, Math.pow(2, attempts) * 1000);
    } else if (fallbackSrc) {
      img.src = fallbackSrc;
    }
  };
  
  img.addEventListener('error', handleError);
  return () => img.removeEventListener('error', handleError);
};