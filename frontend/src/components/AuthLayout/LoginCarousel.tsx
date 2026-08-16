import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { loginImages } from '../../config/loginCarousel';

interface LoginCarouselProps {
  children: ReactNode;
  intervalMs?: number;
}

export default function LoginCarousel({ children, intervalMs = 6500 }: LoginCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const images = useMemo(() => loginImages, []);
  const hasImages = images.length > 0;

  useEffect(() => {
    if (!hasImages) return;

    images.forEach((image) => {
      const preload = new Image();
      preload.src = image.src;
    });
  }, [hasImages, images]);

  useEffect(() => {
    if (images.length < 2) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [images.length, intervalMs]);

  const selectPrevious = () => {
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
  };

  const selectNext = () => {
    setActiveIndex((current) => (current + 1) % images.length);
  };

  return (
    <>
      {hasImages && (
        <div className="login-carousel" aria-label="AlSafwa Cement highlights">
          {images.map((image, index) => (
            <img
              key={image.src}
              src={image.src}
              alt={image.alt}
              className={index === activeIndex ? 'active' : ''}
              aria-hidden={index !== activeIndex}
            />
          ))}
          <div className="login-carousel-scrim" />
        </div>
      )}
      {children}
      {images.length > 1 && (
        <div className="carousel-controls" aria-label="Login image carousel controls">
          <button type="button" onClick={selectPrevious} aria-label="Previous image">
            <ChevronLeft size={16} />
          </button>
          <div className="visual-dots">
            {images.map((image, index) => (
              <button
                key={image.src}
                type="button"
                className={index === activeIndex ? 'on' : ''}
                onClick={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1}`}
                aria-current={index === activeIndex}
              />
            ))}
          </div>
          <button type="button" onClick={selectNext} aria-label="Next image">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}
