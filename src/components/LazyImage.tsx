import { useState } from "react";
import { motion } from "framer-motion";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  srcset?: string;  // Comma-separated srcset values for responsive images
  sizes?: string;   // Media query sizes for responsive images
}

export default function LazyImage({ src, alt, className = "", imgClassName = "", srcset, sizes }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  // ARES placeholder if the original image fails
  const fallbackSrc = "/news_1.png"; 

  return (
    <div className={`relative overflow-hidden bg-white/5 ${className}`}>
      {/* Skeleton Placeholder */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: (isLoaded || isError) ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 bg-marble/5 animate-pulse backdrop-blur-xl z-0"
      />

      {/* Actual Image with WebP support */}
      <picture className={`w-full h-full absolute inset-0 z-10 ${imgClassName}`}>
        {!isError && (
          <source
            srcSet={srcset ?? src.replace(/\.(png|jpg|jpeg)$/i, '.webp')}
            type="image/webp"
            sizes={sizes}
          />
        )}
        <motion.img
          src={isError ? fallbackSrc : src}
          srcSet={srcset}
          sizes={sizes}
          alt={alt}
          initial={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
          animate={{ opacity: (isLoaded || isError) ? 1 : 0, filter: (isLoaded || isError) ? "blur(0px)" : "blur(10px)", scale: (isLoaded || isError) ? 1 : 1.05 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            if (!isError) setIsError(true);
          }}
          className="w-full h-full object-cover"
        />
      </picture>
    </div>
  );
}
