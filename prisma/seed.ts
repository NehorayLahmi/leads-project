import prisma from "../src/config/database";
import bcrypt from "bcrypt";

async function main() {
  // ── 1. Auth User ──────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("seed123!", 10);

  const user = await prisma.user.upsert({
    where: { email: "pro@example.com" },
    update: {},
    create: {
      id: "seed-user-1",
      email: "pro@example.com",
      passwordHash,
      role: "PRO",
      // ── 2. ProProfile (created together in one transaction) ───────────────
      proProfile: {
        create: {
          id: "seed-pro-1",
          firstName: "ישראל",
          lastName: "ישראלי",
          phone: "0521111111",
          city: "haifa",
          profession: "crane-services",
          pricePerLead: 150,
          isActive: true,
        },
      },
    },
    include: { proProfile: true },
  });

  console.log(`✅ User:       ${user.email} (${user.role})`);
  console.log(`✅ ProProfile: ${user.proProfile?.firstName} ${user.proProfile?.lastName} — ${user.proProfile?.profession} / ${user.proProfile?.city}`);

  // ── 3. LandingPage tied to the ProProfile ─────────────────────────────────
  const page = await prisma.landingPage.upsert({
    where: { city_profession: { city: "haifa", profession: "crane-services" } },
    update: {},
    create: {
      city: "haifa",
      profession: "crane-services",
      twilioNumber: "+97239000001",
      mainTitle: "שירותי עגורן בחיפה — מקצועי ומהיר",
      subTitle: "פתרונות הרמה לכל סוג עבודה",
      description: "חברת עגורנים מובילה בחיפה עם ניסיון של 20 שנה. מגיעים לכל אתר, זמינים 24/7.",
      heroImage: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200",
      galleryImages: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600",
      proId: "seed-pro-1",
    },
  });

  console.log(`✅ LandingPage: /${page.profession}/${page.city} — "${page.mainTitle}"`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
