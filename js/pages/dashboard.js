/**
 * dashboard.js — Owner Dashboard (M9)
 * Widgets: 5-KPI strip (with WoW + drill-downs), revenue bar chart,
 *          category donut, staff leaderboard, birthdays, top services.
 * Auto-refreshes every 5 minutes; all widgets open detail slideovvers.
 */

import { registerRoute }    from '../router.js';
import { currentUser }      from '../auth.js';
import { openSlideover }    from '../components/slideover.js';
import {
  getDashboardKPIs,
  getRevenueByDay,
  getRevenueByCategoryForRange,
  getStaffLeaderboard,
  getUpcomingBirthdays,
  getInvoicesByDateRange,
  getLapsedCustomers,
  getTopServicesForRange,
  getStaffPerformance,
} from '../db.js';
import db from '../db.js';

registerRoute('/dashboard', _renderDashboard);

const BIRTHDAY_DAYS_AHEAD = 10;

// ── Module state ───────────────────────────────────────────────────────────────

let _range        = '30d';
let _customFrom   = '';
let _customTo     = '';
let _revenueChart = null;
let _donutChart   = null;
let _refreshTimer = null;

// Cached data — updated in _loadData, read in click handlers
let _staffData  = [];
let _lapsedData = [];
let _catData    = [];
let _topSvcData = [];
let _dr         = { start: '', end: '' };

// ── Page render ────────────────────────────────────────────────────────────────

