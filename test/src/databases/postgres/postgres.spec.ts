/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/* eslint-disable no-console */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import '../../util/db-jest-matchers';
import {DateTime} from 'luxon';

const [describe] = describeIfDatabaseAvailable(['postgres']);

describe('Postgres tests', () => {
  const runtimeList = new RuntimeList(['postgres']);
  const runtime = runtimeList.runtimeMap.get('postgres');
  if (runtime === undefined) {
    throw new Error("Couldn't build runtime");
  }

  // Idempotently create schema and tables with capital letters to use in tests.
  beforeAll(async () => {
    const createSchema = await runtime.connection.runSQL(
      'create schema if not exists "UpperSchema";'
    );
    console.log(
      `CREATE SCHEMA RETURNED: ${JSON.stringify(createSchema, undefined, 2)}`
    );
    const create1 = await runtime.connection.runSQL(
      'create table if not exists "UpperSchema"."UpperSchemaUpperTable" as select 1 as one;'
    );
    console.log(
      `CREATE "UpperSchema"."UpperSchemaUpperTable" RETURNED: ${JSON.stringify(
        create1,
        undefined,
        2
      )}`
    );
    const create2 = await runtime.connection.runSQL(
      'create table if not exists "UpperTablePublic" as select 1 as one;'
    );
    console.log(
      `CREATE "UpperTablePublic" RETURNED: ${JSON.stringify(
        create2,
        undefined,
        2
      )}`
    );
  });

  afterAll(async () => {
    await runtimeList.closeAll();
  });

  it('UpperSchema and UpperTablePublic have been created properly', async () => {
    await expect(`
      run: postgres.sql("""
        select table_schema, table_name from information_schema.tables
        where table_name like 'Upper%Table%'
        order by 1, 2
      """)
    `).malloyResultMatches(runtime, [
      {table_schema: 'UpperSchema', table_name: 'UpperSchemaUpperTable'},
      {table_schema: 'public', table_name: 'UpperTablePublic'},
    ]);
    await expect(`
      run: postgres.sql("""
        SELECT table_name, column_name, data_type from information_schema.columns
        WHERE (table_schema  = 'UpperSchema' and table_name = 'UpperSchemaUpperTable')
           OR (table_schema  = 'public' and table_name = 'UpperTablePublic')
        ORDER BY 1
      """)
    `).malloyResultMatches(runtime, [
      {
        table_name: 'UpperSchemaUpperTable',
        column_name: 'one',
        data_type: 'integer',
      },
      {
        table_name: 'UpperTablePublic',
        column_name: 'one',
        data_type: 'integer',
      },
    ]);
  });

  it('run an sql query', async () => {
    await expect(
      'run: postgres.sql("SELECT 1 as n") -> { select: n }'
    ).malloyResultMatches(runtime, {n: 1});
  });

  it('mixed case col names are properly quoted so they retain case in results', async () => {
    await expect(`
      run: postgres.sql('SELECT 1 as "upperLower"') -> { select: upperLower }
    `).malloyResultMatches(runtime, {upperLower: 1});
  });

  it('fields which are sql keywords are quoted', async () => {
    await expect(`
    run: postgres.sql('SELECT 1 as "select"') -> {
      select:
        select
        create is select + 1
    }
  `).malloyResultMatches(runtime, {select: 1, create: 2});
  });

  it('will quote to properly access mixed case table name', async () => {
    await expect(`
      run: postgres.table('public.UpperTablePublic') -> { select: one }
    `).malloyResultMatches(runtime, {one: 1});
  });

  it('quote to properly access mixes case schema name', async () => {
    await expect(`
      run: postgres.table('UpperSchema.UpperSchemaUpperTable') -> { select: one }
    `).malloyResultMatches(runtime, {one: 1});
  });

  it('passes unsupported data', async () => {
    const result = await runtime
      .loadQuery('run: postgres.sql("SELECT int4range(10, 20) as ranger")')
      .run();
    expect(result.data.value[0]['ranger']).toBeDefined();
  });

  it('supports varchars with parameters', async () => {
    await expect(
      "run: postgres.sql(\"SELECT 'a'::VARCHAR as abc, 'a3'::VARCHAR(3) as abc3\")"
    ).malloyResultMatches(runtime, {abc: 'a', abc3: 'a3'});
  });

  describe('time', () => {
    const zone = 'America/Mexico_City'; // -06:00 no DST
    const zone_2020 = DateTime.fromObject({
      year: 2020,
      month: 2,
      day: 20,
      hour: 0,
      minute: 0,
      second: 0,
      zone,
    });
    test('can cast TIMESTAMPTZ to timestamp', async () => {
      await expect(
        `run: duckdb.sql("""
              SELECT TIMESTAMPTZ '2020-02-20 00:00:00 ${zone}' as t_tstz
          """) -> {
            select: mex_220 is t_tstz::timestamp
          }`
      ).malloyResultMatches(runtime, {mex_220: zone_2020.toJSDate()});
    });
  });
});
