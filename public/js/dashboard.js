'use strict';

let currentReports = [];
let currentFilter  = 'all';

const reportList   = document.getElementById('reportList');
const statTotal    = document.getElementById('statTotal');
const statUrgent   = document.getElementById('statUrgent');
const statNormal   = document.getElementById('statNormal');
const statResolved = document.getElementById('statResolved');
const tabs         = document.querySelectorAll('.tab');
const lightbox          = document.getElementById('lightbox');
const lightboxImg       = document.getElementById('lightboxImg');
const lightboxDownload  = document.getElementById('lightboxDownload');

// --- Clock ---
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('ar-SA', { hour12: false });
}
updateClock();
setInterval(updateClock, 1000);

// --- Arabic relative time ---
function timeAgo(dateString) {
  if (!dateString) return '';
  const normalized = String(dateString).replace(' ', 'T').replace(/Z?$/, 'Z');
  const diff = (Date.now() - new Date(normalized)) / 1000;
  if (diff < 60)    return 'الآن';
  if (diff < 3600)  return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

// --- Animated count-up ---
function animateCount(el, target) {
  const start     = parseInt(el.textContent) || 0;
  const startTime = performance.now();
  const duration  = 600;
  function step(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// --- Fetch stats ---
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const d = await res.json();
    animateCount(statTotal,    d.today_total);
    animateCount(statUrgent,   d.urgent_open);
    animateCount(statNormal,   d.normal_open);
    animateCount(statResolved, d.resolved_today);
  } catch (err) {
    console.error('Stats fetch failed:', err);
  }
}

// --- Fetch reports ---
async function fetchReports() {
  try {
    const res = await fetch('/api/reports?status=all');
    if (!res.ok) return;
    currentReports = await res.json();
    renderList();
  } catch (err) {
    console.error('Reports fetch failed:', err);
  }
}

// --- Filter ---
function filtered() {
  if (currentFilter === 'urgent')   return currentReports.filter(r => r.priority === 'urgent'  && r.status === 'open');
  if (currentFilter === 'normal')   return currentReports.filter(r => r.priority === 'normal'  && r.status === 'open');
  if (currentFilter === 'resolved') return currentReports.filter(r => r.status === 'resolved');
  return currentReports;
}

// --- Render ---
function renderList() {
  const list = filtered();
  if (list.length === 0) {
    reportList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>لا توجد بلاغات تطابق الفلتر</p>
      </div>`;
    return;
  }

  reportList.innerHTML = list.map(buildCard).join('');

  reportList.querySelectorAll('.btn-resolve').forEach(btn => {
    btn.addEventListener('click', () => resolveReport(btn.dataset.id, btn));
  });
  reportList.querySelectorAll('.btn-close').forEach(btn => {
    btn.addEventListener('click', () => closeReport(btn.dataset.id, btn));
  });
  reportList.querySelectorAll('.thumb').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
}

// --- Build card HTML ---
function buildCard(r) {
  const urgent    = r.priority === 'urgent';
  const resolved  = r.status  === 'resolved';
  const closed    = r.status  === 'closed';
  const inactive  = resolved || closed;

  const priClass  = urgent ? 'priority-urgent' : 'priority-normal';
  const stClass   = inactive ? 'status-resolved' : '';

  const badgeCls  = closed ? 'badge-closed' : (resolved ? 'badge-resolved' : (urgent ? 'badge-urgent' : 'badge-normal'));
  const badgeTxt  = closed ? '⛔ تم الإغلاق' : (resolved ? '✅ تم الحل' : (urgent ? '⚡ عاجل' : '🟡 عادي'));

  const photoHtml = r.photo_path ? `
    <div class="card-photo">
      <img src="${esc(r.photo_path)}" alt="صورة المنتج" class="thumb" loading="lazy">
    </div>` : '';

  const actionsHtml = resolved ? `
    <div class="card-resolved-label">✅ تم الحل · ${timeAgo(r.resolved_at)}</div>` :
    closed ? `
    <div class="card-resolved-label">⛔ تم الإغلاق · ${timeAgo(r.closed_at)}</div>` : `
    <div class="card-actions">
      <button class="btn-close" data-id="${r.id}" aria-label="إغلاق البلاغ">✕ إغلاق</button>
      <button class="btn-resolve" data-id="${r.id}" aria-label="تحديد البلاغ كمحلول">تم الحل ✅</button>
    </div>`;

  return `
    <article class="report-card ${priClass} ${stClass}" data-id="${r.id}">

      <div class="card-header">
        <span class="badge ${badgeCls}">${badgeTxt}</span>
        <div class="card-header-end">
          <span class="card-time">${timeAgo(r.created_at)}</span>
        </div>
      </div>

      <h2 class="product-name">${esc(r.product)}</h2>

      <div class="card-worker">👤 ${esc(r.worker_name)}</div>

      ${photoHtml}

      <div class="card-footer">
        <div class="card-quantity">
          <span class="qty-label">📦 الكمية الناقصة</span>
          <strong class="qty-value">${r.quantity}</strong>
        </div>
        ${actionsHtml}
      </div>

    </article>`;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Close ---
async function closeReport(id, btn) {
  if (!confirm('هل تريد إغلاق هذا البلاغ؟')) return;
  btn.disabled = true;
  try {
    const res = await fetch(`/api/reports/${id}/close`, { method: 'PATCH' });
    if (!res.ok) throw new Error();
    const report = currentReports.find(r => r.id == id);
    if (report) {
      report.status   = 'closed';
      report.closed_at = new Date().toISOString().replace('Z','');
    }
    renderList();
    fetchStats();
    showToast('تم إغلاق البلاغ ⛔', 'success');
  } catch {
    btn.disabled = false;
    showToast('فشل الإغلاق، حاول مجدداً', 'error');
  }
}

// --- Resolve ---
async function resolveReport(id, btn) {
  btn.disabled = true;
  try {
    const res  = await fetch(`/api/reports/${id}/resolve`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'خطأ');

    // Update in-memory, animate card out
    const report = currentReports.find(r => r.id == id);
    if (report) {
      report.status      = 'resolved';
      report.resolved_at = new Date().toISOString();
    }

    const card = reportList.querySelector(`.report-card[data-id="${id}"]`);
    if (card) {
      card.classList.add('card-fade-out');
      card.addEventListener('animationend', () => {
        card.remove();
        fetchStats();
        if (filtered().length === 0) renderList();
      }, { once: true });
    }

    showToast('تم الحل بنجاح ✅', 'success');
  } catch (err) {
    btn.disabled = false;
    btn.classList.add('btn-shake');
    btn.addEventListener('animationend', () => btn.classList.remove('btn-shake'), { once: true });
    showToast('حدث خطأ، حاول مجدداً', 'error');
    console.error('Resolve failed:', err);
  }
}

// --- Filter tabs ---
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    currentFilter = tab.dataset.filter;
    renderList();
  });
});

// --- Lightbox ---
function openLightbox(src) {
  lightboxImg.src = src;
  lightboxDownload.href = src;
  lightboxDownload.download = src.split('/').pop();
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.src = '';
}

document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightboxBackdrop').addEventListener('click', closeLightbox);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lightbox.hidden) closeLightbox(); });

// --- Toast ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Init & auto-refresh ---
async function refresh() {
  await Promise.all([fetchStats(), fetchReports()]);
}

refresh();
setInterval(refresh, 30_000);
