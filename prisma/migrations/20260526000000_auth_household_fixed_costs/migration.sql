CREATE TABLE "households" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL DEFAULT 'FamFi',
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "allowed_members" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "household_id" uuid NOT NULL,
  "email" text NOT NULL,
  "nickname" text NOT NULL,
  "role" text NOT NULL DEFAULT 'member',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "allowed_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fixed_costs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "household_id" uuid NOT NULL,
  "label" text NOT NULL,
  "category_id" text NOT NULL,
  "sub_category_id" text NOT NULL,
  "amount" integer NOT NULL DEFAULT 0,
  "due_day" integer NOT NULL DEFAULT 1,
  "payer" "Payer" NOT NULL,
  "source" "ExpenseSource" NOT NULL,
  "beneficiary" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid,
  "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixed_costs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "expenses" ADD COLUMN "household_id" uuid;
ALTER TABLE "deposits" ADD COLUMN "household_id" uuid;
ALTER TABLE "categories" ADD COLUMN "household_id" uuid;

CREATE UNIQUE INDEX "allowed_members_household_id_email_key" ON "allowed_members"("household_id", "email");
CREATE INDEX "allowed_members_email_idx" ON "allowed_members"("email");
CREATE INDEX "allowed_members_household_id_idx" ON "allowed_members"("household_id");
CREATE INDEX "fixed_costs_household_id_idx" ON "fixed_costs"("household_id");
CREATE INDEX "fixed_costs_is_active_idx" ON "fixed_costs"("is_active");
CREATE INDEX "expenses_household_id_idx" ON "expenses"("household_id");
CREATE INDEX "deposits_household_id_idx" ON "deposits"("household_id");
CREATE INDEX "categories_household_id_idx" ON "categories"("household_id");

ALTER TABLE "allowed_members" ADD CONSTRAINT "allowed_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fixed_costs" ADD CONSTRAINT "fixed_costs_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase Auth / RLS implementation notes:
-- 1. Pre-register the two allowed email addresses in allowed_members.email.
-- 2. After sign-in, the app should allow access only when auth.users.email exists in allowed_members.
-- 3. RLS policies should scope reads and writes by household_id and allowed_members membership.
-- 4. Do not use raw_user_meta_data as an authorization source because users can modify it.