async function _renderDashboard() {
  _stopRefresh();
  _range = '30d'; _customFrom = ''; _customTo = '';
  _destroyCharts();

  const content = document.getElementById('page-content');
  if (!content) return;

  const user      = currentUser();
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const dateStr   = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  content.innerHTML = `
    <div class="dashboard-page">

      <div class="dashboard-page__header">
        <div>
          <div class="dashboard-page__greeting">Good ${_tod()}, ${_esc(firstName)}!</div>
          <div class="dashboard-page__date">${dateStr}</div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--sp-3);flex-wrap:wrap;">
          <span id="dash-updated" style="font-size:var(--text-xs);color:var(--clr-text-muted);"></span>
          <button class="btn btn--ghost btn--sm" id="dash-refresh-btn" title="Refresh data">
            <i data-lucide="refresh-cw"></i>
          </button>
          <div class="dashboard-filter" id="dash-filter">
            <button class="dashboard-filter__btn" data-range="1d">Today</button>
            <button class="dashboard-filter__btn" data-range="7d">7 Days</button>
            <button class="dashboard-filter__btn active" data-range="30d">30 Days</button>
            <button class="dashboard-filter__btn" data-range="month">This Month</button>
            <button class="dashboard-filter__btn" data-range="custom">Custom</button>
          </div>
        </div>
      </div>

      <div id="custom-bar" style="display:none;align-items:center;gap:var(--sp-3);flex-wrap:wrap;">
        <label style="font-size:var(--text-xs);color:var(--clr-text-secondary);">From</label>
        <input class="form-input" id="custom-from" type="date" style="width:150px;" />
        <label style="font-size:var(--text-xs);color:var(--clr-text-secondary);">To</label>
        <input class="form-input" id="custom-to"   type="date" style="width:150px;" />
        <button class="btn btn--primary btn--sm" id="apply-custom">Apply</button>
      </div>

      <div class="kpi-strip" id="kpi-strip">
        ${[1,2,3,4,5].map(n => `
          <div class="kpi-card">
            <div class="kpi-card__icon kpi-card__icon--${n}">
              <div class="skeleton" style="width:22px;height:22px;border-radius:4px;background:rgba(255,255,255,0.3);"></div>
            </div>
            <div class="kpi-card__body">
              <div class="skeleton" style="width:80px;height:11px;margin-bottom:10px;"></div>
              <div class="skeleton" style="width:100px;height:26px;"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="dashboard-widgets">
        <div class="section-card">
          <div class="section-card__header">
            <div class="section-card__title">Revenue Trend</div>
            <div class="section-card__meta revenue-trend__note">Rolling 30 days — unaffected by filter</div>
          </div>
          <div class="section-card__body">
            <canvas id="revenue-chart" style="max-height:220px;"></canvas>
          </div>
        </div>
        <div class="section-card">
          <div class="section-card__header">
            <div class="section-card__title">Revenue by Category</div>
          </div>
          <div class="section-card__body" style="display:flex;flex-direction:column;align-items:center;gap:16px;">
            <canvas id="donut-chart" style="max-width:180px;max-height:180px;"></canvas>
            <div id="donut-legend" style="width:100%;"></div>
          </div>
        </div>
      </div>

      <div class="dashboard-bottom">
        <div class="section-card">
          <div class="section-card__header"><div class="section-card__title">Staff Leaderboard</div></div>
          <div class="section-card__body" id="leaderboard-body">
            ${[1,2,3,4].map(() => `<div class="skeleton" style="height:44px;margin-bottom:8px;border-radius:8px;"></div>`).join('')}
          </div>
        </div>
        <div class="section-card">
          <div class="section-card__header">
            <div class="section-card__title">Upcoming Birthdays</div>
            <div class="section-card__meta">Next ${BIRTHDAY_DAYS_AHEAD} days</div>
          </div>
          <div class="section-card__body" id="birthdays-body">
            <div class="skeleton" style="height:60px;border-radius:8px;"></div>
          </div>
        </div>
        <div class="section-card">
          <div class="section-card__header"><div class="section-card__title">Top Services</div></div>
          <div class="section-card__body" id="top-services-body">
            <div class="skeleton" style="height:180px;border-radius:8px;"></div>
          </div>
        </div>
      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ nodes: [content] });

  // Date range filter
  document.getElementById('dash-filter')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-range]');
    if (!btn) return;
    _range = btn.dataset.range;
    document.querySelectorAll('#dash-filter .dashboard-filter__btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const bar = document.getElementById('custom-bar');
    if (_range === 'custom') {
      if (bar) bar.style.display = 'flex';
    } else {
      if (bar) bar.style.display = 'none';
      _loadData();
    }
  });

  document.getElementById('apply-custom')?.addEventListener('click', () => {
    const f = document.getElementById('custom-from')?.value;
    const t = document.getElementById('custom-to')?.value;
    if (!f || !t || f > t) return;
    _customFrom = f; _customTo = t;
    _loadData();
  });

  document.getElementById('dash-refresh-btn')?.addEventListener('click', _loadData);

  // KPI drill-downs (stable element, content replaced on each _loadData)
  document.getElementById('kpi-strip')?.addEventListener('click', async e => {
    const card = e.target.closest('[data-kpi]');
    if (card) await _openKpiDrilldown(card.dataset.kpi);
  });

  // Leaderboard row drill-down
  document.getElementById('leaderboard-body')?.addEventListener('click', e => {
    const row = e.target.closest('[data-staff-id]');
    if (!row) return;
    const staff = _staffData.find(s => String(s.id) === row.dataset.staffId);
    if (staff) _openStaffSalesDrilldown(staff);
  });

  // Top service drill-down
  document.getElementById('top-services-body')?.addEventListener('click', async e => {
    const row = e.target.closest('[data-svc]');
    if (row) await _openSvcDrilldown(row.dataset.svc);
  });

  // Category legend drill-down
  document.getElementById('donut-legend')?.addEventListener('click', async e => {
    const row = e.target.closest('[data-cat]');
    if (row) await _openCatDrilldown(row.dataset.cat);
  });

  await _loadData();
  _startRefresh();
}

// ── Data loading ───────────────────────────────────────────────────────────────

