import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const permissions = [
  // Store permissions
  { code: 'store.create', name: 'Create Store', module: 'store', description: 'Permission to create new stores' },
  { code: 'store.read', name: 'View Store', module: 'store', description: 'Permission to view stores' },
  { code: 'store.update', name: 'Update Store', module: 'store', description: 'Permission to update stores' },
  { code: 'store.delete', name: 'Delete Store', module: 'store', description: 'Permission to delete stores' },

  // Branch permissions
  { code: 'branch.create', name: 'Create Branch', module: 'branch', description: 'Permission to create new branches' },
  { code: 'branch.read', name: 'View Branch', module: 'branch', description: 'Permission to view branches' },
  { code: 'branch.update', name: 'Update Branch', module: 'branch', description: 'Permission to update branches' },
  { code: 'branch.delete', name: 'Delete Branch', module: 'branch', description: 'Permission to delete branches' },

  // User permissions
  { code: 'user.create', name: 'Create User', module: 'user', description: 'Permission to create new users' },
  { code: 'user.read', name: 'View User', module: 'user', description: 'Permission to view users' },
  { code: 'user.update', name: 'Update User', module: 'user', description: 'Permission to update users' },
  { code: 'user.delete', name: 'Delete User', module: 'user', description: 'Permission to delete users' },
  { code: 'user.manage', name: 'Manage User Assignments', module: 'user', description: 'Permission to assign users to stores' },

  // Role permissions
  { code: 'role.create', name: 'Create Role', module: 'role', description: 'Permission to create new roles' },
  { code: 'role.read', name: 'View Role', module: 'role', description: 'Permission to view roles' },
  { code: 'role.update', name: 'Update Role', module: 'role', description: 'Permission to update roles' },
  { code: 'role.delete', name: 'Delete Role', module: 'role', description: 'Permission to delete roles' },

  // Item permissions
  { code: 'item.create', name: 'Create Item', module: 'item', description: 'Permission to create new items' },
  { code: 'item.read', name: 'View Item', module: 'item', description: 'Permission to view items' },
  { code: 'item.update', name: 'Update Item', module: 'item', description: 'Permission to update items' },
  { code: 'item.delete', name: 'Delete Item', module: 'item', description: 'Permission to delete items' },

  // POS permissions
  { code: 'pos.read', name: 'View POS Devices', module: 'pos', description: 'Permission to view POS devices' },
  { code: 'pos.manage', name: 'Manage POS Devices', module: 'pos', description: 'Permission to manage POS devices' },
  { code: 'pos.sync.view', name: 'View Sync Status', module: 'pos', description: 'Permission to view sync status' },

  // Audit permissions
  { code: 'audit.read', name: 'View Audit Logs', module: 'audit', description: 'Permission to view audit logs' },

  // Inventory permissions
  { code: 'inventory.create', name: 'Create Inventory', module: 'inventory', description: 'Permission to create inventory tracking' },
  { code: 'inventory.read', name: 'View Inventory', module: 'inventory', description: 'Permission to view inventory' },
  { code: 'inventory.update', name: 'Update Inventory', module: 'inventory', description: 'Permission to update inventory settings' },
  { code: 'inventory.receive', name: 'Receive Stock', module: 'inventory', description: 'Permission to receive stock' },
  { code: 'inventory.adjust', name: 'Adjust Inventory', module: 'inventory', description: 'Permission to adjust inventory (up, down, wastage)' },

  // Alert permissions
  { code: 'alert.read', name: 'View Alerts', module: 'alert', description: 'Permission to view alerts and notifications' },
  { code: 'alert.acknowledge', name: 'Acknowledge Alerts', module: 'alert', description: 'Permission to acknowledge alerts' },
  { code: 'alert.dismiss', name: 'Dismiss Alerts', module: 'alert', description: 'Permission to dismiss alerts' },
  { code: 'alert.config', name: 'Configure Alerts', module: 'alert', description: 'Permission to configure alert thresholds and settings' },

  // POS Function permissions (synced to POS devices for fine-grained feature gating)
  { code: 'pos_function.void_order', name: 'Void Order', module: 'pos_function', description: 'Permission to void an entire order on POS' },
  { code: 'pos_function.apply_discount', name: 'Apply Discount', module: 'pos_function', description: 'Permission to apply discounts to orders/items on POS' },
  { code: 'pos_function.process_refund', name: 'Process Refund', module: 'pos_function', description: 'Permission to process refunds on POS' },
  { code: 'pos_function.open_cash_drawer', name: 'Open Cash Drawer', module: 'pos_function', description: 'Permission for cash in/out, paid out, and cash drop on POS' },
  { code: 'pos_function.close_shift', name: 'Close Shift', module: 'pos_function', description: 'Permission to close a shift on POS' },
  { code: 'pos_function.view_reports', name: 'View Reports', module: 'pos_function', description: 'Permission to access reports on POS (except Z-Reading)' },
  { code: 'pos_function.generate_z_reading', name: 'Generate Z-Reading', module: 'pos_function', description: 'Permission to close day and generate Z-Reading on POS' },
  { code: 'pos_function.export_reports', name: 'Export Reports', module: 'pos_function', description: 'Permission to export reports to CSV on POS' },
  { code: 'pos_function.manage_device', name: 'Manage Device', module: 'pos_function', description: 'Permission to unregister device and configure printer/display on POS' },
  { code: 'pos_function.view_orders_history', name: 'View Orders History', module: 'pos_function', description: 'Permission to view past orders and reprint receipts on POS' },
];

async function main() {
  console.log('Seeding database...');

  // Create permissions
  console.log('Creating permissions...');
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        description: permission.description,
      },
      create: {
        code: permission.code,
        name: permission.name,
        module: permission.module,
        description: permission.description,
      },
    });
  }
  console.log(`Created ${permissions.length} permissions`);

  // Create admin user (not tied to any store - system administrator)
  console.log('Creating administrator account...');
  const passwordHash = await bcrypt.hash('pass1234', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@posportal.com' },
    update: {
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
    },
    create: {
      email: 'admin@posportal.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
    },
  });

  console.log('Administrator account created:');
  console.log('  Email: admin@posportal.com');
  console.log('  Password: pass1234');
  console.log('  User ID:', adminUser.id);

  console.log('\nSeeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
