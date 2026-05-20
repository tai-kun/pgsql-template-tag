import { describe, test, expectTypeOf } from "vitest";

import { sql } from "../src/sql.js";

describe("sql", () => {
  describe("正常系", () => {
    test("sql.Sql インスタンスを返す", ({ expect }) => {
      // Act
      const result = sql``;

      // Assert
      expect(result).toBeInstanceOf(sql.Sql);
    });

    test("引数なしで静的クエリーを作成したとき、プレースホルダーなしの SQL と空のバインド配列になる", ({
      expect,
    }) => {
      // Act
      const result = sql`SELECT * FROM users`;

      // Assert
      expect(result.text).toBe("SELECT * FROM users");
      expect(result.values).toStrictEqual([]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly []>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly []>();
    });

    test("単一パラメーターをバインドしたとき、1 つのプレースホルダーを含む SQL とその値を含む配列になる", ({
      expect,
    }) => {
      // Arrange
      const id = 1;

      // Act
      const result = sql`SELECT * FROM users WHERE id = ${id}`;

      // Assert
      expect(result.text).toBe("SELECT * FROM users WHERE id = $1");
      expect(result.values).toStrictEqual([1]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly [1]>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly 1[]>();
    });

    test("複数パラメーターをバインドしたとき、順序に従ったプレースホルダーを含む SQL とそれぞれの値を含む配列になる", ({
      expect,
    }) => {
      // Arrange
      const status = "active";
      const age = 20;

      // Act
      const result = sql`SELECT * FROM users WHERE status = ${status} AND age > ${age}`;

      // Assert
      expect(result.text).toBe("SELECT * FROM users WHERE status = $1 AND age > $2");
      expect(result.values).toStrictEqual(["active", 20]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly ["active", 20]>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly ("active" | 20)[]>();
    });

    test("同一のプリミティブ値を複数バインドしたとき、同一のプレースホルダーに集約されて値の重複が排除される", ({
      expect,
    }) => {
      // Arrange
      const value = "test";

      // Act
      const result = sql`SELECT * FROM users WHERE login = ${value} OR email = ${value}`;

      // Assert
      expect(result.text).toBe("SELECT * FROM users WHERE login = $1 OR email = $1");
      expect(result.values).toStrictEqual(["test"]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly ["test", "test"]>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly "test"[]>();
    });

    test("ネストされた Sql インスタンスを展開したとき、親の SQL に結合されてバインド値が結合される", ({
      expect,
    }) => {
      // Arrange
      const subQuery = sql`SELECT * FROM users WHERE id = ${10}`;

      // Act
      const result = sql`SELECT * FROM (${subQuery}) AS sub`;

      // Assert
      expect(result.text).toBe("SELECT * FROM (SELECT * FROM users WHERE id = $1) AS sub");
      expect(result.values).toStrictEqual([10]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly [sql.Sql<readonly [10]>]>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly 10[]>();
    });

    test("Slot インスタンスを含めて構築したとき、プレースホルダーが作成されてスロットのデフォルト値が格納される", ({
      expect,
    }) => {
      // Arrange
      const roleSlot = sql.slot("userRole", "admin");

      // Act
      const result = sql`SELECT * FROM users WHERE role = ${roleSlot}`;

      // Assert
      expect(result.text).toBe("SELECT * FROM users WHERE role = $1");
      expect(result.values).toStrictEqual(["admin"]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly [sql.Slot<"userRole", string>]>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly sql.Slot<"userRole", string>[]>();
    });

    test("同一の Slot インスタンスを複数配置したとき、同一のプレースホルダーに集約される", ({
      expect,
    }) => {
      // Arrange
      const slot = sql.slot("p", 1);

      // Act
      const result = sql`SELECT * FROM u WHERE a = ${slot} OR b = ${slot}`;

      // Assert
      expect(result.text).toBe("SELECT * FROM u WHERE a = $1 OR b = $1");
      expect(result.values).toStrictEqual([1]);
      expectTypeOf(result).toEqualTypeOf<
        sql.Sql<readonly [sql.Slot<"p", number>, sql.Slot<"p", number>]>
      >();
      expectTypeOf(result.values).toEqualTypeOf<readonly sql.Slot<"p", number>[]>();
    });

    test("重複排除されるバインディング値を含む別インスタンスをネストしたとき、親クエリーでも重複排除が適用されてプレースホルダーがマッピングされる", ({
      expect,
    }) => {
      // Arrange
      const sub = sql`status = ${"active"} AND v = ${10}`;

      // Act
      const main = sql`SELECT * FROM t WHERE ${sub} AND user_id = ${10}`;

      // Assert
      expect(main.text).toBe("SELECT * FROM t WHERE status = $1 AND v = $2 AND user_id = $2");
      expect(main.values).toStrictEqual(["active", 10]);
    });
  });

  describe("異常系", () => {
    test("strings の要素数が 0 のとき、TypeError が投げられる", ({ expect }) => {
      // Act & Assert
      expect(() => {
        sql([] as unknown as TemplateStringsArray);
      }).toThrow(new TypeError("Expected at least 1 string"));
    });

    test("strings と bindings の個数不整合でプレースホルダーが過剰なとき、TypeError が投げられる", ({
      expect,
    }) => {
      // Act & Assert
      expect(() => {
        sql(["SELECT * FROM users"] as unknown as TemplateStringsArray, 1 as sql.RawValue);
      }).toThrow(new TypeError("Expected 1 strings to have 0 values"));
    });

    test("strings と bindings の個数不整合で文字列断片が過剰なとき、TypeError が投げられる", ({
      expect,
    }) => {
      // Act & Assert: strings に対して bindings が不足している状態で sql 関数を直接呼び出す。
      expect(() => {
        sql(["A", "B", "C"] as unknown as TemplateStringsArray, 1 as sql.RawValue);
      }).toThrow(new TypeError("Expected 3 strings to have 2 values"));
    });
  });

  describe("境界値・特殊ケース", () => {
    test("空文字列のみのテンプレートのとき、空の SQL と空のバインド配列になる", ({ expect }) => {
      // Act
      const result = sql``;

      // Assert
      expect(result.text).toBe("");
      expect(result.values).toStrictEqual([]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly []>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly []>();
    });

    test("null および undefined をバインドしたとき、プレースホルダーを含む SQL とそのままの値を含む配列になる", ({
      expect,
    }) => {
      // Arrange
      const val1 = null;
      const val2 = undefined;

      // Act
      const result = sql`INSERT INTO t VALUES (${val1}, ${val2})`;

      // Assert
      expect(result.text).toBe("INSERT INTO t VALUES ($1, $2)");
      expect(result.values).toStrictEqual([null, undefined]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly [null, undefined]>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly (null | undefined)[]>();
    });

    test("オブジェクトおよび配列リテラルをバインドしたとき、プレースホルダーを含む SQL とオブジェクトがそのまま保持された配列になる", ({
      expect,
    }) => {
      // Arrange
      const obj = { id: 1 };
      const arr = [1, 2];

      // Act
      const result = sql`VALUES (${obj}, ${arr})`;

      // Assert
      expect(result.text).toBe("VALUES ($1, $2)");
      expect(result.values).toStrictEqual([{ id: 1 }, [1, 2]]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly [{ id: number }, number[]]>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly ({ id: number } | number[])[]>();
    });
  });

  describe("型推論", () => {
    test("ジェネレーター関数で sql.Sql インスタンスを yield するとユニオン型が推論される", () => {
      // Arrange
      const columnsSlot = sql.slot<"columns", sql.Sql>("columns", sql.empty);
      const statusSlot = sql.slot<"status", string>("status", "");
      const selectSql = sql`SELECT ${columnsSlot}`;
      const whereSql = sql`WHERE status = ${statusSlot}`;
      const generator = function* () {
        yield selectSql;
        yield whereSql;
      };

      // Act
      const result = Array.from(generator());

      // Assert
      expectTypeOf(result).toEqualTypeOf<
        (
          | sql.Sql<readonly [sql.Slot<"columns", sql.Sql>]>
          | sql.Sql<readonly [sql.Slot<"status", string>]>
        )[]
      >();
    });
  });
});

describe("sql.raw", () => {
  describe("正常系", () => {
    test("sql.Sql インスタンスを返す", ({ expect }) => {
      // Arrange
      const input = "S";

      // Act
      const result = sql.raw(input);

      // Assert
      expect(result).toBeInstanceOf(sql.Sql);
    });

    test("作成された Sql インスタンスの text プロパティーが入力値と一致する", ({ expect }) => {
      // Arrange
      const input = "SELECT * FROM users";

      // Act
      const result = sql.raw(input);

      // Assert
      expect(result.text).toBe(input);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly []>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly []>();
    });

    test("作成された Sql インスタンスの values プロパティーが空の配列になる", ({ expect }) => {
      // Arrange
      const input = "SELECT * FROM users";

      // Act
      const result = sql.raw(input);

      // Assert
      expect(result.values).toStrictEqual([]);
    });

    test("入力されたプレースホルダー文字列が解析や変換をされずに text プロパティーへそのまま保持される", ({
      expect,
    }) => {
      // Arrange
      const input = "WHERE id = $1";

      // Act
      const result = sql.raw(input);

      // Assert
      expect(result.text).toBe(input);
    });

    test("values プロパティーは依然として空の配列のままである", ({ expect }) => {
      // Arrange
      const input = "WHERE id = $1";

      // Act
      const result = sql.raw(input);

      // Assert
      expect(result.values).toStrictEqual([]);
    });
  });
});

describe("sql.slot", () => {
  describe("正常系", () => {
    test("sql.Slot インスタンスを返す", ({ expect }) => {
      // Act
      const result = sql.slot("userId", 123);

      // Assert
      expect(result).toBeInstanceOf(sql.Slot);
    });

    test("スロット名とデフォルト値を指定して呼び出したとき、指定した値を持つ sql.Slot インスタンスが返される", ({
      expect,
    }) => {
      // Act
      const result = sql.slot("userId", 123);

      // Assert
      expect(result.name).toBe("userId");
      expect(result.defaultValue).toBe(123);
      expectTypeOf(result.name).toEqualTypeOf<"userId">();
      expectTypeOf(result.defaultValue).toEqualTypeOf<number>();
    });

    test("引数を名前のみ指定して呼び出したとき、デフォルト値が null になる", ({ expect }) => {
      // Act
      const result = sql.slot("status");

      // Assert
      expect(result.name).toBe("status");
      expect(result.defaultValue).toBe(null);
      expectTypeOf(result.name).toEqualTypeOf<"status">();
      expectTypeOf(result.defaultValue).toEqualTypeOf<unknown>();
    });

    test("複雑なオブジェクトをデフォルト値に指定したとき、オブジェクトがそのまま保持される", ({
      expect,
    }) => {
      // Arrange
      const defaultValue = { active: true };

      // Act
      const result = sql.slot("config", defaultValue);

      // Assert
      expect(result.defaultValue).toStrictEqual({ active: true });
      expectTypeOf(result.defaultValue).toEqualTypeOf<{ active: boolean }>();
    });

    test("型引数 TValue に null を含めると nullable スロットにできる", () => {
      // Act
      const result = sql.slot<"status", string | null>("status");

      // Assert
      expectTypeOf(result.defaultValue).toEqualTypeOf<string | null>();
    });
  });

  describe("境界値・特殊ケース", () => {
    test("スロット名に空文字列を指定したとき、 name が空文字列の sql.Slot インスタンスが生成される", ({
      expect,
    }) => {
      // Act
      const result = sql.slot("");

      // Assert
      expect(result.name).toBe("");
    });

    test("デフォルト値に undefined を明示的に指定したとき、 defaultValue が undefined になる", ({
      expect,
    }) => {
      // Act
      const result = sql.slot("nullableValue", undefined);

      // Assert
      expect(result.name).toBe("nullableValue");
      expect(result.defaultValue).toBe(undefined);
    });
  });

  describe("Sql.prototype.fill", () => {
    test("プレーンオブジェクトによって単一スロットを置換したとき、プレースホルダーが置換されバインド値が格納される", ({
      expect,
    }) => {
      // Arrange
      const idSlot = sql.slot("id");
      const query = sql`SELECT * FROM users WHERE id = ${idSlot}`;

      // Act
      const result = query.fill({ id: 10 });

      // Assert
      expect(result.text).toBe("SELECT * FROM users WHERE id = $1");
      expect(result.values).toStrictEqual([10]);
      expectTypeOf<Parameters<typeof query.fill>>().toEqualTypeOf<
        [{ readonly id?: unknown } | Iterable<readonly ["id" | sql.Slot<"id", unknown>, unknown]>]
      >();
      expectTypeOf(result.values).toEqualTypeOf<readonly number[]>();
    });

    test("重複するスロット名を一括置換したとき、同一のバインド値が重複排除されてプレースホルダーのインデックスが集約される", ({
      expect,
    }) => {
      // Arrange
      const valSlot = sql.slot("val");
      const sameValSlot = sql.slot("val");
      const query = sql`SELECT * FROM items WHERE min < ${valSlot} AND max > ${sameValSlot}`;

      // Act
      const result = query.fill({ val: 50 });

      // Assert
      expect(result.text).toBe("SELECT * FROM items WHERE min < $1 AND max > $1");
      expect(result.values).toStrictEqual([50]);
      expectTypeOf<Parameters<typeof query.fill>>().toEqualTypeOf<
        [
          | { readonly val?: unknown }
          | Iterable<readonly ["val" | sql.Slot<"val", unknown>, unknown]>,
        ]
      >();
      expectTypeOf(result.values).toEqualTypeOf<readonly number[]>();
    });

    test("異なるバインド型をもつ重複するスロット名を一括置換したとき、バインド型は積集合をとる", ({
      expect,
    }) => {
      // Arrange
      const stringOrNumberValSlot = sql.slot<"val", string | number>("val");
      const stringOnlyValSlot = sql.slot<"val", string>("val");
      const query = sql`
      SELECT * FROM items WHERE min < ${stringOrNumberValSlot} AND max > ${stringOnlyValSlot}`;

      // Act
      const result = query.fill({ val: "50" });

      // Assert
      expect(result.text).toBe("\n      SELECT * FROM items WHERE min < $1 AND max > $1");
      expect(result.values).toStrictEqual(["50"]);
      expectTypeOf<Parameters<typeof query.fill>>().toEqualTypeOf<
        [
          // (string | number | null) & (string | null) -> (string | null)
          // ~~~~~~~~~~~~~~~~~~~~~~~~   ~~~~~~~~~~~~~~~
          // ^stringOrNumberValSlot     ^stringOnlyValSlot
          | { readonly val?: string | null }
          | Iterable<readonly ["val" | sql.Slot<"val", string | null>, string | null]>,
        ]
      >();
      expectTypeOf(result.values).toEqualTypeOf<readonly string[]>();
    });

    test("一部のスロットのみを置換したとき、指定しなかったスロットにはそれぞれのデフォルト値が適用される", ({
      expect,
    }) => {
      // Arrange
      const statusSlot = sql.slot("status", "active");
      const ageSlot = sql.slot("age");
      const query = sql`SELECT * FROM users WHERE status = ${statusSlot} AND age > ${ageSlot}`;

      // Act
      // ここでスロット名 "status" には何も指定しない
      const result = query.fill({ age: 20 });

      // Assert
      expect(result.text).toBe("SELECT * FROM users WHERE status = $1 AND age > $2");
      expect(result.values).toStrictEqual(["active", 20]);
      expectTypeOf<Parameters<typeof query.fill>>().toEqualTypeOf<
        [
          | { readonly status?: string; readonly age?: unknown }
          | Iterable<
              readonly [
                "status" | sql.Slot<"status", string> | "age" | sql.Slot<"age", unknown>,
                unknown,
              ]
            >,
        ]
      >();
      expectTypeOf(result.values).toEqualTypeOf<readonly (number | sql.Slot<"status", string>)[]>();
      // fill 後は、まだ埋められていないスロットのみを埋められる
      expectTypeOf<Parameters<typeof result.fill>>().toEqualTypeOf<
        [
          | { readonly status?: string }
          | Iterable<readonly ["status" | sql.Slot<"status", string>, string]>,
        ]
      >();
    });

    test("Iterable 形式である Map の引数で置換したとき、正しくプレースホルダーが置換されてバインド値が適用される", ({
      expect,
    }) => {
      // Arrange
      const nameSlot = sql.slot<string>("name");
      const query = sql`SELECT * FROM users WHERE name = ${nameSlot}`;
      const parameters = new Map<string | sql.Slot, string>([["name", "Alice"]]);

      // Act
      const result = query.fill(parameters);

      // Assert
      expect(result.text).toBe("SELECT * FROM users WHERE name = $1");
      expect(result.values).toStrictEqual(["Alice"]);
    });

    test("sql.Slot インスタンスを直接キーにして Map で置換したとき、スロット名に頼らず実体キーで正しく値が置換される", ({
      expect,
    }) => {
      // Arrange
      const idSlot = sql.slot<string>("id");
      const sameIdSlot = sql.slot<string>("id");
      const query = sql`SELECT * FROM users WHERE id = ${idSlot} AND same_id = ${sameIdSlot}`;
      const parameters = new Map<string | sql.Slot, any>([[idSlot, 99]]);

      // Act
      const result = query.fill(parameters);

      // Assert
      expect(result.text).toBe("SELECT * FROM users WHERE id = $1 AND same_id = $2");
      expect(result.values).toStrictEqual([99, null]);
    });

    test("静的値とスロットが混在するとき、静的バインド値を維持したままスロットが正しく置換される", ({
      expect,
    }) => {
      // Arrange
      const logType = "ERROR";
      const logCodeSlot = sql.slot("code", 0);
      const query = sql`SELECT * FROM logs WHERE type = ${logType} AND code = ${logCodeSlot}`;

      // Act
      const result = query.fill({ code: 500 });

      // Assert
      expect(result.text).toBe("SELECT * FROM logs WHERE type = $1 AND code = $2");
      expect(result.values).toStrictEqual(["ERROR", 500]);
      expectTypeOf<Parameters<typeof query.fill>>().toEqualTypeOf<
        [
          | { readonly code?: number }
          | Iterable<readonly ["code" | sql.Slot<"code", number>, number]>,
        ]
      >();
      expectTypeOf(result.values).toEqualTypeOf<readonly ("ERROR" | number)[]>();
    });

    test("スロット置換処理を行ったとき、呼び出し元のオリジナル sql.Sql インスタンスは一切変更されず不変である", ({
      expect,
    }) => {
      // Arrange
      const query = sql`SELECT * FROM users WHERE id = ${sql.slot("id")}`;

      // Act
      query.fill({ id: 10 });

      // Assert
      expect(query.text).toBe("SELECT * FROM users WHERE id = $1");
      const firstValue = query.values[0]!;
      expect(firstValue).toBe(null);
    });
  });

  describe("Sql.prototype.fillAll", () => {
    test("すべてのスロットを過不足なく置換したとき、fillAll は例外を投げす正常に全置換を完了する", ({
      expect,
    }) => {
      // Arrange
      const nameSlot = sql.slot("name");
      const roleSlot = sql.slot("role");
      const query = sql`SELECT * FROM users WHERE name = ${nameSlot} AND role = ${roleSlot}`;

      // Act
      const result = query.fillAll({ name: "Bob", role: "admin" });

      // Assert
      expect(result.text).toBe("SELECT * FROM users WHERE name = $1 AND role = $2");
      expect(result.values).toStrictEqual(["Bob", "admin"]);
      expectTypeOf<Parameters<typeof query.fillAll>>().toEqualTypeOf<
        [{ readonly name: unknown; readonly role: unknown }]
      >();
      expectTypeOf(result.values).toEqualTypeOf<readonly string[]>();
      expectTypeOf<Parameters<typeof result.fillAll>>().toEqualTypeOf<[{}]>();
    });

    test("スロットが最初から存在しないクエリーに対して fillAll を適用したとき、エラーにならず正常終了する", ({
      expect,
    }) => {
      // Arrange
      const query = sql`SELECT * FROM users WHERE id = ${1}`;

      // Act
      const result = query.fillAll({});

      // Assert
      expect(result.text).toBe("SELECT * FROM users WHERE id = $1");
      expect(result.values).toStrictEqual([1]);
      expectTypeOf<Parameters<typeof query.fillAll>>().toEqualTypeOf<[{}]>();
    });

    test("必須スロットが不足しているとき、fillAll は欠損しているスロット名を明示して例外を投げる", ({
      expect,
    }) => {
      // Arrange
      const nameSlot = sql.slot("name");
      const emailSlot = sql.slot("email");
      const query = sql`SELECT * FROM users WHERE name = ${nameSlot} AND email = ${emailSlot}`;

      // Act & Assert
      expect(() => {
        // @ts-expect-error
        query.fillAll({ name: "Bob" });
      }).toThrow(new Error("Not all slots are filled. Missing: email"));
    });

    test("複数のスロットが未解決のとき、fillAll は未解決スロットをすべてカンマ区切りでエラーメッセージに含める", ({
      expect,
    }) => {
      // Arrange
      const query = sql`SELECT * FROM users WHERE a = ${sql.slot("a")} AND b = ${sql.slot("b")}`;

      // Act & Assert
      expect(() => {
        // @ts-expect-error
        query.fillAll({});
      }).toThrow(new Error("Not all slots are filled. Missing: a, b"));
    });
  });
});

describe("sql.join", () => {
  describe("正常系", () => {
    test("sql.Sql インスタンスを返す", ({ expect }) => {
      // Arrange
      const values = [1] as const;

      // Act
      const result = sql.join(values);

      // Assert
      expect(result).toBeInstanceOf(sql.Sql);
    });

    test("空の配列を結合したとき、 sql.empty と厳密等価なインスタンスになる", ({ expect }) => {
      // Arrange
      const values = [] as const;

      // Act
      const result = sql.join(values);

      // Assert
      expect(result).toBe(sql.empty);
    });

    test("明示的にセパレーターを指定して空の配列を結合したとき、 sql.empty と厳密等価なインスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [] as const;
      const separator = " AND ";

      // Act
      const result = sql.join(values, separator);

      // Assert
      expect(result).toBe(sql.empty);
    });

    test("単一のプリミティブ値を結合したとき、セパレーターが挿入されず 1 つのプレースホルダーを持つ sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [1] as const;

      // Act
      const result = sql.join(values);

      // Assert
      expect(result.text).toBe("$1");
      expect(result.values).toStrictEqual([1]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly [1]>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly 1[]>();
    });

    test("複数のプリミティブ値をデフォルトのセパレーターで結合したとき、カンマで連結され順にインクリメントされたプレースホルダーを持つ sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [1, "foo", true] as const;

      // Act
      const result = sql.join(values);

      // Assert
      expect(result.text).toBe("$1,$2,$3");
      expect(result.values).toStrictEqual([1, "foo", true]);
      expectTypeOf(result).toEqualTypeOf<sql.Sql<readonly [1, "foo", true]>>();
      expectTypeOf(result.values).toEqualTypeOf<readonly (1 | "foo" | true)[]>();
    });

    test("複数のプリミティブ値を明示的なセパレーターで結合したとき、指定したセパレーターが要素間に挿入された sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [1, 2, 3] as const;
      const separator = " + ";

      // Act
      const result = sql.join(values, separator);

      // Assert
      expect(result.text).toBe("$1 + $2 + $3");
      expect(result.values).toStrictEqual([1, 2, 3]);
    });

    test("重複するプリミティブ値を結合したとき、同一の値に対して同じプレースホルダー ID が再利用された sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = ["a", "b", "a"] as const;

      // Act
      const result = sql.join(values);

      // 検証する.
      expect(result.text).toBe("$1,$2,$1");
      expect(result.values).toStrictEqual(["a", "b"]);
    });

    test("sql.Sql インスタンスを結合したとき、各クエリーーがフラット化されプレースホルダーと値が結合された sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [sql`id = ${1}`, sql`status = ${"active"}`] as const;
      const separator = " AND ";

      // Act
      const result = sql.join(values, separator);

      // Assert
      expect(result.text).toBe("id = $1 AND status = $2");
      expect(result.values).toStrictEqual([1, "active"]);
      expectTypeOf(result).toEqualTypeOf<
        sql.Sql<readonly [sql.Sql<readonly [1]>, sql.Sql<readonly ["active"]>]>
      >();
      expectTypeOf(result.values).toEqualTypeOf<readonly (1 | "active")[]>();
    });

    test("重複値を含む sql.Sql インスタンスを結合したとき、バインディング値が一意に集約された sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [sql`x = ${1}`, sql`y = ${1}`] as const;
      const separator = ", ";

      // Act
      const result = sql.join(values, separator);

      // Assert
      expect(result.text).toBe("x = $1, y = $1");
      expect(result.values).toStrictEqual([1]);
      expectTypeOf(result).toEqualTypeOf<
        sql.Sql<readonly [sql.Sql<readonly [1]>, sql.Sql<readonly [1]>]>
      >();
      expectTypeOf(result.values).toEqualTypeOf<readonly 1[]>();
    });

    test("sql.Slot インスタンスを含む配列を結合したとき、デフォルト値が対応する位置に登録された sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [sql.slot("id", 10), sql.slot("id", 20)] as const;
      const separator = ", ";

      // Act
      const result = sql.join(values, separator);

      // Assert
      expect(result.text).toBe("$1, $2");
      expect(result.values).toStrictEqual([10, 20]);
    });

    test("オブジェクトや配列を結合したとき、プレースホルダー化されて values 配列に格納された sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [[1, 2], { foo: "bar" }] as const;
      const separator = ", ";

      // Act
      const result = sql.join(values, separator);

      // Assert
      expect(result.text).toBe("$1, $2");
      expect(result.values).toStrictEqual([[1, 2], { foo: "bar" }]);
    });
  });

  describe("境界値・特殊条件", () => {
    test("セパレーターに空文字を指定したとき、要素がセパレーターなしで連結された sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [1, 2, 3] as const;
      const separator = "";

      // Act
      const result = sql.join(values, separator);

      // Assert
      expect(result.text).toBe("$1$2$3");
      expect(result.values).toStrictEqual([1, 2, 3]);
    });

    test("セパレーターに undefined を明示指定したとき、デフォルトのカンマとして処理された sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [1, 2] as const;
      const separator = undefined;

      // Act
      const result = sql.join(values, separator);

      // Assert
      expect(result.text).toBe("$1,$2");
      expect(result.values).toStrictEqual([1, 2]);
    });

    test("セパレーターに改行などの特殊文字を指定したとき、そのまま静的パーツとして結合された sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = ["a", "b"] as const;
      const separator = "\n  OR\n  ";

      // Act
      const result = sql.join(values, separator);

      // Assert
      expect(result.text).toBe("$1\n  OR\n  $2");
      expect(result.values).toStrictEqual(["a", "b"]);
    });

    test("null や undefined を結合したとき、値として正しく処理された sql.Sql インスタンスになる", ({
      expect,
    }) => {
      // Arrange
      const values = [null, undefined] as const;
      const separator = ", ";

      // Act
      const result = sql.join(values, separator);

      // Assert
      expect(result.text).toBe("$1, $2");
      expect(result.values).toStrictEqual([null, undefined]);
    });
  });
});