async function _loadData() {
  _dr = _getDateRange();
  const { start, end } = _dr;

  // Prior period (same duration ending at current period start) for WoW
  const dur        = new Date(end) - new Date(start);
  const priorEnd   = new Date(start);
  const priorStart = new Date(priorEnd.getTime() - dur);

  const [kpis, priorKpis, revenueByDay, byCategory, leaderboard, birthdays, topSvcs, lapsed] =
    await Promise.all([
      getDashboardKPIs(start, end),
      getDashboardKPIs(priorStart.toISOString(), priorEnd.toISOString()),
      getRevenueByDay(),
      getRevenueByCategoryForRange(start, end),
      getStaffLeaderboard(start, end),
      getUpcomingBirthdays(BIRTHDAY_DAYS_AHEAD),
      _topServices(start, end),
      getLapsedCustomers(45),
    ]);

  // Cache for click handlers
  _staffData  = leaderboard;
  _lapsedData = lapsed;
  _catData    = byCategory;
  _topSvcData = topSvcs;

  _renderKPIs(kpis, priorKpis, leaderboard, lapsed);
  _renderRevenueChart(revenueByDay);
  _renderDonut(byCategory);
  _renderLeaderboard(leaderboard);
  _renderBirthdays(birthdays);
  _renderTopServices(topSvcs);

  const el = document.getElementById('dash-updated');
  if (el) el.textContent = `Updated ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

// ── Date range helper ──────────────────────────────────────────────────────────

function _getDateRange() {
  if (_range === 'custom' && _customFrom && _customTo) {
    return {
      start: new Date(_customFrom + 'T00:00:00').toISOString(),
      end:   new Date(_customTo   + 'T23:59:59').toISOString(),
    };
  }
  const end   = new Date();
  const start = new Date();
  if      (_range === '1d')    { start.setHours(0, 0, 0, 0); }
  else if (_range === '7d')    { start.setDate(start.getDate() - 7); }
  else if (_range === 'month') { start.setDate(1); start.setHours(0, 0, 0, 0); }
  else                         { start.setDate(start.getDate() - 30); }
  return { start: start.toISOString(), end: end.toISOString() };
}

// ── Top services query ─────────────────────────────────────────────────────────

async function _topServices(startDate, endDate) {
  return getTopServicesForRange(startDate, endDate);
}

// ── Widget renders ─────────────────────────────────────────────────────────────

function _renderKPIs(kpis, priorKpis, leaderboard, lapsed) {
  const el = document.getElementById('kpi-strip');
  if (!el) return;

  const topStaff = leaderboard[0];

  const wowPct = (curr, prior) => {
    if (!prior) return `<span style="font-size:var(--text-xs);color:var(--clr-text-muted);">—</span>`;
    const pct = Math.abs(((curr - prior) / prior * 100)).toFixed(0);
    const up  = curr >= prior;
    return `<span style="font-size:var(--text-xs);font-weight:600;color:${up ? 'var(--clr-success)' : 'var(--clr-danger)'};">${up ? '↑' : '↓'} ${pct}% WoW</span>`;
  };

  const wowAbs = (curr, prior) => {
    const diff = curr - prior;
    if (diff === 0) return `<span style="font-size:var(--text-xs);color:var(--clr-text-muted);">No change</span>`;
    const up = diff > 0;
    return `<span style="font-size:var(--text-xs);font-weight:600;color:${up ? 'var(--clr-success)' : 'var(--clr-danger)'};">${up ? '+' : ''}${diff} vs prior</span>`;
  };

  const cards = [
    {
      icon: 'indian-rupee', label: 'Total Revenue',      slot: 1, kpi: 'revenue',
      value: _fmt(kpis.revenue),
      sub:   wowPct(kpis.revenue, priorKpis.revenue),
    },
    {
      icon: 'users',        label: 'Customers Served',   slot: 2, kpi: 'customers',
      value: kpis.customers,
      sub:   wowAbs(kpis.customers, priorKpis.customers),
    },
    {
      icon: 'trending-up',  label: 'Avg Invoice (ATV)',  slot: 3, kpi: 'atv',
      value: kpis.customers ? _fmt(kpis.avgInvoice) : '—',
      sub:   wowPct(kpis.avgInvoice, priorKpis.avgInvoice),
    },
    {
      icon: 'user-x',       label: 'Lapsed Customers',   slot: 4, kpi: 'lapsed',
      value: lapsed.length,
      sub:   `<span style="font-size:var(--text-xs);color:var(--clr-text-muted);">45-day threshold</span>`,
    },
    {
      icon: 'award',        label: 'Top Performer',      slot: 5, kpi: 'topStaff',
      value: topStaff ? _esc(topStaff.name.split(' ')[0]) : '—',
      sub:   topStaff
        ? `<span style="font-size:var(--text-xs);color:var(--clr-text-muted);">${_fmt(topStaff.totalRevenue)} · ${topStaff.serviceCount} svcs</span>`
        : `<span style="font-size:var(--text-xs);color:var(--clr-text-muted);">No data</span>`,
    },
  ];

  el.innerHTML = cards.map(c => `
    <div class="kpi-card" data-kpi="${c.kpi}" style="cursor:pointer;" title="Click for details">
      <div class="kpi-card__icon kpi-card__icon--${c.slot}"><i data-lucide="${c.icon}"></i></div>
      <div class="kpi-card__body">
        <div class="kpi-card__label">${c.label}</div>
        <div class="kpi-card__value">${c.value}</div>
        <div style="margin-top:var(--sp-1);">${c.sub}</div>
      </div>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons({ nodes: [el] });
}

