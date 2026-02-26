import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Cannot run demo seed in production environment!');
  process.exit(1);
}

const prisma = new PrismaClient();

// Pre-generated UUIDs for consistent demo data (valid UUID v4 format)
const DEMO_STORE_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

// 5 Branches
const BRANCHES = [
  {
    id: 'b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e',
    name: 'Makati Branch',
    address: '456 Ayala Avenue, Makati City, Metro Manila 1226',
    phone: '+63 2 8123 4567',
  },
  {
    id: 'c3d4e5f6-a7b8-4c7d-8e1f-2a3b4c5d6e7f',
    name: 'BGC Branch',
    address: '789 Bonifacio High Street, Taguig City, Metro Manila 1634',
    phone: '+63 2 8234 5678',
  },
  {
    id: 'd4e5f6a7-b8c9-4d8e-9f2a-3b4c5d6e7f8a',
    name: 'Quezon City Branch',
    address: '123 Tomas Morato Avenue, Quezon City, Metro Manila 1103',
    phone: '+63 2 8345 6789',
  },
  {
    id: 'e5f6a7b8-c9d0-4e9f-aa3b-4c5d6e7f8a9b',
    name: 'Ortigas Branch',
    address: '567 Ortigas Avenue, Pasig City, Metro Manila 1605',
    phone: '+63 2 8456 7890',
  },
  {
    id: 'f6a7b8c9-d0e1-4f0a-bb4c-5d6e7f8a9b0c',
    name: 'Alabang Branch',
    address: '890 Alabang-Zapote Road, Muntinlupa City, Metro Manila 1780',
    phone: '+63 2 8567 8901',
  },
];

// 2 POS devices per branch (10 total)
const POS_DEVICES = BRANCHES.flatMap((branch, branchIndex) => [
  {
    branchIndex,
    name: `${branch.name.split(' ')[0]} POS 1`,
    status: 'ONLINE',
    min: `MIN-${branch.name.split(' ')[0].toUpperCase().slice(0, 3)}-001`,
  },
  {
    branchIndex,
    name: `${branch.name.split(' ')[0]} POS 2`,
    status: 'ONLINE',
    min: `MIN-${branch.name.split(' ')[0].toUpperCase().slice(0, 3)}-002`,
  },
]);

// 4 Cashiers per branch (20 total) + 1 Admin + 1 Manager per branch (5 managers)
const CASHIER_FIRST_NAMES = [
  'Juan',
  'Maria',
  'Pedro',
  'Ana',
  'Jose',
  'Rosa',
  'Carlos',
  'Elena',
  'Miguel',
  'Sofia',
  'Luis',
  'Carmen',
  'Antonio',
  'Isabel',
  'Roberto',
  'Teresa',
  'Francisco',
  'Lucia',
  'Manuel',
  'Patricia',
];

const CASHIER_LAST_NAMES = [
  'Dela Cruz',
  'Santos',
  'Reyes',
  'Garcia',
  'Ramos',
  'Mendoza',
  'Torres',
  'Flores',
  'Gonzales',
  'Lopez',
  'Hernandez',
  'Martinez',
  'Perez',
  'Rodriguez',
  'Sanchez',
  'Ramirez',
  'Cruz',
  'Morales',
  'Gutierrez',
  'Chavez',
];

const MANAGER_NAMES = [
  { firstName: 'Ricardo', lastName: 'Villamor' },
  { firstName: 'Cristina', lastName: 'Aquino' },
  { firstName: 'Fernando', lastName: 'Bautista' },
  { firstName: 'Maricel', lastName: 'Dimaculangan' },
  { firstName: 'Eduardo', lastName: 'Evangelista' },
];

const categories = [
  {
    name: 'Appetizers',
    description: 'Start your meal with these delicious starters',
    sortOrder: 1,
  },
  {
    name: 'Main Courses',
    description: 'Hearty Filipino main dishes',
    sortOrder: 2,
  },
  { name: 'Beverages', description: 'Refreshing drinks', sortOrder: 3 },
  { name: 'Desserts', description: 'Sweet Filipino treats', sortOrder: 4 },
  {
    name: 'Sides',
    description: 'Rice, sauces, and accompaniments',
    sortOrder: 5,
  },
];

