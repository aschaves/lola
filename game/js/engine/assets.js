// Image loading. Images are keyed by their path so level data can reference them directly.
const Assets = (() => {
  const images = new Map();

  function load(paths, onProgress) {
    const unique = [...new Set(paths.filter(Boolean))];
    let done = 0;
    const tick = () => { done++; if (onProgress) onProgress(done / unique.length); };
    return Promise.all(unique.map((path) => new Promise((resolve) => {
      if (images.has(path)) { tick(); resolve(); return; }
      const img = new Image();
      img.onload = () => { images.set(path, img); tick(); resolve(); };
      img.onerror = () => { console.warn('Could not load image', path); images.set(path, null); tick(); resolve(); };
      img.src = path;
    })));
  }

  const get = (path) => (path ? images.get(path) || null : null);

  return { load, get };
})();