function _renderRevenueChart(data) {
  const canvas = document.getElementById('revenue-chart');
  if (!canvas || !window.Chart) return;
  if (_revenueChart) { _revenueChart.destroy(); _revenueChart = null; }

  const todayStr = new Date().toISOString().split('T')[0];

  _revenueChart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d =>
        new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      ),
      datasets: [{
        label: 'Revenue',
        data: data.map(d => d.revenue),
        backgroundColor: data.map(d => d.date === todayStr ? '#7c3aed' : 'rgba(124,58,237,0.25)'),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => '₹' + ctx.parsed.y.toLocaleString('en-IN') } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#9ca3af', maxRotation: 0 } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            font: { size: 10 }, color: '#9ca3af',
            callback: v => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
          },
        },
      },
    },
  });
}

const _DONUT_COLORS = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#f43f5e','#8b5cf6'];

function _renderDonut(data) {
  const canvas = document.getElementById('donut-chart');
  const legend = document.getElementById('donut-legend');
  if (!canvas || !window.Chart) return;
  if (_donutChart) { _donutChart.destroy(); _donutChart = null; }

  if (!data.length) {
    if (legend) legend.innerHTML = `<p style="font-size:var(--text-sm);color:var(--clr-text-muted);text-align:center;">No data for this period.</p>`;
    return;
  }

  const total = data.reduce((s, d) => s + d.revenue, 0);

  _donutChart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        data: data.map(d => d.revenue),
        backgroundColor: _DONUT_COLORS.slice(0, data.length),
        borderWidth: 2, borderColor: '#fff',
      }],
    },
    options: {
      responsive: true, cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ₹${ctx.parsed.toLocaleString('en-IN')}` } },
      },
      onClick: (evt, elements) => {
        if (elements.length) _openCatDrilldown(_catData[elements[0].index]?.name);
      },
    },
  });

  if (legend) {
    legend.innerHTML = data.map((d, i) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;" data-cat="${_esc(d.name)}">
        <span style="width:10px;height:10px;border-radius:50%;background:${_DONUT_COLORS[i]};flex-shrink:0;"></span>
        <span style="font-size:var(--text-xs);color:var(--clr-text-secondary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(d.name)}</span>
        <span style="font-size:var(--text-xs);font-weight:600;color:var(--clr-text-primary);">${_fmt(d.revenue)}</span>
        <span style="font-size:var(--text-xs);color:var(--clr-text-muted);">${total ? Math.round(d.revenue / total * 100) : 0}%</span>
      </div>
    `).join('');
  }
}

