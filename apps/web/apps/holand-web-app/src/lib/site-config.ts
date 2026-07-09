const siteConfig = {
  title: 'Holand Platform',
  description: 'Assessment and guidance platform',
  logo: '/brand/brand-wordmark.svg',
};
export default siteConfig;

/**
 * Helper that returns Next.js metadata object with a page-specific title.
 * @param title - Page title appended to site name
 */
export function metaObject(title?: string, restParam?: object) {
  return {
    title: title ? `${title} — ${siteConfig.title}` : siteConfig.title,
    description: siteConfig.description,
    ...restParam,
  };
}
