const imageModules = import.meta.glob('../assets/login/*.{avif,jpeg,jpg,png,webp}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export const loginImages = Object.entries(imageModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, src]) => ({
    src,
    alt:
      path
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim() || 'AlSafwa Cement',
  }));
