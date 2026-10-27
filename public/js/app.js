/**
 * Office Supplies Inventory & Requisition System (Client-side Engine)
 * Features: Role-Based Access Control (Admin, Storekeeper, Department User)
 */

// Application State
const state = {
  currentUser: null,
  settings: {},
  items: [],
  categories: [],
  departments: [],
  users: [],
  requisitions: [],
  stockIns: [],
  currentTab: 'inventory',
  selectedRequisition: null,
  charts: {
    deptChart: null,
    catChart: null
  }
};

// ---------------------------------------------------------------------------
// INITIALIZATION & AUTHENTICATION
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  const reqDateEl = document.getElementById('reqDate');
  const inDateEl = document.getElementById('inDate');
  const reportEndEl = document.getElementById('reportEndDate');
  if (reqDateEl) reqDateEl.value = today;
  if (inDateEl) inDateEl.value = today;
  if (reportEndEl) reportEndEl.value = today;

  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const reportStartEl = document.getElementById('reportStartDate');
  if (reportStartEl) reportStartEl.value = firstDay;

  // Check saved session in localStorage
  const savedUser = localStorage.getItem('office_user');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
      document.getElementById('loginScreen').classList.add('hidden');
      await initializeApp();
    } catch (e) {
      localStorage.removeItem('office_user');
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
});

function showLoginScreen() {
  document.getElementById('loginScreen').classList.remove('hidden');
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    state.currentUser = json.data;
    localStorage.setItem('office_user', JSON.stringify(json.data));

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('loginForm').reset();

    await initializeApp();

    Swal.fire({
      icon: 'success',
      title: 'ยินดีต้อนรับ',
      text: `เข้าสู่ระบบในฐานะ: ${state.currentUser.fullName}`,
      timer: 1500,
      showConfirmButton: false
    });
  } catch (err) {
    Swal.fire('เข้าสู่ระบบไม่สำเร็จ', err.message, 'error');
  }
}

function quickLogin(username, password) {
  document.getElementById('loginUsername').value = username;
  document.getElementById('loginPassword').value = password;
  document.getElementById('loginForm').dispatchEvent(new Event('submit'));
}

function handleLogout() {
  Swal.fire({
    title: 'ออกจากระบบ?',
    text: 'คุณต้องการออกจากระบบหรือไม่',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ออกจากระบบ',
    cancelButtonText: 'ยกเลิก'
  }).then((res) => {
    if (res.isConfirmed) {
      localStorage.removeItem('office_user');
      state.currentUser = null;
      document.getElementById('loginScreen').classList.remove('hidden');
    }
  });
}

// ---------------------------------------------------------------------------
// APP BOOTSTRAP & ROLE-BASED ACCESS CONTROL (RBAC)
// ---------------------------------------------------------------------------

async function initializeApp() {
  updateUserHeaderProfile();
  applyRolePermissions();

  await Promise.all([
    fetchSettings(),
    fetchCategories(),
    fetchDepartments(),
    fetchItems(),
    fetchRequisitions(),
    fetchStockIns()
  ]);

  if (state.currentUser.role === 'admin') {
    await fetchUsers();
  }

  populateDropdowns();

  // Switch to default role tab
  if (state.currentUser.role === 'department') {
    switchTab('inventory');
  } else {
    switchTab('dashboard');
  }
}

function updateUserHeaderProfile() {
  const u = state.currentUser;
  if (!u) return;

  document.getElementById('userDisplayName').textContent = u.fullName;

  const roleBadge = document.getElementById('userRoleBadge');
  const deptLabel = document.getElementById('userDeptLabel');

  if (u.role === 'admin') {
    roleBadge.textContent = 'ผู้ดูแลระบบ (Admin)';
    roleBadge.className = 'px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-white';
    deptLabel.textContent = '';
  } else if (u.role === 'storekeeper') {
    roleBadge.textContent = 'จนท.คลังพัสดุ (Storekeeper)';
    roleBadge.className = 'px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-600 text-white';
    deptLabel.textContent = 'ห้องพัสดุ';
  } else {
    roleBadge.textContent = 'ผู้เบิกประจำแผนก';
    roleBadge.className = 'px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800';
    deptLabel.textContent = u.departmentName ? `(${u.departmentName})` : '';
  }
}

function applyRolePermissions() {
  const role = state.currentUser ? state.currentUser.role : 'guest';

  const tabDashboard = document.getElementById('navTabDashboard');
  const tabStockIns = document.getElementById('navTabStockIns');
  const tabReports = document.getElementById('navTabReports');
  const tabSettings = document.getElementById('navTabSettings');
  const deptBanner = document.getElementById('deptRoleBanner');
  const btnStockIn = document.getElementById('btnQuickStockIn');
  const btnAddItem = document.getElementById('btnAddNewItem');
  const btnExportInv = document.getElementById('btnInventoryExportExcel');
  const btnExportReq = document.getElementById('btnReqExportExcel');
  const autoApproveContainer = document.getElementById('autoApproveToggleContainer');

  // Department User Permissions
  if (role === 'department') {
    tabDashboard.classList.add('hidden');
    tabStockIns.classList.add('hidden');
    tabReports.classList.add('hidden');
    tabSettings.classList.add('hidden');

    if (deptBanner) {
      deptBanner.classList.remove('hidden');
      document.getElementById('bannerDeptName').textContent = state.currentUser.departmentName || 'แผนกของคุณ';
    }

    if (btnStockIn) btnStockIn.classList.add('hidden');
    if (btnAddItem) btnAddItem.classList.add('hidden');
    if (btnExportInv) btnExportInv.classList.add('hidden');
    if (btnExportReq) btnExportReq.classList.add('hidden');
    if (autoApproveContainer) autoApproveContainer.classList.add('hidden');

    // Rename tab labels for clarity
    document.getElementById('inventoryTabLabel').textContent = 'เช็คพัสดุคงเหลือ (พร้อมเบิก)';
    document.getElementById('requisitionsTabLabel').textContent = 'ใบขอเบิกของแผนกเรา';

    // Hide pricing & admin columns in inventory table
    document.querySelectorAll('.col-price').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.col-minstock').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.col-admin-actions').forEach(el => el.classList.add('hidden'));
  }
  // Storekeeper Permissions (รับเข้า + ตรวจรับใบเซ็น & จ่ายของ)
  else if (role === 'storekeeper') {
    tabDashboard.classList.remove('hidden');
    tabStockIns.classList.remove('hidden');
    tabReports.classList.add('hidden');
    tabSettings.classList.add('hidden');

    if (deptBanner) deptBanner.classList.add('hidden');
    if (btnStockIn) btnStockIn.classList.remove('hidden');
    if (btnAddItem) btnAddItem.classList.remove('hidden');
    if (btnExportInv) btnExportInv.classList.remove('hidden');
    if (btnExportReq) btnExportReq.classList.remove('hidden');
    if (autoApproveContainer) autoApproveContainer.classList.remove('hidden');

    document.getElementById('inventoryTabLabel').textContent = 'คลังอุปกรณ์/สต็อก';
    document.getElementById('requisitionsTabLabel').textContent = 'คิวใบเบิก & จ่ายพัสดุ';

    document.querySelectorAll('.col-price').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('.col-minstock').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('.col-admin-actions').forEach(el => el.classList.remove('hidden'));
  }
  // Admin Permissions (Full Control)
  else if (role === 'admin') {
    tabDashboard.classList.remove('hidden');
    tabStockIns.classList.remove('hidden');
    tabReports.classList.remove('hidden');
    tabSettings.classList.remove('hidden');

    if (deptBanner) deptBanner.classList.add('hidden');
    if (btnStockIn) btnStockIn.classList.remove('hidden');
    if (btnAddItem) btnAddItem.classList.remove('hidden');
    if (btnExportInv) btnExportInv.classList.remove('hidden');
    if (btnExportReq) btnExportReq.classList.remove('hidden');
    if (autoApproveContainer) autoApproveContainer.classList.remove('hidden');

    document.getElementById('inventoryTabLabel').textContent = 'คลังอุปกรณ์/สต็อก';
    document.getElementById('requisitionsTabLabel').textContent = 'รายการใบเบิกพัสดุ';

    document.querySelectorAll('.col-price').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('.col-minstock').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('.col-admin-actions').forEach(el => el.classList.remove('hidden'));
  }
}

// ---------------------------------------------------------------------------
// DATA FETCHERS
// ---------------------------------------------------------------------------

async function fetchSettings() {
  const res = await fetch('/api/settings');
  const json = await res.json();
  if (json.success) {
    state.settings = json.data;
    if (state.settings.orgName) {
      const headerOrg = document.getElementById('headerOrgBadge');
      if (headerOrg) headerOrg.textContent = state.settings.orgName;
    }
  }
}

async function fetchCategories() {
  const res = await fetch('/api/categories');
  const json = await res.json();
  if (json.success) state.categories = json.data;
}

async function fetchDepartments() {
  const res = await fetch('/api/departments');
  const json = await res.json();
  if (json.success) state.departments = json.data;
}

async function fetchItems() {
  const res = await fetch('/api/items');
  const json = await res.json();
  if (json.success) {
    state.items = json.data;
    renderInventoryTable();
  }
}

async function fetchUsers() {
  const res = await fetch('/api/users');
  const json = await res.json();
  if (json.success) {
    state.users = json.data;
    renderUsersTable();
  }
}

