// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
beforeAll(async () => {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE ROLE authenticated;
    CREATE TYPE public.app_role AS ENUM ('admin','cashier');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id(1)}'::uuid $$;
    CREATE FUNCTION public.current_store_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id(2)}'::uuid $$;
    CREATE FUNCTION public.get_user_branch(uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT '${id(3)}'::uuid $$;
    CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.role',true) = $2::text $$;
    CREATE TABLE public.sales(id uuid PRIMARY KEY,store_id uuid,branch_id uuid,cashier_id uuid);
    CREATE TABLE public.credit_sales(sale_id uuid,store_id uuid,branch_id uuid);
    GRANT USAGE ON SCHEMA auth,public TO authenticated;
    GRANT SELECT ON public.sales,public.credit_sales TO authenticated;
    ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
    CREATE POLICY base_sales_read ON public.sales FOR SELECT TO authenticated USING (cashier_id=auth.uid() OR has_role(auth.uid(),'admin'));
    CREATE POLICY store_isolation ON public.sales AS RESTRICTIVE FOR ALL TO authenticated USING (store_id=current_store_id());
    INSERT INTO sales VALUES
      ('${id(10)}','${id(2)}','${id(3)}','${id(9)}'),
      ('${id(11)}','${id(2)}','${id(4)}','${id(9)}'),
      ('${id(12)}','${id(5)}','${id(3)}','${id(9)}'),
      ('${id(13)}','${id(2)}','${id(3)}','${id(9)}');
    INSERT INTO credit_sales SELECT id,store_id,branch_id FROM sales WHERE id <> '${id(13)}';
  `);
  await db.exec(readFileSync('drizzle/migrations/0009_credit_transaction_read_access.sql','utf8'));
  await db.exec('SET ROLE authenticated');
}, 30000);
afterAll(async () => { await db.close(); });
const visible = async (role: string) => {
  await db.query("SELECT set_config('test.role',$1,false)",[role]);
  return (await db.query<{id:string}>('SELECT id FROM sales ORDER BY id')).rows.map(row => row.id);
};
describe('credit transaction access', () => {
  it('lets a cashier view another cashier’s credit transaction in their assigned branch, not other branches, stores or cash transactions', async () => {
    expect(await visible('cashier')).toEqual([id(10)]);
  });
  it('lets administrators view every branch transaction within their own store', async () => {
    expect(await visible('admin')).toEqual([id(10),id(11),id(13)]);
  });
});