describe("sql.ident", () => {
  test("標準的な識別子を渡したとき、ダブルクォートで囲まれる", ({ expect }) => {
    // Arrange
    const input = "users";

    // Act
    const result = sql.ident(input);

    // Assert
    expect(result).toBe('"users"');
  });

  test("ダブルクォートを含む識別子を渡したとき、内部のクォートが二重化され全体が囲まれる", ({
    expect,
  }) => {
    // Arrange
    const input = 'user"name';

    // Act
    const result = sql.ident(input);

    // Assert
    expect(result).toBe('"user""name"');
  });

  test("空文字列を渡したとき、空のダブルクォート囲みになる", ({ expect }) => {
    // Arrange
    const input = "";

    // Act
    const result = sql.ident(input);

    // Assert
    expect(result).toBe('""');
  });

  test("連続するダブルクォートを含む識別子を渡したとき、すべて正しくエスケープされる", ({
    expect,
  }) => {
    // Arrange
    const input = 'my""table';

    // Act
    const result = sql.ident(input);

    // Assert
    expect(result).toBe('"my""""table"');
  });

  test("ダブルクォートのみを渡したとき、エスケープされて 4 つのダブルクォートになる", ({
    expect,
  }) => {
    // Arrange
    const input = '"';

    // Act
    const result = sql.ident(input);

    // Assert
    expect(result).toBe('""""');
  });

  test("空白や記号を含む識別子を渡したとき、そのままダブルクォートで囲まれる", ({ expect }) => {
    // Arrange
    const input = "table space!";

    // Act
    const result = sql.ident(input);

    // Assert
    expect(result).toBe('"table space!"');
  });

  test("日本語の識別子を渡したとき、マルチバイト文字が損なわれずに囲まれる", ({ expect }) => {
    // Arrange
    const input = "ユーザー";

    // Act
    const result = sql.ident(input);

    // Assert
    expect(result).toBe('"ユーザー"');
  });
});

