(() => {
  const base = new URL('.', document.currentScript.src);
  const parts = [
    'app-core.js',
    'app-semantic.js',
    'app-learning.js',
    'app-analysis.js',
    'app-scenarios.js',
    'app-ui.js'
  ];
  let i = 0;
  const loadNext = () => {
    if (i >= parts.length) return;
    const script = document.createElement('script');
    script.src = new URL(parts[i++], base).href;
    script.async = false;
    script.onload = loadNext;
    script.onerror = () => console.error('Decision Lab failed to load', script.src);
    document.head.appendChild(script);
  };
  loadNext();
})();
