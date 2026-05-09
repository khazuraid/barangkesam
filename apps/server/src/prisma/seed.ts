import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const hashed = await argon2.hash('admin123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@alkes.id' },
    update: {},
    create: {
      name: 'Administrator',
      email: 'admin@alkes.id',
      password: hashed,
      role: 'ADMIN',
      is_active: true,
    },
  });

  console.log('✅ Admin user:', admin.email);
  console.log('✅ Seeding selesai!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
