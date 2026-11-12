(function (root) {
  'use strict';
  const MAX_IMPORT_BYTES = 100000;
  function emptyProgress() { return { schemaVersion: 1, completed: [], favorites: [] }; }
  function validateProgress(value, points) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1) throw new Error('文件格式不匹配，需要 schemaVersion: 1。');
    const ids = new Set(points.map(p => p.id));
    for (const key of ['completed', 'favorites']) {
      if (!Array.isArray(value[key]) || value[key].length > points.length || value[key].some(id => typeof id !== 'string' || !ids.has(id))) throw new Error('进度包含未知点位或无效字段。');
    }
    return { schemaVersion: 1, completed: [...new Set(value.completed)], favorites: [...new Set(value.favorites)] };
  }
  function filterPoints(points, filters, progress) {
    const query = filters.query.trim().toLocaleLowerCase();
    return points.filter(p => p.region === filters.region && filters.categories.has(p.category) &&
      (!query || (p.title + ' ' + p.summary).toLocaleLowerCase().includes(query)) &&
      (!filters.favoritesOnly || progress.favorites.includes(p.id)) &&
      (!filters.hideCompleted || !progress.completed.includes(p.id)));
  }
  function toggle(progress, field, id) {
    if (!['completed', 'favorites'].includes(field)) throw new Error('Unknown progress field');
    const values = new Set(progress[field]);
    values.has(id) ? values.delete(id) : values.add(id);
    return { ...progress, [field]: [...values] };
  }
  function parseHash(hash, data) {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const point = data.points.find(p => p.id === params.get('point')) || null;
    const region = point?.region || (data.regions.some(r => r.id === params.get('region')) ? params.get('region') : data.regions[0].id);
    return { region, point };
  }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  const api = { MAX_IMPORT_BYTES, emptyProgress, validateProgress, filterPoints, toggle, parseHash, clamp };
  root.MapCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
