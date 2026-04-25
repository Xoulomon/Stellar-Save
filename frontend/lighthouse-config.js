module.exports = {
  settings: {
    formFactor: 'mobile',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
    skipAudits: [],
    onlyAudits: null,
    precomputedLanternDataJson: null,
    throttlingMethod: 'simulate',
    useOnlyProvidedAudits: false,
  },
  audits: [
    // Performance metrics
    'first-contentful-paint',
    'largest-contentful-paint',
    'cumulative-layout-shift',
    'first-input-delay',
    'interaction-to-next-paint',
    'total-blocking-time',
    'speed-index',
    'longest-task-duration',
    
    // Best practices
    'errors-in-console',
    'doctype',
    'valid-source-maps',
    
    // Accessibility
    'button-name',
    'color-contrast',
    'label',
    'heading-order',
    
    // SEO
    'meta-description',
    'hreflang',
    'rel-canonical',
  ],
  categories: {
    performance: {
      title: 'Performance',
      description: 'These checks ensure your page is performant',
      auditRefs: [
        { id: 'first-contentful-paint', weight: 10 },
        { id: 'largest-contentful-paint', weight: 25 },
        { id: 'cumulative-layout-shift', weight: 15 },
        { id: 'total-blocking-time', weight: 25 },
        { id: 'speed-index', weight: 15 },
        { id: 'interaction-to-next-paint', weight: 10 },
      ],
    },
    'best-practices': {
      title: 'Best Practices',
      description: 'These checks highlight opportunities to improve code health and web best practices',
      auditRefs: [
        { id: 'errors-in-console', weight: 12 },
        { id: 'valid-source-maps', weight: 3 },
      ],
    },
    accessibility: {
      title: 'Accessibility',
      description: 'These checks ensure your app is accessible to all users',
      auditRefs: [
        { id: 'button-name', weight: 3 },
        { id: 'color-contrast', weight: 3 },
        { id: 'heading-order', weight: 2 },
      ],
    },
    seo: {
      title: 'SEO',
      description: 'These checks ensure your page is optimized for search engines',
      auditRefs: [
        { id: 'meta-description', weight: 10 },
        { id: 'rel-canonical', weight: 10 },
      ],
    },
  },
};