function _renderLeaderboard(staffList) {
  const el = document.getElementById('leaderboard-body');
  if (!el) return;

  if (!staffList.length) {
    el.innerHTML = `<p style="font-size:var(--text-sm);color:var(--clr-text-muted);">No data for this period.</p>`;
    return;
  }

  const multi = staffList.length >= 2;
  el.innerHTML = staffList.map((s, i) => {
    const isTop    = multi && i === 0;
    const isBottom = multi && i === staffList.length - 1;
    const badge    = isTop
      ? `<span style="color:#f59e0b;font-size:15px;line-height:1;" title="Top performer">★</span>`
      : isBottom
        ? `<span style="color:var(--clr-danger);font-size:15px;line-height:1;" title="Bottom performer">↓</span>`
        : `<span style="width:15px;display:inline-block;"></span>`;
    return `
      <div class="leaderboard-row" data-staff-id="${s.id}" style="cursor:pointer;">
        <span class="leaderboard-row__rank">${i + 1}</span>
        <span class="leaderboard-row__name">${_esc(s.name)}</span>
        <span style="font-size:var(--text-xs);color:var(--clr-text-muted);flex-shrink:0;">${s.serviceCount ?? 0} svcs</span>
        <span class="leaderboard-row__amount">${_fmt(s.totalRevenue)}</span>
        ${badge}
      </div>
    `;
  }).join('');
}

function _renderBirthdays(list) {
  const el = document.getElementById('birthdays-body');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `<p style="font-size:var(--text-sm);color:var(--clr-text-muted);">No upcoming birthdays in the next ${BIRTHDAY_DAYS_AHEAD} days.</p>`;
    return;
  }

  el.innerHTML = list.map(c => {
    const label = c.daysUntilBirthday === 0
      ? `<span class="badge badge--birthday">Today!</span>`
      : `In ${c.daysUntilBirthday} day${c.daysUntilBirthday !== 1 ? 's' : ''}`;
    return `
      <div class="birthday-row">
        <div class="birthday-avatar">${_initials(c.name)}</div>
        <div class="birthday-row__info">
          <div class="birthday-row__name">${_esc(c.name)}</div>
          <div class="birthday-row__date">${label}</div>
        </div>
        <span class="birthday-row__phone">${_esc(_maskPhone(c.phone))}</span>
      </div>
    `;
  }).join('');
}

function _renderTopServices(services) {
  const el = document.getElementById('top-services-body');
  if (!el) return;

  if (!services.length) {
    el.innerHTML = `<p style="font-size:var(--text-sm);color:var(--clr-text-muted);">No data for this period.</p>`;
    return;
  }

  const max = services[0].revenue || 1;
  el.innerHTML = services.map(s => `
    <div class="top-service-row" data-svc="${_esc(s.name)}" style="cursor:pointer;" title="Click for details">
      <div class="top-service-row__name" title="${_esc(s.name)}">${_esc(s.name)}</div>
      <div class="top-service-row__bar-wrapper">
        <div class="top-service-row__bar" style="width:${Math.round(s.revenue / max * 100)}%"></div>
      </div>
      <span style="font-size:var(--text-xs);color:var(--clr-text-muted);flex-shrink:0;">${s.count}×</span>
      <div class="top-service-row__value">${_fmt(s.revenue)}</div>
    </div>
  `).join('');
}

// ── Slideover drill-downs ──────────────────────────────────────────────────────

