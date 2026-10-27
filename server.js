require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// 1. Authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }
    const user = await db.authenticate(username, password);
    if (!user) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    res.json({ success: true, data: user, message: 'เข้าสู่ระบบสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. User Management (Admin only)
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, fullName, role, departmentId, phone } = req.body;
    if (!username || !fullName) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อผู้ใช้และชื่อ-นามสกุล' });
    }
    const created = await db.createUser({ username, password, fullName, role, departmentId, phone });
    res.status(201).json({ success: true, data: created, message: 'สร้างบัญชีผู้ใช้งานสำเร็จ' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const updated = await db.updateUser(req.params.id, req.body);
    res.json({ success: true, data: updated, message: 'อัปเดตข้อมูลผู้ใช้งานสำเร็จ' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.deleteUser(req.params.id);
    res.json({ success: true, message: 'ลบผู้ใช้งานเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 3. Dashboard summary & metrics
app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = await db.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Items / Inventory Management
app.get('/api/items', async (req, res) => {
  try {
    const items = await db.getItems();
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await db.getItemById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const { name, categoryId, unit, currentStock, minStock, unitPrice, location, description, code } = req.body;
    if (!name || !categoryId) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่ออุปกรณ์และเลือกหมวดหมู่' });
    }
    const created = await db.createItem({ name, categoryId, unit, currentStock, minStock, unitPrice, location, description, code });
    res.status(201).json({ success: true, data: created, message: 'เพิ่มรายการอุปกรณ์สำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const updated = await db.updateItem(req.params.id, req.body);
    res.json({ success: true, data: updated, message: 'บันทึกการแก้ไขอุปกรณ์สำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    await db.deleteItem(req.params.id);
    res.json({ success: true, message: 'ลบรายการอุปกรณ์เรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Categories
app.get('/api/categories', async (req, res) => {
  try {
    const cats = await db.getCategories();
    res.json({ success: true, data: cats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อหมวดหมู่' });
    const cat = await db.createCategory(req.body);
    res.status(201).json({ success: true, data: cat, message: 'สร้างหมวดหมู่สำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await db.deleteCategory(req.params.id);
    res.json({ success: true, message: 'ลบหมวดหมู่เรียบร้อยแล้ว' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 6. Departments
app.get('/api/departments', async (req, res) => {
  try {
    const depts = await db.getDepartments();
    res.json({ success: true, data: depts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อแผนก/ฝ่าย' });
    const dept = await db.createDepartment(req.body);
    res.status(201).json({ success: true, data: dept, message: 'เพิ่มแผนกสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  try {
    await db.deleteDepartment(req.params.id);
    res.json({ success: true, message: 'ลบแผนกเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Stock-in Transactions (การรับเข้า)
app.get('/api/stock-in', async (req, res) => {
  try {
    const stockIns = await db.getStockIns();
    res.json({ success: true, data: stockIns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/stock-in', async (req, res) => {
  try {
    const { items, poNumber, supplier, receiverName, notes, date } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรายการอุปกรณ์ที่ต้องการรับเข้า' });
    }
    const record = await db.createStockIn({ items, poNumber, supplier, receiverName, notes, date });
    res.status(201).json({ success: true, data: record, message: 'บันทึกการรับเข้าสต็อกเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Requisitions / Stock-out (การขอเบิก-จ่ายพัสดุ)
app.get('/api/requisitions', async (req, res) => {
  try {
    const { departmentId } = req.query;
    const reqs = await db.getRequisitions(departmentId ? { departmentId } : {});
    res.json({ success: true, data: reqs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/requisitions/:id', async (req, res) => {
  try {
    const reqItem = await db.getRequisitionById(req.params.id);
    if (!reqItem) return res.status(404).json({ success: false, message: 'ไม่พบใบเบิกนี้' });
    const settings = await db.getSettings();
    res.json({ success: true, data: reqItem, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/requisitions', async (req, res) => {
  try {
    const { requisitioner, departmentId, purpose, items, status, approverName, dispatchedBy, date } = req.body;
    if (!requisitioner || !departmentId || !items || !items.length) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลผู้ขอเบิก แผนก และเลือกอุปกรณ์อย่างน้อย 1 รายการ' });
    }
    const created = await db.createRequisition({
      requisitioner,
      departmentId,
      purpose,
      items,
      status,
      approverName,
      dispatchedBy,
      date
    });
    res.status(201).json({ success: true, data: created, message: 'สร้างใบขอเบิกพัสดุสำเร็จ' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update status (e.g., Pending -> Approved / Dispatched with storekeeper signature, or Rejected)
app.put('/api/requisitions/:id/status', async (req, res) => {
  try {
    const { status, approverName, dispatchedBy, notes } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'กรุณาระบุสถานะ' });
    const updated = await db.updateRequisitionStatus(req.params.id, status, { approverName, dispatchedBy, notes });
    res.json({
      success: true,
      data: updated,
      message: `อัปเดตสถานะเป็น "${status === 'approved' ? 'อนุมัติ/จ่ายของแล้ว (ตัดสต็อกแล้ว)' : status === 'rejected' ? 'ปฏิเสธคำขอ' : status}" เรียบร้อยแล้ว`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/requisitions/:id', async (req, res) => {
  try {
    await db.deleteRequisition(req.params.id);
    res.json({ success: true, message: 'ลบใบขอเบิกเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9. Comprehensive Reports
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await db.getDetailedReports(req.query);
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 10. Settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const updated = await db.updateSettings(req.body);
    res.json({ success: true, data: updated, message: 'บันทึกการตั้งค่าองค์กรเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 11. Backup & Restore Data
app.get('/api/backup/export', async (req, res) => {
  try {
    const data = await db.exportBackup();
    res.setHeader('Content-disposition', `attachment; filename=office_inventory_backup_${Date.now()}.json`);
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/backup/import', async (req, res) => {
  try {
    await db.importBackup(req.body);
    res.json({ success: true, message: 'กู้คืนฐานข้อมูลสำรองสำเร็จ' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Start Server
db.init().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`📦 Office Supplies Inventory & Requisition System`);
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`🔐 Role-Based Access Control: Admin | Storekeeper | Department`);
    console.log(`====================================================`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
