import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Pre-generated UUIDs for consistent demo data
const DEMO_STORE_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
const BRANCHES = [
  {
    id: 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',
    name: 'Makati Branch',
    address: '456 Ayala Avenue, Makati City, Metro Manila 1226',
    phone: '+63 2 8123 4567',
  },
  {
    id: 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f',
    name: 'BGC Branch',
    address: '789 Bonifacio High Street, Taguig City, Metro Manila 1634',
    phone: '+63 2 8234 5678',
  },
  {
    id: 'd4e5f6a7-b8c9-7d8e-1f2a-3b4c5d6e7f8a',
    name: 'Quezon City Branch',
    address: '123 Tomas Morato Avenue, Quezon City, Metro Manila 1103',
    phone: '+63 2 8345 6789',
  },
];

const POS_DEVICES = [
  {
    branchIndex: 0,
    name: 'Makati POS 1',
    status: 'ONLINE',
    min: 'MIN-MKT-001',
  },
  {
    branchIndex: 0,
    name: 'Makati POS 2',
    status: 'ONLINE',
    min: 'MIN-MKT-002',
  },
  { branchIndex: 1, name: 'BGC POS 1', status: 'ONLINE', min: 'MIN-BGC-001' },
  { branchIndex: 1, name: 'BGC POS 2', status: 'OFFLINE', min: 'MIN-BGC-002' },
  { branchIndex: 2, name: 'QC POS 1', status: 'ONLINE', min: 'MIN-QC-001' },
  { branchIndex: 2, name: 'QC POS 2', status: 'INACTIVE', min: 'MIN-QC-002' },
];

const STAFF = [
  {
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan@demo.com',
    role: 'Cashier',
  },
  {
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'maria@demo.com',
    role: 'Cashier',
  },
  {
    firstName: 'Pedro',
    lastName: 'Reyes',
    email: 'pedro@demo.com',
    role: 'Cashier',
  },
  {
    firstName: 'Ana',
    lastName: 'Garcia',
    email: 'ana@demo.com',
    role: 'Manager',
  },
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

  // ========== BRANCHES ==========
  console.log('\n📍 Creating branches...');
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
        ptuNo: `PTU-2024-${branchData.id.slice(0, 3).toUpperCase()}`,
        ptuDateIssued: new Date('2024-01-01'),
        ptuValidUntil: new Date('2029-01-01'),
        accreditationNo: `ACC-2024-${branchData.id.slice(0, 3).toUpperCase()}`,
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
      description: 'Store manager',
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
      description: 'POS Cashier (no portal access)',
    },
  });
  console.log('   ✓ Admin, Manager, Cashier roles created');

  // ========== USERS ==========
  console.log('\n👤 Creating users...');
  const passwordHash = await bcrypt.hash('admin123', 10);
  const createdUsers = [];

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

  // Staff users
  for (const staff of STAFF) {
    const user = await prisma.user.upsert({
      where: { email: staff.email },
      update: { passwordHash },
      create: {
        email: staff.email,
        passwordHash,
        firstName: staff.firstName,
        lastName: staff.lastName,
        isActive: true,
      },
    });
    const role = staff.role === 'Manager' ? managerRole : cashierRole;
    await prisma.storeUser.upsert({
      where: { userId_storeId: { userId: user.id, storeId: store.id } },
      update: { roleId: role.id },
      create: { userId: user.id, storeId: store.id, roleId: role.id },
    });
    createdUsers.push(user);
    console.log(`   ✓ ${staff.email} (${staff.role})`);
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

  // ========== POS DEVICES ==========
  console.log('\n💻 Creating POS devices...');
  const createdDevices = [];

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
        isRegistered: device.status !== 'INACTIVE',
        registeredAt: device.status !== 'INACTIVE' ? new Date() : null,
        lastHeartbeatAt:
          device.status === 'ONLINE'
            ? new Date()
            : new Date(Date.now() - 86400000),
        lastSyncAt:
          device.status === 'ONLINE'
            ? new Date()
            : new Date(Date.now() - 86400000),
      },
    });
    createdDevices.push(posDevice);
    console.log(`   ✓ ${device.name} (${device.status})`);
  }

  // ========== GENERATE ORDERS & TRANSACTIONS ==========
  console.log('\n📝 Generating orders and transactions (past 30 days)...');

  const paymentMethods = [
    'CASH',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'MOBILE_PAYMENT',
  ];
  const orderTypes = ['DINE_IN', 'TAKEOUT', 'DELIVERY'];
  let totalOrders = 0;
  let totalRevenue = 0;

  // Generate data for the past 30 days
  for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(0, 0, 0, 0);

    // More orders on weekends
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const ordersPerBranch = isWeekend
      ? randomBetween(25, 40)
      : randomBetween(15, 30);

    for (const branch of createdBranches) {
      const branchDevices = createdDevices.filter(
        (d) => d.branchId === branch.id && d.status !== 'INACTIVE',
      );
      if (branchDevices.length === 0) continue;

      // Create a shift for each day
      const operator = randomFromArray(
        createdUsers.filter((u) => u.email !== 'admin@demo.com'),
      );
      const device = randomFromArray(branchDevices);

      const shiftStart = new Date(date);
      shiftStart.setHours(9, 0, 0, 0);
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
          status: daysAgo === 0 ? 'OPEN' : 'CLOSED',
          openedAt: shiftStart,
          closedAt: daysAgo === 0 ? null : shiftEnd,
          openingCash: 5000,
          closingCash: daysAgo === 0 ? null : randomBetween(15000, 35000),
          expectedCash: daysAgo === 0 ? null : randomBetween(15000, 35000),
          variance: daysAgo === 0 ? null : randomBetween(-100, 100),
          orderCount: ordersPerBranch,
        },
      });

      // Generate orders for this branch/day
      for (let i = 0; i < ordersPerBranch; i++) {
        const orderTime = new Date(date);
        orderTime.setHours(
          randomBetween(10, 20),
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
            orderNumber: `${branch.name.slice(0, 3).toUpperCase()}-${Date.now()}-${i}`,
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

      // Create Z-Reading for completed days
      if (daysAgo > 0) {
        await prisma.zReading.create({
          data: {
            posDeviceId: device.id,
            branchId: branch.id,
            storeId: store.id,
            posZReadingId: uuidv4(),
            zCounterNo: 30 - daysAgo + 1,
            beginningInvoiceNo: `SI-${String(totalOrders - ordersPerBranch + 1).padStart(6, '0')}`,
            endingInvoiceNo: `SI-${String(totalOrders).padStart(6, '0')}`,
            beginningGrandTotal: totalRevenue - ordersPerBranch * 500,
            endingGrandTotal: totalRevenue,
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
            closedBy: operator.id,
            closedAt: shiftEnd,
          },
        });
      }
    }

    if (daysAgo % 5 === 0) {
      console.log(`   ✓ Day -${daysAgo}: Generated orders`);
    }
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
  console.log(`   POS Devices: ${createdDevices.length}`);
  console.log(`   Users: ${createdUsers.length}`);
  console.log(`   Orders: ~${totalOrders}`);
  console.log(`   Revenue: ~₱${totalRevenue.toLocaleString()}`);
  console.log('\n🔐 Login credentials (password: admin123):');
  console.log('   - admin@demo.com (Admin - Full Access)');
  console.log('   - ana@demo.com (Manager)');
  console.log('   - juan@demo.com, maria@demo.com, pedro@demo.com (Cashiers)');
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
