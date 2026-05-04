export type Value = unknown;

// oxlint-disable-next-line typescript/no-redundant-type-constituents
export type RawValue = Value | Sql;

export class Sql {
  public get text(): string {
    if (!this._.t.c) {
      let text = this._.s[0],
        placeholderIds = this._.t.v;
      if (placeholderIds.length > 0) {
        for (let i = 0, len = placeholderIds.length; i < len; i++) {
          text += "$" + placeholderIds[i] + this._.s[i + 1];
        }
      }

      this._.t = {
        c: true,
        v: text,
      };
    }

    return this._.t.v;
  }

  public readonly values: readonly Value[];

  private readonly _: {
    t:
      | {
          readonly c: false;
          readonly v: readonly number[];
        }
      | {
          readonly c: true;
          readonly v: string;
        };
    readonly s: readonly [string, ...string[]];
  };

  public constructor(rawStrings: readonly string[], rawBindings: readonly RawValue[]) {
    if (rawStrings.length === 0) {
      throw new TypeError("Expected at least 1 string");
    }

    if (rawStrings.length - 1 !== rawBindings.length) {
      throw new TypeError(
        `Expected ${rawStrings.length} strings to have ${rawStrings.length - 1} values`,
      );
    }

    const strings: [string, ...string[]] = [rawStrings[0]!];
    const bindings: Value[] = [];
    const placeholderIds: number[] = [];

    if (rawStrings.length > 0) {
      const valueToId = new Map<Value, number>();

      for (
        let i = 0,
          len = rawBindings.length,
          child: unknown,
          rawString: string,
          placeholderId: number | undefined;
        i < len;
        i++
      ) {
        child = rawBindings[i];
        rawString = rawStrings[i + 1]!;

        if (child instanceof Sql) {
          strings[strings.length - 1] += child._.s[0];

          for (let j = 0, value: unknown; j < child.values.length; j++) {
            value = child.values[j];
            placeholderId = valueToId.get(value);
            if (placeholderId === undefined) {
              bindings.push(value);
              placeholderId = bindings.length;
              valueToId.set(value, placeholderId);
            }

            strings.push(child._.s[j + 1]!);
            placeholderIds.push(placeholderId);
          }

          strings[strings.length - 1] += rawString;
        } else {
          placeholderId = valueToId.get(child);

          if (placeholderId === undefined) {
            bindings.push(child);
            placeholderId = bindings.length;
            valueToId.set(child, placeholderId);
          }

          strings.push(rawString);
          placeholderIds.push(placeholderId);
        }
      }
    }

    this.values = bindings;
    Object.defineProperty(this, "_", {
      value: (this._ = {
        t: {
          c: false,
          v: placeholderIds,
        },
        s: strings,
      }),
    });
  }

  public toJSON(): {
    text: string;
    values: Value[];
  } {
    return {
      text: this.text,
      values: this.values.slice(),
    };
  }

  public toString(): string {
    return this.text;
  }
}

export function raw(value: string): Sql {
  return new Sql([value], []);
}

export const empty: Sql = raw("");

export function join(values: readonly RawValue[], separator: string | undefined = ","): Sql {
  if (values.length === 0) {
    return empty;
  }

  return new Sql(["", ...Array(values.length - 1).fill(separator), ""], values);
}

const DOUBLE_QUOTE_REGEX = /"/g;

export function ident(value: string): string {
  return '"' + value.replace(DOUBLE_QUOTE_REGEX, '""') + '"';
}
