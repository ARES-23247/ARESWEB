import { useState } from "react";
import { motion } from "framer-motion";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}

export default function LazyImage({ src, alt, className = "", imgClassName = "" }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-white/5 ${className}`}>
      {/* Skeleton Placeholder */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: isLoaded ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 bg-marble/5 animate-pulse backdrop-blur-xl z-0"
      />

      {/* Actual Image */}
      <motion.img
        src={src}
        alt={alt}
        initial={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
        animate={{ opacity: isLoaded ? 1 : 0, filter: isLoaded ? "blur(0px)" : "blur(10px)", scale: isLoaded ? 1 : 1.05 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover absolute inset-0 z-10 ${imgClassName}`}
      />
    </div>
  );
}
