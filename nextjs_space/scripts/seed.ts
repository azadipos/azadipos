import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed...");

  // Create default admin user for the system (not shown to user)
  const hashedPassword = await bcrypt.hash("johndoe123", 10);
  await prisma.user.upsert({
    where: { email: "john@doe.com" },
    update: {},
    create: {
      email: "john@doe.com",
      name: "Admin",
      password: hashedPassword,
    },
  });
  console.log("Created default admin user");

  // Create a sample company
  const company = await prisma.company.upsert({
    where: { id: "demo-company" },
    update: {},
    create: {
      id: "demo-company",
      name: "Demo Store",
    },
  });
  console.log("Created demo company:", company.name);

  // Create categories
  const groceryCategory = await prisma.category.upsert({
    where: { companyId_name: { companyId: company.id, name: "Grocery" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Grocery",
      taxRate: 0,
    },
  });

  const beveragesCategory = await prisma.category.upsert({
    where: { companyId_name: { companyId: company.id, name: "Beverages" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Beverages",
      taxRate: 8.5,
    },
  });

  const produceCategory = await prisma.category.upsert({
    where: { companyId_name: { companyId: company.id, name: "Produce" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Produce",
      taxRate: 0,
    },
  });

  const snacksCategory = await prisma.category.upsert({
    where: { companyId_name: { companyId: company.id, name: "Snacks" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Snacks",
      taxRate: 8.5,
    },
  });

  console.log("Created categories");

  // Create vendors
  const vendor1 = await prisma.vendor.upsert({
    where: { companyId_name: { companyId: company.id, name: "ABC Distributors" } },
    update: {},
    create: {
      companyId: company.id,
      name: "ABC Distributors",
      contactInfo: "contact@abcdist.com",
    },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { companyId_name: { companyId: company.id, name: "Fresh Farm Supply" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Fresh Farm Supply",
      contactInfo: "orders@freshfarm.com",
    },
  });

  console.log("Created vendors");

  // Create sample items
  const items = [
    { barcode: "123456789012", name: "Milk 1 Gallon", price: 4.99, cost: 3.50, categoryId: groceryCategory.id, vendorId: vendor1.id, quantityOnHand: 25, isWeightPriced: false },
    { barcode: "123456789013", name: "Bread Loaf", price: 3.49, cost: 2.00, categoryId: groceryCategory.id, vendorId: vendor1.id, quantityOnHand: 30, isWeightPriced: false },
    { barcode: "123456789014", name: "Eggs (Dozen)", price: 5.99, cost: 4.00, categoryId: groceryCategory.id, vendorId: vendor2.id, quantityOnHand: 20, isWeightPriced: false },
    { barcode: "123456789015", name: "Coca Cola 2L", price: 2.49, cost: 1.50, categoryId: beveragesCategory.id, vendorId: vendor1.id, quantityOnHand: 50, isWeightPriced: false },
    { barcode: "123456789016", name: "Water Bottle 500ml", price: 1.29, cost: 0.50, categoryId: beveragesCategory.id, vendorId: vendor1.id, quantityOnHand: 100, isWeightPriced: false },
    { barcode: "123456789017", name: "Orange Juice 64oz", price: 4.99, cost: 3.00, categoryId: beveragesCategory.id, vendorId: vendor1.id, quantityOnHand: 15, isWeightPriced: false },
    { barcode: "4011", name: "Bananas", price: 0.69, cost: 0.30, categoryId: produceCategory.id, vendorId: vendor2.id, quantityOnHand: 0, isWeightPriced: true },
    { barcode: "4065", name: "Apples (Gala)", price: 1.99, cost: 1.00, categoryId: produceCategory.id, vendorId: vendor2.id, quantityOnHand: 0, isWeightPriced: true },
    { barcode: "4664", name: "Tomatoes", price: 2.49, cost: 1.50, categoryId: produceCategory.id, vendorId: vendor2.id, quantityOnHand: 0, isWeightPriced: true },
    { barcode: "123456789020", name: "Potato Chips", price: 3.99, cost: 2.00, categoryId: snacksCategory.id, vendorId: vendor1.id, quantityOnHand: 40, isWeightPriced: false },
    { barcode: "123456789021", name: "Chocolate Bar", price: 1.99, cost: 1.00, categoryId: snacksCategory.id, vendorId: vendor1.id, quantityOnHand: 60, isWeightPriced: false },
  ];

  for (const item of items) {
    await prisma.item.upsert({
      where: { companyId_barcode: { companyId: company.id, barcode: item.barcode } },
      update: {},
      create: {
        companyId: company.id,
        ...item,
      },
    });
  }
  console.log("Created sample items");

  // Create employees
  const manager = await prisma.employee.upsert({
    where: { companyId_barcode: { companyId: company.id, barcode: "EMP-MGR01" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Store Manager",
      pin: "1234",
      barcode: "EMP-MGR01",
      isManager: true,
    },
  });

  const cashier = await prisma.employee.upsert({
    where: { companyId_barcode: { companyId: company.id, barcode: "EMP-CSH01" } },
    update: {},
    create: {
      companyId: company.id,
      name: "John Cashier",
      pin: "5678",
      barcode: "EMP-CSH01",
      isManager: false,
    },
  });

  console.log("Created employees:");
  console.log("  - Store Manager (Barcode: EMP-MGR01) - Manager");
  console.log("  - John Cashier (Barcode: EMP-CSH01) - Cashier");

  console.log("\nSeed completed successfully!");
  console.log("\nDemo Store login Barcodes:");
  console.log("  Manager: EMP-MGR01");
  console.log("  Cashier: EMP-CSH01");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });