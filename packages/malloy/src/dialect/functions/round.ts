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

import {
  overload,
  minScalar,
  anyExprType,
  sql,
  DialectFunctionOverloadDef,
  makeParam,
} from './util';

export function fnRound(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', anyExprType('number'));
  // TODO this parameter should only accept integers, but we don't have a good
  // way of expressing that constraint at the moment
  const precision = makeParam('precision', anyExprType('number'));
  return [
    overload(minScalar('number'), [value.param], sql`ROUND(${value.arg})`),
    overload(
      minScalar('number'),
      [value.param, precision.param],
      sql`ROUND(${value.arg}, ${precision.arg})`
    ),
    // TODO Consider adding a third overload for round(x, y, mode), where
    // "mode" is "ROUND_HALF_AWAY_FROM_ZERO" or "ROUND_HALF_EVEN"
  ];
}