describe("sql.literal", () => {
  test("標準的なリテラルを渡したとき、シングルクォートで囲まれる", ({ expect }) => {
    // Arrange
    const input = "hello";

    // Act
    const result = sql.literal(input);

    // Assert
    expect(result).toBe("'hello'");
  });

  test("シングルクォートを含むリテラルを渡したとき、内部のクォートが二重化され全体が囲まれる", ({
    expect,
  }) => {
    // Arrange
    const input = "It's me";

    // Act
    const result = sql.literal(input);

    // Assert
    expect(result).toBe("'It''s me'");
  });

  test("空文字列を渡したとき、空のシングルクォート囲みになる", ({ expect }) => {
    // Arrange
    const input = "";

    // Act
    const result = sql.literal(input);

    // Assert
    expect(result).toBe("''");
  });

  test("連続するシングルクォートを含むリテラルを渡したとき、すべて正しくエスケープされる", ({
    expect,
  }) => {
    // Arrange
    const input = "''";

    // Act
    const result = sql.literal(input);

    // Assert
    expect(result).toBe("''''''");
  });

  test("シングルクォートのみを渡したとき、エスケープされて 4 つのシングルクォートになる", ({
    expect,
  }) => {
    // Arrange
    const input = "'";

    // Act
    const result = sql.literal(input);

    // Assert
    expect(result).toBe("''''");
  });

  test("SQL インジェクションを意図した文字列を渡したとき、単なるリテラルとして安全に囲まれる", ({
    expect,
  }) => {
    // Arrange
    const input = "; DROP TABLE users; --";

    // Act
    const result = sql.literal(input);

    // Assert
    expect(result).toBe("'; DROP TABLE users; --'");
  });

  test("日本語のリテラルを渡したとき、マルチバイト文字が損なわれずに囲まれる", ({ expect }) => {
    // Arrange
    const input = "ユーザー";

    // Act
    const result = sql.literal(input);

    // Assert
    expect(result).toBe("'ユーザー'");
  });
});
