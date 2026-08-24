import { ImageIcon, Package } from 'lucide-react';
import { useState } from 'react';

interface ProductImageProps {
  image: string | null | undefined;
  productName: string;
  size?: 'card' | 'detail' | 'thumbnail' | 'summary';
}

const sizeClasses = {
  card: 'h-44 w-full',
  detail: 'aspect-[4/3] w-full',
  thumbnail: 'h-12 w-12',
  summary: 'h-16 w-16',
};

export function ProductImage({ image, productName, size = 'card' }: ProductImageProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const canShowImage = Boolean(image) && !imageFailed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${sizeClasses[size]}`}
    >
      {canShowImage ? (
        <img
          src={image ?? undefined}
          alt={productName}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-contain p-3"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-3 text-center text-slate-400">
          {image ? (
            <ImageIcon size={size === 'card' || size === 'detail' ? 30 : 20} />
          ) : (
            <Package size={size === 'card' || size === 'detail' ? 30 : 20} />
          )}
          {(size === 'card' || size === 'detail') && (
            <span className="text-xs font-bold">No image available</span>
          )}
        </div>
      )}
    </div>
  );
}
