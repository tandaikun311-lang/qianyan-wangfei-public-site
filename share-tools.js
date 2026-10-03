/* 芊颜王妃分享工具：无外部 CDN，依赖页面加载的本地 vendor/qrcode-generator.js（全局 qrcode）。 */
(function shareToolsModule(global) {
  'use strict';
  const PUBLIC_ORIGIN = 'https://tandaikun.com';
  const PUBLIC_PATH = '/partner/';
  const API_VALIDATE_PATH = 'api/invite/validate';
  const SCENE_PATH = 'assets/brand-scene.webp';
  const state = { link: '', generation: 0, posterBlob: null, sourceCode: '' };

  function qs(selector) { return document.querySelector(selector); }
  function setStatus(message, kind) {
    const node = qs('#shareToolsStatus');
    if (!node) return;
    node.textContent = message || '';
    if (kind) node.dataset.state = kind; else delete node.dataset.state;
  }
  function setBusy(busy) {
    const generate = qs('#shareToolsGenerate');
    const poster = qs('#shareToolsPoster');
    if (generate) { generate.disabled = busy; generate.textContent = busy ? '验证中…' : '生成链接'; }
    if (poster) poster.disabled = busy || !state.link;
  }
  function publicUrl(code, product) {
    const url = new URL(PUBLIC_PATH, PUBLIC_ORIGIN);
    if (code) url.searchParams.set('ref', code);
    if (product) url.searchParams.set('product', product);
    return url.toString();
  }
  function apiUrl() { return new URL(API_VALIDATE_PATH, location.href).toString(); }
  async function validateInvite(code, signal) {
    const response = await fetch(apiUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ code }), credentials: 'same-origin', signal });
    let payload = null;
    try { payload = await response.json(); } catch (_) { payload = null; }
    if (!response.ok) throw new Error((payload && payload.message) || '邀请码校验失败，请稍后再试');
    if (!payload || payload.valid !== true) return { valid: false, message: (payload && payload.message) || '邀请码无效或已失效' };
    return { valid: true };
  }
  function resetOutput() {
    state.link = ''; state.posterBlob = null;
    const url = qs('#shareToolsUrl'); if (url) url.textContent = '';
    const copy = qs('#shareToolsCopy'); if (copy) copy.disabled = true;
    const poster = qs('#shareToolsPoster'); if (poster) poster.disabled = true;
    const download = qs('#shareToolsDownload'); if (download) { download.hidden = true; download.removeAttribute('href'); }
    const preview = qs('#shareToolsPosterPreview'); if (preview) preview.innerHTML = '<div class="share-tools-poster-placeholder"><span aria-hidden="true">✦</span><span>生成链接后预览海报</span></div>';
  }
  function announceLink(link) {
    state.link = link;
    const url = qs('#shareToolsUrl'); if (url) url.textContent = link;
    const copy = qs('#shareToolsCopy'); if (copy) copy.disabled = false;
    const poster = qs('#shareToolsPoster'); if (poster) poster.disabled = false;
  }
  async function generateLink(event) {
    if (event) event.preventDefault();
    const token = ++state.generation;
    const codeNode = qs('#shareToolsCode'); const productNode = qs('#shareToolsProduct');
    const code = (codeNode && codeNode.value || '').trim(); const product = productNode && productNode.value || '';
    resetOutput(); setBusy(true); setStatus(code ? '正在验证邀请码…' : '正在生成公开品牌链接…', 'loading');
    try {
      if (code) {
        const result = await validateInvite(code);
        if (token !== state.generation) return;
        if (!result.valid) throw new Error(result.message);
        state.sourceCode = code;
      } else state.sourceCode = '';
      const link = publicUrl(code || '', product);
      announceLink(link); setStatus(code ? '邀请码验证通过，可以生成海报。' : '公开品牌链接已生成，可以生成海报。', 'success');
    } catch (error) {
      if (token !== state.generation) return;
      setStatus(error && error.name === 'AbortError' ? '已取消。' : (error.message || '生成失败，请稍后再试'), 'error');
    } finally { if (token === state.generation) setBusy(false); }
  }
  async function copyLink() {
    if (!state.link) return;
    try { await navigator.clipboard.writeText(state.link); setStatus('链接已复制。', 'success'); }
    catch (_) {
      const area = document.createElement('textarea'); area.value = state.link; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select();
      let copied = false; try { copied = document.execCommand('copy'); } catch (_) { copied = false; } area.remove();
      setStatus(copied ? '链接已复制。' : '请长按或选中链接复制。', copied ? 'success' : 'error');
    }
  }
  function roundedRect(ctx, x, y, width, height, radius, fill) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, width, height, radius) : ctx.rect(x, y, width, height); ctx.fillStyle = fill; ctx.fill(); }
  function drawCover(ctx, image, y, height) {
    if (!image || !image.naturalWidth) return false;
    const scale = Math.max(1080 / image.naturalWidth, height / image.naturalHeight); const w = image.naturalWidth * scale; const h = image.naturalHeight * scale;
    ctx.drawImage(image, (1080 - w) / 2, y + (height - h) / 2, w, h); return true;
  }
  function drawQr(ctx, link, x, y, size) {
    if (typeof global.qrcode !== 'function') throw new Error('二维码组件未加载，请刷新页面后再试');
    const qr = global.qrcode(0, 'M'); qr.addData(link); qr.make(); const count = qr.getModuleCount(); const cell = size / count;
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 16, y - 16, size + 32, size + 32); ctx.fillStyle = '#122943';
    for (let row = 0; row < count; row += 1) for (let col = 0; col < count; col += 1) if (qr.isDark(row, col)) ctx.fillRect(Math.round(x + col * cell), Math.round(y + row * cell), Math.ceil(cell), Math.ceil(cell));
  }
  function loadScene() {
    return new Promise((resolve) => { const image = new Image(); image.decoding = 'async'; image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = new URL(SCENE_PATH, location.href).toString(); });
  }
  async function renderPoster() {
    if (!state.link) { setStatus('请先生成分享链接。', 'error'); return; }
    const token = state.generation; const button = qs('#shareToolsPoster'); if (button) { button.disabled = true; button.textContent = '海报生成中…'; }
    try {
      const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1600; const ctx = canvas.getContext('2d', { alpha: false });
      const gradient = ctx.createLinearGradient(0, 0, 1080, 1600); gradient.addColorStop(0, '#eaf7ff'); gradient.addColorStop(.55, '#fff'); gradient.addColorStop(1, '#dceeff'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1600);
      const scene = await loadScene(); drawCover(ctx, scene, 0, 530); ctx.fillStyle = 'rgba(10,44,83,.18)'; ctx.fillRect(0, 0, 1080, 530);
      ctx.fillStyle = '#fff'; ctx.font = '700 34px sans-serif'; ctx.fillText('芊颜王妃', 76, 92); ctx.font = '600 17px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText('PARTNER SHARE', 79, 123);
      ctx.fillStyle = '#163b68'; ctx.font = '700 68px "Songti SC", serif'; ctx.fillText('一起分享好状态', 76, 705); ctx.font = '400 31px sans-serif'; ctx.fillStyle = '#56708f'; ctx.fillText('品牌合作中心 · 伙伴专属入口', 80, 765);
      roundedRect(ctx, 74, 835, 932, 146, 22, '#f1f8ff'); ctx.fillStyle = '#35658e'; ctx.font = '400 27px sans-serif'; ctx.fillText('扫码打开品牌合作中心，了解产品与合作流程', 110, 895); ctx.font = '400 23px sans-serif'; ctx.fillStyle = '#7890a8'; ctx.fillText('合作资格、商品与结算以品牌方确认版本为准', 110, 938);
      drawQr(ctx, state.link, 360, 1050, 360); ctx.fillStyle = '#163b68'; ctx.font = '600 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('长按识别二维码', 540, 1485); ctx.font = '400 18px sans-serif'; ctx.fillStyle = '#7b8da1'; ctx.fillText('芊颜王妃品牌合作中心', 540, 1526); ctx.textAlign = 'left';
      if (token !== state.generation) return;
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')); if (!blob) throw new Error('海报图片生成失败'); state.posterBlob = blob;
      const preview = qs('#shareToolsPosterPreview'); if (preview) { preview.innerHTML = ''; const image = document.createElement('img'); image.src = dataUrl; image.alt = '芊颜王妃品牌合作分享海报，含可扫描二维码'; preview.appendChild(image); }
      const download = qs('#shareToolsDownload'); if (download) { download.href = dataUrl; download.hidden = false; }
      setStatus('海报已生成，可下载或在手机上长按保存。', 'success');
    } catch (error) { setStatus(error.message || '海报生成失败，请稍后再试。', 'error'); }
    finally { if (button) { button.disabled = !state.link; button.textContent = '生成海报'; } }
  }
  async function validateSourceRef() {
    const params = new URLSearchParams(location.search); const ref = (params.get('ref') || '').trim();
    if (!ref) return;
    const input = qs('#shareToolsCode'); if (input) input.value = ref;
    setStatus('正在验证来源邀请码…', 'loading');
    try { const result = await validateInvite(ref); if (result.valid) setStatus('已识别有效伙伴来源，可直接生成链接。', 'success'); else setStatus('来源邀请码已失效，请使用公开链接或联系品牌方。', 'error'); }
    catch (_) { setStatus('来源邀请码暂时无法验证，请稍后重试。', 'error'); }
  }
  function init() {
    const form = qs('#shareToolsForm'); if (!form) return;
    form.addEventListener('submit', generateLink); qs('#shareToolsCopy')?.addEventListener('click', copyLink); qs('#shareToolsPoster')?.addEventListener('click', renderPoster);
    qs('#shareToolsCode')?.addEventListener('input', () => { state.generation += 1; resetOutput(); if (!qs('#shareToolsCode').value.trim()) setStatus('', ''); });
    qs('#shareToolsProduct')?.addEventListener('change', () => { if (state.link) { const code = state.sourceCode; announceLink(publicUrl(code, qs('#shareToolsProduct').value)); resetOutput(); announceLink(publicUrl(code, qs('#shareToolsProduct').value)); } });
    validateSourceRef();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  global.ShareTools = { generateLink, renderPoster, validateInvite, resetOutput };
}(window));
