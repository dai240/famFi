ALTER TABLE "categories" ADD COLUMN "color" varchar(16) NOT NULL DEFAULT '#64748b';

UPDATE "categories" SET "color" = '#0f766e' WHERE "id" = 'cat-housing';
UPDATE "categories" SET "color" = '#2563eb' WHERE "id" = 'cat-utilities';
UPDATE "categories" SET "color" = '#7c3aed' WHERE "id" = 'cat-communication';
UPDATE "categories" SET "color" = '#16a34a' WHERE "id" = 'cat-food';
UPDATE "categories" SET "color" = '#d97706' WHERE "id" = 'cat-daily';
UPDATE "categories" SET "color" = '#db2777' WHERE "id" = 'cat-childcare';
UPDATE "categories" SET "color" = '#0891b2' WHERE "id" = 'cat-transport';
UPDATE "categories" SET "color" = '#4f46e5' WHERE "id" = 'cat-insurance';
UPDATE "categories" SET "color" = '#475569' WHERE "id" = 'cat-car';
UPDATE "categories" SET "color" = '#ea580c' WHERE "id" = 'cat-leisure';
UPDATE "categories" SET "color" = '#9333ea' WHERE "id" = 'cat-large-purchase';
UPDATE "categories" SET "color" = '#64748b' WHERE "id" = 'cat-other';
UPDATE "categories" SET "color" = '#94a3b8' WHERE "id" = 'cat-uncategorized';
