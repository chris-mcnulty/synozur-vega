import { db } from './db';
import { tenants } from '@shared/schema';

async function seedTenantsOnly() {
  console.log('Seeding tenants...');

  await db.insert(tenants).values([
    {
      id: 'f7229583-c9c9-4e80-88cf-5bbfd2819770',
      name: 'Acme Corporation',
      color: 'hsl(220, 85%, 38%)',
    },
    {
      id: 'f328cd4e-0fe1-4893-a637-941684749c55',
      name: 'The Synozur Alliance LLC',
      color: 'hsl(277, 98%, 53%)',
    },
    {
      id: '33c48024-917b-4045-a1ef-0542c2da57ca',
      name: 'TechStart Inc',
      color: 'hsl(328, 94%, 45%)',
    },
    {
      id: 'f689f005-63ff-40d8-ac04-79e476615c9b',
      name: 'Global Ventures',
      color: 'hsl(200, 75%, 45%)',
    },
  ]).onConflictDoNothing();

  console.log('✓ Tenants seeded successfully');
}

seedTenantsOnly()
  .then(() => {
    console.log('Seed completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
