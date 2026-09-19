import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, PaymentMethod } from "../src/generated/prisma/client";
import { splitByPercentage, splitByShares, splitEqual } from "../src/lib/money";
import { CARD_PRODUCTS, ISSUERS, REWARD_CURRENCIES } from "./card-catalog-data";

// Mirrors the TLS handling in src/lib/prisma.ts: RDS needs the Amazon CA
// supplied explicitly, and sslmode has to come out of the URL so node-postgres
// does not override the verified `ssl` config with its own handling.
const rawUrl = process.env.DATABASE_URL ?? "";
const wantsSsl = /sslmode=(require|verify-ca|verify-full)/.test(rawUrl);
const connectionString = rawUrl.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");

function seedSsl() {
  if (!wantsSsl) return undefined;
  const inline = process.env.DATABASE_CA_CERT;
  if (inline?.includes("BEGIN CERTIFICATE")) return { ca: inline, rejectUnauthorized: true as const };
  const bundle = path.join(process.cwd(), "prisma", "rds-ca-bundle.pem");
  if (fs.existsSync(bundle)) return { ca: fs.readFileSync(bundle, "utf8"), rejectUnauthorized: true as const };
  return { rejectUnauthorized: false as const };
}

const adapter = new PrismaPg({ connectionString, ssl: seedSsl() });
const prisma = new PrismaClient({ adapter });

// Colors reference the fixed categorical CSS custom properties defined in
// globals.css (--series-1..8), so each category keeps one identity color
// that resolves correctly in both light and dark mode automatically.
const CATEGORIES = [
  { name: "Food", icon: "UtensilsCrossed", color: "var(--series-1)" },
  { name: "Shopping", icon: "ShoppingBag", color: "var(--series-2)" },
  { name: "Transport", icon: "Car", color: "var(--series-3)" },
  { name: "Entertainment", icon: "Clapperboard", color: "var(--series-4)" },
  { name: "Bills", icon: "Receipt", color: "var(--series-5)" },
  { name: "Health", icon: "HeartPulse", color: "var(--series-6)" },
  { name: "Education", icon: "GraduationCap", color: "var(--series-7)" },
  { name: "Other", icon: "MoreHorizontal", color: "var(--series-8)" },
];

// Card-reward category matching needs distinctions the base expense categories don't make
// (e.g. "Travel" as flights/hotels vs. "Transport" as daily commute). Added as system defaults
// alongside CATEGORIES rather than a separate taxonomy so the reward engine and expense tracker
// share one source of truth for "what category was this spend."
const CARD_CATEGORIES = [
  { name: "Travel", icon: "Plane", color: "var(--series-1)" },
  { name: "Dining", icon: "UtensilsCrossed", color: "var(--series-2)" },
  { name: "Grocery", icon: "ShoppingCart", color: "var(--series-3)" },
  { name: "Fuel", icon: "Fuel", color: "var(--series-4)" },
  { name: "Utilities", icon: "Zap", color: "var(--series-5)" },
];

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number) {
  return Math.floor(randomBetween(min, max + 1));
}

function pick<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

const FOOD_DESCRIPTIONS = ["Zomato order", "Swiggy delivery", "Groceries", "Lunch with friends", "Coffee"];
const SHOPPING_DESCRIPTIONS = ["Amazon order", "Myntra haul", "New shoes", "Home decor"];
const TRANSPORT_DESCRIPTIONS = ["Uber ride", "Ola ride", "Fuel", "Metro card recharge"];
const ENTERTAINMENT_DESCRIPTIONS = ["Movie tickets", "Concert", "Gaming purchase"];
const BILLS_DESCRIPTIONS = ["Electricity bill", "Internet bill", "Mobile recharge", "Rent"];
const HEALTH_DESCRIPTIONS = ["Pharmacy", "Doctor visit", "Gym membership"];
const EDUCATION_DESCRIPTIONS = ["Online course", "Books"];
const OTHER_DESCRIPTIONS = ["Miscellaneous", "Gift"];

