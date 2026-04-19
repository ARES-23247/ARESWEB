import React, { useState, useEffect } from 'react';
import { LucideIcon, Globe } from 'lucide-react';
import { getLogoUrl, extractDomain } from '../utils/logoResolvers';

interface BrandLogoProps {
  domain: string;
  className?: string;
  fallbackIcon?: LucideIcon;
  alt?: string;
}

/**
 * A resilient logo component that handles domain sanitization,
 * loading states, and provides a Lucide icon fallback if the logo fails to load.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ 
  domain, 
  className = "w-8 h-8", 
  fallbackIcon: Fallback = Globe,
  alt = "Brand Logo" 
}) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const cleanDomain = extractDomain(domain);
  const logoUrl = getLogoUrl(cleanDomain);

  // Reset error/loading when domain changes
  useEffect(() => {
    setError(false);
    setLoading(true);
  }, [cleanDomain]);

  if (!cleanDomain || error) {
    return (
      <div className={`${className} flex items-center justify-center bg-zinc-800 border border-zinc-700/50 rounded-lg text-zinc-500`}>
        <Fallback size={Math.max(12, parseInt(className.match(/\d+/)?.[0] || "16") * 0.6)} />
      </div>
    );
  }

  return (
    <div className={`${className} relative group bg-white p-0.5 rounded-lg overflow-hidden flex-shrink-0`}>
      {loading && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
      )}
      <img
        src={logoUrl}
        alt={alt}
        className={`w-full h-full object-contain transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
      />
    </div>
  );
};