async function fetchRequisitions() {
  let url = '/api/requisitions';
  // If department user, only fetch their department's requisitions!
  if (state.currentUser && state.currentUser.role === 'department' && state.currentUser.departmentId) {
    url += `?departmentId=${state.currentUser.departmentId}`;
  }

  const res = await fetch(url);
  const json = await res.json();
  if (json.success) {
    state.requisitions = json.data;
    renderRequisitionsTable();
  }
}

async function fetchStockIns() {
  const res = await fetch('/api/stock-in');
  const json = await res.json();
  if (json.success) {
    state.stockIns = json.data;
    renderStockInsTable();
  }
}

// ---------------------------------------------------------------------------
// TAB NAVIGATION
// ---------------------------------------------------------------------------

function switchTab(tabId) {
  state.currentTab = tabId;

  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

  const target = document.getElementById(`tab-${tabId}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('fade-in');
  }

  document.querySelectorAll('#mainTabNav .tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.className = 'tab-btn px-3 py-2 text-xs sm:text-sm font-medium rounded-lg text-blue-600 bg-blue-50/70 border-b-2 border-blue-600 flex items-center gap-2 whitespace-nowrap';
    } else {
      btn.className = 'tab-btn px-3 py-2 text-xs sm:text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-2 whitespace-nowrap';
    }
  });

  if (tabId === 'dashboard') {
    renderDashboard();
  } else if (tabId === 'reports') {
    generateReport();
  } else if (tabId === 'settings' && state.currentUser.role === 'admin') {
    renderSettingsView();
  }
}

// ---------------------------------------------------------------------------
// TAB 1: DASHBOARD
// ---------------------------------------------------------------------------

async function renderDashboard() {
  if (state.currentUser.role === 'department') return;

  try {
    const res = await fetch('/api/dashboard');
    const json = await res.json();
    if (!json.success) return;

    const { summary, lowStockList, recentRequisitions, deptUsage, catStock } = json.data;

    document.getElementById('dashTotalItems').textContent = summary.totalItems;
    document.getElementById('dashLowStockCount').textContent = summary.lowStockCount;
    document.getElementById('dashOutOfStockSub').textContent = `หมดสต็อก ${summary.outOfStockCount} รายการ`;
    document.getElementById('dashPendingReqs').textContent = summary.pendingRequisitionCount;
    document.getElementById('dashInventoryValue').textContent = `฿${summary.totalInventoryValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

    const lowBadge = document.getElementById('lowStockNavBadge');
    if (lowBadge) {
      if (summary.lowStockCount > 0) {
        lowBadge.textContent = summary.lowStockCount;
        lowBadge.classList.remove('hidden');
      } else {
        lowBadge.classList.add('hidden');
      }
    }

    const pendingBadge = document.getElementById('pendingReqNavBadge');
    if (pendingBadge) {
      if (summary.pendingRequisitionCount > 0) {
        pendingBadge.textContent = summary.pendingRequisitionCount;
        pendingBadge.classList.remove('hidden');
      } else {
        pendingBadge.classList.add('hidden');
      }
    }

    const alertBanner = document.getElementById('dashboardAlertBanner');
    if (summary.lowStockCount > 0) {
      alertBanner.classList.remove('hidden');
      document.getElementById('dashboardAlertText').textContent = `มีอุปกรณ์ ${summary.lowStockCount} รายการ ที่สต็อกต่ำกว่าจุดเตือน หรือหมดสต็อก`;
    } else {
      alertBanner.classList.add('hidden');
    }

    // Low stock quick table
    const lowTable = document.getElementById('dashLowStockTable');
    if (lowStockList.length === 0) {
      lowTable.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">สต็อกอุปกรณ์ทั้งหมดอยู่ในระดับปกติ ไม่มีของใกล้หมด</td></tr>`;
    } else {
      lowTable.innerHTML = lowStockList.slice(0, 5).map(item => `
        <tr class="hover:bg-slate-50 transition">
          <td class="p-3">
            <div class="font-medium text-slate-800">${item.name}</div>
            <div class="text-[11px] text-slate-400 font-mono">${item.code}</div>
          </td>
          <td class="p-3 text-center">
            <span class="px-2 py-0.5 rounded font-bold ${item.currentStock <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}">
              ${item.currentStock} ${item.unit}
            </span>
          </td>
          <td class="p-3 text-center text-slate-500">${item.minStock} ${item.unit}</td>
          <td class="p-3 text-right">
            <button onclick="openStockInForSpecificItem('${item.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition">
              <i class="fa-solid fa-plus"></i> สั่งเข้า
            </button>
          </td>
        </tr>
      `).join('');
    }

    // Recent Requisitions Table
    const recentTable = document.getElementById('dashRecentReqsTable');
    if (recentRequisitions.length === 0) {
      recentTable.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">ยังไม่มีประวัติการเบิกพัสดุ</td></tr>`;
    } else {
      recentTable.innerHTML = recentRequisitions.map(req => {
        let statusBadge = '<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">รอเบิก</span>';
        if (req.status === 'approved') statusBadge = '<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">จ่ายแล้ว</span>';
        if (req.status === 'rejected') statusBadge = '<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">ปฏิเสธ</span>';

        return `
          <tr class="hover:bg-slate-50 transition">
            <td class="p-3">
              <div class="font-semibold text-blue-600">${req.id}</div>
              <div class="text-[11px] text-slate-400">${req.date || '-'}</div>
            </td>
            <td class="p-3">
              <div class="font-medium text-slate-800">${req.requisitioner}</div>
              <div class="text-[11px] text-slate-500">${req.departmentName || '-'}</div>
            </td>
            <td class="p-3 text-center">${statusBadge}</td>
            <td class="p-3 text-right">
              <button onclick="viewRequisitionDetail('${req.id}')" class="text-blue-600 hover:text-blue-800 font-medium text-xs">
                ดูใบเบิก
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    renderDeptUsageChart(deptUsage);
    renderCategoryStockChart(catStock);
  } catch (err) {
    console.error('Error rendering dashboard:', err);
  }
}

function renderDeptUsageChart(deptUsage) {
  const ctx = document.getElementById('deptUsageChart');
  if (!ctx) return;

  const labels = Object.keys(deptUsage);
  const dataValues = labels.map(key => deptUsage[key].amount);

  if (state.charts.deptChart) state.charts.deptChart.destroy();

  state.charts.deptChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(l => l.replace('ฝ่าย', '').replace('(HR)', '').replace('(IT)', '')),
      datasets: [{
        label: 'มูลค่าการเบิก (บาท)',
        data: dataValues,
        backgroundColor: '#3b82f6',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => '฿' + v.toLocaleString() }
        }
      }
    }
  });
}

function renderCategoryStockChart(catStock) {
  const ctx = document.getElementById('catStockChart');
  if (!ctx) return;

  const labels = Object.keys(catStock);
  const values = labels.map(k => catStock[k].value);

  if (state.charts.catChart) state.charts.catChart.destroy();

  state.charts.catChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: ['#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { family: 'Prompt', size: 11 }, boxWidth: 12 } }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// TAB 2: INVENTORY & STOCK
// ---------------------------------------------------------------------------

function renderInventoryTable(itemsToRender = null) {
  const items = itemsToRender || state.items;
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  const isDepartmentUser = state.currentUser && state.currentUser.role === 'department';

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400">ไม่พบรายการอุปกรณ์ตามเงื่อนไขที่ค้นหา</td></tr>`;
    document.getElementById('inventoryRowCountText').textContent = 'แสดง 0 รายการ';
    return;
  }

  let totalValuation = 0;

  tbody.innerHTML = items.map((item, index) => {
    const val = Number(item.totalValue || (item.currentStock * item.unitPrice) || 0);
    totalValuation += val;

    let stockBadge = `<span class="px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-800">${item.currentStock} ${item.unit}</span>`;
    if (item.currentStock <= 0) {
      stockBadge = `<span class="px-2.5 py-1 rounded-full font-bold bg-rose-100 text-rose-700 animate-pulse">หมดสต็อก</span>`;
    } else if (item.currentStock <= item.minStock) {
      stockBadge = `<span class="px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800">⚠️ เหลือ ${item.currentStock} ${item.unit}</span>`;
    }

    const priceCol = isDepartmentUser ? '' : `
      <td class="p-3 text-center text-slate-500 font-medium col-minstock">${item.minStock} ${item.unit}</td>
      <td class="p-3 text-right text-slate-700 col-price">฿${Number(item.unitPrice || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="p-3 text-right font-semibold text-slate-900 col-price">฿${val.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
    `;

    const actionCol = isDepartmentUser ? '' : `
      <td class="p-3 text-center col-admin-actions">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="editItem('${item.id}')" title="แก้ไข" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-600 transition flex items-center justify-center text-xs">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button onclick="deleteItem('${item.id}')" title="ลบรายการ" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 transition flex items-center justify-center text-xs">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 text-center text-slate-400">${index + 1}</td>
        <td class="p-3 font-mono font-medium text-slate-700">${item.code || '-'}</td>
        <td class="p-3">
          <div class="font-semibold text-slate-900">${item.name}</div>
          <div class="text-[11px] text-slate-500">${item.description || '-'}</div>
        </td>
        <td class="p-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            ${item.categoryName || 'ทั่วไป'}
          </span>
        </td>
        <td class="p-3 text-center">${stockBadge}</td>
        ${priceCol}
        <td class="p-3 text-slate-600 text-xs">${item.location || '-'}</td>
        ${actionCol}
      </tr>
    `;
  }).join('');

  document.getElementById('inventoryRowCountText').textContent = `แสดง ${items.length} รายการ จากทั้งหมด ${state.items.length} รายการ`;
  if (!isDepartmentUser) {
    document.getElementById('inventoryTotalValuationText').textContent = `มูลค่ารวม: ฿${totalValuation.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  }
}

function filterInventoryTable() {
  const search = (document.getElementById('inventorySearchInput').value || '').toLowerCase().trim();
  const cat = document.getElementById('inventoryCategoryFilter').value;
  const status = document.getElementById('inventoryStatusFilter').value;

  const filtered = state.items.filter(item => {
    const matchSearch = !search ||
      (item.name || '').toLowerCase().includes(search) ||
      (item.code || '').toLowerCase().includes(search) ||
      (item.location || '').toLowerCase().includes(search) ||
      (item.description || '').toLowerCase().includes(search);

    const matchCat = cat === 'all' || item.categoryId === cat;

    let matchStatus = true;
    if (status === 'normal') matchStatus = item.currentStock > item.minStock;
    if (status === 'low') matchStatus = item.currentStock <= item.minStock && item.currentStock > 0;
    if (status === 'out') matchStatus = item.currentStock <= 0;

    return matchSearch && matchCat && matchStatus;
  });

  renderInventoryTable(filtered);
}

function filterByLowStock() {
  const statusSelect = document.getElementById('inventoryStatusFilter');
  if (statusSelect) {
    statusSelect.value = 'low';
    filterInventoryTable();
  }
}

// ---------------------------------------------------------------------------
// TAB 3: REQUISITIONS (เบิก-จ่ายพัสดุ & เวิร์กโฟลว์ลายเซ็น)
// ---------------------------------------------------------------------------

function renderRequisitionsTable(reqsToRender = null) {
  const reqs = reqsToRender || state.requisitions;
  const tbody = document.getElementById('requisitionTableBody');
  if (!tbody) return;

  const isStorekeeper = state.currentUser && (state.currentUser.role === 'storekeeper' || state.currentUser.role === 'admin');

  if (reqs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400">ยังไม่มีรายการใบขอเบิกพัสดุ</td></tr>`;
    return;
  }

  tbody.innerHTML = reqs.map(req => {
    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">รอหัวหน้าเซ็น / รอจ่าย</span>';
    if (req.status === 'approved') statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">อนุมัติ & จ่ายของแล้ว</span>';
    if (req.status === 'rejected') statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">ปฏิเสธคำขอ</span>';

    const itemCount = (req.items || []).length;

    // Dispense Button for Storekeeper/Admin if pending
    let dispenseBtn = '';
    if (isStorekeeper && req.status === 'pending') {
      dispenseBtn = `
        <button onclick="promptDispenseOrder('${req.id}')" title="ตรวจรับใบเซ็นและจ่ายของ" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1">
          <i class="fa-solid fa-check"></i> จ่ายของ
        </button>
      `;
    }

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-semibold text-blue-600 font-mono">${req.id}</td>
        <td class="p-3 text-slate-600">${req.date || '-'}</td>
        <td class="p-3 font-medium text-slate-900">${req.requisitioner}</td>
        <td class="p-3 text-slate-600">${req.departmentName || '-'}</td>
        <td class="p-3 text-slate-700 max-w-xs truncate">${req.purpose || '-'}</td>
        <td class="p-3 text-center font-medium">${itemCount} รายการ</td>
        <td class="p-3 text-right font-semibold text-slate-900">฿${Number(req.totalEstimatedCost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td class="p-3 text-center">${statusBadge}</td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            ${dispenseBtn}
            <a href="print-slip.html?id=${req.id}" target="_blank" title="พิมพ์ใบเบิกเพื่อให้หัวหน้าเซ็น" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1 transition shadow-xs">
              <i class="fa-solid fa-print"></i> พิมพ์ใบเบิก
            </a>
            <button onclick="viewRequisitionDetail('${req.id}')" title="ดูรายละเอียด" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-600 transition flex items-center justify-center text-xs">
              <i class="fa-solid fa-eye"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterRequisitionTable() {
  const search = (document.getElementById('reqSearchInput').value || '').toLowerCase().trim();
  const status = document.getElementById('reqStatusFilter').value;
  const dept = document.getElementById('reqDeptFilter').value;

  const filtered = state.requisitions.filter(r => {
    const matchSearch = !search ||
      (r.id || '').toLowerCase().includes(search) ||
      (r.requisitioner || '').toLowerCase().includes(search) ||
      (r.departmentName || '').toLowerCase().includes(search) ||
      (r.purpose || '').toLowerCase().includes(search);

    const matchStatus = status === 'all' || r.status === status;
    const matchDept = dept === 'all' || r.departmentId === dept;

    return matchSearch && matchStatus && matchDept;
  });

  renderRequisitionsTable(filtered);
}

// Requisition Modal
function openRequisitionModal() {
  const modal = document.getElementById('requisitionModal');
  const deptSelect = document.getElementById('reqDepartmentId');

  deptSelect.innerHTML = state.departments.map(d => `
    <option value="${d.id}">${d.name}</option>
  `).join('');

  document.getElementById('requisitionForm').reset();
  document.getElementById('reqDate').value = new Date().toISOString().split('T')[0];

  // Auto fill user's name and department if logged in as department
  if (state.currentUser) {
    document.getElementById('reqRequisitioner').value = state.currentUser.fullName || '';
    if (state.currentUser.departmentId) {
      deptSelect.value = state.currentUser.departmentId;
    }
  }

  const container = document.getElementById('requisitionRowsContainer');
  container.innerHTML = '';
  addRequisitionRow();

  calculateReqModalTotal();
  modal.classList.remove('hidden');
}

function addRequisitionRow() {
  const container = document.getElementById('requisitionRowsContainer');
  const rowId = 'req-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'grid grid-cols-12 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl items-center text-xs';

  const itemOptions = state.items.map(item => `
    <option value="${item.id}" data-unit="${item.unit}" data-stock="${item.currentStock}" data-price="${item.unitPrice}">
      ${item.name} (คงเหลือ: ${item.currentStock} ${item.unit})
    </option>
  `).join('');

  row.innerHTML = `
    <div class="col-span-12 sm:col-span-5">
      <select class="req-item-select w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500" onchange="handleReqItemChange('${rowId}')">
        <option value="">-- เลือกอุปกรณ์สำนักงาน --</option>
        ${itemOptions}
      </select>
    </div>
    <div class="col-span-4 sm:col-span-2">
      <div class="flex items-center gap-1">
        <input type="number" min="1" value="1" class="req-item-qty w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500" oninput="calculateReqModalTotal()">
        <span class="req-item-unit text-slate-500 whitespace-nowrap">-</span>
      </div>
    </div>
    <div class="col-span-4 sm:col-span-2 text-right">
      <span class="text-slate-400">@ ฿</span><span class="req-item-price text-slate-700">0.00</span>
    </div>
    <div class="col-span-3 sm:col-span-2 text-right font-bold text-slate-900">
      <span class="req-item-subtotal">฿0.00</span>
    </div>
    <div class="col-span-1 text-center">
      <button type="button" onclick="removeRequisitionRow('${rowId}')" class="text-slate-400 hover:text-rose-500 transition">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  calculateReqModalTotal();
}

function removeRequisitionRow(rowId) {
  const el = document.getElementById(rowId);
  if (el) el.remove();
  calculateReqModalTotal();
}

function handleReqItemChange(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;

  const select = row.querySelector('.req-item-select');
  const selectedOpt = select.options[select.selectedIndex];
  const unit = selectedOpt.getAttribute('data-unit') || '-';
  const price = Number(selectedOpt.getAttribute('data-price') || 0);
  const stock = Number(selectedOpt.getAttribute('data-stock') || 0);

  row.querySelector('.req-item-unit').textContent = unit;
  row.querySelector('.req-item-price').textContent = price.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  if (stock <= 0) {
    Swal.fire('ของหมดสต็อก', 'อุปกรณ์รายการนี้ไม่มีของในคลัง (คงเหลือ 0) อาจไม่สามารถเบิกจ่ายได้ทันที', 'warning');
  }

  calculateReqModalTotal();
}

function calculateReqModalTotal() {
  const container = document.getElementById('requisitionRowsContainer');
  if (!container) return;

  let total = 0;
  const rows = container.querySelectorAll('.grid');

  rows.forEach(row => {
    const select = row.querySelector('.req-item-select');
    const qtyInput = row.querySelector('.req-item-qty');
    const subtotalEl = row.querySelector('.req-item-subtotal');

    if (select && select.value && qtyInput) {
      const selectedOpt = select.options[select.selectedIndex];
      const price = Number(selectedOpt.getAttribute('data-price') || 0);
      const qty = Number(qtyInput.value) || 0;
      const sub = price * qty;
      total += sub;
      subtotalEl.textContent = `฿${sub.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    } else {
      subtotalEl.textContent = '฿0.00';
    }
  });

  const totalEl = document.getElementById('reqFormTotalAmount');
  if (totalEl) totalEl.textContent = `฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
}

async function handleRequisitionSubmit(e) {
  e.preventDefault();

  const requisitioner = document.getElementById('reqRequisitioner').value.trim();
  const departmentId = document.getElementById('reqDepartmentId').value;
  const purpose = document.getElementById('reqPurpose').value.trim();
  const date = document.getElementById('reqDate').value;
  const autoApproveEl = document.getElementById('reqAutoApprove');
  const autoApprove = autoApproveEl ? autoApproveEl.checked : false;

  const items = [];
  const rows = document.querySelectorAll('#requisitionRowsContainer .grid');
  let stockWarningItems = [];

  rows.forEach(row => {
    const select = row.querySelector('.req-item-select');
    const qtyInput = row.querySelector('.req-item-qty');
    if (select && select.value) {
      const itemId = select.value;
      const quantity = Number(qtyInput.value) || 1;
      const selectedOpt = select.options[select.selectedIndex];
      const stock = Number(selectedOpt.getAttribute('data-stock') || 0);

      if (autoApprove && quantity > stock) {
        stockWarningItems.push(`${selectedOpt.text} (ขอ ${quantity} แต่มีเพียง ${stock})`);
      }

      items.push({ itemId, quantity });
    }
  });

  if (items.length === 0) {
    Swal.fire('แจ้งเตือน', 'กรุณาเลือกอุปกรณ์ที่ต้องการขอเบิกอย่างน้อย 1 รายการ', 'warning');
    return;
  }

  if (stockWarningItems.length > 0) {
    Swal.fire({
      icon: 'error',
      title: 'สต็อกไม่เพียงพอสำหรับการตัดจ่ายทันที',
      html: `รายการดังต่อไปนี้มีจำนวนในคลังไม่พอ:<br><br><b>${stockWarningItems.join('<br>')}</b>`
    });
    return;
  }

  const payload = {
    requisitioner,
    departmentId,
    purpose,
    date,
    items,
    status: autoApprove ? 'approved' : 'pending'
  };

  try {
    const res = await fetch('/api/requisitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    closeModal('requisitionModal');

    Swal.fire({
      icon: 'success',
      title: 'สร้างใบขอเบิกสำเร็จ!',
      html: `
        เลขที่ใบเบิก: <b>${json.data.id}</b><br><br>
        กรุณากด <b>"พิมพ์ใบเบิก"</b> เพื่อนำเอกสารไปเสนอหัวหน้าแผนกเซ็นอนุมัติ ก่อนนำมาเบิกพัสดุที่ห้องพัสดุครับ
      `,
      showCancelButton: true,
      confirmButtonText: '🖨️ สั่งพิมพ์ใบเบิกทันที (Print A4)',
      cancelButtonText: 'ปิด'
    }).then(result => {
      if (result.isConfirmed) {
        window.open(`print-slip.html?id=${json.data.id}&autoprint=1`, '_blank');
      }
    });

    await Promise.all([fetchRequisitions(), fetchItems()]);
  } catch (err) {
    Swal.fire('ข้อผิดพลาด', err.message, 'error');
  }
}

// Storekeeper Action: ตรวจรับใบเบิกที่เซ็นแล้ว & กดจ่ายของ
async function promptDispenseOrder(reqId) {
  const req = state.requisitions.find(r => r.id === reqId);
  if (!req) return;

  const result = await Swal.fire({
    title: `ตรวจรับใบเซ็น & จ่ายพัสดุ?`,
    html: `
      ใบเบิกเลขที่: <b>${req.id}</b><br>
      ผู้ขอเบิก: <b>${req.requisitioner}</b> (${req.departmentName})<br><br>
      <div class="text-left text-xs bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900">
        <b>โปรดตรวจสอบ:</b><br>
        1. ผู้เบิกนำใบเบิกกระดาษที่มี <b>"ลายเซ็นหัวหน้าแผนกอนุมัติแล้ว"</b> มาแสดง<br>
        2. ตรวจนับของครบถ้วนตามรายการ<br>
        3. เมื่อกดยืนยัน ระบบจะ <b>ตัดสต็อกพัสดุในคลังทันที</b>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ยืนยันจ่ายของ & ตัดสต็อก',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    try {
      const res = await fetch(`/api/requisitions/${reqId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          dispatchedBy: state.currentUser.fullName || 'เจ้าหน้าที่ห้องพัสดุ'
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      Swal.fire('จ่ายของสำเร็จ!', 'ระบบได้ทำการตัดสต็อกเรียบร้อยแล้ว กรุณาลงชื่อผู้จ่ายในใบเบิกกระดาษให้ผู้เบิก', 'success');

      await Promise.all([fetchRequisitions(), fetchItems()]);
      if (state.currentUser.role !== 'department') renderDashboard();
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.message, 'error');
    }
  }
}

function viewRequisitionDetail(id) {
  const req = state.requisitions.find(r => r.id === id);
  if (!req) return;

  state.selectedRequisition = req;

  document.getElementById('detailReqId').textContent = `ใบขอเบิกเลขที่ ${req.id}`;
  document.getElementById('detailReqMeta').textContent = `วันที่ทำรายการ: ${req.date || '-'} | สร้างเมื่อ: ${new Date(req.createdAt).toLocaleString('th-TH')}`;
  document.getElementById('detailReqUser').textContent = req.requisitioner;
  document.getElementById('detailReqDept').textContent = req.departmentName || '-';
  document.getElementById('detailReqPurpose').textContent = req.purpose || '-';
  document.getElementById('detailReqTotal').textContent = `฿${Number(req.totalEstimatedCost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

  const badgeEl = document.getElementById('detailReqStatusBadge');
  if (req.status === 'approved') {
    badgeEl.className = 'px-2 py-0.5 rounded font-semibold text-xs bg-emerald-100 text-emerald-800';
    badgeEl.textContent = 'อนุมัติ & จ่ายของแล้ว (ตัดสต็อกแล้ว)';
  } else if (req.status === 'rejected') {
    badgeEl.className = 'px-2 py-0.5 rounded font-semibold text-xs bg-rose-100 text-rose-800';
    badgeEl.textContent = 'ปฏิเสธคำขอ';
  } else {
    badgeEl.className = 'px-2 py-0.5 rounded font-semibold text-xs bg-amber-100 text-amber-800';
    badgeEl.textContent = 'รอหัวหน้าแผนกเซ็นอนุมัติ / รอเบิก';
  }

  const tbody = document.getElementById('detailReqItemsTbody');
  tbody.innerHTML = (req.items || []).map(item => `
    <tr>
      <td class="p-2.5 font-medium text-slate-800">${item.name}</td>
      <td class="p-2.5 text-center font-bold text-slate-900">${item.quantity}</td>
      <td class="p-2.5 text-center text-slate-500">${item.unit || 'ชิ้น'}</td>
      <td class="p-2.5 text-right text-slate-600">฿${Number(item.unitPrice || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="p-2.5 text-right font-semibold text-slate-900">฿${Number(item.totalPrice || (item.quantity * item.unitPrice)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  const actionDiv = document.getElementById('detailStatusActions');
  const isStore = state.currentUser && (state.currentUser.role === 'storekeeper' || state.currentUser.role === 'admin');

  if (req.status === 'pending') {
    if (isStore) {
      actionDiv.innerHTML = `
        <button onclick="updateReqStatus('${req.id}', 'rejected')" class="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition">
          <i class="fa-solid fa-xmark mr-1"></i> ปฏิเสธ
        </button>
        <button onclick="promptDispenseOrder('${req.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition">
          <i class="fa-solid fa-check mr-1"></i> ตรวจรับใบเซ็น & จ่ายของ (ตัดสต็อก)
        </button>
      `;
    } else {
      actionDiv.innerHTML = `<span class="text-xs text-amber-700 font-medium">โปรดสั่งพิมพ์ใบเบิกนี้ไปให้หัวหน้าแผนกเซ็น แล้วนำไปเบิกที่ห้องพัสดุ</span>`;
    }
  } else if (req.status === 'approved') {
    actionDiv.innerHTML = `
      <span class="text-xs text-emerald-700 font-medium">
        <i class="fa-solid fa-circle-check"></i> ดำเนินการจ่ายของแล้วโดย: ${req.dispatchedBy || 'เจ้าหน้าที่พัสดุ'}
      </span>
    `;
  } else {
    actionDiv.innerHTML = `<span class="text-xs text-rose-600 font-medium">รายการนี้ถูกปฏิเสธแล้ว</span>`;
  }

  document.getElementById('requisitionDetailModal').classList.remove('hidden');
}

function openPrintSlipWindow() {
  if (state.selectedRequisition) {
    window.open(`print-slip.html?id=${state.selectedRequisition.id}`, '_blank');
  }
}

async function updateReqStatus(id, newStatus) {
  const result = await Swal.fire({
    title: `ยืนยันการปฏิเสธคำขอ?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันปฏิเสธ',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    try {
      const res = await fetch(`/api/requisitions/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      closeModal('requisitionDetailModal');
      Swal.fire('สำเร็จ', json.message, 'success');

      await Promise.all([fetchRequisitions(), fetchItems()]);
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.message, 'error');
    }
  }
}

// ---------------------------------------------------------------------------
// TAB 4: STOCK IN (การรับเข้าพัสดุ)
// ---------------------------------------------------------------------------

function renderStockInsTable(stockInsToRender = null) {
  const stockIns = stockInsToRender || state.stockIns;
  const tbody = document.getElementById('stockInTableBody');
  if (!tbody) return;

  if (stockIns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">ยังไม่มีประวัติการรับเข้าสต็อก</td></tr>`;
    return;
  }

  tbody.innerHTML = stockIns.map(item => `
    <tr class="hover:bg-slate-50 transition">
      <td class="p-3 font-semibold text-blue-600 font-mono">${item.id}</td>
      <td class="p-3 text-slate-600">${item.date || '-'}</td>
      <td class="p-3 font-mono text-slate-700">${item.poNumber || '-'}</td>
      <td class="p-3 font-medium text-slate-900">${item.supplier || '-'}</td>
      <td class="p-3 text-slate-600">${item.receiverName || '-'}</td>
      <td class="p-3 text-center font-medium">${(item.items || []).length} รายการ</td>
      <td class="p-3 text-right font-semibold text-emerald-700">฿${Number(item.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="p-3 text-center">
        <button onclick="viewStockInDetail('${item.id}')" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition">
          ดูรายการ
        </button>
      </td>
    </tr>
  `).join('');
}

function filterStockInTable() {
  const search = (document.getElementById('stockInSearchInput').value || '').toLowerCase().trim();
  const filtered = state.stockIns.filter(i => {
    return !search ||
      (i.id || '').toLowerCase().includes(search) ||
      (i.poNumber || '').toLowerCase().includes(search) ||
      (i.supplier || '').toLowerCase().includes(search) ||
      (i.receiverName || '').toLowerCase().includes(search);
  });
  renderStockInsTable(filtered);
}

function openStockInModal() {
  const modal = document.getElementById('stockInModal');
  document.getElementById('stockInForm').reset();
  document.getElementById('inDate').value = new Date().toISOString().split('T')[0];

  if (state.currentUser) {
    document.getElementById('inReceiverName').value = state.currentUser.fullName || '';
  }

  const container = document.getElementById('stockInRowsContainer');
  container.innerHTML = '';
  addStockInRow();

  calculateStockInModalTotal();
  modal.classList.remove('hidden');
}

function openStockInForSpecificItem(itemId) {
  openStockInModal();
  const select = document.querySelector('#stockInRowsContainer .stockin-item-select');
  if (select) {
    select.value = itemId;
    const rowId = select.closest('.grid').id;
    handleStockInItemChange(rowId);
  }
}

function addStockInRow() {
  const container = document.getElementById('stockInRowsContainer');
  const rowId = 'stockin-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'grid grid-cols-12 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl items-center text-xs';

  const itemOptions = state.items.map(item => `
    <option value="${item.id}" data-unit="${item.unit}" data-price="${item.unitPrice}">
      ${item.name} (${item.unit})
    </option>
  `).join('');

  row.innerHTML = `
    <div class="col-span-12 sm:col-span-5">
      <select class="stockin-item-select w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" onchange="handleStockInItemChange('${rowId}')">
        <option value="">-- เลือกอุปกรณ์สำนักงาน --</option>
        ${itemOptions}
      </select>
    </div>
    <div class="col-span-3 sm:col-span-2">
      <div class="flex items-center gap-1">
        <input type="number" min="1" value="10" class="stockin-item-qty w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-500" oninput="calculateStockInModalTotal()">
        <span class="stockin-item-unit text-slate-500 whitespace-nowrap">-</span>
      </div>
    </div>
    <div class="col-span-4 sm:col-span-2">
      <input type="number" step="0.01" min="0" placeholder="ราคา/หน่วย" class="stockin-item-price w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-right font-medium focus:outline-none focus:ring-1 focus:ring-blue-500" oninput="calculateStockInModalTotal()">
    </div>
    <div class="col-span-4 sm:col-span-2 text-right font-bold text-slate-900">
      <span class="stockin-item-subtotal">฿0.00</span>
    </div>
    <div class="col-span-1 text-center">
      <button type="button" onclick="removeStockInRow('${rowId}')" class="text-slate-400 hover:text-rose-500 transition">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  calculateStockInModalTotal();
}

function removeStockInRow(rowId) {
  const el = document.getElementById(rowId);
  if (el) el.remove();
  calculateStockInModalTotal();
}

function handleStockInItemChange(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;

  const select = row.querySelector('.stockin-item-select');
  const selectedOpt = select.options[select.selectedIndex];
  const unit = selectedOpt.getAttribute('data-unit') || '-';
  const price = Number(selectedOpt.getAttribute('data-price') || 0);

  row.querySelector('.stockin-item-unit').textContent = unit;
  const priceInput = row.querySelector('.stockin-item-price');
  if (priceInput && (!priceInput.value || Number(priceInput.value) === 0)) {
    priceInput.value = price;
  }

  calculateStockInModalTotal();
}

function calculateStockInModalTotal() {
  const container = document.getElementById('stockInRowsContainer');
  if (!container) return;

  let total = 0;
  const rows = container.querySelectorAll('.grid');

  rows.forEach(row => {
    const select = row.querySelector('.stockin-item-select');
    const qtyInput = row.querySelector('.stockin-item-qty');
    const priceInput = row.querySelector('.stockin-item-price');
    const subtotalEl = row.querySelector('.stockin-item-subtotal');

    if (select && select.value) {
      const qty = Number(qtyInput.value) || 0;
      const price = Number(priceInput.value) || 0;
      const sub = qty * price;
      total += sub;
      subtotalEl.textContent = `฿${sub.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    } else {
      subtotalEl.textContent = '฿0.00';
    }
  });

  const totalEl = document.getElementById('stockInFormTotalAmount');
  if (totalEl) totalEl.textContent = `฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
}

async function handleStockInSubmit(e) {
  e.preventDefault();

  const date = document.getElementById('inDate').value;
  const poNumber = document.getElementById('inPoNumber').value.trim();
  const supplier = document.getElementById('inSupplier').value.trim();
  const receiverName = document.getElementById('inReceiverName').value.trim();
  const notes = document.getElementById('inNotes').value.trim();

  const items = [];
  const rows = document.querySelectorAll('#stockInRowsContainer .grid');

  rows.forEach(row => {
    const select = row.querySelector('.stockin-item-select');
    const qtyInput = row.querySelector('.stockin-item-qty');
    const priceInput = row.querySelector('.stockin-item-price');

    if (select && select.value) {
      items.push({
        itemId: select.value,
        quantity: Number(qtyInput.value) || 1,
        unitPrice: Number(priceInput.value) || 0
      });
    }
  });

  if (items.length === 0) {
    Swal.fire('แจ้งเตือน', 'กรุณาเลือกอุปกรณ์ที่ต้องการรับเข้าอย่างน้อย 1 รายการ', 'warning');
    return;
  }

  const payload = { date, poNumber, supplier, receiverName, notes, items };

  try {
    const res = await fetch('/api/stock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    closeModal('stockInModal');
    Swal.fire('รับเข้าสต็อกสำเร็จ', `บันทึกรับเข้าเลขที่ ${json.data.id} เรียบร้อยแล้ว สต็อกพัสดุได้รับการอัปเดต`, 'success');

    await Promise.all([fetchStockIns(), fetchItems()]);
    if (state.currentUser.role !== 'department') renderDashboard();
  } catch (err) {
    Swal.fire('ข้อผิดพลาด', err.message, 'error');
  }
}

function viewStockInDetail(id) {
  const record = state.stockIns.find(i => i.id === id);
  if (!record) return;

  document.getElementById('detailInId').textContent = `ใบรับเข้าพัสดุเลขที่ ${record.id}`;
  document.getElementById('detailInMeta').textContent = `วันที่รับ: ${record.date || '-'} | บันทึกเมื่อ: ${new Date(record.createdAt).toLocaleString('th-TH')}`;
  document.getElementById('detailInSupplier').textContent = record.supplier || '-';
  document.getElementById('detailInPo').textContent = record.poNumber || '-';
  document.getElementById('detailInReceiver').textContent = record.receiverName || '-';
  document.getElementById('detailInTotal').textContent = `฿${Number(record.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

  const tbody = document.getElementById('detailInItemsTbody');
  tbody.innerHTML = (record.items || []).map(item => `
    <tr>
      <td class="p-2.5 font-medium text-slate-800">${item.name}</td>
      <td class="p-2.5 text-center font-bold text-slate-900">${item.quantity}</td>
      <td class="p-2.5 text-center text-slate-500">${item.unit || 'ชิ้น'}</td>
      <td class="p-2.5 text-right text-slate-600">฿${Number(item.unitPrice || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td class="p-2.5 text-right font-semibold text-slate-900">฿${Number(item.totalPrice || (item.quantity * item.unitPrice)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  document.getElementById('stockInDetailModal').classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// TAB 5: COMPREHENSIVE REPORTS (Admin)
// ---------------------------------------------------------------------------

let currentReportData = { type: 'inventory', title: '', headers: [], rows: [] };

async function generateReport() {
  const type = document.getElementById('reportTypeSelect').value;
  const categoryId = document.getElementById('reportCategoryFilter').value;
  const departmentId = document.getElementById('reportDeptFilter').value;
  const startDate = document.getElementById('reportStartDate').value;
  const endDate = document.getElementById('reportEndDate').value;

  const orgName = state.settings.orgName || 'บริษัท สยาม ซินเนอร์จี้ จำกัด';
  document.getElementById('reportOrgNameTitle').textContent = orgName;
  document.getElementById('reportPrintDate').textContent = new Date().toLocaleDateString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const queryParams = new URLSearchParams({ type, categoryId, departmentId, startDate, endDate });

  try {
    const res = await fetch(`/api/reports?${queryParams.toString()}`);
    const json = await res.json();
    if (!json.success) return;

    const data = json.data;
    const thead = document.getElementById('reportOutputThead');
    const tbody = document.getElementById('reportOutputTbody');
    const tfoot = document.getElementById('reportOutputTfoot');

    let title = '';
    let rowsHtml = '';
    let footHtml = '';

    if (type === 'inventory') {
      title = '1. รายงานสรุปสต็อกคงเหลือและมูลค่ารวมตามหมวดหมู่';
      thead.innerHTML = `
        <tr>
          <th class="p-2.5 text-center w-12">#</th>
          <th class="p-2.5 w-24">รหัสพัสดุ</th>
          <th class="p-2.5">รายการอุปกรณ์สำนักงาน</th>
          <th class="p-2.5">หมวดหมู่</th>
          <th class="p-2.5 text-center">คงเหลือ</th>
          <th class="p-2.5 text-center">จุดสั่งซื้อ</th>
          <th class="p-2.5 text-right">ราคา/หน่วย</th>
          <th class="p-2.5 text-right">มูลค่ารวม (บาท)</th>
          <th class="p-2.5">สถานที่เก็บ</th>
        </tr>
      `;

      let totalUnits = 0;
      let totalValue = 0;

      rowsHtml = (data.inventory || []).map((item, idx) => {
        totalUnits += item.currentStock;
        totalValue += (item.totalValue || 0);

        let stockText = `${item.currentStock} ${item.unit}`;
        if (item.isLowStock) stockText = `<span class="text-amber-600 font-bold">${item.currentStock} ${item.unit} (ใกล้หมด)</span>`;
        if (item.isOutOfStock) stockText = `<span class="text-rose-600 font-bold">0 ${item.unit} (หมดสต็อก)</span>`;

        return `
          <tr class="hover:bg-slate-50">
            <td class="p-2 text-center text-slate-400">${idx + 1}</td>
            <td class="p-2 font-mono text-xs">${item.code}</td>
            <td class="p-2 font-medium text-slate-800">${item.name}</td>
            <td class="p-2 text-slate-600">${item.categoryName}</td>
            <td class="p-2 text-center font-medium">${stockText}</td>
            <td class="p-2 text-center text-slate-500">${item.minStock} ${item.unit}</td>
            <td class="p-2 text-right">฿${Number(item.unitPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
            <td class="p-2 text-right font-semibold text-slate-900">฿${Number(item.totalValue).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
            <td class="p-2 text-slate-500 text-xs">${item.location || '-'}</td>
          </tr>
        `;
      }).join('');

      footHtml = `
        <tr>
          <td colspan="4" class="p-2.5 text-right font-bold">รวมทั้งสิ้น:</td>
          <td class="p-2.5 text-center font-bold text-blue-700">${totalUnits.toLocaleString()} หน่วย</td>
          <td colspan="2"></td>
          <td class="p-2.5 text-right font-bold text-emerald-700 text-base">฿${totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          <td></td>
        </tr>
      `;

      updateReportKpis('จำนวนรายการวัสดุ', (data.inventory || []).length, 'รวมจำนวนสต็อก (หน่วย)', totalUnits.toLocaleString(), 'มูลค่ารวมพัสดุในคลัง', `฿${totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`);
    } else if (type === 'requisition') {
      title = '2. รายงานการขอเบิก-จ่ายพัสดุ (ตามแผนก/บุคคล)';
      thead.innerHTML = `
        <tr>
          <th class="p-2.5 w-24">เลขที่ใบเบิก</th>
          <th class="p-2.5">วันที่</th>
          <th class="p-2.5">ผู้ขอเบิก</th>
          <th class="p-2.5">แผนก/ฝ่าย</th>
          <th class="p-2.5">รายการอุปกรณ์ที่เบิก</th>
          <th class="p-2.5 text-center">สถานะ</th>
          <th class="p-2.5 text-right">มูลค่ารวม (บาท)</th>
        </tr>
      `;

      let totalReqCost = 0;
      let totalReqItems = 0;

      rowsHtml = (data.requisitions || []).map(r => {
        totalReqCost += Number(r.totalEstimatedCost || 0);
        totalReqItems += (r.items || []).length;
        const itemsSummary = (r.items || []).map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ');

        let statusText = 'รอเบิก';
        if (r.status === 'approved') statusText = '<span class="text-emerald-700 font-semibold">จ่ายแล้ว</span>';
        if (r.status === 'rejected') statusText = '<span class="text-rose-600 font-semibold">ปฏิเสธ</span>';

        return `
          <tr class="hover:bg-slate-50">
            <td class="p-2 font-mono font-bold text-blue-600">${r.id}</td>
            <td class="p-2 text-slate-600">${r.date || '-'}</td>
            <td class="p-2 font-medium text-slate-800">${r.requisitioner}</td>
            <td class="p-2 text-slate-700">${r.departmentName}</td>
            <td class="p-2 text-xs text-slate-600 max-w-sm truncate" title="${itemsSummary}">${itemsSummary}</td>
            <td class="p-2 text-center">${statusText}</td>
            <td class="p-2 text-right font-semibold text-slate-900">฿${Number(r.totalEstimatedCost).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      }).join('');

      footHtml = `
        <tr>
          <td colspan="6" class="p-2.5 text-right font-bold">ยอดรวมมูลค่าการเบิกทั้งสิ้น:</td>
          <td class="p-2.5 text-right font-bold text-emerald-700 text-base">฿${totalReqCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;

      updateReportKpis('จำนวนใบขอเบิก', (data.requisitions || []).length, 'รวมรายการที่เบิก', totalReqItems.toLocaleString(), 'มูลค่าการเบิกรวม', `฿${totalReqCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`);
    } else if (type === 'stockin') {
      title = '3. รายงานการรับเข้าพัสดุอุปกรณ์เข้าคลังสต็อก';
      thead.innerHTML = `
        <tr>
          <th class="p-2.5 w-24">เลขที่รับ</th>
          <th class="p-2.5">วันที่รับ</th>
          <th class="p-2.5">เลขที่ PO</th>
          <th class="p-2.5">ผู้จัดจำหน่าย / แหล่งที่มา</th>
          <th class="p-2.5">ผู้ตรวจรับ</th>
          <th class="p-2.5">รายการอุปกรณ์ที่รับเข้า</th>
          <th class="p-2.5 text-right">ยอดเงินรวม (บาท)</th>
        </tr>
      `;

      let totalInCost = 0;
      rowsHtml = (data.stockIns || []).map(s => {
        totalInCost += Number(s.totalAmount || 0);
        const itemsSummary = (s.items || []).map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ');

        return `
          <tr class="hover:bg-slate-50">
            <td class="p-2 font-mono font-bold text-blue-600">${s.id}</td>
            <td class="p-2 text-slate-600">${s.date || '-'}</td>
            <td class="p-2 font-mono text-slate-700">${s.poNumber || '-'}</td>
            <td class="p-2 font-medium text-slate-800">${s.supplier}</td>
            <td class="p-2 text-slate-600">${s.receiverName}</td>
            <td class="p-2 text-xs text-slate-600 max-w-sm truncate" title="${itemsSummary}">${itemsSummary}</td>
            <td class="p-2 text-right font-semibold text-emerald-700">฿${Number(s.totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      }).join('');

      footHtml = `
        <tr>
          <td colspan="6" class="p-2.5 text-right font-bold">ยอดรับเข้าสต็อกรวมทั้งสิ้น:</td>
          <td class="p-2.5 text-right font-bold text-emerald-700 text-base">฿${totalInCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;

      updateReportKpis('จำนวนครั้งที่รับเข้า', (data.stockIns || []).length, 'ผู้จำหน่ายทั้งหมด', new Set((data.stockIns || []).map(s => s.supplier)).size, 'มูลค่ารับเข้าสต็อกรวม', `฿${totalInCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`);
    } else if (type === 'dept_expense') {
      title = '4. รายงานสรุปค่าใช้จ่ายและปริมาณการเบิกอุปกรณ์ตามแผนก';
      thead.innerHTML = `
        <tr>
          <th class="p-2.5 text-center w-12">#</th>
          <th class="p-2.5">ชื่อฝ่าย / แผนก</th>
          <th class="p-2.5 text-center">จำนวนใบเบิก</th>
          <th class="p-2.5 text-center">จำนวนชิ้นที่เบิกรวม</th>
          <th class="p-2.5 text-right">ค่าใช้จ่ายรวม (บาท)</th>
          <th class="p-2.5 text-right">สัดส่วนค่าใช้จ่าย (%)</th>
        </tr>
      `;

      const deptSummary = {};
      state.departments.forEach(d => {
        deptSummary[d.id] = { name: d.name, slipsCount: 0, itemsQty: 0, totalCost: 0 };
      });

      let grandCost = 0;
      (data.requisitions || []).forEach(r => {
        const dId = r.departmentId;
        if (!deptSummary[dId]) deptSummary[dId] = { name: r.departmentName, slipsCount: 0, itemsQty: 0, totalCost: 0 };
        deptSummary[dId].slipsCount += 1;
        deptSummary[dId].totalCost += (r.totalEstimatedCost || 0);
        grandCost += (r.totalEstimatedCost || 0);

        (r.items || []).forEach(i => { deptSummary[dId].itemsQty += (i.quantity || 0); });
      });

      const deptList = Object.values(deptSummary).sort((a, b) => b.totalCost - a.totalCost);

      rowsHtml = deptList.map((d, idx) => {
        const percent = grandCost > 0 ? ((d.totalCost / grandCost) * 100).toFixed(1) : 0;
        return `
          <tr class="hover:bg-slate-50">
            <td class="p-2 text-center text-slate-400">${idx + 1}</td>
            <td class="p-2 font-medium text-slate-900">${d.name}</td>
            <td class="p-2 text-center">${d.slipsCount} ใบ</td>
            <td class="p-2 text-center">${d.itemsQty.toLocaleString()} ชิ้น</td>
            <td class="p-2 text-right font-semibold text-slate-900">฿${d.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
            <td class="p-2 text-right text-blue-600 font-bold">${percent}%</td>
          </tr>
        `;
      }).join('');

      footHtml = `
        <tr>
          <td colspan="4" class="p-2.5 text-right font-bold">รวมค่าใช้จ่ายอุปกรณ์ทั้งหมด:</td>
          <td class="p-2.5 text-right font-bold text-emerald-700 text-base">฿${grandCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          <td class="p-2.5 text-right font-bold text-blue-700">100.0%</td>
        </tr>
      `;

      updateReportKpis('แผนกทั้งหมด', deptList.length, 'ยอดเบิกรวมทั้งหมด', (data.requisitions || []).length + ' ใบ', 'รวมค่าใช้จ่ายทั้งสิ้น', `฿${grandCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`);
    } else if (type === 'lowstock') {
      title = '5. รายงานรายการวัสดุที่ต้องจัดซื้อเพิ่ม (ต่ำกว่าเกณฑ์สั่งซื้อ)';
      thead.innerHTML = `
        <tr>
          <th class="p-2.5 text-center w-12">#</th>
          <th class="p-2.5 w-24">รหัสพัสดุ</th>
          <th class="p-2.5">รายการอุปกรณ์สำนักงาน</th>
          <th class="p-2.5">หมวดหมู่</th>
          <th class="p-2.5 text-center">คงเหลือในคลัง</th>
          <th class="p-2.5 text-center">จุดสั่งซื้อขั้นต่ำ</th>
          <th class="p-2.5 text-center">จำนวนที่ควรสั่งซื้อเพิ่ม</th>
          <th class="p-2.5 text-right">ราคาต่อหน่วย</th>
          <th class="p-2.5 text-right">งบประมาณสั่งซื้อโดยประมาณ</th>
        </tr>
      `;

      const lowItems = (data.inventory || []).filter(i => i.isLowStock);
      let totalReorderBudget = 0;

      rowsHtml = lowItems.map((item, idx) => {
        const suggestedQty = Math.max(item.minStock, (item.minStock * 2) - item.currentStock);
        const estCost = suggestedQty * (item.unitPrice || 0);
        totalReorderBudget += estCost;

        return `
          <tr class="hover:bg-slate-50">
            <td class="p-2 text-center text-slate-400">${idx + 1}</td>
            <td class="p-2 font-mono text-xs font-semibold">${item.code}</td>
            <td class="p-2 font-medium text-slate-900">${item.name}</td>
            <td class="p-2 text-slate-600">${item.categoryName}</td>
            <td class="p-2 text-center font-bold ${item.currentStock <= 0 ? 'text-rose-600' : 'text-amber-600'}">${item.currentStock} ${item.unit}</td>
            <td class="p-2 text-center text-slate-500">${item.minStock} ${item.unit}</td>
            <td class="p-2 text-center font-bold text-blue-700 bg-blue-50/50">${suggestedQty} ${item.unit}</td>
            <td class="p-2 text-right">฿${Number(item.unitPrice).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
            <td class="p-2 text-right font-semibold text-slate-900">฿${estCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      }).join('');

      if (lowItems.length === 0) {
        rowsHtml = `<tr><td colspan="9" class="p-8 text-center text-slate-400">พัสดุทุกรายการมีสต็อกเพียงพอ ไม่พบรายการที่ต้องสั่งซื้อด่วน</td></tr>`;
      }

      footHtml = `
        <tr>
          <td colspan="6" class="p-2.5 text-right font-bold">งบประมาณแนะนำในการจัดซื้อรอบนี้:</td>
          <td colspan="3" class="p-2.5 text-right font-bold text-blue-700 text-base">฿${totalReorderBudget.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;

      updateReportKpis('รายการที่ต้องสั่งซื้อ', lowItems.length, 'หมดสต็อกทันที', lowItems.filter(i => i.currentStock <= 0).length, 'งบสั่งซื้อโดยประมาณ', `฿${totalReorderBudget.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`);
    }

    document.getElementById('reportTitleHeader').textContent = title;
    tbody.innerHTML = rowsHtml;
    tfoot.innerHTML = footHtml;

    currentReportData.type = type;
    currentReportData.title = title;
  } catch (err) {
    console.error('Error generating report:', err);
  }
}

function updateReportKpis(kpi1Title, kpi1Val, kpi2Title, kpi2Val, kpi3Title, kpi3Val) {
  document.getElementById('reportKpi1Title').textContent = kpi1Title;
  document.getElementById('reportKpi1Val').textContent = kpi1Val;
  document.getElementById('reportKpi2Title').textContent = kpi2Title;
  document.getElementById('reportKpi2Val').textContent = kpi2Val;
  document.getElementById('reportKpi3Title').textContent = kpi3Title;
  document.getElementById('reportKpi3Val').textContent = kpi3Val;
}

function printReportA4() {
  window.print();
}

function exportCurrentReportToExcel() {
  const table = document.getElementById('reportOutputTable');
  if (!table) return;

  const title = currentReportData.title || 'Office_Supplies_Report';
  const wb = XLSX.utils.table_to_book(table, { sheet: "Report" });
  const filename = `${title.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function exportInventoryToExcel() {
  const data = state.items.map((i, idx) => ({
    "ลำดับ": idx + 1,
    "รหัสพัสดุ": i.code,
    "ชื่ออุปกรณ์": i.name,
    "หมวดหมู่": i.categoryName,
    "คงเหลือ": i.currentStock,
    "หน่วยนับ": i.unit,
    "จุดสั่งซื้อ": i.minStock,
    "ราคาต่อหน่วย": i.unitPrice,
    "มูลค่ารวม": i.totalValue,
    "สถานที่เก็บ": i.location || '',
    "สถานะ": i.isOutOfStock ? 'หมดสต็อก' : (i.isLowStock ? 'ใกล้หมด' : 'ปกติ')
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  XLSX.writeFile(wb, `สรุปสต็อกอุปกรณ์สำนักงาน_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportRequisitionsToExcel() {
  const flatData = [];
  state.requisitions.forEach(r => {
    (r.items || []).forEach(item => {
      flatData.push({
        "เลขที่ใบเบิก": r.id,
        "วันที่": r.date,
        "ผู้ขอเบิก": r.requisitioner,
        "แผนก": r.departmentName,
        "วัตถุประสงค์": r.purpose,
        "สถานะ": r.status === 'approved' ? 'จ่ายแล้ว' : (r.status === 'rejected' ? 'ปฏิเสธ' : 'รอเบิก'),
        "รหัสพัสดุ": item.itemId,
        "รายการอุปกรณ์": item.name,
        "จำนวน": item.quantity,
        "หน่วย": item.unit,
        "ราคาต่อหน่วย": item.unitPrice,
        "ยอดรวม": item.totalPrice || (item.quantity * item.unitPrice)
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(flatData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Requisitions");
  XLSX.writeFile(wb, `ประวัติการเบิกพัสดุ_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportStockInsToExcel() {
  const flatData = [];
  state.stockIns.forEach(s => {
    (s.items || []).forEach(item => {
      flatData.push({
        "เลขที่รับ": s.id,
        "วันที่รับ": s.date,
        "เลขที่ PO": s.poNumber,
        "ผู้จัดจำหน่าย": s.supplier,
        "ผู้ตรวจรับ": s.receiverName,
        "รายการอุปกรณ์": item.name,
        "จำนวนรับ": item.quantity,
        "หน่วย": item.unit,
        "ราคาต่อหน่วย": item.unitPrice,
        "ยอดรวม": item.totalPrice || (item.quantity * item.unitPrice)
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(flatData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "StockIns");
  XLSX.writeFile(wb, `ประวัติรับเข้าสต็อก_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ---------------------------------------------------------------------------
// TAB 6: SETTINGS & USER MANAGEMENT (Admin)
// ---------------------------------------------------------------------------

function renderSettingsView() {
  const s = state.settings;
  if (s) {
    if (document.getElementById('setOrgName')) document.getElementById('setOrgName').value = s.orgName || '';
    if (document.getElementById('setManagerName')) document.getElementById('setManagerName').value = s.managerName || '';
    if (document.getElementById('setOrgAddress')) document.getElementById('setOrgAddress').value = s.orgAddress || '';
    if (document.getElementById('setOrgPhone')) document.getElementById('setOrgPhone').value = s.orgPhone || '';
    if (document.getElementById('setLowStockDefault')) document.getElementById('setLowStockDefault').value = s.lowStockThresholdDefault || 5;
  }

  // Categories list
  const catList = document.getElementById('settingsCategoryList');
  if (catList) {
    catList.innerHTML = state.categories.map(c => `
      <div class="py-2.5 flex justify-between items-center text-xs sm:text-sm">
        <div class="flex items-center gap-2">
          <i class="fa-solid ${c.icon || 'fa-box'} text-slate-500 w-5 text-center"></i>
          <span class="font-medium text-slate-800">${c.name}</span>
        </div>
        <button onclick="deleteCategory('${c.id}')" class="text-slate-400 hover:text-rose-500 transition px-2 py-1">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');
  }

  // Departments list
  const deptList = document.getElementById('settingsDeptList');
  if (deptList) {
    deptList.innerHTML = state.departments.map(d => `
      <div class="py-2.5 flex justify-between items-center text-xs sm:text-sm">
        <div>
          <div class="font-medium text-slate-800">${d.name}</div>
          <div class="text-[11px] text-slate-400">${d.manager ? 'หัวหน้างาน: ' + d.manager : ''}</div>
        </div>
        <button onclick="deleteDepartment('${d.id}')" class="text-slate-400 hover:text-rose-500 transition px-2 py-1">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');
  }

  renderUsersTable();
}

function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  tbody.innerHTML = (state.users || []).map(u => {
    let roleBadge = '<span class="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">ผู้เบิกประจำแผนก</span>';
    if (u.role === 'admin') roleBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-white">ผู้ดูแลระบบ (Admin)</span>';
    if (u.role === 'storekeeper') roleBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">จนท.ห้องพัสดุ (Storekeeper)</span>';

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-mono font-bold text-slate-800">${u.username}</td>
        <td class="p-3 font-medium text-slate-900">${u.fullName}</td>
        <td class="p-3">${roleBadge}</td>
        <td class="p-3 text-slate-600">${u.departmentName || '-'}</td>
        <td class="p-3 text-slate-500 text-xs">${u.phone || '-'}</td>
        <td class="p-3 text-center">
          ${u.id === 'usr-admin' ? '<span class="text-slate-400 text-xs">หลัก</span>' : `
            <button onclick="deleteUser('${u.id}')" title="ลบผู้ใช้" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 transition inline-flex items-center justify-center text-xs">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function openUserModal() {
  const modal = document.getElementById('userModal');
  const deptSelect = document.getElementById('userDepartmentId');

  deptSelect.innerHTML = state.departments.map(d => `
    <option value="${d.id}">${d.name}</option>
  `).join('');

  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  modal.classList.remove('hidden');
}

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const payload = {
    username: document.getElementById('userUsername').value.trim(),
    password: document.getElementById('userPassword').value,
    fullName: document.getElementById('userFullName').value.trim(),
    role: document.getElementById('userRole').value,
    departmentId: document.getElementById('userDepartmentId').value,
    phone: document.getElementById('userPhone').value.trim()
  };

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    closeModal('userModal');
    Swal.fire('สำเร็จ', 'สร้างบัญชีผู้ใช้งานเรียบร้อยแล้ว', 'success');
    await fetchUsers();
  } catch (err) {
    Swal.fire('ข้อผิดพลาด', err.message, 'error');
  }
}

async function deleteUser(id) {
  const result = await Swal.fire({
    title: 'ยืนยันลบผู้ใช้งานนี้?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ใช่, ลบ',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      Swal.fire('สำเร็จ', 'ลบผู้ใช้เรียบร้อยแล้ว', 'success');
      await fetchUsers();
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.message, 'error');
    }
  }
}

async function saveOrgSettings(e) {
  e.preventDefault();
  const payload = {
    orgName: document.getElementById('setOrgName').value.trim(),
    managerName: document.getElementById('setManagerName').value.trim(),
    orgAddress: document.getElementById('setOrgAddress').value.trim(),
    orgPhone: document.getElementById('setOrgPhone').value.trim(),
    lowStockThresholdDefault: Number(document.getElementById('setLowStockDefault').value) || 5
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    Swal.fire('บันทึกสำเร็จ', 'อัปเดตข้อมูลองค์กรเรียบร้อยแล้ว', 'success');
    await fetchSettings();
  } catch (err) {
    Swal.fire('ข้อผิดพลาด', err.message, 'error');
  }
}

async function promptAddCategory() {
  const { value: name } = await Swal.fire({
    title: 'เพิ่มหมวดหมู่อุปกรณ์ใหม่',
    input: 'text',
    inputPlaceholder: 'เช่น เครื่องเขียน, หมึกพิมพ์, แฟ้มเอกสาร...',
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก'
  });

  if (name && name.trim()) {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      await fetchCategories();
      renderSettingsView();
      populateDropdowns();
      Swal.fire('สำเร็จ', 'เพิ่มหมวดหมู่เรียบร้อยแล้ว', 'success');
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.message, 'error');
    }
  }
}

async function deleteCategory(id) {
  const result = await Swal.fire({
    title: 'ยืนยันลบหมวดหมู่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ใช่, ลบ',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      await fetchCategories();
      renderSettingsView();
      populateDropdowns();
      Swal.fire('ลบสำเร็จ', 'ลบหมวดหมู่เรียบร้อยแล้ว', 'success');
    } catch (err) {
      Swal.fire('ไม่สามารถลบได้', err.message, 'error');
    }
  }
}

async function promptAddDepartment() {
  const { value: formValues } = await Swal.fire({
    title: 'เพิ่มแผนก / ฝ่ายใหม่',
    html: `
      <input id="swal-dept-name" class="swal2-input" placeholder="ชื่อฝ่าย เช่น ฝ่ายการตลาด, ฝ่ายกฎหมาย">
      <input id="swal-dept-mgr" class="swal2-input" placeholder="ชื่อผู้จัดการฝ่าย (ถ้ามี)">
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    preConfirm: () => {
      const name = document.getElementById('swal-dept-name').value.trim();
      const manager = document.getElementById('swal-dept-mgr').value.trim();
      if (!name) {
        Swal.showValidationMessage('กรุณาระบุชื่อแผนก');
        return false;
      }
      return { name, manager };
    }
  });

  if (formValues) {
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      await fetchDepartments();
      renderSettingsView();
      populateDropdowns();
      Swal.fire('สำเร็จ', 'เพิ่มแผนกเรียบร้อยแล้ว', 'success');
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.message, 'error');
    }
  }
}

async function deleteDepartment(id) {
  const result = await Swal.fire({
    title: 'ยืนยันลบแผนกนี้?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ใช่, ลบ',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      await fetchDepartments();
      renderSettingsView();
      populateDropdowns();
      Swal.fire('ลบสำเร็จ', 'ลบแผนกเรียบร้อยแล้ว', 'success');
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.message, 'error');
    }
  }
}

async function handleRestoreUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const json = JSON.parse(evt.target.result);
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });
      const resJson = await res.json();
      if (!resJson.success) throw new Error(resJson.message);

      Swal.fire('กู้คืนสำเร็จ', 'กู้คืนฐานข้อมูลสำรองเรียบร้อยแล้ว', 'success');
      await initializeApp();
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาดในการกู้คืน', err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// Item Modal logic
function openItemModal(item = null) {
  const modal = document.getElementById('itemModal');
  const title = document.getElementById('itemModalTitle');
  const catSelect = document.getElementById('itemCategoryId');

  catSelect.innerHTML = state.categories.map(c => `
    <option value="${c.id}">${c.name}</option>
  `).join('');

  if (item) {
    title.textContent = 'แก้ไขรายการอุปกรณ์';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemCode').value = item.code || '';
    document.getElementById('itemName').value = item.name || '';
    document.getElementById('itemCategoryId').value = item.categoryId || '';
    document.getElementById('itemUnit').value = item.unit || '';
    document.getElementById('itemCurrentStock').value = item.currentStock || 0;
    document.getElementById('itemMinStock').value = item.minStock || 5;
    document.getElementById('itemUnitPrice').value = item.unitPrice || 0;
    document.getElementById('itemLocation').value = item.location || '';
    document.getElementById('itemDescription').value = item.description || '';
  } else {
    title.textContent = 'เพิ่มรายการอุปกรณ์ใหม่';
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    const nextNum = state.items.length + 1;
    document.getElementById('itemCode').value = `OFF-${String(nextNum).padStart(3, '0')}`;
    document.getElementById('itemMinStock').value = state.settings.lowStockThresholdDefault || 5;
  }

  modal.classList.remove('hidden');
}

async function handleItemFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('itemId').value;
  const payload = {
    code: document.getElementById('itemCode').value.trim(),
    name: document.getElementById('itemName').value.trim(),
    categoryId: document.getElementById('itemCategoryId').value,
    unit: document.getElementById('itemUnit').value.trim(),
    currentStock: Number(document.getElementById('itemCurrentStock').value) || 0,
    minStock: Number(document.getElementById('itemMinStock').value) || 5,
    unitPrice: Number(document.getElementById('itemUnitPrice').value) || 0,
    location: document.getElementById('itemLocation').value.trim(),
    description: document.getElementById('itemDescription').value.trim()
  };

  try {
    let res;
    if (id) {
      res = await fetch(`/api/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    closeModal('itemModal');
    Swal.fire({ icon: 'success', title: json.message || 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });

    await fetchItems();
    if (state.currentUser.role !== 'department') renderDashboard();
  } catch (err) {
    Swal.fire('ข้อผิดพลาด', err.message, 'error');
  }
}

function editItem(id) {
  const item = state.items.find(i => i.id === id);
  if (item) openItemModal(item);
}

async function deleteItem(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;

  const result = await Swal.fire({
    title: 'ยืนยันการลบรายการ?',
    text: `ต้องการลบ "${item.name}" ออกจากระบบหรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ใช่, ลบรายการนี้',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      Swal.fire('ลบสำเร็จ', 'ลบรายการอุปกรณ์เรียบร้อยแล้ว', 'success');
      await fetchItems();
      if (state.currentUser.role !== 'department') renderDashboard();
    } catch (err) {
      Swal.fire('ไม่สามารถลบได้', err.message, 'error');
    }
  }
}

function populateDropdowns() {
  const invCat = document.getElementById('inventoryCategoryFilter');
  if (invCat) {
    invCat.innerHTML = `<option value="all">ทุกหมวดหมู่</option>` +
      state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  const repCat = document.getElementById('reportCategoryFilter');
  if (repCat) {
    repCat.innerHTML = `<option value="all">ทุกหมวดหมู่</option>` +
      state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  const reqDept = document.getElementById('reqDeptFilter');
  if (reqDept) {
    reqDept.innerHTML = `<option value="all">ทุกแผนก/ฝ่าย</option>` +
      state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }

  const repDept = document.getElementById('reportDeptFilter');
  if (repDept) {
    repDept.innerHTML = `<option value="all">ทุกแผนก/ฝ่าย</option>` +
      state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}