const DESCRIPTIONS_BY_CATEGORY: Record<string, string[]> = {
  Food: FOOD_DESCRIPTIONS,
  Shopping: SHOPPING_DESCRIPTIONS,
  Transport: TRANSPORT_DESCRIPTIONS,
  Entertainment: ENTERTAINMENT_DESCRIPTIONS,
  Bills: BILLS_DESCRIPTIONS,
  Health: HEALTH_DESCRIPTIONS,
  Education: EDUCATION_DESCRIPTIONS,
  Other: OTHER_DESCRIPTIONS,
};

const AMOUNT_RANGE_BY_CATEGORY: Record<string, [number, number]> = {
  Food: [120, 900],
  Shopping: [400, 4500],
  Transport: [80, 700],
  Entertainment: [200, 1500],
  Bills: [500, 6000],
  Health: [150, 2500],
  Education: [500, 3000],
  Other: [100, 1000],
};

async function main() {
  console.log("Seeding default categories...");
  // Prisma can't upsert on a compound unique key with a null column (SQL NULL
  // never equals NULL), so find-or-create explicitly instead.
  const categoryRecords = await Promise.all(
    [...CATEGORIES, ...CARD_CATEGORIES].map(async (c) => {
      const existing = await prisma.expenseCategory.findFirst({
        where: { userId: null, name: c.name },
      });
      if (existing) {
        return prisma.expenseCategory.update({
          where: { id: existing.id },
          data: { icon: c.icon, color: c.color },
        });
      }
      return prisma.expenseCategory.create({
        data: { ...c, userId: null, isDefault: true },
      });
    })
  );

  console.log("Seeding demo user...");
  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@evenly.app" },
    update: {},
    create: {
      name: "Suhrid",
      email: "demo@evenly.app",
      passwordHash,
      currency: "INR",
    },
  });

  console.log("Clearing existing demo data for idempotent re-seeding...");
  await prisma.expense.deleteMany({ where: { userId: user.id } });
  await prisma.income.deleteMany({ where: { userId: user.id } });
  await prisma.budget.deleteMany({ where: { userId: user.id } });
  await prisma.group.deleteMany({ where: { createdBy: user.id } });
  await prisma.savingsGoal.deleteMany({ where: { userId: user.id } });
  await prisma.subscription.deleteMany({ where: { userId: user.id } });
  await prisma.receipt.deleteMany({ where: { userId: user.id } });

  const now = new Date();
  const monthsBack = 2;
  const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

  console.log("Seeding incomes (monthly salary)...");
  for (let m = 0; m <= monthsBack; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() - monthsBack + m, 1);
    await prisma.income.create({
      data: {
        userId: user.id,
        amount: "85000.00",
        source: "Salary",
        date,
        isRecurring: true,
        recurrenceInterval: "MONTHLY",
      },
    });
  }

  console.log("Seeding expenses...");
  const totalDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  // Random daily-expense generation only knows amount ranges/descriptions for the original
  // CATEGORIES set; card-reward categories (Travel, Fuel, etc.) are seeded for rule-matching
  // only and are deliberately excluded from this random pick.
  const expenseSeedCategoryRecords = categoryRecords.filter((c) =>
    CATEGORIES.some((base) => base.name === c.name)
  );

  for (let d = 0; d <= totalDays; d++) {
    const date = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    const expensesToday = Math.random() < 0.6 ? 1 : Math.random() < 0.85 ? 2 : 0;

    for (let i = 0; i < expensesToday; i++) {
      const category = pick(expenseSeedCategoryRecords);
      const [min, max] = AMOUNT_RANGE_BY_CATEGORY[category.name];
      const amount = randomBetween(min, max).toFixed(2);
      const description = pick(DESCRIPTIONS_BY_CATEGORY[category.name]);

      await prisma.expense.create({
        data: {
          userId: user.id,
          categoryId: category.id,
          amount,
          description,
          date,
          paymentMethod: pick(PAYMENT_METHODS),
        },
      });
    }
  }

  console.log("Seeding recurring subscriptions (Netflix, gym)...");
  const billsCategory = categoryRecords.find((c) => c.name === "Bills")!;
  const entertainmentCategory = categoryRecords.find((c) => c.name === "Entertainment")!;
  for (let m = 0; m <= monthsBack; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() - monthsBack + m, 5);
    await prisma.expense.create({
      data: {
        userId: user.id,
        categoryId: entertainmentCategory.id,
        amount: "649.00",
        description: "Netflix",
        date,
        paymentMethod: "CARD",
        isRecurring: true,
        recurrenceInterval: "MONTHLY",
      },
    });
    await prisma.expense.create({
      data: {
        userId: user.id,
        categoryId: billsCategory.id,
        amount: "1499.00",
        description: "Gym membership",
        date: new Date(now.getFullYear(), now.getMonth() - monthsBack + m, 3),
        paymentMethod: "UPI",
        isRecurring: true,
        recurrenceInterval: "MONTHLY",
      },
    });
  }

  console.log("Seeding budgets for the current month...");
  const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const budgetAmounts: Record<string, string> = {
    Food: "8000.00",
    Shopping: "5000.00",
    Transport: "3000.00",
    Entertainment: "2000.00",
  };
  for (const [categoryName, amount] of Object.entries(budgetAmounts)) {
    const category = categoryRecords.find((c) => c.name === categoryName)!;
    await prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        amount,
        periodStart: currentPeriodStart,
      },
    });
  }

  console.log("Seeding demo groups...");
  const foodCategory = categoryRecords.find((c) => c.name === "Food")!;
  const transportCategory = categoryRecords.find((c) => c.name === "Transport")!;
  const entertainmentCategory2 = categoryRecords.find((c) => c.name === "Entertainment")!;

  // Self-contained mirror of src/lib/data/groups.ts's syncGroupExpenseToPersonalExpenses.
  // Duplicated rather than imported: this seed script runs via plain `tsx` with no `@/`
  // path-alias resolution (see the relative "../src/lib/money" import above), so it can't
  // reach into src/lib/data without its own module-resolution setup. Keep this in sync with
  // the real implementation if the sync rule ever changes.
  async function seedSyncGroupExpense(groupExpenseId: string) {
    const expense = await prisma.groupExpense.findUniqueOrThrow({
      where: { id: groupExpenseId },
      include: { shares: { include: { groupMember: true } } },
    });
    for (const share of expense.shares) {
      if (!share.groupMember.userId) continue;
      await prisma.expense.upsert({
        where: { groupExpenseId_userId: { groupExpenseId, userId: share.groupMember.userId } },
        update: { categoryId: expense.categoryId, amount: share.shareAmount, description: expense.description, date: expense.date },
        create: {
          userId: share.groupMember.userId,
          categoryId: expense.categoryId,
          groupExpenseId,
          amount: share.shareAmount,
          description: expense.description,
          date: expense.date,
          paymentMethod: "OTHER",
          notes: `Your share of a group expense.`,
        },
      });
    }
  }

  async function createGroupExpense(
    groupId: string,
    paidByMemberId: string,
    categoryId: string,
    description: string,
    date: Date,
    splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES",
    shares: { memberId: string; amount: string; percentage?: string; units?: number }[]
  ) {
    const amount = shares.reduce((sum, s) => sum + Number(s.amount), 0).toFixed(2);
    const created = await prisma.groupExpense.create({
      data: {
        groupId,
        categoryId,
        paidByMemberId,
        description,
        amount,
        date,
        splitType,
        createdByUserId: user.id,
        shares: {
          create: shares.map((s) => ({
            groupMemberId: s.memberId,
            shareAmount: s.amount,
            sharePercentage: s.percentage ?? null,
            shareUnits: s.units ?? null,
          })),
        },
      },
    });
    await seedSyncGroupExpense(created.id);
  }

  // --- Goa Trip ---
  const goaTrip = await prisma.group.create({
    data: { name: "Goa Trip", icon: "✈️", createdBy: user.id },
  });
  const goaYou = await prisma.groupMember.create({
    data: { groupId: goaTrip.id, userId: user.id, name: user.name ?? "You" },
  });
  const rahul = await prisma.groupMember.create({
    data: { groupId: goaTrip.id, name: "Rahul", email: "rahul.demo@example.com" },
  });
  const priya = await prisma.groupMember.create({
    data: { groupId: goaTrip.id, name: "Priya", email: "priya.demo@example.com" },
  });

  const flightAmounts = splitEqual("9000", 3);
  await createGroupExpense(
    goaTrip.id,
    goaYou.id,
    transportCategory.id,
    "Flight tickets",
    new Date(now.getFullYear(), now.getMonth() - 1, 2),
    "EQUAL",
    [goaYou, rahul, priya].map((m, i) => ({ memberId: m.id, amount: flightAmounts[i].toString() }))
  );

  await createGroupExpense(
    goaTrip.id,
    rahul.id,
    entertainmentCategory2.id,
    "Beach resort (3 nights)",
    new Date(now.getFullYear(), now.getMonth() - 1, 3),
    "EXACT",
    [
      { memberId: goaYou.id, amount: "6000.00" },
      { memberId: rahul.id, amount: "6000.00" },
      { memberId: priya.id, amount: "3000.00" },
    ]
  );

  const dinnerPct = splitByPercentage("3000", [50, 30, 20]);
  await createGroupExpense(
    goaTrip.id,
    priya.id,
    foodCategory.id,
    "Beach shack dinner",
    new Date(now.getFullYear(), now.getMonth() - 1, 4),
    "PERCENTAGE",
    [
      { memberId: goaYou.id, amount: dinnerPct[0].toString(), percentage: "50.00" },
      { memberId: rahul.id, amount: dinnerPct[1].toString(), percentage: "30.00" },
      { memberId: priya.id, amount: dinnerPct[2].toString(), percentage: "20.00" },
    ]
  );

  const scooterShares = splitByShares("1500", [2, 1]);
  await createGroupExpense(
    goaTrip.id,
    goaYou.id,
    transportCategory.id,
    "Scooter rental",
    new Date(now.getFullYear(), now.getMonth() - 1, 4),
    "SHARES",
    [
      { memberId: goaYou.id, amount: scooterShares[0].toString(), units: 2 },
      { memberId: rahul.id, amount: scooterShares[1].toString(), units: 1 },
    ]
  );

  const goaSettlement = await prisma.settlement.create({
    data: {
      groupId: goaTrip.id,
      fromMemberId: priya.id,
      toMemberId: goaYou.id,
      amount: "1500.00",
      note: "Partial settle-up over UPI",
      createdByUserId: user.id,
    },
  });
  // Self-contained mirror of src/lib/data/groups.ts's syncSettlementToIncome. See the note
  // on seedSyncGroupExpense above for why this is duplicated rather than imported.
  await prisma.income.upsert({
    where: { settlementId: goaSettlement.id },
    update: { amount: goaSettlement.amount, date: goaSettlement.settledAt },
    create: {
      userId: user.id,
      settlementId: goaSettlement.id,
      amount: goaSettlement.amount,
      source: "Repaid by Priya · Goa Trip",
      date: goaSettlement.settledAt,
    },
  });

  // --- Flatmates ---
  const flatmates = await prisma.group.create({
    data: { name: "Flatmates", icon: "🏠", createdBy: user.id },
  });
  const flatYou = await prisma.groupMember.create({
    data: { groupId: flatmates.id, userId: user.id, name: user.name ?? "You" },
  });
  const aditya = await prisma.groupMember.create({
    data: { groupId: flatmates.id, name: "Aditya", email: "aditya.demo@example.com" },
  });
  const meera = await prisma.groupMember.create({
    data: { groupId: flatmates.id, name: "Meera", email: "meera.demo@example.com" },
  });

  for (let m = 0; m <= 1; m++) {
    const rentDate = new Date(now.getFullYear(), now.getMonth() - 1 + m, 1);
    const rentAmounts = splitEqual("24000", 3);
    await createGroupExpense(
      flatmates.id,
      flatYou.id,
      billsCategory.id,
      "Rent",
      rentDate,
      "EQUAL",
      [flatYou, aditya, meera].map((mm, i) => ({ memberId: mm.id, amount: rentAmounts[i].toString() }))
    );

    const groceryAmounts = splitEqual("2400", 3);
    await createGroupExpense(
      flatmates.id,
      aditya.id,
      foodCategory.id,
      "Groceries",
      new Date(rentDate.getFullYear(), rentDate.getMonth(), 10),
      "EQUAL",
      [flatYou, aditya, meera].map((mm, i) => ({ memberId: mm.id, amount: groceryAmounts[i].toString() }))
    );
  }

  await createGroupExpense(
    flatmates.id,
    meera.id,
    billsCategory.id,
    "Electricity bill",
    new Date(now.getFullYear(), now.getMonth(), 6),
    "EXACT",
    [
      { memberId: flatYou.id, amount: "800.00" },
      { memberId: aditya.id, amount: "800.00" },
      { memberId: meera.id, amount: "700.00" },
    ]
  );

  // --- College Friends ---
  const college = await prisma.group.create({
    data: { name: "College Friends", icon: "🎓", createdBy: user.id },
  });
  const clgYou = await prisma.groupMember.create({
    data: { groupId: college.id, userId: user.id, name: user.name ?? "You" },
  });
  const arjun = await prisma.groupMember.create({
    data: { groupId: college.id, name: "Arjun", email: "arjun.demo@example.com" },
  });
  const sneha = await prisma.groupMember.create({
    data: { groupId: college.id, name: "Sneha", email: "sneha.demo@example.com" },
  });
  const karan = await prisma.groupMember.create({
    data: { groupId: college.id, name: "Karan", email: "karan.demo@example.com" },
  });

  const reunionAmounts = splitEqual("4800", 4);
  await createGroupExpense(
    college.id,
    clgYou.id,
    foodCategory.id,
    "Reunion dinner",
    new Date(now.getFullYear(), now.getMonth(), 9),
    "EQUAL",
    [clgYou, arjun, sneha, karan].map((m, i) => ({ memberId: m.id, amount: reunionAmounts[i].toString() }))
  );

  await createGroupExpense(
    college.id,
    arjun.id,
    entertainmentCategory2.id,
    "Movie night",
    new Date(now.getFullYear(), now.getMonth(), 9),
    "EQUAL",
    splitEqual("800", 4).map((amt, i) => ({
      memberId: [clgYou, arjun, sneha, karan][i].id,
      amount: amt.toString(),
    }))
  );

  console.log("Seeding savings goals...");
  const emergencyFund = await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name: "Emergency fund",
      icon: "🚨",
      targetAmount: "150000.00",
      currentAmount: "45000.00",
      targetDate: new Date(now.getFullYear(), now.getMonth() + 8, 1),
      monthlyContribution: "12000.00",
    },
  });
  await prisma.goalContribution.createMany({
    data: [
      { goalId: emergencyFund.id, amount: "25000.00", note: "Initial deposit", createdAt: new Date(now.getFullYear(), now.getMonth() - 2, 5) },
      { goalId: emergencyFund.id, amount: "12000.00", note: "Monthly top-up", createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 3) },
      { goalId: emergencyFund.id, amount: "8000.00", note: "Monthly top-up", createdAt: new Date(now.getFullYear(), now.getMonth(), 3) },
    ],
  });

  const vacationGoal = await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name: "Vacation",
      icon: "🏖️",
      targetAmount: "40000.00",
      currentAmount: "12000.00",
      monthlyContribution: "5000.00",
    },
  });
  await prisma.goalContribution.createMany({
    data: [
      { goalId: vacationGoal.id, amount: "7000.00", note: "Diwali bonus", createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 12) },
      { goalId: vacationGoal.id, amount: "5000.00", note: null, createdAt: new Date(now.getFullYear(), now.getMonth(), 2) },
    ],
  });

  const laptopGoal = await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name: "New laptop",
      icon: "💻",
      targetAmount: "90000.00",
      currentAmount: "90000.00",
      isCompleted: true,
    },
  });
  await prisma.goalContribution.createMany({
    data: [
      { goalId: laptopGoal.id, amount: "50000.00", note: "Initial deposit", createdAt: new Date(now.getFullYear(), now.getMonth() - 2, 10) },
      { goalId: laptopGoal.id, amount: "40000.00", note: "Freelance payout", createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 20) },
    ],
  });

  console.log(`Seeding credit card catalog (${CARD_PRODUCTS.length} cards across ${ISSUERS.length} issuers)...`);

  const SOURCE_CHECKED_AT = new Date("2026-08-26");

  const issuersByName = new Map<string, { id: string }>();
  for (const i of ISSUERS) {
    issuersByName.set(i.name, await prisma.issuer.upsert({ where: { name: i.name }, update: { shortCode: i.shortCode }, create: i }));
  }

  const currenciesByName = new Map<string, { id: string }>();
  for (const c of REWARD_CURRENCIES) {
    currenciesByName.set(
      c.name,
      await prisma.rewardCurrency.upsert({
        where: { name: c.name },
        update: { type: c.type, unitValueInr: c.unitValueInr, valueNote: c.valueNote },
        create: c,
      })
    );
  }

  const cardsBySlug = new Map<string, { id: string }>();
  for (const p of CARD_PRODUCTS) {
    const { issuerName, rewardCurrencyName, categoryRules, slug, ...rest } = p;
    const data = {
      ...rest,
      issuerId: issuersByName.get(issuerName)!.id,
      rewardCurrencyId: rewardCurrencyName ? currenciesByName.get(rewardCurrencyName)!.id : undefined,
      sourceCheckedAt: SOURCE_CHECKED_AT,
    };
    const product = await prisma.cardProduct.upsert({ where: { slug }, update: data, create: { ...data, slug } });
    cardsBySlug.set(slug, product);

    for (const rule of categoryRules ?? []) {
      // categoryId is nullable (channel-only rules), and SQL NULL never equals NULL, so the
      // compound-unique constraint can't be used with upsert() when categoryId is null.
      const categoryId = rule.categoryName ? categoryRecords.find((c) => c.name === rule.categoryName)!.id : null;
      const ruleData = { multiplier: rule.multiplier, capAmount: rule.capAmount, capPeriod: rule.capPeriod, notes: rule.notes };
      const existing = await prisma.cardCategoryRule.findFirst({
        where: { cardProductId: product.id, categoryId, channel: rule.channel },
      });
      if (existing) {
        await prisma.cardCategoryRule.update({ where: { id: existing.id }, data: ruleData });
      } else {
        await prisma.cardCategoryRule.create({
          data: { cardProductId: product.id, categoryId, channel: rule.channel, ...ruleData },
        });
      }
    }
  }

  console.log("Seeding demo user's card portfolio...");
  await prisma.userCard.deleteMany({ where: { userId: user.id } });

  const demoPortfolio: { slug: string; creditLimit: string; outstanding: string; rewardBalance: string; statementDate: number; paymentDueDate: number }[] = [
    { slug: "hdfc-regalia-gold", creditLimit: "200000.00", outstanding: "42300.00", rewardBalance: "12450", statementDate: 5, paymentDueDate: 25 },
    { slug: "axis-atlas", creditLimit: "300000.00", outstanding: "50000.00", rewardBalance: "8200", statementDate: 10, paymentDueDate: 30 },
    { slug: "sbi-cashback", creditLimit: "150000.00", outstanding: "18000.00", rewardBalance: "1240", statementDate: 15, paymentDueDate: 3 },
    { slug: "amex-mrcc", creditLimit: "100000.00", outstanding: "22000.00", rewardBalance: "32000", statementDate: 20, paymentDueDate: 8 },
  ];
  for (const card of demoPortfolio) {
    const { slug, ...data } = card;
    await prisma.userCard.create({ data: { userId: user.id, cardProductId: cardsBySlug.get(slug)!.id, ...data } });
  }

  console.log("Seed complete. Demo login: demo@evenly.app / password123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
