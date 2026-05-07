export type Value = unknown;

// oxlint-disable-next-line typescript/no-redundant-type-constituents
export type RawValue = Value | Sql;

type PrivateState = {
  readonly s: readonly [string, ...string[]];

  readonly p: readonly number[];

  t?: string;
};

export class Sql {
  public get text(): string {
    if (this._.t === undefined) {
      const { s, p } = this._;

      let text = s[0];

      for (let i = 0; i < p.length; i++) {
        text += "$" + p[i] + s[i + 1];
      }

      this._.t = text;
    }

    return this._.t;
  }

  public readonly values: readonly Value[];

  private readonly _: PrivateState;

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

    const valueToId = new Map<Value, number>();

    for (let i = 0; i < rawBindings.length; i++) {
      const child = rawBindings[i];
      const rawString = rawStrings[i + 1]!;

      if (child instanceof Sql) {
        const childValues = child.values;
        const childStrings = child._.s;
        const childPlaceholderIds = child._.p;

        strings[strings.length - 1] += childStrings[0];

        for (let j = 0; j < childPlaceholderIds.length; j++) {
          const childPlaceholderId = childPlaceholderIds[j]!;
          const value = childValues[childPlaceholderId - 1]!;

          let placeholderId = valueToId.get(value);
          if (placeholderId === undefined) {
            bindings.push(value);
            placeholderId = bindings.length;
            valueToId.set(value, placeholderId);
          }

          strings.push(childStrings[j + 1]!);
          placeholderIds.push(placeholderId);
        }

        strings[strings.length - 1] += rawString;
      } else {
        let placeholderId = valueToId.get(child);
        if (placeholderId === undefined) {
          bindings.push(child);
          placeholderId = bindings.length;
          valueToId.set(child, placeholderId);
        }

        strings.push(rawString);
        placeholderIds.push(placeholderId);
      }
    }

    this.values = bindings;
    Object.defineProperty(this, "_", {
      value: (this._ = {
        s: strings,
        p: placeholderIds,
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