async function _openKpiDrilldown(key) {
  const { start, end } = _dr;

  if (key === 'revenue') {
    const invs = (await getInvoicesByDateRange(start, end))
      .filter(i => i.status !== 'REFUNDED')
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
    const rows = await Promise.all(invs.map(async inv => {
      const cust = await db.customers.get(inv.customerId);
      return `<tr>
        <td style="font-size:var(--text-xs);">${_esc(inv.invoiceNumber)}</td>
        <td style="font-size:var(--text-xs);">${_esc(cust?.name ?? '—')}</td>
        <td style="font-size:var(--text-xs);">${_fmtDate(inv.invoiceDate)}</td>
        <td style="font-size:var(--text-xs);text-align:right;">${_fmt(inv.grandTotal)}</td>
      </tr>`;
    }));
    openSlideover({
      title: `Revenue — ${invs.length} invoice${invs.length !== 1 ? 's' : ''}`,
      bodyHTML: rows.length
        ? `<table class="table" style="width:100%;"><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th style="text-align:right;">Amount</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
        : `<p style="color:var(--clr-text-muted);">No invoices in this period.</p>`,
    });

  } else if (key === 'customers') {
    const invs = (await getInvoicesByDateRange(start, end)).filter(i => i.status !== 'REFUNDED');
    const cMap = {};
    for (const inv of invs) {
      if (!cMap[inv.customerId]) {
        const c     = await db.customers.get(inv.customerId);
        const prior = await db.invoices.where('customerId').equals(inv.customerId)
                        .filter(i => i.invoiceDate < start && i.status !== 'REFUNDED').first();
        cMap[inv.customerId] = { name: c?.name ?? '—', total: 0, isNew: !prior };
      }
      cMap[inv.customerId].total += inv.grandTotal;
    }
    const sorted = Object.values(cMap).sort((a, b) => b.total - a.total);
    const rows   = sorted.map(c => `<tr>
      <td style="font-size:var(--text-xs);">${_esc(c.name)}</td>
      <td><span class="badge ${c.isNew ? 'badge--active' : 'badge--inactive'} badge--no-dot" style="font-size:10px;">${c.isNew ? 'New' : 'Returning'}</span></td>
      <td style="font-size:var(--text-xs);text-align:right;">${_fmt(c.total)}</td>
    </tr>`);
    openSlideover({
      title: `Customers Served — ${sorted.length}`,
      bodyHTML: rows.length
        ? `<table class="table" style="width:100%;"><thead><tr><th>Customer</th><th>Type</th><th style="text-align:right;">Total</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
        : `<p style="color:var(--clr-text-muted);">No customers in this period.</p>`,
    });

  } else if (key === 'atv') {
    const invs = (await getInvoicesByDateRange(start, end)).filter(i => i.status !== 'REFUNDED');
    const cMap = {};
    for (const inv of invs) {
      if (!cMap[inv.customerId]) {
        const c = await db.customers.get(inv.customerId);
        cMap[inv.customerId] = { name: c?.name ?? '—', total: 0, count: 0 };
      }
      cMap[inv.customerId].total += inv.grandTotal;
      cMap[inv.customerId].count += 1;
    }
    const sorted = Object.values(cMap).sort((a, b) => (b.total / b.count) - (a.total / a.count));
    const rows   = sorted.map(c => `<tr>
      <td style="font-size:var(--text-xs);">${_esc(c.name)}</td>
      <td style="font-size:var(--text-xs);text-align:right;">${_fmt(c.total)}</td>
      <td style="font-size:var(--text-xs);text-align:right;font-weight:600;">${_fmt(c.total / c.count)}</td>
    </tr>`);
    openSlideover({
      title: 'Avg Invoice Value (ATV)',
      bodyHTML: rows.length
        ? `<table class="table" style="width:100%;"><thead><tr><th>Customer</th><th style="text-align:right;">Total</th><th style="text-align:right;">ATV</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
        : `<p style="color:var(--clr-text-muted);">No data in this period.</p>`,
    });

  } else if (key === 'lapsed') {
    const rows = _lapsedData.map(c => `<tr>
      <td style="font-size:var(--text-xs);">${_esc(c.name)}</td>
      <td style="font-size:var(--text-xs);">${_esc(_maskPhone(c.phone))}</td>
      <td style="font-size:var(--text-xs);">${c.lastVisit ? _fmtDate(c.lastVisit) : '—'}</td>
      <td style="font-size:var(--text-xs);text-align:right;color:var(--clr-danger);">${c.daysSince ?? '—'}d</td>
    </tr>`);
    openSlideover({
      title: `Lapsed Customers — ${_lapsedData.length}`,
      bodyHTML: rows.length
        ? `<table class="table" style="width:100%;"><thead><tr><th>Name</th><th>Phone</th><th>Last Visit</th><th style="text-align:right;">Inactive</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
        : `<p style="color:var(--clr-text-muted);">No lapsed customers.</p>`,
    });

  } else if (key === 'topStaff') {
    const top = _staffData[0];
    if (top) _openStaffSalesDrilldown(top);
  }
}

