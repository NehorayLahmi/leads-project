import prisma from "../src/config/database";

async function main() {
  const pro = await prisma.pro.upsert({
    where: { id: "seed-pro-1" },
    update: {},
    create: {
      id: "seed-pro-1",
      name: "ישראל ישראלי",
      phone: "0521111111",
      city: "תל אביב",
      isActive: true,
      pricePerLead: 50,
    },
  });
  console.log("Seeded Pro:", pro);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
