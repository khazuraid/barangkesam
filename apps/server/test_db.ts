import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.equipmentRequest.findMany({
    where: { status: { in: ['APPROVED', 'FULFILLED'] } }
  });
  console.log("Approved/Fulfilled count:", reqs.length);
  console.log("First request:", reqs[0]);
}
main().catch(console.error);