const itemsByCategory: Record<
  string,
  Array<{ name: string; description: string; price: number; sku: string }>
> = {
  Appetizers: [
    {
      name: 'Lumpiang Shanghai',
      description: 'Crispy pork spring rolls (8 pcs)',
      price: 165,
      sku: 'APP-001',
    },
    {
      name: 'Buffalo Wings',
      description: 'Crispy wings with sauce (6 pcs)',
      price: 285,
      sku: 'APP-002',
    },
    {
      name: 'Calamares',
      description: 'Crispy fried squid rings',
      price: 195,
      sku: 'APP-003',
    },
    {
      name: "Tokwa't Baboy",
      description: 'Fried tofu with pork belly',
      price: 175,
      sku: 'APP-004',
    },
    {
      name: 'Nachos Grande',
      description: 'Tortilla chips with cheese and jalapeños',
      price: 245,
      sku: 'APP-005',
    },
  ],
  'Main Courses': [
    {
      name: 'Chicken Inasal',
      description: 'Grilled chicken with calamansi',
      price: 285,
      sku: 'MAIN-001',
    },
    {
      name: 'Sizzling Sisig',
      description: 'Sizzling pork face with egg',
      price: 295,
      sku: 'MAIN-002',
    },
    {
      name: 'Crispy Pata',
      description: 'Deep fried pork leg',
      price: 595,
      sku: 'MAIN-003',
    },
    {
      name: 'Kare-Kare',
      description: 'Oxtail in peanut sauce',
      price: 385,
      sku: 'MAIN-004',
    },
    {
      name: 'Sinigang na Baboy',
      description: 'Pork in sour tamarind soup',
      price: 325,
      sku: 'MAIN-005',
    },
    {
      name: 'Lechon Kawali',
      description: 'Crispy pan-roasted pork belly',
      price: 345,
      sku: 'MAIN-006',
    },
    {
      name: 'Bistek Tagalog',
      description: 'Filipino beef steak with onions',
      price: 295,
      sku: 'MAIN-007',
    },
  ],
  Beverages: [
    {
      name: 'Soft Drinks',
      description: 'Coke, Sprite, or Royal',
      price: 55,
      sku: 'BEV-001',
    },
    {
      name: 'Iced Tea',
      description: 'House-brewed iced tea',
      price: 65,
      sku: 'BEV-002',
    },
    {
      name: 'Fresh Calamansi',
      description: 'Freshly squeezed lime juice',
      price: 75,
      sku: 'BEV-003',
    },
    {
      name: 'Mango Shake',
      description: 'Fresh mango smoothie',
      price: 95,
      sku: 'BEV-004',
    },
    {
      name: 'Buko Juice',
      description: 'Fresh coconut juice',
      price: 85,
      sku: 'BEV-005',
    },
    {
      name: 'San Miguel Beer',
      description: 'Local pale pilsen',
      price: 85,
      sku: 'BEV-006',
    },
    {
      name: 'Bottled Water',
      description: '500ml mineral water',
      price: 35,
      sku: 'BEV-007',
    },
  ],
  Desserts: [
    {
      name: 'Halo-Halo',
      description: 'Shaved ice with mixed sweets',
      price: 145,
      sku: 'DES-001',
    },
    {
      name: 'Leche Flan',
      description: 'Creamy caramel custard',
      price: 95,
      sku: 'DES-002',
    },
    {
      name: 'Ube Ice Cream',
      description: 'Purple yam ice cream (2 scoops)',
      price: 85,
      sku: 'DES-003',
    },
    {
      name: 'Turon',
      description: 'Banana spring roll (2 pcs)',
      price: 75,
      sku: 'DES-004',
    },
    {
      name: 'Mango Float',
      description: 'Layered graham and mango',
      price: 125,
      sku: 'DES-005',
    },
  ],
  Sides: [
    {
      name: 'Plain Rice',
      description: 'Steamed jasmine rice',
      price: 35,
      sku: 'SIDE-001',
    },
    {
      name: 'Garlic Rice',
      description: 'Filipino garlic fried rice',
      price: 55,
      sku: 'SIDE-002',
    },
    {
      name: 'Java Rice',
      description: 'Red rice with spices',
      price: 65,
      sku: 'SIDE-003',
    },
    {
      name: 'Extra Sauce',
      description: 'Additional dipping sauce',
      price: 25,
      sku: 'SIDE-004',
    },
    {
      name: 'Atchara',
      description: 'Pickled papaya relish',
      price: 45,
      sku: 'SIDE-005',
    },
  ],
};

// Helper functions
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function calculateVAT(total: number) {
  const vatableSales = total / 1.12;
  const vatAmount = total - vatableSales;
  return { vatableSales, vatAmount };
}

async function main() {
  console.log('🚀 Seeding comprehensive demo data...\n');

  // ========== STORE ==========
  console.log('📍 Creating store...');
  const store = await prisma.store.upsert({
    where: { id: DEMO_STORE_ID },
    update: {},
    create: {
      id: DEMO_STORE_ID,
      name: 'Kainan sa Kalye',
      type: 'RESTAURANT',
      address: '456 Ayala Avenue, Makati City, Metro Manila',
      phone: '+63 2 8123 4567',
      email: 'info@kainanskalye.com',
      registeredName: 'Kainan sa Kalye Food Services Inc.',
      registeredAddress:
        '456 Ayala Avenue, Brgy. Poblacion, Makati City, Metro Manila 1226',
      vatTin: '123-456-789-000',
      isVatRegistered: true,
    },
  });
  console.log(`   ✓ Store: ${store.name}`);

  // ========== BRANCHES (5) ==========
  console.log('\n📍 Creating 5 branches...');
  const createdBranches = [];
  for (const branchData of BRANCHES) {
    const branch = await prisma.branch.upsert({
      where: { id: branchData.id },
      update: {},
      create: {
        id: branchData.id,
        storeId: store.id,
        name: branchData.name,
        address: branchData.address,
        phone: branchData.phone,
        status: 'ONLINE',
        ptuNo: `PTU-2026-${branchData.id.slice(0, 3).toUpperCase()}`,
        ptuDateIssued: new Date('2026-01-01'),
        ptuValidUntil: new Date('2031-01-01'),
        accreditationNo: `ACC-2026-${branchData.id.slice(0, 3).toUpperCase()}`,
      },
    });
    createdBranches.push(branch);
    console.log(`   ✓ ${branch.name}`);
  }

  // ========== ROLES ==========
  console.log('\n👥 Creating roles...');
  const allPermissions = await prisma.permission.findMany();

  const adminRole = await prisma.role.upsert({
    where: { storeId_name: { storeId: store.id, name: 'Admin' } },
    update: {},
    create: {
      storeId: store.id,
      name: 'Admin',
      description: 'Full access administrator',
    },
  });
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
  }

  const managerRole = await prisma.role.upsert({
    where: { storeId_name: { storeId: store.id, name: 'Manager' } },
    update: {},
    create: {
      storeId: store.id,
      name: 'Manager',
      description: 'Branch manager',
    },
  });
  const managerPerms = allPermissions.filter((p) =>
    [
      'store.read',
      'branch.read',
      'user.read',
      'item.read',
      'item.update',
      'pos.read',
      'inventory.read',
      'inventory.receive',
      'loss_prevention.read',
      'clone.read',
      'report.read',
      'audit.read',
    ].includes(p.code),
  );
  for (const permission of managerPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: managerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: managerRole.id, permissionId: permission.id },
    });
  }

  const cashierRole = await prisma.role.upsert({
    where: { storeId_name: { storeId: store.id, name: 'Cashier' } },
    update: {},
    create: {
      storeId: store.id,
      name: 'Cashier',
      description: 'POS Cashier',
    },
  });
  console.log('   ✓ Admin, Manager, Cashier roles created');

  // ========== USERS ==========
  console.log('\n👤 Creating users...');
  const passwordHash = await bcrypt.hash('admin123', 10);
  const createdUsers: any[] = [];
  const branchCashiers: Map<string, any[]> = new Map();

  // Initialize branch cashiers map
  for (const branch of createdBranches) {
    branchCashiers.set(branch.id, []);
  }

  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: { passwordHash },
    create: {
      email: 'admin@demo.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
    },
  });
  await prisma.storeUser.upsert({
    where: { userId_storeId: { userId: adminUser.id, storeId: store.id } },
    update: { roleId: adminRole.id },
    create: { userId: adminUser.id, storeId: store.id, roleId: adminRole.id },
  });
  createdUsers.push(adminUser);
  console.log('   ✓ admin@demo.com (Admin)');

  // 1 Manager per branch (5 managers)
  for (let i = 0; i < BRANCHES.length; i++) {
    const manager = MANAGER_NAMES[i];
    const branch = createdBranches[i];
    const email = `${manager.firstName.toLowerCase()}.${manager.lastName.toLowerCase()}@demo.com`;

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        email,
        passwordHash,
        firstName: manager.firstName,
        lastName: manager.lastName,
        isActive: true,
      },
    });
    await prisma.storeUser.upsert({
      where: { userId_storeId: { userId: user.id, storeId: store.id } },
      update: { roleId: managerRole.id },
      create: { userId: user.id, storeId: store.id, roleId: managerRole.id },
    });
    createdUsers.push(user);
    console.log(`   ✓ ${email} (Manager - ${branch.name})`);
  }

  // 4 Cashiers per branch (20 cashiers)
  let cashierIndex = 0;
  for (let branchIdx = 0; branchIdx < BRANCHES.length; branchIdx++) {
    const branch = createdBranches[branchIdx];
    const branchCashierList: any[] = [];

    for (let c = 0; c < 4; c++) {
      const firstName =
        CASHIER_FIRST_NAMES[cashierIndex % CASHIER_FIRST_NAMES.length];
      const lastName =
        CASHIER_LAST_NAMES[cashierIndex % CASHIER_LAST_NAMES.length];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}@demo.com`;

      const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash },
        create: {
          email,
          passwordHash,
          firstName,
          lastName,
          isActive: true,
        },
      });
      await prisma.storeUser.upsert({
        where: { userId_storeId: { userId: user.id, storeId: store.id } },
        update: { roleId: cashierRole.id },
        create: { userId: user.id, storeId: store.id, roleId: cashierRole.id },
      });
      createdUsers.push(user);
      branchCashierList.push(user);
      cashierIndex++;
    }

    branchCashiers.set(branch.id, branchCashierList);
    console.log(`   ✓ ${branch.name}: 4 cashiers created`);
  }

  // ========== CATEGORIES & ITEMS ==========
  console.log('\n📦 Creating categories and items...');
  const createdItems: any[] = [];

  for (const categoryData of categories) {
    const category = await prisma.category.upsert({
      where: { storeId_name: { storeId: store.id, name: categoryData.name } },
      update: {},
      create: { storeId: store.id, ...categoryData, isActive: true },
    });

    const items = itemsByCategory[categoryData.name] || [];
    for (const itemData of items) {
      const item = await prisma.item.upsert({
        where: { storeId_sku: { storeId: store.id, sku: itemData.sku } },
        update: {},
        create: {
          storeId: store.id,
          categoryId: category.id,
          ...itemData,
          isActive: true,
        },
      });
      createdItems.push(item);

      // Create item availability and inventory for each branch
      for (const branch of createdBranches) {
        await prisma.itemBranch.upsert({
          where: { itemId_branchId: { itemId: item.id, branchId: branch.id } },
          update: {},
          create: { itemId: item.id, branchId: branch.id, isAvailable: true },
        });
        await prisma.branchInventory.upsert({
          where: { itemId_branchId: { itemId: item.id, branchId: branch.id } },
          update: {},
          create: {
            itemId: item.id,
            branchId: branch.id,
            storeId: store.id,
            currentQuantity: randomBetween(50, 200),
            lowStockThreshold: 10,
            isTracked: true,
          },
        });
      }
    }
    console.log(`   ✓ ${categoryData.name}: ${items.length} items`);
  }

  // ========== POS DEVICES (2 per branch = 10 total) ==========
  console.log('\n💻 Creating POS devices (2 per branch)...');
  const createdDevices: any[] = [];

  for (const device of POS_DEVICES) {
    const branch = createdBranches[device.branchIndex];
    const posDevice = await prisma.posDevice.create({
      data: {
        branchId: branch.id,
        deviceIdentifier: `DEMO-${device.min}`,
        name: device.name,
        status: device.status as any,
        min: device.min,
        serialNumber: `SN-${device.min}`,
        permitNumber: `PERMIT-${device.min}`,
        isRegistered: true,
        registeredAt: new Date('2026-01-01'),
        lastHeartbeatAt: new Date(),
        lastSyncAt: new Date(),
      },
    });
    createdDevices.push(posDevice);
    console.log(`   ✓ ${device.name} (${device.status})`);
  }

  // ========== GENERATE ORDERS FOR JANUARY - JUNE 2026 (6 MONTHS) ==========
  console.log('\n📝 Generating orders for January - June 2026 (6 months)...');

  const paymentMethods = [
    'CASH',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'MOBILE_PAYMENT',
  ];
  const orderTypes = ['DINE_IN', 'TAKEOUT', 'DELIVERY'];
  let totalOrders = 0;
  let totalRevenue = 0;
  let zCounterByBranch: Map<string, number> = new Map();
  for (const branch of createdBranches) {
    zCounterByBranch.set(branch.id, 0);
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June'];

  for (let month = 0; month < 6; month++) {
    const daysInMonth = new Date(2026, month + 1, 0).getDate();
    let monthOrders = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(2026, month, day);
      date.setHours(0, 0, 0, 0);

      // More orders on weekends
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const ordersPerBranch = isWeekend
        ? randomBetween(30, 50)
        : randomBetween(20, 35);

      for (const branch of createdBranches) {
        const branchDevices = createdDevices.filter(
          (d) => d.branchId === branch.id,
        );
        const cashiers = branchCashiers.get(branch.id) || [];

        if (branchDevices.length === 0 || cashiers.length === 0) continue;

        // Create shifts for each cashier (2 shifts: morning and afternoon)
        const shifts: any[] = [];

        // Morning shift (9 AM - 3 PM)
        for (let i = 0; i < 2; i++) {
          const operator = cashiers[i];
          const device = branchDevices[i % branchDevices.length];
          const shiftStart = new Date(date);
          shiftStart.setHours(9, 0, 0, 0);
          const shiftEnd = new Date(date);
          shiftEnd.setHours(15, 0, 0, 0);

          const shift = await prisma.shift.create({
            data: {
              posShiftId: uuidv4(),
              posDeviceId: device.id,
              branchId: branch.id,
              storeId: store.id,
              posOperatorId: operator.id,
              operatorId: operator.id,
              status: 'CLOSED',
              openedAt: shiftStart,
              closedAt: shiftEnd,
              openingCash: 5000,
              closingCash: randomBetween(15000, 25000),
              expectedCash: randomBetween(15000, 25000),
              variance: randomBetween(-50, 50),
            },
          });
          shifts.push({ shift, operator, device, startHour: 9, endHour: 15 });
        }

        // Afternoon shift (3 PM - 9 PM)
        for (let i = 2; i < 4; i++) {
          const operator = cashiers[i];
          const device = branchDevices[i % branchDevices.length];
          const shiftStart = new Date(date);
          shiftStart.setHours(15, 0, 0, 0);
          const shiftEnd = new Date(date);
          shiftEnd.setHours(21, 0, 0, 0);

          const shift = await prisma.shift.create({
            data: {
              posShiftId: uuidv4(),
              posDeviceId: device.id,
              branchId: branch.id,
              storeId: store.id,
              posOperatorId: operator.id,
              operatorId: operator.id,
              status: 'CLOSED',
              openedAt: shiftStart,
              closedAt: shiftEnd,
              openingCash: 5000,
              closingCash: randomBetween(20000, 35000),
              expectedCash: randomBetween(20000, 35000),
              variance: randomBetween(-50, 50),
            },
          });
          shifts.push({ shift, operator, device, startHour: 15, endHour: 21 });
        }

        // Generate orders distributed across shifts
        for (let i = 0; i < ordersPerBranch; i++) {
          // Pick a random shift
          const { shift, operator, device, startHour, endHour } =
            randomFromArray(shifts);

          const orderTime = new Date(date);
          orderTime.setHours(
            randomBetween(startHour, endHour - 1),
            randomBetween(0, 59),
            randomBetween(0, 59),
          );

          // Random items for this order (2-5 items)
          const numItems = randomBetween(2, 5);
          const orderItems: any[] = [];
          let subtotal = 0;

          for (let j = 0; j < numItems; j++) {
            const item = randomFromArray(createdItems);
            const quantity = randomBetween(1, 3);
            const unitPrice = Number(item.price);
            const totalPrice = unitPrice * quantity;
            subtotal += totalPrice;

            orderItems.push({
              itemId: item.id,
              itemName: item.name,
              itemSku: item.sku,
              quantity,
              unitPrice,
              totalPrice,
              discountAmount: 0,
              taxAmount: 0,
            });
          }

          // Apply occasional discount (20% of orders)
          let discountTotal = 0;
          const hasDiscount = Math.random() < 0.2;
          if (hasDiscount) {
            discountTotal = Math.round(subtotal * (randomBetween(5, 15) / 100));
          }

          const grandTotal = subtotal - discountTotal;
          const { vatableSales, vatAmount } = calculateVAT(grandTotal);

          // Determine if this order should be voided or refunded (rare)
          const isVoided = Math.random() < 0.02; // 2% voided
          const isRefunded = !isVoided && Math.random() < 0.03; // 3% refunded

          const order = await prisma.order.create({
            data: {
              posOrderId: uuidv4(),
              posDeviceId: device.id,
              branchId: branch.id,
              storeId: store.id,
              shiftId: shift.id,
              operatorId: operator.id,
              orderNumber: `${branch.name.slice(0, 3).toUpperCase()}-${String(month + 1).padStart(2, '0')}${day.toString().padStart(2, '0')}-${i.toString().padStart(4, '0')}`,
              orderType: randomFromArray(orderTypes) as any,
              status: isVoided ? 'VOIDED' : isRefunded ? 'REFUNDED' : 'COMPLETED',
              subtotal,
              discountTotal,
              taxTotal: vatAmount,
              grandTotal,
              vatableSales,
              vatAmount,
              vatExemptSales: 0,
              zeroRatedSales: 0,
              posCreatedAt: orderTime,
              posClosedAt: orderTime,
              orderItems: {
                create: orderItems,
              },
            },
          });

          if (!isVoided) {
            // Create payment
            const paymentMethod = randomFromArray(paymentMethods);
            const isCash = paymentMethod === 'CASH';
            const cashTendered = isCash
              ? Math.ceil(grandTotal / 100) * 100
              : grandTotal;
            const changeAmount = isCash ? cashTendered - grandTotal : 0;

            await prisma.payment.create({
              data: {
                posPaymentId: uuidv4(),
                orderId: order.id,
                paymentMethod: paymentMethod as any,
                status: 'COMPLETED',
                amount: grandTotal,
                tipAmount: Math.random() < 0.1 ? randomBetween(20, 100) : 0,
                changeAmount,
                processedAt: orderTime,
              },
            });

            // Create discount record if applicable
            if (hasDiscount) {
              await prisma.orderDiscount.create({
                data: {
                  orderId: order.id,
                  discountName: randomFromArray([
                    'Senior Citizen',
                    'PWD',
                    'Promo',
                    'Loyalty',
                  ]),
                  discountType: 'PERCENTAGE',
                  discountScope: 'ORDER',
                  discountValue: randomBetween(5, 15),
                  discountAmount: discountTotal,
                },
              });
            }

            if (isRefunded) {
              await prisma.refund.create({
                data: {
                  posRefundId: uuidv4(),
                  orderId: order.id,
                  amount: grandTotal,
                  reason: randomFromArray([
                    'Customer complaint',
                    'Wrong order',
                    'Quality issue',
                  ]),
                  refundMethod: paymentMethod as any,
                  processedAt: new Date(orderTime.getTime() + 3600000),
                },
              });
            }

            totalRevenue += grandTotal;
          }

          totalOrders++;
        }

        // Create Z-Reading for the day
        const zCounter = (zCounterByBranch.get(branch.id) || 0) + 1;
        zCounterByBranch.set(branch.id, zCounter);
        const lastDevice = branchDevices[0];
        await prisma.zReading.create({
          data: {
            posDeviceId: lastDevice.id,
            branchId: branch.id,
            storeId: store.id,
            posZReadingId: uuidv4(),
            zCounterNo: zCounter,
            beginningInvoiceNo: `SI-${String((zCounter - 1) * ordersPerBranch + 1).padStart(6, '0')}`,
            endingInvoiceNo: `SI-${String(zCounter * ordersPerBranch).padStart(6, '0')}`,
            beginningGrandTotal: (zCounter - 1) * ordersPerBranch * 450,
            endingGrandTotal: zCounter * ordersPerBranch * 450,
            grossSales: ordersPerBranch * 500,
            netSales: ordersPerBranch * 450,
            vatableSales: ordersPerBranch * 400,
            vatAmount: ordersPerBranch * 50,
            vatExemptSales: 0,
            zeroRatedSales: 0,
            discountTotal: ordersPerBranch * 20,
            refundTotal: ordersPerBranch * 10,
            voidTotal: ordersPerBranch * 5,
            transactionCount: ordersPerBranch,
            voidCount: Math.floor(ordersPerBranch * 0.02),
            refundCount: Math.floor(ordersPerBranch * 0.03),
            closedBy: cashiers[0].id,
            closedAt: new Date(date.getTime() + 21 * 3600000), // 9 PM
          },
        });

        monthOrders += ordersPerBranch;
      }
    }

    console.log(`   ✓ ${monthNames[month]} 2026: ~${monthOrders} orders across 5 branches`);
  }

  // ========== SUMMARY ==========
  console.log('\n========================================');
  console.log('🎉 Demo data seeding completed!');
  console.log('========================================');
  console.log(`\n📊 Summary:`);
  console.log(`   Store: ${store.name}`);
  console.log(`   Branches: ${createdBranches.length}`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Items: ${createdItems.length}`);
  console.log(`   POS Devices: ${createdDevices.length} (2 per branch)`);
  console.log(
    `   Users: ${createdUsers.length} (1 admin + 5 managers + 20 cashiers)`,
  );
  console.log(`   Orders: ~${totalOrders} (Jan - Jun 2026)`);
  console.log(`   Revenue: ~₱${totalRevenue.toLocaleString()}`);
  console.log('\n🔐 Login credentials (password: admin123):');
  console.log('   - admin@demo.com (Admin - Full Access)');
  console.log('   - ricardo.villamor@demo.com (Manager - Makati)');
  console.log('   - cristina.aquino@demo.com (Manager - BGC)');
  console.log('   - fernando.bautista@demo.com (Manager - QC)');
  console.log('   - maricel.dimaculangan@demo.com (Manager - Ortigas)');
  console.log('   - eduardo.evangelista@demo.com (Manager - Alabang)');
  console.log('   - 20 cashiers (4 per branch)');
  console.log('\n========================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
