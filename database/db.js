/**
 * Database Layer for Office Supplies Inventory & Requisition System
 * Dual storage engine:
 * 1. PostgreSQL (When DATABASE_URL is set, e.g. for Render, Supabase, Neon)
 * 2. Pure JSON File DB (Local file storage with atomic writes, zero setup required)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, '../data');
const JSON_DB_PATH = path.join(DATA_DIR, 'office_inventory.json');

const isPostgres = !!process.env.DATABASE_URL;
let pgPool = null;

if (isPostgres) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data with comprehensive Thai office supplies and user roles
const initialData = {
  settings: {
    orgName: 'บริษัท สยาม ซินเนอร์จี้ จำกัด (สำนักงานใหญ่)',
    orgAddress: '888 อาคารเอ็มไพร์สเตท ชั้น 18 ถนนสาทรใต้ ยานนาวา สาทร กรุงเทพฯ 10120',
    orgPhone: '02-888-9999 ต่อ 101-103',
    managerName: 'นายประสิทธิ์ สุขสมบูรณ์ (ผู้จัดการฝ่ายธุรการ)',
    currencySymbol: '฿',
    lowStockThresholdDefault: 5
  },
  users: [
    {
      id: 'usr-admin',
      username: 'admin',
      password: 'admin123',
      fullName: 'ผู้ดูแลระบบสูงสุด (System Admin)',
      role: 'admin', // admin: เข้าถึงได้ทุกฟังก์ชัน
      departmentId: 'dept-admin',
      departmentName: 'ฝ่ายบริหารและธุรการทั่วไป',
      phone: '02-888-9999'
    },
    {
      id: 'usr-store',
      username: 'store',
      password: 'store123',
      fullName: 'นายประสิทธิ์ สุขสมบูรณ์',
      role: 'storekeeper', // storekeeper: เจ้าหน้าที่ห้องพัสดุ (รับเข้าสต็อก + ตรวจใบเซ็นและจ่ายของ)
      departmentId: 'dept-admin',
      departmentName: 'แผนกคลังพัสดุและจัดเก็บ',
      phone: '081-999-8877'
    },
    {
      id: 'usr-sales',
      username: 'sales',
      password: '1234',
      fullName: 'นายสมเกียรติ สิทธิพร',
      role: 'department', // department: ผู้ขอเบิกประจำแผนก
      departmentId: 'dept-sales',
      departmentName: 'ฝ่ายขายและการตลาด',
      phone: '089-111-2222'
    },
    {
      id: 'usr-acc',
      username: 'account',
      password: '1234',
      fullName: 'นางสาวศศิธร สุวรรณ',
      role: 'department',
      departmentId: 'dept-acc',
      departmentName: 'ฝ่ายบัญชีและการเงิน',
      phone: '089-333-4444'
    },
    {
      id: 'usr-hr',
      username: 'hr',
      password: '1234',
      fullName: 'นางสาวจินตนา ภูมิดี',
      role: 'department',
      departmentId: 'dept-hr',
      departmentName: 'ฝ่ายทรัพยากรบุคคล (HR)',
      phone: '089-555-6666'
    },
    {
      id: 'usr-it',
      username: 'it',
      password: '1234',
      fullName: 'นายธนาธิป เจริญผล',
      role: 'department',
      departmentId: 'dept-it',
      departmentName: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
      phone: '089-777-8888'
    }
  ],
  categories: [
    { id: 'cat-paper', name: 'กระดาษและสิ่งพิมพ์', icon: 'fa-file-lines', color: 'blue' },
    { id: 'cat-pen', name: 'ปากกาและเครื่องเขียน', icon: 'fa-pen-nib', color: 'indigo' },
    { id: 'cat-ink', name: 'หมึกพิมพ์และโทนเนอร์', icon: 'fa-print', color: 'purple' },
    { id: 'cat-doc', name: 'แฟ้มและอุปกรณ์จัดเก็บเอกสาร', icon: 'fa-folder-open', color: 'amber' },
    { id: 'cat-tools', name: 'อุปกรณ์สำนักงานทั่วไป', icon: 'fa-scissors', color: 'emerald' },
    { id: 'cat-electronic', name: 'อุปกรณ์อิเล็กทรอนิกส์และถ่านไฟ', icon: 'fa-battery-three-quarters', color: 'rose' }
  ],
  departments: [
    { id: 'dept-admin', name: 'ฝ่ายธุรการและบริหารทั่วไป', manager: 'คุณประสิทธิ์ สุขสมบูรณ์' },
    { id: 'dept-hr', name: 'ฝ่ายทรัพยากรบุคคล (HR)', manager: 'คุณวิมลทิพย์' },
    { id: 'dept-acc', name: 'ฝ่ายบัญชีและการเงิน', manager: 'คุณสมศรี' },
    { id: 'dept-sales', name: 'ฝ่ายขายและการตลาด', manager: 'คุณวรวิทย์' },
    { id: 'dept-it', name: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)', manager: 'คุณภานุเดช' },
    { id: 'dept-purchasing', name: 'ฝ่ายจัดซื้อ', manager: 'คุณกนกวรรณ' }
  ],
  items: [
    {
      id: 'ITM-001',
      code: 'OFF-PAP-01',
      name: 'กระดาษ Double A ขนาด A4 80 แกรม',
      categoryId: 'cat-paper',
      unit: 'รีม',
      currentStock: 48,
      minStock: 20,
      unitPrice: 145.00,
      location: 'ชั้นวาง A-1',
      description: 'กระดาษถ่ายเอกสารคุณภาพสูง หนา 80 แกรม บรรจุ 500 แผ่น/รีม',
      status: 'active'
    },
    {
      id: 'ITM-002',
      code: 'OFF-PAP-02',
      name: 'กระดาษ Idea Work ขนาด A4 70 แกรม',
      categoryId: 'cat-paper',
      unit: 'รีม',
      currentStock: 12,
      minStock: 15, // Low stock trigger
      unitPrice: 125.00,
      location: 'ชั้นวาง A-2',
      description: 'กระดาษถ่ายเอกสารทั่วไป หนา 70 แกรม 500 แผ่น/รีม',
      status: 'active'
    },
    {
      id: 'ITM-003',
      code: 'OFF-PEN-01',
      name: 'ปากกาลูกลื่น Lancer Spiral 0.5 มม. (หมึกน้ำเงิน)',
      categoryId: 'cat-pen',
      unit: 'ด้าม',
      currentStock: 120,
      minStock: 30,
      unitPrice: 7.00,
      location: 'ลิ้นชัก B-1',
      description: 'ปากกาลูกลื่นสีน้ำเงิน เขียนลื่น หัว 0.5',
      status: 'active'
    },
    {
      id: 'ITM-004',
      code: 'OFF-PEN-02',
      name: 'ปากกาลูกลื่น Lancer Spiral 0.5 มม. (หมึกแดง)',
      categoryId: 'cat-pen',
      unit: 'ด้าม',
      currentStock: 45,
      minStock: 20,
      unitPrice: 7.00,
      location: 'ลิ้นชัก B-1',
      description: 'ปากกาลูกลื่นสีแดง สำหรับตรวจงาน',
      status: 'active'
    },
    {
      id: 'ITM-005',
      code: 'OFF-PEN-03',
      name: 'ปากกาไวท์บอร์ด Zebra หัวแหลม (ดำ)',
      categoryId: 'cat-pen',
      unit: 'ด้าม',
      currentStock: 8,
      minStock: 15, // Low stock trigger
      unitPrice: 28.00,
      location: 'ลิ้นชัก B-2',
      description: 'ปากกาเขียนกระดานไวท์บอร์ด ลบง่าย ไม่มีกลิ่นฉุน',
      status: 'active'
    },
    {
      id: 'ITM-006',
      code: 'OFF-PEN-04',
      name: 'ดินสอกด Pentel Graphgear 500 ขนาด 0.5 มม.',
      categoryId: 'cat-pen',
      unit: 'ด้าม',
      currentStock: 18,
      minStock: 10,
      unitPrice: 165.00,
      location: 'ลิ้นชัก B-3',
      description: 'ดินสอกดเขียนแบบ ด้ามโลหะ ทนทาน',
      status: 'active'
    },
    {
      id: 'ITM-007',
      code: 'OFF-PEN-05',
      name: 'ไส้ดินสอกด Pentel Ain Stein 0.5 มม. (2B)',
      categoryId: 'cat-pen',
      unit: 'หลอด',
      currentStock: 25,
      minStock: 10,
      unitPrice: 45.00,
      location: 'ลิ้นชัก B-3',
      description: 'ไส้ดินสอความเข้ม 2B บรรจุ 40 ไส้',
      status: 'active'
    },
    {
      id: 'ITM-008',
      code: 'OFF-INK-01',
      name: 'ตลับหมึกโทนเนอร์ HP LaserJet 85A (CE285A)',
      categoryId: 'cat-ink',
      unit: 'ตลับ',
      currentStock: 4,
      minStock: 3,
      unitPrice: 2290.00,
      location: 'ตู้เซฟ C-1',
      description: 'ตลับหมึกแท้สำหรับเครื่องพิมพ์ HP LaserJet Pro P1102 / M1132',
      status: 'active'
    },
    {
      id: 'ITM-009',
      code: 'OFF-INK-02',
      name: 'ตลับหมึกแท้ Brother TN-2480 (Black)',
      categoryId: 'cat-ink',
      unit: 'ตลับ',
      currentStock: 2,
      minStock: 3, // Low stock trigger
      unitPrice: 2150.00,
      location: 'ตู้เซฟ C-1',
      description: 'สำหรับเครื่องพิมพ์ Brother HL-L2375DW, MFC-L2715DW พิมพ์ได้ 3,000 หน้า',
      status: 'active'
    },
    {
      id: 'ITM-010',
      code: 'OFF-INK-03',
      name: 'หมึกขวด Canon GI-790 BK (สีดำ)',
      categoryId: 'cat-ink',
      unit: 'ขวด',
      currentStock: 9,
      minStock: 4,
      unitPrice: 290.00,
      location: 'ตู้เซฟ C-2',
      description: 'หมึกแท้สำหรับปริ้นเตอร์ Canon G1010, G2010, G3010',
      status: 'active'
    },
    {
      id: 'ITM-011',
      code: 'OFF-DOC-01',
      name: 'แฟ้มสันกว้าง 3 นิ้ว ตราช้าง 120A4',
      categoryId: 'cat-doc',
      unit: 'เล่ม',
      currentStock: 32,
      minStock: 15,
      unitPrice: 75.00,
      location: 'ชั้นวาง D-1',
      description: 'แฟ้มห่วงก้านยก สัน 3 นิ้ว สีดำ กันกระแทก ทนทาน',
      status: 'active'
    },
    {
      id: 'ITM-012',
      code: 'OFF-DOC-02',
      name: 'ซองเอกสารสีน้ำตาล ขนาด A4 (ขยายข้าง)',
      categoryId: 'cat-doc',
      unit: 'แพ็ค',
      currentStock: 16,
      minStock: 10,
      unitPrice: 95.00,
      location: 'ชั้นวาง D-2',
      description: 'ซองน้ำตาล KA 125 แกรม แพ็คละ 50 ซอง',
      status: 'active'
    },
    {
      id: 'ITM-013',
      code: 'OFF-DOC-03',
      name: 'กระดาษโน้ต Post-it 3x3 นิ้ว สีเหลืองสดนีออน',
      categoryId: 'cat-doc',
      unit: 'เล่ม',
      currentStock: 40,
      minStock: 15,
      unitPrice: 38.00,
      location: 'ลิ้นชัก B-4',
      description: 'กระดาษโน้ตกาวในตัว 3M 100 แผ่น/เล่ม',
      status: 'active'
    },
    {
      id: 'ITM-014',
      code: 'OFF-TOO-01',
      name: 'เครื่องเย็บกระดาษ MAX HD-10D (พร้อมลวดเย็บ)',
      categoryId: 'cat-tools',
      unit: 'อัน',
      currentStock: 14,
      minStock: 5,
      unitPrice: 160.00,
      location: 'ชั้นวาง E-1',
      description: 'เครื่องเย็บกระดาษ เบอร์ 10 เย็บได้หนา 20 แผ่น',
      status: 'active'
    },
    {
      id: 'ITM-015',
      code: 'OFF-TOO-02',
      name: 'ลวดเย็บกระดาษ MAX เบอร์ 10 (1M)',
      categoryId: 'cat-tools',
      unit: 'กล่อง',
      currentStock: 65,
      minStock: 20,
      unitPrice: 15.00,
      location: 'ชั้นวาง E-1',
      description: 'ลวดเย็บมาตรฐาน ผลิตจากเหล็กเหนียวชุบสารกันสนิม',
      status: 'active'
    },
    {
      id: 'ITM-016',
      code: 'OFF-TOO-03',
      name: 'กรรไกรตราช้าง ขนาด 8 นิ้ว ด้ามยางนุ่ม',
      categoryId: 'cat-tools',
      unit: 'เล่ม',
      currentStock: 11,
      minStock: 5,
      unitPrice: 65.00,
      location: 'ชั้นวาง E-2',
      description: 'กรรไกรสแตนเลส คมกริบ ด้ามจับกระชับมือ',
      status: 'active'
    },
    {
      id: 'ITM-017',
      code: 'OFF-TOO-04',
      name: 'เทปใสแกนเล็ก 3/4 นิ้ว x 36 หลา (Scotch 3M)',
      categoryId: 'cat-tools',
      unit: 'ม้วน',
      currentStock: 38,
      minStock: 15,
      unitPrice: 22.00,
      location: 'ชั้นวาง E-3',
      description: 'เทปใสเนื้อเหนียว ติดแน่น ไม่ทิ้งคราบกาว',
      status: 'active'
    },
    {
      id: 'ITM-018',
      code: 'OFF-ELE-01',
      name: 'ถ่านอัลคาไลน์ Panasonic ขนาด AA (แพ็ค 4 ก้อน)',
      categoryId: 'cat-electronic',
      unit: 'แพ็ค',
      currentStock: 15,
      minStock: 8,
      unitPrice: 120.00,
      location: 'ตู้ F-1',
      description: 'ถ่านอัลคาไลน์สำหรับเมาส์ไร้สาย รีโมทแอร์ และนาฬิกา',
      status: 'active'
    },
    {
      id: 'ITM-019',
      code: 'OFF-ELE-02',
      name: 'ถ่านอัลคาไลน์ Panasonic ขนาด AAA (แพ็ค 4 ก้อน)',
      categoryId: 'cat-electronic',
      unit: 'แพ็ค',
      currentStock: 18,
      minStock: 8,
      unitPrice: 120.00,
      location: 'ตู้ F-1',
      description: 'ถ่านอัลคาไลน์ขนาด AAA ไร้สารปรอท',
      status: 'active'
    }
  ],
  stockIns: [
    {
      id: 'IN-2025-001',
      date: '2025-10-15',
      poNumber: 'PO-6810-092',
      supplier: 'บริษัท ออฟฟิศเมท จำกัด (มหาชน)',
      receiverName: 'นายประสิทธิ์ (เจ้าหน้าที่พัสดุ)',
      totalAmount: 11520.00,
      notes: 'รับพัสดุอุปกรณ์สำนักงานประจำไตรมาส 4',
      items: [
        { itemId: 'ITM-001', name: 'กระดาษ Double A ขนาด A4 80 แกรม', quantity: 50, unit: 'รีม', unitPrice: 145.00, totalPrice: 7250.00 },
        { itemId: 'ITM-003', name: 'ปากกาลูกลื่น Lancer Spiral 0.5 มม. (หมึกน้ำเงิน)', quantity: 100, unit: 'ด้าม', unitPrice: 7.00, totalPrice: 700.00 },
        { itemId: 'ITM-008', name: 'ตลับหมึกโทนเนอร์ HP LaserJet 85A (CE285A)', quantity: 1, unit: 'ตลับ', unitPrice: 2290.00, totalPrice: 2290.00 },
        { itemId: 'ITM-015', name: 'ลวดเย็บกระดาษ MAX เบอร์ 10 (1M)', quantity: 50, unit: 'กล่อง', unitPrice: 15.00, totalPrice: 750.00 },
        { itemId: 'ITM-017', name: 'เทปใสแกนเล็ก 3/4 นิ้ว x 36 หลา (Scotch 3M)', quantity: 24, unit: 'ม้วน', unitPrice: 22.00, totalPrice: 528.00 }
      ],
      createdAt: '2025-10-15T09:30:00Z'
    },
    {
      id: 'IN-2025-002',
      date: '2025-10-22',
      poNumber: 'PO-6810-105',
      supplier: 'บจก. ธนบุรี ซัพพลาย แอนด์ สเตชั่นเนอรี่',
      receiverName: 'นายประสิทธิ์ (เจ้าหน้าที่พัสดุ)',
      totalAmount: 6450.00,
      notes: 'สั่งซื้อหมึกสำรองและแฟ้มเอกสารเพิ่ม',
      items: [
        { itemId: 'ITM-009', name: 'ตลับหมึกแท้ Brother TN-2480 (Black)', quantity: 2, unit: 'ตลับ', unitPrice: 2150.00, totalPrice: 4300.00 },
        { itemId: 'ITM-011', name: 'แฟ้มสันกว้าง 3 นิ้ว ตราช้าง 120A4', quantity: 20, unit: 'เล่ม', unitPrice: 75.00, totalPrice: 1500.00 },
        { itemId: 'ITM-018', name: 'ถ่านอัลคาไลน์ Panasonic ขนาด AA (แพ็ค 4 ก้อน)', quantity: 5, unit: 'แพ็ค', unitPrice: 120.00, totalPrice: 600.00 },
        { itemId: 'ITM-019', name: 'ถ่านอัลคาไลน์ Panasonic ขนาด AAA (แพ็ค 4 ก้อน)', quantity: 5, unit: 'แพ็ค', unitPrice: 120.00, totalPrice: 600.00 }
      ],
      createdAt: '2025-10-22T14:15:00Z'
    }
  ],
  requisitions: [
    {
      id: 'REQ-2025-001',
      date: '2025-10-23',
      requisitioner: 'นายสมเกียรติ สิทธิพร',
      departmentId: 'dept-sales',
      departmentName: 'ฝ่ายขายและการตลาด',
      purpose: 'ใช้จัดเตรียมเอกสารเสนอโครงการลูกค้างานบิ๊กอีเวนต์',
      status: 'approved', // pending, approved, rejected
      approverName: 'คุณวรวิทย์ (ผจก.ฝ่ายขาย)',
      dispatchedBy: 'นายประสิทธิ์ (เจ้าหน้าที่พัสดุ)',
      dispatchedAt: '2025-10-23T11:00:00Z',
      totalEstimatedCost: 1105.00,
      items: [
        { itemId: 'ITM-001', name: 'กระดาษ Double A ขนาด A4 80 แกรม', quantity: 5, unit: 'รีม', unitPrice: 145.00, totalPrice: 725.00 },
        { itemId: 'ITM-003', name: 'ปากกาลูกลื่น Lancer Spiral 0.5 มม. (หมึกน้ำเงิน)', quantity: 10, unit: 'ด้าม', unitPrice: 7.00, totalPrice: 70.00 },
        { itemId: 'ITM-011', name: 'แฟ้มสันกว้าง 3 นิ้ว ตราช้าง 120A4', quantity: 4, unit: 'เล่ม', unitPrice: 75.00, totalPrice: 300.00 },
        { itemId: 'ITM-017', name: 'เทปใสแกนเล็ก 3/4 นิ้ว x 36 หลา (Scotch 3M)', quantity: 2, unit: 'ม้วน', unitPrice: 22.00, totalPrice: 44.00 }
      ],
      createdAt: '2025-10-23T10:15:00Z'
    },
    {
      id: 'REQ-2025-002',
      date: '2025-10-24',
      requisitioner: 'นางสาวศศิธร สุวรรณ',
      departmentId: 'dept-acc',
      departmentName: 'ฝ่ายบัญชีและการเงิน',
      purpose: 'จัดทำเอกสารปิดงบประจำเดือนตุลาคม',
      status: 'approved',
      approverName: 'คุณสมศรี (ผจก.ฝ่ายบัญชี)',
      dispatchedBy: 'นายประสิทธิ์ (เจ้าหน้าที่พัสดุ)',
      dispatchedAt: '2025-10-24T15:20:00Z',
      totalEstimatedCost: 1055.00,
      items: [
        { itemId: 'ITM-001', name: 'กระดาษ Double A ขนาด A4 80 แกรม', quantity: 4, unit: 'รีม', unitPrice: 145.00, totalPrice: 580.00 },
        { itemId: 'ITM-011', name: 'แฟ้มสันกว้าง 3 นิ้ว ตราช้าง 120A4', quantity: 5, unit: 'เล่ม', unitPrice: 75.00, totalPrice: 375.00 },
        { itemId: 'ITM-013', name: 'กระดาษโน้ต Post-it 3x3 นิ้ว สีเหลืองสดนีออน', quantity: 2, unit: 'เล่ม', unitPrice: 38.00, totalPrice: 76.00 },
        { itemId: 'ITM-015', name: 'ลวดเย็บกระดาษ MAX เบอร์ 10 (1M)', quantity: 4, unit: 'กล่อง', unitPrice: 15.00, totalPrice: 60.00 }
      ],
      createdAt: '2025-10-24T14:00:00Z'
    },
    {
      id: 'REQ-2025-003',
      date: '2025-10-26',
      requisitioner: 'นายธนาธิป เจริญผล',
      departmentId: 'dept-it',
      departmentName: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)',
      purpose: 'เปลี่ยนถ่านเมาส์และคีย์บอร์ดไร้สายห้องประชุมใหญ่',
      status: 'approved',
      approverName: 'คุณภานุเดช (ผจก.ฝ่าย IT)',
      dispatchedBy: 'นายประสิทธิ์ (เจ้าหน้าที่พัสดุ)',
      dispatchedAt: '2025-10-26T09:30:00Z',
      totalEstimatedCost: 480.00,
      items: [
        { itemId: 'ITM-018', name: 'ถ่านอัลคาไลน์ Panasonic ขนาด AA (แพ็ค 4 ก้อน)', quantity: 2, unit: 'แพ็ค', unitPrice: 120.00, totalPrice: 240.00 },
        { itemId: 'ITM-019', name: 'ถ่านอัลคาไลน์ Panasonic ขนาด AAA (แพ็ค 4 ก้อน)', quantity: 2, unit: 'แพ็ค', unitPrice: 120.00, totalPrice: 240.00 }
      ],
      createdAt: '2025-10-26T09:00:00Z'
    },
    {
      id: 'REQ-2025-004',
      date: '2025-10-27',
      requisitioner: 'นางสาวจินตนา ภูมิดี',
      departmentId: 'dept-hr',
      departmentName: 'ฝ่ายทรัพยากรบุคคล (HR)',
      purpose: 'จัดเตรียมเอกสารการอบรมปฐมนิเทศพนักงานใหม่',
      status: 'pending', // Waiting for Dept Manager signature or Storekeeper dispatch
      approverName: '',
      dispatchedBy: '',
      dispatchedAt: null,
      totalEstimatedCost: 810.00,
      items: [
        { itemId: 'ITM-001', name: 'กระดาษ Double A ขนาด A4 80 แกรม', quantity: 3, unit: 'รีม', unitPrice: 145.00, totalPrice: 435.00 },
        { itemId: 'ITM-003', name: 'ปากกาลูกลื่น Lancer Spiral 0.5 มม. (หมึกน้ำเงิน)', quantity: 15, unit: 'ด้าม', unitPrice: 7.00, totalPrice: 105.00 },
        { itemId: 'ITM-013', name: 'กระดาษโน้ต Post-it 3x3 นิ้ว สีเหลืองสดนีออน', quantity: 3, unit: 'เล่ม', unitPrice: 38.00, totalPrice: 114.00 },
        { itemId: 'ITM-005', name: 'ปากกาไวท์บอร์ด Zebra หัวแหลม (ดำ)', quantity: 3, unit: 'ด้าม', unitPrice: 28.00, totalPrice: 84.00 }
      ],
      createdAt: '2025-10-27T08:45:00Z'
    }
  ]
};

// ---------------------------------------------------------------------------
// JSON DATABASE ADAPTER
// ---------------------------------------------------------------------------

function loadJsonDB() {
  try {
    if (!fs.existsSync(JSON_DB_PATH)) {
      saveJsonDB(initialData);
      return initialData;
    }
    const raw = fs.readFileSync(JSON_DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      settings: parsed.settings || initialData.settings,
      users: parsed.users || initialData.users,
      categories: parsed.categories || initialData.categories,
      departments: parsed.departments || initialData.departments,
      items: parsed.items || initialData.items,
      stockIns: parsed.stockIns || initialData.stockIns,
      requisitions: parsed.requisitions || initialData.requisitions
    };
  } catch (err) {
    console.error('Error reading JSON DB, fallback to initial:', err);
    return initialData;
  }
}

function saveJsonDB(data) {
  try {
    const tmpPath = JSON_DB_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, JSON_DB_PATH);
  } catch (err) {
    console.error('Error saving JSON DB:', err);
  }
}

// ---------------------------------------------------------------------------
// POSTGRES INIT
// ---------------------------------------------------------------------------

async function initPostgres() {
  if (!pgPool) return;
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS office_app_state (
        id VARCHAR(32) PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const res = await client.query('SELECT payload FROM office_app_state WHERE id = $1', ['singleton']);
    if (res.rows.length === 0) {
      await client.query(
        'INSERT INTO office_app_state (id, payload) VALUES ($1, $2)',
        ['singleton', JSON.stringify(initialData)]
      );
    }
  } catch (e) {
    console.error('Failed to init Postgres schema:', e);
  } finally {
    client.release();
  }
}

async function loadData() {
  if (isPostgres) {
    try {
      const res = await pgPool.query('SELECT payload FROM office_app_state WHERE id = $1', ['singleton']);
      if (res.rows.length > 0) {
        return res.rows[0].payload;
      }
    } catch (e) {
      console.error('Postgres load error, using JSON fallback:', e);
    }
  }
  return loadJsonDB();
}

async function saveData(data) {
  if (isPostgres) {
    try {
      await pgPool.query(
        `INSERT INTO office_app_state (id, payload, updated_at) 
         VALUES ('singleton', $1, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET payload = $1, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(data)]
      );
      return;
    } catch (e) {
      console.error('Postgres save error, falling back to JSON:', e);
    }
  }
  saveJsonDB(data);
}

// ---------------------------------------------------------------------------
// API METHODS
// ---------------------------------------------------------------------------

const db = {
  async init() {
    if (isPostgres) {
      await initPostgres();
    } else {
      loadJsonDB();
    }
  },

  // 1. Settings
  async getSettings() {
    const data = await loadData();
    return data.settings;
  },

  async updateSettings(newSettings) {
    const data = await loadData();
    data.settings = { ...data.settings, ...newSettings };
    await saveData(data);
    return data.settings;
  },

  // 2. Authentication & User Management
  async authenticate(username, password) {
    const data = await loadData();
    const user = (data.users || []).find(
      u => u.username.toLowerCase() === (username || '').trim().toLowerCase() && u.password === password
    );
    if (!user) return null;

    // Return safe user object (exclude sensitive password)
    const { password: _, ...safeUser } = user;
    return safeUser;
  },

  async getUsers() {
    const data = await loadData();
    return (data.users || []).map(({ password: _, ...user }) => user);
  },

  async createUser(userData) {
    const data = await loadData();
    const existing = (data.users || []).find(
      u => u.username.toLowerCase() === (userData.username || '').trim().toLowerCase()
    );
    if (existing) {
      throw new Error(`ชื่อผู้ใช้ (Username) "${userData.username}" มีอยู่ในระบบแล้ว`);
    }

    const id = 'usr-' + Date.now();
    let departmentName = userData.departmentName || '';
    if (userData.departmentId) {
      const dept = (data.departments || []).find(d => d.id === userData.departmentId);
      if (dept) departmentName = dept.name;
    }

    const newUser = {
      id,
      username: userData.username.trim(),
      password: userData.password || '1234',
      fullName: userData.fullName.trim(),
      role: userData.role || 'department', // 'admin', 'storekeeper', 'department'
      departmentId: userData.departmentId || '',
      departmentName: departmentName,
      phone: userData.phone || '',
      createdAt: new Date().toISOString()
    };

    if (!data.users) data.users = [];
    data.users.push(newUser);
    await saveData(data);

    const { password: _, ...safeUser } = newUser;
    return safeUser;
  },

  async updateUser(id, updateData) {
    const data = await loadData();
    const idx = (data.users || []).findIndex(u => u.id === id);
    if (idx === -1) throw new Error('ไม่พบข้อมูลผู้ใช้นี้');

    if (updateData.departmentId) {
      const dept = (data.departments || []).find(d => d.id === updateData.departmentId);
      if (dept) updateData.departmentName = dept.name;
    }

    const updatedUser = {
      ...data.users[idx],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    // If password not provided or blank, preserve existing password
    if (!updateData.password) {
      updatedUser.password = data.users[idx].password;
    }

    data.users[idx] = updatedUser;
    await saveData(data);

    const { password: _, ...safeUser } = updatedUser;
    return safeUser;
  },

  async deleteUser(id) {
    const data = await loadData();
    if (id === 'usr-admin') {
      throw new Error('ไม่สามารถลบบัญชีผู้ดูแลระบบหลัก (Admin) ได้');
    }
    data.users = (data.users || []).filter(u => u.id !== id);
    await saveData(data);
    return true;
  },

  // 3. Categories
  async getCategories() {
    const data = await loadData();
    return data.categories || [];
  },

  async createCategory(cat) {
    const data = await loadData();
    const id = cat.id || 'cat-' + Date.now();
    const newCat = {
      id,
      name: cat.name,
      icon: cat.icon || 'fa-box',
      color: cat.color || 'blue'
    };
    data.categories.push(newCat);
    await saveData(data);
    return newCat;
  },

  async deleteCategory(id) {
    const data = await loadData();
    const hasItems = data.items.some(i => i.categoryId === id);
    if (hasItems) {
      throw new Error('ไม่สามารถลบหมวดหมู่นี้ได้เนื่องจากยังมีรายการอุปกรณ์อยู่ในหมวดนี้');
    }
    data.categories = data.categories.filter(c => c.id !== id);
    await saveData(data);
    return true;
  },

  // 4. Departments
  async getDepartments() {
    const data = await loadData();
    return data.departments || [];
  },

  async createDepartment(dept) {
    const data = await loadData();
    const id = dept.id || 'dept-' + Date.now();
    const newDept = {
      id,
      name: dept.name,
      manager: dept.manager || ''
    };
    data.departments.push(newDept);
    await saveData(data);
    return newDept;
  },

  async deleteDepartment(id) {
    const data = await loadData();
    data.departments = data.departments.filter(d => d.id !== id);
    await saveData(data);
    return true;
  },

  // 5. Items (Inventory)
  async getItems() {
    const data = await loadData();
    const categoriesMap = {};
    (data.categories || []).forEach(c => { categoriesMap[c.id] = c; });

    return (data.items || []).map(item => {
      const cat = categoriesMap[item.categoryId] || { name: 'ไม่ระบุ', color: 'gray' };
      const isLowStock = item.currentStock <= item.minStock;
      const isOutOfStock = item.currentStock <= 0;
      return {
        ...item,
        categoryName: cat.name,
        categoryColor: cat.color,
        isLowStock,
        isOutOfStock,
        totalValue: Number((item.currentStock * (item.unitPrice || 0)).toFixed(2))
      };
    });
  },

  async getItemById(id) {
    const items = await this.getItems();
    return items.find(i => i.id === id || i.code === id) || null;
  },

  async createItem(itemData) {
    const data = await loadData();
    const id = 'ITM-' + String(data.items.length + 1).padStart(3, '0');
    const newItem = {
      id,
      code: itemData.code || ('OFF-' + String(data.items.length + 1).padStart(3, '0')),
      name: itemData.name,
      categoryId: itemData.categoryId,
      unit: itemData.unit || 'ชิ้น',
      currentStock: Number(itemData.currentStock) || 0,
      minStock: Number(itemData.minStock) || 5,
      unitPrice: Number(itemData.unitPrice) || 0,
      location: itemData.location || '',
      description: itemData.description || '',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    data.items.push(newItem);
    await saveData(data);
    return newItem;
  },

  async updateItem(id, updateData) {
    const data = await loadData();
    const index = data.items.findIndex(i => i.id === id);
    if (index === -1) throw new Error('ไม่พบรายการอุปกรณ์นี้');

    data.items[index] = {
      ...data.items[index],
      ...updateData,
      currentStock: Number(updateData.currentStock !== undefined ? updateData.currentStock : data.items[index].currentStock),
      minStock: Number(updateData.minStock !== undefined ? updateData.minStock : data.items[index].minStock),
      unitPrice: Number(updateData.unitPrice !== undefined ? updateData.unitPrice : data.items[index].unitPrice),
      updatedAt: new Date().toISOString()
    };
    await saveData(data);
    return data.items[index];
  },

  async deleteItem(id) {
    const data = await loadData();
    data.items = data.items.filter(i => i.id !== id);
    await saveData(data);
    return true;
  },

  // 6. Stock In (การรับเข้าสต็อก)
  async getStockIns() {
    const data = await loadData();
    return (data.stockIns || []).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  },

  async createStockIn(payload) {
    const data = await loadData();
    const today = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();
    const count = (data.stockIns || []).length + 1;
    const id = payload.id || `IN-${year}-${String(count).padStart(3, '0')}`;

    let totalAmount = 0;
    const validatedItems = [];

    for (const row of payload.items) {
      const qty = Number(row.quantity) || 0;
      const price = Number(row.unitPrice) || 0;
      const subTotal = qty * price;
      totalAmount += subTotal;

      const itemIndex = data.items.findIndex(i => i.id === row.itemId);
      if (itemIndex !== -1) {
        data.items[itemIndex].currentStock += qty;
        if (price > 0) {
          data.items[itemIndex].unitPrice = price;
        }
        validatedItems.push({
          itemId: data.items[itemIndex].id,
          name: data.items[itemIndex].name,
          quantity: qty,
          unit: data.items[itemIndex].unit,
          unitPrice: price,
          totalPrice: subTotal
        });
      }
    }

    const record = {
      id,
      date: payload.date || today,
      poNumber: payload.poNumber || '',
      supplier: payload.supplier || 'ไม่ระบุ',
      receiverName: payload.receiverName || 'เจ้าหน้าที่พัสดุ',
      totalAmount: Number(totalAmount.toFixed(2)),
      notes: payload.notes || '',
      items: validatedItems,
      createdAt: new Date().toISOString()
    };

    if (!data.stockIns) data.stockIns = [];
    data.stockIns.unshift(record);
    await saveData(data);
    return record;
  },

  // 7. Requisitions / Stock Out (การเบิกจ่ายพัสดุ)
  async getRequisitions(filter = {}) {
    const data = await loadData();
    let list = data.requisitions || [];
    if (filter.departmentId) {
      list = list.filter(r => r.departmentId === filter.departmentId);
    }
    return list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  },

  async getRequisitionById(id) {
    const reqs = await this.getRequisitions();
    return reqs.find(r => r.id === id) || null;
  },

  async createRequisition(payload) {
    const data = await loadData();
    const today = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();
    const count = (data.requisitions || []).length + 1;
    const id = payload.id || `REQ-${year}-${String(count).padStart(3, '0')}`;

    const dept = (data.departments || []).find(d => d.id === payload.departmentId);
    const departmentName = dept ? dept.name : (payload.departmentName || 'ไม่ระบุ');

    let totalEstimatedCost = 0;
    const validatedItems = [];

    for (const row of payload.items) {
      const qty = Number(row.quantity) || 0;
      const target = data.items.find(i => i.id === row.itemId);
      if (!target) continue;

      const unitPrice = Number(target.unitPrice) || 0;
      const subTotal = qty * unitPrice;
      totalEstimatedCost += subTotal;

      validatedItems.push({
        itemId: target.id,
        name: target.name,
        quantity: qty,
        unit: target.unit,
        unitPrice: unitPrice,
        totalPrice: Number(subTotal.toFixed(2)),
        currentStockBefore: target.currentStock
      });
    }

    const initialStatus = payload.status || 'pending'; // 'pending' (รอเซ็น/รอจ่าย) or 'approved'

    if (initialStatus === 'approved') {
      for (const row of validatedItems) {
        const itemIdx = data.items.findIndex(i => i.id === row.itemId);
        if (itemIdx !== -1) {
          data.items[itemIdx].currentStock = Math.max(0, data.items[itemIdx].currentStock - row.quantity);
        }
      }
    }

    const record = {
      id,
      date: payload.date || today,
      requisitioner: payload.requisitioner,
      departmentId: payload.departmentId,
      departmentName: departmentName,
      purpose: payload.purpose || 'ใช้งานประจำวัน',
      status: initialStatus,
      approverName: payload.approverName || (dept ? dept.manager : ''),
      dispatchedBy: initialStatus === 'approved' ? (payload.dispatchedBy || 'เจ้าหน้าที่พัสดุ') : '',
      dispatchedAt: initialStatus === 'approved' ? new Date().toISOString() : null,
      totalEstimatedCost: Number(totalEstimatedCost.toFixed(2)),
      items: validatedItems,
      createdAt: new Date().toISOString()
    };

    if (!data.requisitions) data.requisitions = [];
    data.requisitions.unshift(record);
    await saveData(data);
    return record;
  },

  async updateRequisitionStatus(id, newStatus, meta = {}) {
    const data = await loadData();
    const reqIndex = data.requisitions.findIndex(r => r.id === id);
    if (reqIndex === -1) throw new Error('ไม่พบใบเบิกนี้');

    const req = data.requisitions[reqIndex];
    const prevStatus = req.status;

    // Transitioning from pending -> approved: deduct stock!
    if (prevStatus !== 'approved' && newStatus === 'approved') {
      for (const row of req.items) {
        const itemIdx = data.items.findIndex(i => i.id === row.itemId);
        if (itemIdx !== -1) {
          data.items[itemIdx].currentStock = Math.max(0, data.items[itemIdx].currentStock - row.quantity);
        }
      }
      req.dispatchedAt = new Date().toISOString();
      req.dispatchedBy = meta.dispatchedBy || 'เจ้าหน้าที่พัสดุ';
      if (meta.approverName) req.approverName = meta.approverName;
    }

    // Transitioning from approved -> rejected or cancelled: restore stock!
    if (prevStatus === 'approved' && (newStatus === 'rejected' || newStatus === 'cancelled')) {
      for (const row of req.items) {
        const itemIdx = data.items.findIndex(i => i.id === row.itemId);
        if (itemIdx !== -1) {
          data.items[itemIdx].currentStock += row.quantity;
        }
      }
    }

    req.status = newStatus;
    if (meta.notes) req.adminNotes = meta.notes;

    data.requisitions[reqIndex] = req;
    await saveData(data);
    return req;
  },

  async deleteRequisition(id) {
    const data = await loadData();
    const req = data.requisitions.find(r => r.id === id);
    if (req && req.status === 'approved') {
      for (const row of req.items) {
        const itemIdx = data.items.findIndex(i => i.id === row.itemId);
        if (itemIdx !== -1) {
          data.items[itemIdx].currentStock += row.quantity;
        }
      }
    }
    data.requisitions = data.requisitions.filter(r => r.id !== id);
    await saveData(data);
    return true;
  },

  // 8. Dashboard Stats & Analytics
  async getDashboardStats() {
    const items = await this.getItems();
    const reqs = await this.getRequisitions();
    const stockIns = await this.getStockIns();
    const categories = await this.getCategories();
    const departments = await this.getDepartments();

    const totalItems = items.length;
    const lowStockItems = items.filter(i => i.isLowStock);
    const outOfStockItems = items.filter(i => i.isOutOfStock);
    const totalInventoryValue = items.reduce((sum, i) => sum + (i.totalValue || 0), 0);

    const pendingReqs = reqs.filter(r => r.status === 'pending');
    const approvedReqs = reqs.filter(r => r.status === 'approved');

    const totalRequisitionValue = approvedReqs.reduce((sum, r) => sum + (r.totalEstimatedCost || 0), 0);

    const deptUsage = {};
    departments.forEach(d => { deptUsage[d.name] = { count: 0, amount: 0 }; });

    approvedReqs.forEach(r => {
      const dName = r.departmentName || 'ทั่วไป';
      if (!deptUsage[dName]) deptUsage[dName] = { count: 0, amount: 0 };
      deptUsage[dName].count += 1;
      deptUsage[dName].amount += (r.totalEstimatedCost || 0);
    });

    const catStock = {};
    categories.forEach(c => { catStock[c.name] = { count: 0, totalUnits: 0, value: 0 }; });
    items.forEach(i => {
      const cName = i.categoryName || 'อื่นๆ';
      if (!catStock[cName]) catStock[cName] = { count: 0, totalUnits: 0, value: 0 };
      catStock[cName].count += 1;
      catStock[cName].totalUnits += i.currentStock;
      catStock[cName].value += i.totalValue;
    });

    return {
      summary: {
        totalItems,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        totalInventoryValue: Number(totalInventoryValue.toFixed(2)),
        pendingRequisitionCount: pendingReqs.length,
        totalRequisitionCount: reqs.length,
        totalRequisitionValue: Number(totalRequisitionValue.toFixed(2))
      },
      lowStockList: lowStockItems.map(i => ({
        id: i.id,
        code: i.code,
        name: i.name,
        currentStock: i.currentStock,
        minStock: i.minStock,
        unit: i.unit,
        unitPrice: i.unitPrice
      })),
      recentRequisitions: reqs.slice(0, 5),
      recentStockIns: stockIns.slice(0, 5),
      deptUsage,
      catStock
    };
  },

  // 9. Reports Filter
  async getDetailedReports(filters = {}) {
    const items = await this.getItems();
    const reqs = await this.getRequisitions();
    const stockIns = await this.getStockIns();

    const { startDate, endDate, categoryId, departmentId } = filters;

    let filteredIns = stockIns;
    if (startDate) filteredIns = filteredIns.filter(x => (x.date || x.createdAt) >= startDate);
    if (endDate) filteredIns = filteredIns.filter(x => (x.date || x.createdAt) <= endDate);

    let filteredReqs = reqs;
    if (startDate) filteredReqs = filteredReqs.filter(x => (x.date || x.createdAt) >= startDate);
    if (endDate) filteredReqs = filteredReqs.filter(x => (x.date || x.createdAt) <= endDate);
    if (departmentId && departmentId !== 'all') {
      filteredReqs = filteredReqs.filter(x => x.departmentId === departmentId);
    }

    let filteredItems = items;
    if (categoryId && categoryId !== 'all') {
      filteredItems = filteredItems.filter(x => x.categoryId === categoryId);
    }

    return {
      inventory: filteredItems,
      requisitions: filteredReqs,
      stockIns: filteredIns
    };
  },

  // 10. Full Backup & Restore
  async exportBackup() {
    return await loadData();
  },

  async importBackup(data) {
    if (!data.items || !data.categories) {
      throw new Error('รูปแบบไฟล์สำรองข้อมูลไม่ถูกต้อง');
    }
    await saveData(data);
    return true;
  }
};

module.exports = db;
