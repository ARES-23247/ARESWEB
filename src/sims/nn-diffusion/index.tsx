/** @sim {"name": "Sim 5: Generative AI (Diffusion)", "description": "Visualize how Generative AI creates images by gradually removing noise."} */
import { useState, useEffect, useRef } from 'react';

const GRID_SIZE = 10;
// An "A" pattern
const TARGET_IMAGE = [
  0,0,0,1,1,1,1,0,0,0,
  0,0,1,1,0,0,1,1,0,0,
  0,1,1,0,0,0,0,1,1,0,
  0,1,1,0,0,0,0,1,1,0,
  0,1,1,1,1,1,1,1,1,0,
  0,1,1,0,0,0,0,1,1,0,
  0,1,1,0,0,0,0,1,1,0,
  1,1,1,0,0,0,0,1,1,1,
  1,1,0,0,0,0,0,0,1,1,
  1,0,0,0,0,0,0,0,0,1,
];

export default function DiffusionVisualizer() {
  const [pixels, setPixels] = useState<number[]>(TARGET_IMAGE);
  const [step, setStep] = useState(0); // 0 = clear image, 100 = pure noise
  const [phase, setPhase] = useState<'idle' | 'forward' | 'reverse'>('idle');
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // Generate a fully noisy image based on target and current step (noise level)
  const computeImageAtStep = (currentStep: number) => {
    const newPixels = [...TARGET_IMAGE];
    const noiseFactor = currentStep / 100;
    
    for (let i = 0; i < newPixels.length; i++) {
      // Add random noise
      const noise = Math.random();
      // Linearly interpolate between original pixel and random noise
      // If step = 0, newPixels[i] = TARGET_IMAGE[i]
      // If step = 100, newPixels[i] = random noise
      newPixels[i] = newPixels[i] * (1 - noiseFactor) + noise * noiseFactor;
    }
    return newPixels;
  };

  const addNoise = () => {
    if (animationRef.current) clearInterval(animationRef.current);
    setPhase('forward');
    let current = 0;
    setStep(0);
    
    animationRef.current = setInterval(() => {
      current += 2;
      if (current >= 100) {
        current = 100;
        if (animationRef.current) clearInterval(animationRef.current);
        setPhase('idle');
      }
      setStep(current);
      setPixels(computeImageAtStep(current));
    }, 50);
  };

  const removeNoise = () => {
    if (animationRef.current) clearInterval(animationRef.current);
    setPhase('reverse');
    let current = 100;
    setStep(100);
    setPixels(computeImageAtStep(100)); // Start from pure noise
    
    animationRef.current = setInterval(() => {
      current -= 2;
      if (current <= 0) {
        current = 0;
        if (animationRef.current) clearInterval(animationRef.current);
        setPhase('idle');
        setPixels([...TARGET_IMAGE]); // Snap to perfect image
      } else {
        setStep(current);
        setPixels(computeImageAtStep(current));
      }
    }, 50);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, []);

  return (
    <div className="bg-obsidian border border-white/10 ares-cut-sm p-6 text-marble font-sans max-w-2xl mx-auto my-8 text-center">
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading text-ares-gold uppercase tracking-wider">Sim 5: Generative AI</h2>
        <p className="text-sm text-marble/60">Watch a Diffusion Model learn by adding noise, then generating art by removing it.</p>
      </div>

      <div className="mb-8 flex justify-center gap-4">
        <button 
          onClick={addNoise}
          disabled={phase !== 'idle'}
          className="px-6 py-3 bg-white/10 text-white font-bold tracking-widest uppercase ares-cut-sm disabled:opacity-50 hover:bg-white/20 transition-colors"
        >
          Add Noise (Forward)
        </button>
        <button 
          onClick={removeNoise}
          disabled={phase !== 'idle'}
          className="px-6 py-3 bg-ares-red text-white font-bold tracking-widest uppercase ares-cut-sm disabled:opacity-50 hover:shadow-[0_0_20px_rgba(192,0,0,0.4)] transition-all"
        >
          Denoise (Generate)
        </button>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="text-xs font-bold uppercase tracking-widest text-marble/60">
          Noise Level: <span className="text-ares-cyan">{step}%</span>
        </div>
        
        <div className="grid border border-white/20 bg-black shadow-2xl shadow-ares-cyan/10" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
          {pixels.map((val, i) => {
            // Map 0-1 to grayscale
            const color = Math.floor(val * 255);
            return (
              <div 
                key={i} 
                className="w-8 h-8 sm:w-12 sm:h-12"
                style={{ backgroundColor: `rgb(${color}, ${color}, ${color})` }}
              />
            );
          })}
        </div>
      </div>
      
      <div className="mt-8 text-xs text-marble/60 max-w-lg mx-auto leading-relaxed">
        Modern AI models like Midjourney or DALL-E work by starting with pure static noise (100% noise) and using a neural network to predict and subtract the noise step-by-step until a clear image emerges.
      </div>
    </div>
  );
}