async function _openStaffSalesDrilldown(staff) {
  const { start, end } = _dr;
  let perf;

  try {
    perf = await getStaffPerformance(staff.id, start, end);
  } catch (err) {
    console.error('Failed to load staff drilldown:', err);
    openSlideover({
      title: `${_esc(staff.name)} â€” Services`,
      bodyHTML: `<p style="color:var(--clr-danger);">Could not load services for this period. Please try again.</p>`,
    });
    return;
  }

  const items = [...(perf.lineItems ?? [])]
    .sort((a, b) => String(b.invoice?.invoiceDate ?? '').localeCompare(String(a.invoice?.invoiceDate ?? '')));

  const rows = items.map(li => `<tr>
    <td style="font-size:var(--text-xs);white-space:nowrap;">${_fmtDate(li.invoice?.invoiceDate ?? '')}</td>
    <td style="font-size:var(--text-xs);">${_esc(li.serviceNameSnap ?? '')}</td>
    <td style="font-size:var(--text-xs);text-align:right;">${_fmt(li.revenue)}</td>
    <td style="font-size:var(--text-xs);text-align:right;color:var(--clr-primary);font-weight:600;">${_fmt(li.commission)}</td>
  </tr>`);

  openSlideover({
    title: `${_esc(staff.name)} â€” Services`,
    bodyHTML: rows.length
      ? `<div style="margin-bottom:var(--sp-3);font-size:var(--text-sm);color:var(--clr-text-secondary);">
          ${items.length} service${items.length !== 1 ? 's' : ''} from ${_fmtDate(start)} to ${_fmtDate(end)}
        </div>
        <table class="table" style="width:100%;">
          <thead><tr><th>Date</th><th>Service</th><th style="text-align:right;">Sale</th><th style="text-align:right;">Commission</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>`
      : `<p style="color:var(--clr-text-muted);">No services in this period.</p>`,
  });
}

