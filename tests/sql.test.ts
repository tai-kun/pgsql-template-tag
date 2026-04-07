import { test } from "vitest";
import { sql } from "../src/sql.js";

test("テンプレートリテラルで Sql インスタンスを作成できる", ({ expect }) => {
  // Act
  const s = sql`SELECT * FROM u WHERE a = ${1} AND b = [${sql.join([])}]` satisfies sql.Sql;

  // Assert
  expect(s).toBeInstanceOf(sql.Sql);
  expect(s.text).toBe("SELECT * FROM u WHERE a = $1 AND b = []");
  expect(s.values).toHaveLength(1);
  expect(s.values[0]).toBe(1);
});
