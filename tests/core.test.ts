import { describe, test } from "vitest";

import { ident, join, literal, raw, Sql, Slot } from "../src/core.js";

describe("基本的なインスタンス化とプレースホルダー生成の振る舞い", () => {
  test("1 つのバインド変数を持つ SQL を生成したとき、プレースホルダー $1 と値が正しく設定される", ({
    expect,
  }) => {
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

  test("複数の異なるバインド変数を持つ SQL を生成したとき、インクリメントされたプレースホルダーが割り振られる", ({
    expect,
  }) => {
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

  test("10 個以上のバインド変数があるとき、2 桁のプレースホルダー ID が正しく採番される", ({
    expect,
  }) => {
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
  test("同一の値が複数回バインドされたとき、同じプレースホルダー ID が再利用され values が圧縮される", ({
    expect,
  }) => {
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
  test("Sql オブジェクトを別の Sql オブジェクトにネストしたとき、クエリとバインド変数が統合される", ({
    expect,
  }) => {
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

describe("Slot クラスの基本機能", () => {
  test("名前とデフォルト値を指定してインスタンス化したとき、プロパティーが正しく保持される", ({
    expect,
  }) => {
    // Arrange
    const name = "id";
    const defaultValue = 1;

    // Act
    const slot = new Slot(name, defaultValue);

    // Assert
    expect(slot.name).toBe("id");
    expect(slot.defaultValue).toBe(1);
  });

  test("デフォルト値を省略してインスタンス化したとき、defaultValue が null になる", ({
    expect,
  }) => {
    // Arrange
    const name = "id";

    // Act
    const slot = new Slot(name);

    // Assert
    expect(slot.defaultValue).toBe(null);
  });

  test("undefined のデフォルト値は undefined になる", ({ expect }) => {
    // Arrange
    const name = "id";
    const defaultValue = undefined;

    // Act
    const slot = new Slot(name, defaultValue);

    // Assert
    expect(slot.defaultValue).toBe(undefined);
  });
});

describe("Sql.fill メソッド (オブジェクト形式)", () => {
  test("オブジェクト形式で単一のスロットを指定したとき、該当する値が更新される", ({ expect }) => {
    // Arrange
    const slot = new Slot("id", 1);
    const sql = new Sql(["SELECT * FROM users WHERE id = ", ""], [slot]);

    // Act
    const filled = sql.fill({ id: 100 });

    // Assert
    expect(filled.toJSON()).toStrictEqual({
      text: "SELECT * FROM users WHERE id = $1",
      values: [100],
    });
  });

  test("オブジェクト形式で複数のスロットを同時に指定したとき、それぞれの値が適切に更新される", ({
    expect,
  }) => {
    // Arrange
    const p1 = new Slot("p1", "A");
    const p2 = new Slot("p2", "B");
    const sql = new Sql(["", " ", ""], [p1, p2]);

    // Act
    const filled = sql.fill({ p1: "X", p2: "Y" });

    // Assert
    expect(filled.toJSON()).toStrictEqual({
      text: "$1 $2",
      values: ["X", "Y"],
    });
  });

  test("存在しないスロット名を指定したとき、既存の値に変化はなくエラーも発生しない", ({
    expect,
  }) => {
    // Arrange
    const slot = new Slot("id", 1);
    const sql = new Sql(["id = ", ""], [slot]);

    // Act
    // @ts-expect-error
    const filled = sql.fill({ unknown: 999 });

    // Assert
    expect(filled.toJSON()).toStrictEqual({
      text: "id = $1",
      values: [1],
    });
  });

  test("同じ名前のスロットが複数箇所にあるとき、全てのプレースホルダーが更新される", ({
    expect,
  }) => {
    // Arrange
    const s1 = new Slot("dup", 0);
    const s2 = new Slot("dup", 0);
    const sql = new Sql(["a = ", " OR b = ", ""], [s1, s2]);

    // Act
    const filled = sql.fill({ dup: 10 });

    // Assert
    expect(filled.toJSON()).toStrictEqual({
      text: "a = $1 OR b = $1",
      values: [10],
    });
  });
});

describe("Sql.fill メソッド (Iterable 形式)", () => {
  test("Map オブジェクトを用いて更新したとき、値が正しく反映される", ({ expect }) => {
    // Arrange
    const slot = new Slot("id", 1);
    const sql = new Sql(["id = ", ""], [slot]);
    const valuesMap = new Map<"id" | Slot<"id", number>, number>([["id", 200]]);

    // Act
    const filled = sql.fill(valuesMap);

    // Assert
    expect(filled.toJSON()).toStrictEqual({
      text: "id = $1",
      values: [200],
    });
  });

  test("Slot インスタンスをキーとして直接指定したとき、インスタンス一致によって値が更新される", ({
    expect,
  }) => {
    // Arrange
    const slot = new Slot<"id", number | string>("id", 1);
    const sql = new Sql(["id = ", ""], [slot]);
    const updates: [Slot<"id", number | string>, string][] = [[slot, "val"]];

    // Act
    const filled = sql.fill(updates);

    // Assert
    expect(filled.toJSON()).toStrictEqual({
      text: "id = $1",
      values: ["val"],
    });
  });

  test("配列内での重複キーが指定されたとき、後の値が優先される", ({ expect }) => {
    // Arrange
    const slot = new Slot("id", 0);
    const sql = new Sql(["id = ", ""], [slot]);
    const updates: ["id", number][] = [
      ["id", 1],
      ["id", 2],
    ];

    // Act
    const filled = sql.fill(updates);

    // Assert
    expect(filled.toJSON()).toStrictEqual({
      text: "id = $1",
      values: [2],
    });
  });
});

describe("Sql.fillAll メソッド", () => {
  test("一部のスロットが不足しているとき、欠落しているスロット名を含むエラーを投げる", ({
    expect,
  }) => {
    // Arrange
    const idSlot = new Slot<"id", string>("id", "1");
    const nameSlot = new Slot<"name", string>("name", "?");
    const sql = new Sql(["SELECT * FROM user WHERE id = ", " AND name = ", ""], [idSlot, nameSlot]);
    const slots: any = { id: "1" };

    // Act & Assert
    expect(() => sql.fillAll(slots)).toThrow("Not all slots are filled. Missing: name");
  });
});

describe("raw ユーティリティー関数の振る舞い", () => {
  test("プレースホルダー化されずに文字列がそのまま保持される", ({ expect }) => {
    // Act
    const sql = raw("SELECT * FROM table");

    // Assert
    expect(sql.text).toBe("SELECT * FROM table");
    expect(sql.values).toHaveLength(0);
  });
});

describe("join ユーティリティー関数の振る舞い", () => {
  test("指定したセパレータでプレースホルダーが連結される", ({ expect }) => {
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

  test("セパレータを指定しないとき、デフォルトのカンマが使用される", ({ expect }) => {
    // Act
    const sql = join([1, 2]);

    // Assert
    expect(sql.text).toBe("$1,$2");
  });

  test("空配列を渡したとき、空の Sql インスタンスが返る", ({ expect }) => {
    // Act
    const sql = join([], ",");

    // Assert
    expect(sql.text).toBe("");
    expect(sql.values).toHaveLength(0);
  });

  test("values が圧縮された Sql を join できる", ({ expect }) => {
    // Arrange
    const rawStrings1 = ["INSERT INTO table (a, b) VALUES (", ", ", ")"];
    const rawBindings1 = [100, 100];
    const sql1 = new Sql(rawStrings1, rawBindings1);

    // Act
    const sql = join([sql1], "");

    // Assert
    expect(sql.text).toBe("INSERT INTO table (a, b) VALUES ($1, $1)");
  });
});

describe("ident ユーティリティー関数の振る舞い", () => {
  test("標準的な識別子を渡したとき、ダブルクォートで囲まれる", ({ expect }) => {
    // Arrange
    const input = "users";

    // Act
    const result = ident(input);

    // Assert
    expect(result).toBe('"users"');
  });

  test("ダブルクォートを含む識別子を渡したとき、内部のクォートが二重化され全体が囲まれる", ({
    expect,
  }) => {
    // Arrange
    const input = 'user"name';

    // Act
    const result = ident(input);

    // Assert
    expect(result).toBe('"user""name"');
  });

  test("空文字列を渡したとき、空のダブルクォート囲みになる", ({ expect }) => {
    // Arrange
    const input = "";

    // Act
    const result = ident(input);

    // Assert
    expect(result).toBe('""');
  });

  test("連続するダブルクォートを含む識別子を渡したとき、すべて正しくエスケープされる", ({
    expect,
  }) => {
    // Arrange
    const input = 'my""table';

    // Act
    const result = ident(input);

    // Assert
    expect(result).toBe('"my""""table"');
  });

  test("ダブルクォートのみを渡したとき、エスケープされて 4 つのダブルクォートになる", ({
    expect,
  }) => {
    // Arrange
    const input = '"';

    // Act
    const result = ident(input);

    // Assert
    expect(result).toBe('""""');
  });

  test("空白や記号を含む識別子を渡したとき、そのままダブルクォートで囲まれる", ({ expect }) => {
    // Arrange
    const input = "table space!";

    // Act
    const result = ident(input);

    // Assert
    expect(result).toBe('"table space!"');
  });

  test("日本語の識別子を渡したとき、マルチバイト文字が損なわれずに囲まれる", ({ expect }) => {
    // Arrange
    const input = "ユーザー";

    // Act
    const result = ident(input);

    // Assert
    expect(result).toBe('"ユーザー"');
  });
});

describe("literal ユーティリティー関数の振る舞い", () => {
  test("標準的なリテラルを渡したとき、シングルクォートで囲まれる", ({ expect }) => {
    // Arrange
    const input = "hello";

    // Act
    const result = literal(input);

    // Assert
    expect(result).toBe("'hello'");
  });

  test("シングルクォートを含むリテラルを渡したとき、内部のクォートが二重化され全体が囲まれる", ({
    expect,
  }) => {
    // Arrange
    const input = "It's me";

    // Act
    const result = literal(input);

    // Assert
    expect(result).toBe("'It''s me'");
  });

  test("空文字列を渡したとき、空のシングルクォート囲みになる", ({ expect }) => {
    // Arrange
    const input = "";

    // Act
    const result = literal(input);

    // Assert
    expect(result).toBe("''");
  });

  test("連続するシングルクォートを含むリテラルを渡したとき、すべて正しくエスケープされる", ({
    expect,
  }) => {
    // Arrange
    const input = "''";

    // Act
    const result = literal(input);

    // Assert
    expect(result).toBe("''''''");
  });

  test("シングルクォートのみを渡したとき、エスケープされて 4 つのシングルクォートになる", ({
    expect,
  }) => {
    // Arrange
    const input = "'";

    // Act
    const result = literal(input);

    // Assert
    expect(result).toBe("''''");
  });

  test("SQL インジェクションを意図した文字列を渡したとき、単なるリテラルとして安全に囲まれる", ({
    expect,
  }) => {
    // Arrange
    const input = "; DROP TABLE users; --";

    // Act
    const result = literal(input);

    // Assert
    expect(result).toBe("'; DROP TABLE users; --'");
  });

  test("日本語のリテラルを渡したとき、マルチバイト文字が損なわれずに囲まれる", ({ expect }) => {
    // Arrange
    const input = "ユーザー";

    // Act
    const result = literal(input);

    // Assert
    expect(result).toBe("'ユーザー'");
  });
});

describe("異常系と検証の振る舞い", () => {
  test("文字列配列が空でインスタンス化したとき、TypeError を投げる", ({ expect }) => {
    // Act & Assert
    expect(() => new Sql([], [])).toThrow(TypeError);
    expect(() => new Sql([], [])).toThrow("Expected at least 1 string");
  });

  test("文字列とバインド変数の数が不適切なとき、不一致を指摘する TypeError を投げる", ({
    expect,
  }) => {
    // Arrange
    const rawStrings = ["A", "B"];
    const rawBindings = [1, 2]; // 2 strings should have 1 value

    // Act & Assert
    expect(() => new Sql(rawStrings, rawBindings)).toThrow(TypeError);
    expect(() => new Sql(rawStrings, rawBindings)).toThrow("Expected 2 strings to have 1 values");
  });
});

describe("特殊な型と内部状態の振る舞い", () => {
  test("null や undefined やオブジェクトをバインドしたとき、そのまま値が保持される", ({
    expect,
  }) => {
    // Arrange
    const complexValues = [null, undefined, { a: 1 }];
    const sql = new Sql(["", ", ", ", ", ""], complexValues);

    // Act & Assert
    expect(sql.values).toHaveLength(3);
    expect(sql.values[0]).toBe(null);
    expect(sql.values[1]).toBe(undefined);
    expect(sql.values[2]).toStrictEqual({ a: 1 });
  });

  test("text プロパティーに連続してアクセスしたとき、2 回目以降はキャッシュされた値が返る", ({
    expect,
  }) => {
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
