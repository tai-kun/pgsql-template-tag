import { describe, test } from "vitest";
import { join, raw, Sql } from "../src/core.js";

describe("基本的なインスタンス化とプレースホルダ生成の振る舞い", () => {
  test("1 つのバインド変数を持つ SQL を生成したとき、プレースホルダ $1 と値が正しく設定される", ({ expect }) => {
    // Arrange
    const rawStrings = ["SELECT * FROM users WHERE id = ", ""];
    const rawBindings = [10];

    // Act
    const sql = new Sql(rawStrings, rawBindings);

    // Assert
    expect(sql.text).toBe("SELECT * FROM users WHERE id = $1");
    expect(sql.values).toHaveLength(1);
    expect(sql.values[0]).toBe(10);
  });

  test("複数の異なるバインド変数を持つ SQL を生成したとき、インクリメントされたプレースホルダが割り振られる", ({ expect }) => {
    // Arrange
    const rawStrings = ["SELECT * FROM u WHERE a = ", " AND b = ", ""];
    const rawBindings = [1, 2];

    // Act
    const sql = new Sql(rawStrings, rawBindings);

    // Assert
    expect(sql.text).toBe("SELECT * FROM u WHERE a = $1 AND b = $2");
    expect(sql.values).toHaveLength(2);
    expect(sql.values[0]).toBe(1);
    expect(sql.values[1]).toBe(2);
  });

  test("10 個以上のバインド変数があるとき、2 桁のプレースホルダ ID が正しく採番される", ({ expect }) => {
    // Arrange
    const count = 11;
    const rawStrings = Array(count + 1).fill("");
    const rawBindings = Array.from({ length: count }, (_, i) => i + 1);

    // Act
    const sql = new Sql(rawStrings, rawBindings);

    // Assert
    expect(sql.text).toContain("$10");
    expect(sql.text).toContain("$11");
    expect(sql.values).toHaveLength(11);
    expect(sql.values[10]).toBe(11);
  });
});

describe("変数の重複排除の振る舞い", () => {
  test("同一の値が複数回バインドされたとき、同じプレースホルダ ID が再利用され values が圧縮される", ({ expect }) => {
    // Arrange
    const rawStrings = ["SELECT * FROM u WHERE a = ", " OR b = ", ""];
    const rawBindings = [100, 100];

    // Act
    const sql = new Sql(rawStrings, rawBindings);

    // Assert
    expect(sql.text).toBe("SELECT * FROM u WHERE a = $1 OR b = $1");
    expect(sql.values).toHaveLength(1);
    expect(sql.values[0]).toBe(100);
  });

  test("オブジェクトをバインドしたとき、参照が一致していれば同一 ID とみなされる", ({ expect }) => {
    // Arrange
    const obj = { id: 1 };
    const sql = new Sql(["", " = ", ""], [obj, obj]);

    // Act & Assert
    expect(sql.text).toBe("$1 = $1");
    expect(sql.values).toHaveLength(1);
    expect(sql.values[0]).toBe(obj);
  });
});

describe("Sql オブジェクトの結合とネストの振る舞い", () => {
  test("Sql オブジェクトを別の Sql オブジェクトにネストしたとき、クエリとバインド変数が統合される", ({ expect }) => {
    // Arrange
    const nestedSql = new Sql(["", ", ", ""], [1, 2]);
    const parentSql = new Sql(["WHERE id IN (", ")"], [nestedSql]);

    // Act & Assert
    expect(parentSql.text).toBe("WHERE id IN ($1, $2)");
    expect(parentSql.values).toHaveLength(2);
    expect(parentSql.values[0]).toBe(1);
    expect(parentSql.values[1]).toBe(2);
  });

  test("ネストした際に親と子で共通の値があるとき、全体で重複排除が行われる", ({ expect }) => {
    // Arrange
    const status = "active";
    const nestedSql = new Sql(["status = ", ""], [status]);
    const parentSql = new Sql(["", " AND category = ", ""], [nestedSql, status]);

    // Act & Assert
    expect(parentSql.text).toBe("status = $1 AND category = $1");
    expect(parentSql.values).toHaveLength(1);
    expect(parentSql.values[0]).toBe(status);
  });
});

describe("ユーティリティ関数の振る舞い", () => {
  test("join 関数を使用したとき、指定したセパレータでプレースホルダが連結される", ({ expect }) => {
    // Arrange
    const items = [1, 2, 3];

    // Act
    const sql = join(items, ",");

    // Assert
    expect(sql.text).toBe("$1,$2,$3");
    expect(sql.values).toHaveLength(3);
    expect(sql.values[0]).toBe(1);
    expect(sql.values[1]).toBe(2);
    expect(sql.values[2]).toBe(3);
  });

  test("join 関数にセパレータを指定しないとき、デフォルトのカンマが使用される", ({ expect }) => {
    // Act
    const sql = join([1, 2]);

    // Assert
    expect(sql.text).toBe("$1,$2");
  });

  test("join 関数に空配列を渡したとき、空の Sql インスタンスが返る", ({ expect }) => {
    // Act
    const sql = join([], ",");

    // Assert
    expect(sql.text).toBe("");
    expect(sql.values).toHaveLength(0);
  });

  test("raw 関数を使用したとき、プレースホルダ化されずに文字列がそのまま保持される", ({ expect }) => {
    // Act
    const sql = raw("SELECT * FROM table");

    // Assert
    expect(sql.text).toBe("SELECT * FROM table");
    expect(sql.values).toHaveLength(0);
  });
});

describe("異常系と検証の振る舞い", () => {
  test("文字列配列が空でインスタンス化したとき、TypeError を投げる", ({ expect }) => {
    // Act & Assert
    expect(() => new Sql([], [])).toThrow(TypeError);
    expect(() => new Sql([], [])).toThrow("Expected at least 1 string");
  });

  test("文字列とバインド変数の数が不適切なとき、不一致を指摘する TypeError を投げる", ({ expect }) => {
    // Arrange
    const rawStrings = ["A", "B"];
    const rawBindings = [1, 2]; // 2 strings should have 1 value

    // Act & Assert
    expect(() => new Sql(rawStrings, rawBindings)).toThrow(TypeError);
    expect(() => new Sql(rawStrings, rawBindings)).toThrow("Expected 2 strings to have 1 values");
  });
});

describe("特殊な型と内部状態の振る舞い", () => {
  test("null や undefined やオブジェクトをバインドしたとき、そのまま値が保持される", ({ expect }) => {
    // Arrange
    const complexValues = [null, undefined, { a: 1 }];
    const sql = new Sql(["", ", ", ", ", ""], complexValues);

    // Act & Assert
    expect(sql.values).toHaveLength(3);
    expect(sql.values[0]).toBe(null);
    expect(sql.values[1]).toBe(undefined);
    expect(sql.values[2]).toStrictEqual({ a: 1 });
  });

  test("text プロパティに連続してアクセスしたとき、2 回目以降はキャッシュされた値が返る", ({ expect }) => {
    // Arrange
    const sql = new Sql(["SELECT ", ""], [1]);

    // Act
    const firstAccess = sql.text;
    const secondAccess = sql.text;

    // Assert
    expect(firstAccess).toBe("SELECT $1");
    expect(secondAccess).toBe("SELECT $1");
    // 内部実装の詳細（キャッシュフラグ）はテストせず、振る舞いの一貫性のみを保証する。
  });
});
