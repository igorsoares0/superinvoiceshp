import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const plans = [
  { name: "free", displayName: "Free", price: 0, invoiceLimit: 30 },
  { name: "basic", displayName: "Basic", price: 9, invoiceLimit: 300 },
  { name: "pro", displayName: "Pro", price: 19, invoiceLimit: 1000 },
  { name: "scale", displayName: "Scale", price: 39, invoiceLimit: null },
];

async function main() {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        price: plan.price,
        invoiceLimit: plan.invoiceLimit,
      },
      create: plan,
    });
  }

  console.log("Seeded plans:", plans.map((p) => p.displayName).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
