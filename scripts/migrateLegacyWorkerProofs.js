const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const normalizeAadhaar = (value) =>
  String(value || "").replace(/\D/g, "");

const normalizePan = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const normalizeOtherId = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

async function main() {
  const workers = await prisma.worker.findMany({
    select: {
      id: true,
      name: true,
      idProofType: true,
      idNumber: true,
      aadhaarNumber: true,
      panNumber: true,
      otherIdNumber: true,
    },
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const worker of workers) {
    const proofType = String(worker.idProofType || "").toUpperCase();
    const legacyNumber = String(worker.idNumber || "").trim();

    if (!legacyNumber) {
      console.log(`Skipped Worker #${worker.id}: ID number missing.`);
      skippedCount++;
      continue;
    }

    const data = {};

    if (proofType === "AADHAR") {
      const aadhaar = normalizeAadhaar(legacyNumber);

      if (!/^\d{12}$/.test(aadhaar)) {
        console.log(
          `Skipped Worker #${worker.id} (${worker.name}): Aadhaar must contain exactly 12 digits.`,
        );
        skippedCount++;
        continue;
      }

      if (!worker.aadhaarNumber) {
        data.aadhaarNumber = aadhaar;
      }
    } else if (proofType === "PAN") {
      const pan = normalizePan(legacyNumber);

      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
        console.log(
          `Skipped Worker #${worker.id} (${worker.name}): PAN format is invalid.`,
        );
        skippedCount++;
        continue;
      }

      if (!worker.panNumber) {
        data.panNumber = pan;
      }
    } else if (proofType === "VOTING" || proofType === "DRIVING") {
      const otherId = normalizeOtherId(legacyNumber);

      if (!worker.otherIdNumber) {
        data.otherIdNumber = otherId;
      }
    } else {
      console.log(
        `Skipped Worker #${worker.id} (${worker.name}): Unknown proof type "${proofType}".`,
      );
      skippedCount++;
      continue;
    }

    if (Object.keys(data).length > 0) {
      await prisma.worker.update({
        where: { id: worker.id },
        data,
      });

      updatedCount++;
      console.log(`Updated Worker #${worker.id} (${worker.name})`);
    }
  }

  console.log("\nMigration finished.");
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });