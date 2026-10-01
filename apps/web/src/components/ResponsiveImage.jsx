import { imageSource, imageSourceSet } from '../lib/images.js';

export function ResponsiveImage({ name, alt, sizes = '100vw', eager = false, className = '' }) {
  return (
    <img
      src={imageSource(name)}
      srcSet={imageSourceSet(name)}
      sizes={sizes}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
    />
  );
}
