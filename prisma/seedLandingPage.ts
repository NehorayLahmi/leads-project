import prisma from "../src/config/database";

async function main() {
  const page = await prisma.landingPage.upsert({
    where: { city_profession: { city: "yavne", profession: "locks" } },
    update: {},
    create: {
      city: "yavne",
      profession: "locks",
      twilioNumber: "+97239876543",
      mainTitle: "מנעולן מקצועי ביבנה — 24/7",
      subTitle: "שירות מהיר, אמין ובמחיר הוגן",
      description:
        "בעלי בית ביבנה? נעלתם את עצמכם בחוץ? מנעול שבור? הצוות שלנו מגיע אליכם תוך 20 דקות בכל שעה. ניסיון של מעל 15 שנה, שירות מוסמך ומחירים שקופים ללא הפתעות.",
      heroImage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200",
      profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      galleryImages: [
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600",
        "https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=600",
        "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600",
      ].join(","),
      proId: "seed-pro-1",
    },
  });

  console.log("✅ Landing page seeded:", page.mainTitle, `→ /${page.profession}/${page.city}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
