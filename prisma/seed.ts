// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client")
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding lookup tables...")

  // ─────────────────────────────────────────
  // TblServiceLine
  // ─────────────────────────────────────────
  await prisma.tblServiceLine.createMany({
    data: [
      { ServiceLine: "Estate Planning & Trusts", Description: "Estate planning and trust services", SortOrder: 1 },
      { ServiceLine: "M&A",                      Description: "Mergers and acquisitions",           SortOrder: 2 },
      { ServiceLine: "Cross-Border",             Description: "Cross-border tax services",          SortOrder: 3 },
      { ServiceLine: "Tax Litigation",           Description: "Tax litigation support",             SortOrder: 4 },
      { ServiceLine: "Sales Tax",                Description: "Sales tax compliance",               SortOrder: 5 },
      { ServiceLine: "Canadian Tax",             Description: "Canadian tax services",              SortOrder: 6 },
      { ServiceLine: "US Tax",                   Description: "US tax services",                    SortOrder: 7 },
    ],
    skipDuplicates: true,
  })
  console.log("✅ TblServiceLine seeded")

  // ─────────────────────────────────────────
  // TblCurrentStage
  // ─────────────────────────────────────────
  await prisma.tblCurrentStage.createMany({
    data: [
      { CurrentStage: "Preparation & Analysis",       SortOrder: 1,  IsPipeline: false, IsCompleted: false, IsLost: false },
      { CurrentStage: "Opportunity Identified",        SortOrder: 2,  IsPipeline: true,  IsCompleted: false, IsLost: false },
      { CurrentStage: "Scoping & Pricing",             SortOrder: 3,  IsPipeline: true,  IsCompleted: false, IsLost: false },
      { CurrentStage: "Awaiting Client Approval",      SortOrder: 4,  IsPipeline: true,  IsCompleted: false, IsLost: false },
      { CurrentStage: "Gathering Information",         SortOrder: 5,  IsPipeline: false, IsCompleted: false, IsLost: false },
      { CurrentStage: "Internal Review",               SortOrder: 6,  IsPipeline: false, IsCompleted: false, IsLost: false },
      { CurrentStage: "Partner Review",                SortOrder: 7,  IsPipeline: false, IsCompleted: false, IsLost: false },
      { CurrentStage: "Waiting on Client/Third Party", SortOrder: 8,  IsPipeline: false, IsCompleted: false, IsLost: false },
      { CurrentStage: "Implementation",                SortOrder: 9,  IsPipeline: false, IsCompleted: false, IsLost: false },
      { CurrentStage: "Completed",                     SortOrder: 10, IsPipeline: false, IsCompleted: true,  IsLost: false },
      { CurrentStage: "Lost",                          SortOrder: 11, IsPipeline: false, IsCompleted: false, IsLost: true  },
    ],
    skipDuplicates: true,
  })
  console.log("✅ TblCurrentStage seeded")

  // ─────────────────────────────────────────
  // TblChargeAccs
  // ─────────────────────────────────────────
  await prisma.tblChargeAccs.createMany({
    data: [
      { ChargeAcID: 815,  Description: "Paid - Illness/Personal Time",            ChargeType: "Leave"       },
      { ChargeAcID: 817,  Description: "Statutory Holiday",                        ChargeType: "Holiday"     },
      { ChargeAcID: 818,  Description: "Study Leave/Exams",                        ChargeType: "Leave"       },
      { ChargeAcID: 819,  Description: "Paid - Vacation",                          ChargeType: "Leave"       },
      { ChargeAcID: 820,  Description: "Unpaid - Vacation",                        ChargeType: "Leave"       },
      { ChargeAcID: 821,  Description: "Crowe BGK Holiday",                        ChargeType: "Holiday"     },
      { ChargeAcID: 849,  Description: "Unpaid - Illness/Personal Time",           ChargeType: "Leave"       },
      { ChargeAcID: 850,  Description: "Parental Leave",                           ChargeType: "Leave"       },
      { ChargeAcID: 863,  Description: "Birth/Marriage/Bereavement",               ChargeType: "Leave"       },
      { ChargeAcID: 910,  Description: "M&P - Volunteering",                       ChargeType: "NonBillable" },
      { ChargeAcID: 917,  Description: "Jury duty",                                ChargeType: "Leave"       },
      { ChargeAcID: 1118, Description: "Partner - Time off Vacation",              ChargeType: "Leave"       },
      { ChargeAcID: 1142, Description: "Partner Time off - Illness/Personal Time", ChargeType: "Leave"       },
      { ChargeAcID: 1223, Description: "DNU_ Outsourcing Personal Leave/Vacay/Si", ChargeType: "Leave"       },
      { ChargeAcID: 1225, Description: "Volunteering",                             ChargeType: "NonBillable" },
      { ChargeAcID: 1281, Description: "Crowe BGK Summer Friday",                  ChargeType: "Holiday"     },
    ],
    skipDuplicates: true,
  })
  console.log("✅ TblChargeAccs seeded")

  console.log("✅ Lookup tables seeded successfully!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })