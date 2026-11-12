(() => {
  'use strict';
  const D = window.MapData, C = window.MapCore;
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'mistvale-original-template-progress-v1';
  const NS = 'http://www.w3.org/2000/svg';
  const initial = C.parseHash(location.hash, D);
  let progress = C.emptyProgress(), storageMode = 'ok', selected = initial.point?.id || null;
  let filters = { region: initial.region, query: '', categories: new Set(D.categories.map(c => c.id)), favoritesOnly: false, hideCompleted: false };
  let camera = { x: 0, y: 0, width: 1100, height: 700 }, toastTimer, suppressClick = 0;
  const category = id => D.categories.find(c => c.id === id);
  const activeRoute = () => D.routes.find(r => r.region === filters.region);
  const pointById = id => D.points.find(p => p.id === id);
  function el(tag, text, cls) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; }
  function svgEl(tag, attributes) { const node = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attributes)) node.setAttribute(k, v); return node; }
  function notify(message) { $('notification').textContent = message; $('notification').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('notification').hidden = true; }, 4500); }
  function loadProgress() {
    try { const raw = localStorage.getItem(STORAGE_KEY); progress = raw ? C.validateProgress(JSON.parse(raw), D.points) : C.emptyProgress(); storageMode = 'ok'; }
    catch (error) { progress = C.emptyProgress(); storageMode = error instanceof SyntaxError || error.message.includes('进度') || error.message.includes('文件') ? 'invalid' : 'unavailable'; }
    storageNotice();
  }
  function storageNotice() {
    const messages = { ok: '进度仅保存在此浏览器', unavailable: '存储不可用：仅暂存内存，请及时导出', invalid: '旧数据无法读取：请导入备份或确认清空', failed: '保存失败：当前更改仅在内存，请导出' };
    $('storage-status').textContent = messages[storageMode];
    $('storage-status').parentElement.classList.toggle('storage-warning', storageMode !== 'ok');
  }
  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); storageMode = 'ok'; }
    catch { storageMode = 'failed'; notify('浏览器未保存进度。请导出备份后再关闭页面。'); }
    storageNotice();
  }
  function changeProgress(field, id) {
    if (storageMode === 'invalid') { notify('旧数据无法读取。请先导入备份或明确清空，避免覆盖。'); return; }
    progress = C.toggle(progress, field, id); saveProgress(); render();
  }
  function syncHash(id = selected) {
    const params = new URLSearchParams({ region: filters.region }); if (id) params.set('point', id);
    const hash = '#' + params.toString();
    if (location.hash !== hash) history.pushState(null, '', hash);
  }
  function resetCamera() { camera = { x: 0, y: 0, width: 1100, height: 700 }; applyCamera(); }
  function applyCamera() {
    camera.x = C.clamp(camera.x, -camera.width * .7, 1100 - camera.width * .3);
    camera.y = C.clamp(camera.y, -camera.height * .7, 700 - camera.height * .3);
    $('map').setAttribute('viewBox', `${camera.x} ${camera.y} ${camera.width} ${camera.height}`);
    $('zoom-label').textContent = Math.round(1100 / camera.width * 100) + '%';
    resizeMarkers();
  }
  function resizeMarkers() {
    const matrix = $('map').getScreenCTM(); if (!matrix?.a) return;
    for (const marker of $('marker-layer').children) { const point = pointById(marker.dataset.id); marker.setAttribute('transform', `translate(${point.x} ${point.y}) scale(${.85 / matrix.a})`); }
  }
  function zoom(factor, anchor) {
    const width = C.clamp(camera.width / factor, 300, 1650), height = width * 700 / 1100;
    const a = anchor || { x: camera.x + camera.width / 2, y: camera.y + camera.height / 2 };
    const rx = (a.x - camera.x) / camera.width, ry = (a.y - camera.y) / camera.height;
    camera = { x: a.x - rx * width, y: a.y - ry * height, width, height }; applyCamera();
  }
  function focusPoint(point) { camera.x = point.x - camera.width / 2; camera.y = point.y - camera.height / 2; applyCamera(); }
  function resetFilters() {
    filters.query = ''; filters.categories = new Set(D.categories.map(c => c.id)); filters.favoritesOnly = false; filters.hideCompleted = false;
    $('search').value = ''; $('favorites-only').checked = false; $('hide-completed').checked = false;
    for (const input of $('categories').querySelectorAll('input')) input.checked = true;
  }
  function selectPoint(id, options = {}) {
    const point = pointById(id); if (!point) return;
    if (point.region !== filters.region) { filters.region = point.region; resetFilters(); resetCamera(); }
    if (options.clearFilters) resetFilters();
    selected = id; syncHash(); render();
    if (options.center) focusPoint(point);
    if (options.focusDetail) { $('point-detail').setAttribute('tabindex', '-1'); $('point-detail').focus({ preventScroll: true }); }
  }
  function createAction(text, className, handler) { const b = el('button', text, className); b.type = 'button'; b.addEventListener('click', handler); return b; }
  function renderList(visible) {
    $('point-list').replaceChildren(); $('visible-count').textContent = `${visible.length} / ${D.points.filter(p => p.region === filters.region).length}`;
    if (!visible.length) { const li = el('li', undefined, 'empty-state'); li.append(el('strong', '没有匹配的点位'), el('p', '试试清空关键词，或重置筛选。')); $('point-list').append(li); return; }
    for (const point of visible) {
      const row = el('li'), done = progress.completed.includes(point.id), cat = category(point.category);
      const button = createAction('', `point-row${point.id === selected ? ' is-active' : ''}`, () => selectPoint(point.id, { center: true }));
      button.setAttribute('aria-pressed', String(selected === point.id));
      const icon = el('span', done ? '✓' : cat.symbol, `point-icon category-${point.category}`); icon.setAttribute('aria-hidden', 'true');
      const words = el('span', undefined, 'point-words'); words.append(el('strong', point.title), el('small', cat.label + (done ? ' · 已探索' : '')));
      button.append(icon, words); if (progress.favorites.includes(point.id)) { const star = el('span', '★', 'favorite-star'); star.setAttribute('aria-label', '已收藏'); button.append(star); }
      row.append(button); $('point-list').append(row);
    }
  }
  function renderMap(visible) {
    const image = D.regions.find(r => r.id === filters.region).image;
    if ($('map-art').getAttribute('href') !== image) $('map-art').setAttribute('href', image);
    $('marker-layer').replaceChildren(); $('route-layer').replaceChildren();
    const route = activeRoute();
    if ($('show-route').checked && route) {
      $('route-layer').append(svgEl('polyline', { points: route.points.map(id => { const p = pointById(id); return p.x + ',' + p.y; }).join(' '), class: 'route-line-under' }));
      $('route-layer').append(svgEl('polyline', { points: route.points.map(id => { const p = pointById(id); return p.x + ',' + p.y; }).join(' '), class: 'route-line' }));
    }
    for (const point of visible) {
      const done = progress.completed.includes(point.id), cat = category(point.category);
      const g = svgEl('g', { transform: `translate(${point.x} ${point.y})`, role: 'button', tabindex: '0', 'aria-label': `${point.title}，${cat.label}${done ? '，已探索' : ''}`, 'aria-pressed': String(point.id === selected), 'data-id': point.id, class: `map-marker category-${point.category}${point.id === selected ? ' is-selected' : ''}${done ? ' is-done' : ''}` });
      g.append(svgEl('circle', { r: 23, class: 'marker-halo' }), svgEl('circle', { r: 16, class: 'marker-face' }));
      const symbol = svgEl('text', { y: 6, 'text-anchor': 'middle', class: 'marker-symbol', 'aria-hidden': 'true' }); symbol.textContent = done ? '✓' : cat.symbol; g.append(symbol);
      const label = svgEl('text', { y: 36, 'text-anchor': 'middle', class: 'marker-label', 'aria-hidden': 'true' }); label.textContent = point.title; g.append(label);
      $('marker-layer').append(g);
    }
    resizeMarkers();
  }
  function renderRoute() {
    const route = activeRoute(); $('route-title').textContent = route.title; $('route-description').textContent = route.description;
    const done = route.points.filter(id => progress.completed.includes(id)).length;
    $('route-count').textContent = storageMode === 'invalid' ? '进度未知' : `${done} / ${route.points.length} 已探索`;
    $('route-steps').replaceChildren();
    route.points.forEach((id, index) => {
      const point = pointById(id), li = el('li');
      const button = createAction('', `route-step${selected === id ? ' is-active' : ''}${progress.completed.includes(id) ? ' is-done' : ''}`, () => selectPoint(id, { clearFilters: true, center: true }));
      button.setAttribute('aria-pressed', String(selected === id));
      button.append(el('span', progress.completed.includes(id) ? '✓' : String(index + 1), 'step-number'), el('span', point.title)); li.append(button); $('route-steps').append(li);
    });
  }
  function renderDetail() {
    const panel = $('point-detail'); panel.replaceChildren(); const point = pointById(selected);
    $('mobile-detail-link').hidden = !point || point.region !== filters.region;
    if (point) $('mobile-detail-link').textContent = point.title + ' · 查看线索与进度';
    if (!point || point.region !== filters.region) {
      panel.append(el('div', '⌖', 'detail-empty-mark'), el('h2', '从一处地标开始'), el('p', '选择地图上的标记，或点开左侧图鉴。每个点位都有线索与行进步骤。', 'detail-empty-copy'));
      panel.append(createAction('从推荐路线出发', 'primary-button', () => selectPoint(activeRoute().points[0], { clearFilters: true, center: true })));
      return;
    }
    const cat = category(point.category), done = progress.completed.includes(point.id), saved = progress.favorites.includes(point.id);
    panel.append(el('span', `${cat.symbol} ${cat.label}`, `detail-category category-${point.category}`));
    const title = el('h2', point.title); title.id = 'detail-title'; panel.append(title, el('p', point.summary, 'detail-summary'));
    const actions = el('div', undefined, 'detail-actions');
    const complete = createAction(done ? '✓ 已探索，点击撤销' : '标记为已探索', 'primary-button', () => changeProgress('completed', point.id)); complete.setAttribute('aria-pressed', String(done)); complete.disabled = storageMode === 'invalid';
    const favorite = createAction(saved ? '★ 已收藏' : '☆ 收藏', 'quiet-button', () => changeProgress('favorites', point.id)); favorite.setAttribute('aria-pressed', String(saved)); favorite.disabled = storageMode === 'invalid'; actions.append(complete, favorite); panel.append(actions);
    panel.append(el('h3', '行进线索')); const list = el('ol', undefined, 'guide-steps'); for (const step of point.guide) list.append(el('li', step)); panel.append(list, el('p', point.note, 'detail-note'));
    const route = activeRoute(), index = route.points.indexOf(point.id), nav = el('div', undefined, 'detail-nav');
    if (index >= 0) {
      const previous = createAction('上一处', 'text-button', () => selectPoint(route.points[index - 1], { clearFilters: true, center: true })); previous.disabled = index === 0;
      const next = createAction('下一处', 'text-button', () => selectPoint(route.points[index + 1], { clearFilters: true, center: true })); next.disabled = index === route.points.length - 1; nav.append(previous, next);
    }
    nav.append(createAction('定位地图', 'text-button', () => { resetFilters(); render(); focusPoint(point); $('map').focus({ preventScroll: true }); $('map').scrollIntoView({ block: 'center' }); })); panel.append(nav);
  }
  function render() {
    const region = D.regions.find(r => r.id === filters.region), points = D.points.filter(p => p.region === filters.region), visible = C.filterPoints(D.points, filters, progress);
    $('region-select').value = filters.region; $('region-title').textContent = region.name; $('region-subtitle').textContent = region.subtitle;
    const completed = points.filter(p => progress.completed.includes(p.id)).length;
    $('progress-number').replaceChildren(document.createTextNode(storageMode === 'invalid' ? '?' : String(completed)), el('small', ` / ${points.length}`));
    $('region-progress').max = points.length; $('region-progress').value = completed;
    if (storageMode === 'invalid') $('region-progress').removeAttribute('value');
    $('progress-caption').textContent = storageMode === 'invalid' ? '无法读取旧记录，并不表示未完成。' : completed === points.length ? '本区已探索完毕，再出发去另一片天地。' : `还有 ${points.length - completed} 处风景，等你发现。`;
    renderList(visible); renderMap(visible); renderRoute(); renderDetail();
  }
  for (const region of D.regions) $('region-select').append(new Option(region.name, region.id));
  for (const cat of D.categories) {
    const label = el('label', undefined, `category-chip category-${cat.id}`), input = el('input'); input.type = 'checkbox'; input.value = cat.id; input.checked = true;
    input.addEventListener('change', () => { input.checked ? filters.categories.add(cat.id) : filters.categories.delete(cat.id); render(); });
    label.append(input, el('span', cat.symbol + ' ' + cat.label)); $('categories').append(label);
  }
  $('region-select').addEventListener('change', () => { filters.region = $('region-select').value; selected = null; resetFilters(); resetCamera(); syncHash(); render(); });
  $('search').addEventListener('input', () => { filters.query = $('search').value; render(); });
  $('favorites-only').addEventListener('change', event => { filters.favoritesOnly = event.target.checked; render(); });
  $('hide-completed').addEventListener('change', event => { filters.hideCompleted = event.target.checked; render(); });
  $('reset-filters').addEventListener('click', () => { resetFilters(); render(); });
  $('show-route').addEventListener('change', render);
  $('zoom-in').addEventListener('click', () => zoom(1.3)); $('zoom-out').addEventListener('click', () => zoom(1 / 1.3)); $('reset-view').addEventListener('click', resetCamera);
  function screenPoint(event) { return new DOMPoint(event.clientX, event.clientY).matrixTransform($('map').getScreenCTM().inverse()); }
  $('map').addEventListener('wheel', event => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, screenPoint(event)); }, { passive: false });
  let drag = null;
  $('map').addEventListener('pointerdown', event => { if (!event.isPrimary || event.button !== 0) return; drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false }; });
  $('map').addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) { drag.moved = true; $('map').setPointerCapture(event.pointerId); }
    if (drag.moved) { const matrix = $('map').getScreenCTM(); camera.x -= (event.clientX - drag.lastX) / matrix.a; camera.y -= (event.clientY - drag.lastY) / matrix.d; applyCamera(); }
    drag.lastX = event.clientX; drag.lastY = event.clientY;
  });
  function stopDrag(event) { if (!drag) return; if (drag.moved) suppressClick = Date.now() + 250; if ($('map').hasPointerCapture(event.pointerId)) $('map').releasePointerCapture(event.pointerId); drag = null; }
  $('map').addEventListener('pointerup', stopDrag); $('map').addEventListener('pointercancel', stopDrag); $('map').addEventListener('pointerleave', event => { if (drag && !drag.moved) stopDrag(event); });
  $('map').addEventListener('click', event => { if (Date.now() < suppressClick) return; const marker = event.target.closest('[data-id]'); if (marker) selectPoint(marker.dataset.id); });
  $('map').addEventListener('keydown', event => {
    const marker = event.target.closest('[data-id]');
    if (marker && ['Enter', ' '].includes(event.key)) { event.preventDefault(); selectPoint(marker.dataset.id, { focusDetail: true }); return; }
    const step = camera.width * .08;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) { event.preventDefault(); camera.x += moves[event.key][0]; camera.y += moves[event.key][1]; applyCamera(); }
    else if (['+', '=', '-', '0'].includes(event.key)) { event.preventDefault(); event.key === '0' ? resetCamera() : zoom(event.key === '-' ? 1 / 1.3 : 1.3); }
  });
  window.addEventListener('popstate', () => { const next = C.parseHash(location.hash, D); filters.region = next.region; selected = next.point?.id || null; resetFilters(); resetCamera(); render(); if (next.point) focusPoint(next.point); });
  window.addEventListener('storage', event => { if (event.key !== STORAGE_KEY && event.key !== null) return; loadProgress(); render(); notify('已重新读取其他窗口的进度。'); });
  window.addEventListener('resize', resizeMarkers);
  $('export-progress').addEventListener('click', () => {
    if (storageMode === 'invalid') { notify('旧数据无法读取，不能将未知进度导出为空记录。'); return; }
    const blob = new Blob([JSON.stringify({ ...progress, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = 'progress-mistvale.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); notify('已请求下载进度文件。请确认浏览器下载完成。');
  });
  $('import-progress').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > C.MAX_IMPORT_BYTES) throw new Error('文件过大，请使用小于 100 KB 的本模板进度文件。');
      const imported = C.validateProgress(JSON.parse(await file.text()), D.points);
      if (!confirm(`将用此文件替换全部区域的演示进度：${imported.completed.length} 个已探索，${imported.favorites.length} 个收藏。是否继续？`)) return;
      progress = imported; saveProgress(); render(); notify(storageMode === 'ok' ? '已导入并保存进度。' : '已导入，但浏览器保存失败，请保留原备份。');
    } catch (error) { notify(error instanceof SyntaxError ? '这不是有效的 JSON 文件，未改动现有进度。' : error.message); }
  });
  $('clear-progress').addEventListener('click', () => {
    if (!confirm('将清空这个模板全部区域的探索与收藏记录，不影响其他网站。此操作不可撤销；需要保留时请先导出。确认清空？')) return;
    progress = C.emptyProgress(); saveProgress(); render(); notify(storageMode === 'ok' ? '已清空本模板全部区域的进度。' : '仅清空了内存中的进度，浏览器存储未更新。');
  });
  $('help-open').addEventListener('click', () => $('help-dialog').showModal()); $('help-close').addEventListener('click', () => $('help-dialog').close());
  $('mobile-detail-link').addEventListener('click', () => { $('point-detail').setAttribute('tabindex', '-1'); $('point-detail').focus(); $('point-detail').scrollIntoView({ block: 'start' }); });
  $('map-art').addEventListener('error', () => notify('地图图片未能加载。请确认 assets 文件夹与 index.html 一同保留。'));
  loadProgress(); render(); if (initial.point) focusPoint(initial.point);
})();
