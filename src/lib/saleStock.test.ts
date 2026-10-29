// @vitest-environment node
// Run the actual production trigger in an isolated PostgreSQL-compatible database.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const store = '00000000-0000-0000-0000-000000000001';
const outlet = '00000000-0000-0000-0000-000000000002';
const source = '00000000-0000-0000-0000-000000000003';
const product = '00000000-0000-0000-0000-000000000004';
const cashier = '00000000-0000-0000-0000-000000000005';
const sale = '00000000-0000-0000-0000-000000000006';
beforeAll(async () => {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('admin','cashier');
    CREATE TYPE public.transaction_status AS ENUM ('completed','pending');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${cashier}'::uuid $$;
    CREATE FUNCTION public.current_store_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '${store}'::uuid $$;
    CREATE FUNCTION public.has_any_role(uuid, public.app_role[]) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE FUNCTION public.get_user_branch(uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT '${outlet}'::uuid $$;
    CREATE TABLE public.sales(id uuid PRIMARY KEY, store_id uuid, branch_id uuid, cashier_id uuid, status public.transaction_status);
    CREATE TABLE public.products(id uuid PRIMARY KEY, store_id uuid);
    CREATE TABLE public.branch_inventory(store_id uuid, branch_id uuid, product_id uuid, quantity numeric, reserved_quantity numeric DEFAULT 0, is_available boolean DEFAULT true);
    CREATE TABLE public.sale_items(id serial PRIMARY KEY, sale_id uuid, store_id uuid, product_id uuid, quantity numeric);
    CREATE TABLE public.stock_movements(store_id uuid,branch_id uuid,product_id uuid,operation_type text,quantity numeric,reference_id uuid,reference_type text,performed_by uuid);
    INSERT INTO products VALUES('${product}','${store}');
    INSERT INTO sales VALUES('${sale}','${store}','${outlet}','${cashier}','completed');
    INSERT INTO branch_inventory(store_id,branch_id,product_id,quantity) VALUES('${store}','${outlet}','${product}',100),('${store}','${source}','${product}',500);
  `);
  await db.exec(readFileSync('drizzle/migrations/0008_sale_item_stock_deduction.sql', 'utf8'));
}, 30000);
afterAll(async () => { await db.close(); });
const insert = (qty: number) => db.query('INSERT INTO sale_items(sale_id,store_id,product_id,quantity) VALUES($1,$2,$3,$4)', [sale,store,product,qty]);
describe('outlet sale stock deductions', () => {
  it('reduces 100 transferred units to 97 after a cashier sells 3; leaves warehouse stock unchanged', async () => {
    await insert(3);
    const result = await db.query<{quantity:string}>('SELECT quantity FROM branch_inventory WHERE branch_id=$1', [outlet]);
    expect(Number(result.rows[0]?.quantity)).toBe(97);
    const warehouse = await db.query<{quantity:string}>('SELECT quantity FROM branch_inventory WHERE branch_id=$1', [source]);
    expect(Number(warehouse.rows[0]?.quantity)).toBe(500);
    const movements = await db.query<{quantity:string}>('SELECT quantity FROM stock_movements');
    expect(movements.rows).toHaveLength(1);
    expect(Number(movements.rows[0]?.quantity)).toBe(-3);
  });
  it('rejects overselling and rolls back the item and movement', async () => {
    await expect(insert(98)).rejects.toThrow('Insufficient stock');
    const result = await db.query<{quantity:string}>('SELECT quantity FROM branch_inventory WHERE branch_id=$1', [outlet]);
    expect(Number(result.rows[0]?.quantity)).toBe(97);
    const count = await db.query<{count:number}>('SELECT count(*)::int AS count FROM sale_items');
    expect(count.rows[0]?.count).toBe(1);
  });
  it('rejects zero sale quantities', async () => { await expect(insert(0)).rejects.toThrow('Sale quantity must be positive'); });
  it('rejects sale items in a different store', async () => {
    await expect(db.query('INSERT INTO sale_items(sale_id,store_id,product_id,quantity) VALUES($1,$2,$3,1)',[sale,source,product])).rejects.toThrow('Sale item must belong');
  });
});