async function _openStaffDrilldown(staff) {
  const items    = staff.lineItems ?? [];
  const custIds  = [...new Set(items.map(li => li.invoice?.customerId).filter(Boolean))];
  const custs    = await Promise.all(custIds.map(id => db.customers.get(id)));
  const cMap     = Object.fromEntries(custs.filter(Boolean).map(c => [c.id, c.name]));

  const rows = items.map(li => `<tr>
    <td style="font-size:var(--text-xs);">${_fmtDate(li.invoice?.invoiceDate ?? '')}</td>
    <td style="font-size:var(--text-xs);">${_esc(li.serviceNameSnap ?? '')}</td>
    <td style="font-size:var(--text-xs);">${_esc(cMap[li.invoice?.customerId] ?? '—')}</td>
    <td style="font-size:var(--text-xs);text-align:right;">${_fmt(li.revenue)}</td>
  </tr>`);

  openSlideover({
    title: `${_esc(staff.name)} — Services`,
    bodyHTML: rows.length
      ? `<table class="table" style="width:100%;"><thead><tr><th>Date</th><th>Service</th><th>Customer</th><th style="text-align:right;">Amount</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
      : `<p style="color:var(--clr-text-muted);">No services in this period.</p>`,
  });
}

async function _openCatDrilldown(catName) {
  if (!catName) return;
  const { start, end } = _dr;
  const invs   = (await getInvoicesByDateRange(start, end)).filter(i => i.status !== 'REFUNDED');
  const svcMap = {};

  for (const inv of invs) {
    const items = await db.invoiceLineItems.where('invoiceId').equals(inv.id).toArray();
    for (const li of items) {
      const svc = await db.services.get(li.serviceId);
      const cat = await db.serviceCategories.get(svc?.categoryId);
      if ((cat?.name ?? 'Other') !== catName) continue;
      if (!svcMap[li.serviceNameSnap]) svcMap[li.serviceNameSnap] = { revenue: 0, count: 0 };
      svcMap[li.serviceNameSnap].revenue += li.unitPriceSnap * li.quantity;
      svcMap[li.serviceNameSnap].count   += 1;
    }
  }

  const rows = Object.entries(svcMap)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .map(([name, { revenue, count }]) => `<tr>
      <td style="font-size:var(--text-xs);">${_esc(name)}</td>
      <td style="font-size:var(--text-xs);text-align:center;">${count}</td>
      <td style="font-size:var(--text-xs);text-align:right;">${_fmt(revenue)}</td>
    </tr>`);

  openSlideover({
    title: `${_esc(catName)} — Services`,
    bodyHTML: rows.length
      ? `<table class="table" style="width:100%;"><thead><tr><th>Service</th><th style="text-align:center;">Count</th><th style="text-align:right;">Revenue</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
      : `<p style="color:var(--clr-text-muted);">No data for this category in this period.</p>`,
  });
}

async function _openSvcDrilldown(svcName) {
  if (!svcName) return;
  const { start, end } = _dr;
  const invs = (await getInvoicesByDateRange(start, end)).filter(i => i.status !== 'REFUNDED');
  const rows = [];

  for (const inv of invs) {
    const items = await db.invoiceLineItems.where('invoiceId').equals(inv.id).toArray();
    for (const li of items) {
      if (li.serviceNameSnap !== svcName) continue;
      const cust = await db.customers.get(inv.customerId);
      rows.push(`<tr>
        <td style="font-size:var(--text-xs);">${_fmtDate(inv.invoiceDate)}</td>
        <td style="font-size:var(--text-xs);">${_esc(cust?.name ?? '—')}</td>
        <td style="font-size:var(--text-xs);text-align:right;">${_fmt(li.unitPriceSnap)}</td>
      </tr>`);
    }
  }

  openSlideover({
    title: `${_esc(svcName)} — ${rows.length} invoice${rows.length !== 1 ? 's' : ''}`,
    bodyHTML: rows.length
      ? `<table class="table" style="width:100%;"><thead><tr><th>Date</th><th>Customer</th><th style="text-align:right;">Price</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
      : `<p style="color:var(--clr-text-muted);">No records found.</p>`,
  });
}

// ── Auto-refresh ───────────────────────────────────────────────────────────────

function _startRefresh() {
  _refreshTimer = setInterval(() => {
    if (navigator.onLine && document.getElementById('kpi-strip')) _loadData();
  }, 5 * 60 * 1000);
}

function _stopRefresh() {
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function _destroyCharts() {
  if (_revenueChart) { _revenueChart.destroy(); _revenueChart = null; }
  if (_donutChart)   { _donutChart.destroy();   _donutChart   = null; }
}

function _tod() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function _fmt(n) {
  return '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function _fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

function _maskPhone(phone) {
  const s = String(phone ?? '');
  return s.length >= 4 ? 'XXXXX' + s.slice(-4) : s;
}

function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _initials(name) {
  return String(name ?? '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}
