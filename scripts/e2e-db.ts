/**
 * עזר DB לבדיקות ה-E2E (Playwright) שב-leads-nextjs/e2e.
 *
 *   npx tsx scripts/e2e-db.ts setup     — מנקה שאריות, יוצר אדמין + נציג + דף נחיתה לבדיקות
 *   npx tsx scripts/e2e-db.ts cleanup   — מוחק את כל נתוני הבדיקות
 *
 * הנתונים מגיעים ממשתנה הסביבה E2E_FIXTURE (JSON). כל נתוני הבדיקות מזוהים לפי
 * אימייל שמסתיים ב-@lumina.test ועיר שמתחילה ב-"e2e-", כך שהניקוי לא נוגע בנתונים אמיתיים.
 */
import bcrypt from "bcrypt";
import prisma from "../src/config/database";

interface Fixture {
  admin: { email: string; password: string };
  pro: {
    email: string; password: string; firstName: string; lastName: string;
    phone: string; city: string; profession: string; pricePerLead: number;
  };
  page: { mainTitle: string; twilioNumber: string };
  testPhones: string[];
}

const EMAIL_DOMAIN = "@lumina.test";
const CITY_PREFIX = "e2e-";

function readFixture(): Fixture {
  const raw = process.env.E2E_FIXTURE;
  if (!raw) throw new Error("E2E_FIXTURE env var is required");
  const f = JSON.parse(raw) as Fixture;
  for (const email of [f.admin.email, f.pro.email]) {
    if (!email.endsWith(EMAIL_DOMAIN)) throw new Error(`test emails must end with ${EMAIL_DOMAIN}: ${email}`);
  }
  if (!f.pro.city.startsWith(CITY_PREFIX)) throw new Error(`test city must start with ${CITY_PREFIX}`);
  return f;
}

async function cleanup(f: Fixture): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: EMAIL_DOMAIN } },
    select: { id: true, proProfile: { select: { id: true } } },
  });
  const proIds = users.map((u) => u.proProfile?.id).filter((id): id is string => !!id);

  await prisma.$transaction([
    prisma.lead.deleteMany({
      where: { OR: [{ proId: { in: proIds } }, { city: { startsWith: CITY_PREFIX } }] },
    }),
    prisma.call.deleteMany({
      where: { OR: [{ proId: { in: proIds } }, { destinationPhone: { in: f.testPhones } }] },
    }),
    prisma.landingPage.deleteMany({
      where: { OR: [{ proId: { in: proIds } }, { city: { startsWith: CITY_PREFIX } }] },
    }),
    prisma.proProfile.deleteMany({ where: { id: { in: proIds } } }),
    prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } }),
  ]);
}

async function setup(f: Fixture): Promise<{ proId: string; landingPageId: string }> {
  await cleanup(f);

  await prisma.user.create({
    data: { email: f.admin.email, passwordHash: await bcrypt.hash(f.admin.password, 10), role: "ADMIN" },
  });

  const proUser = await prisma.user.create({
    data: {
      email: f.pro.email,
      passwordHash: await bcrypt.hash(f.pro.password, 10),
      role: "PRO",
      proProfile: {
        create: {
          firstName: f.pro.firstName,
          lastName: f.pro.lastName,
          phone: f.pro.phone,
          city: f.pro.city,
          profession: f.pro.profession,
          pricePerLead: f.pro.pricePerLead,
        },
      },
    },
    select: { proProfile: { select: { id: true } } },
  });
  const proId = proUser.proProfile!.id;

  const page = await prisma.landingPage.create({
    data: {
      city: f.pro.city,
      profession: f.pro.profession,
      twilioNumber: f.page.twilioNumber,
      mainTitle: f.page.mainTitle,
      subTitle: "",
      description: "דף נחיתה שנוצר אוטומטית לבדיקות E2E",
      heroImage: "",
      galleryImages: "[]",
      proId,
    },
    select: { id: true },
  });

  return { proId, landingPageId: page.id };
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  const fixture = readFixture();
  if (cmd === "setup") {
    const ids = await setup(fixture);
    // שורה אחרונה ב-stdout — נקראת ע"י global-setup של Playwright
    process.stdout.write(`E2E_IDS=${JSON.stringify(ids)}\n`);
  } else if (cmd === "cleanup") {
    await cleanup(fixture);
    process.stdout.write("E2E cleanup done\n");
  } else {
    throw new Error(`unknown command: ${cmd} (expected setup | cleanup)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
