/**
 * シラバスのスクレイピング結果 (t.json) から授業マスタの SQL を生成する。
 *
 * 元データは「1行 = 1コマ」なので、週に複数コマある授業は同じシラバス no_id で
 * 複数行に分かれている (最大4コマ)。時間割以外の項目はグループ内で完全に一致するため、
 *   class     … no_id ごとに1行
 *   classSlot … コマごとに1行
 * に分けて出力する。
 *
 * 使い方 (apps/server で):
 *   pnpm exec tsx scripts/seed-classes.ts <t.json のパス>
 *   pnpm exec wrangler d1 execute hoseilink-d1 --local --file drizzle/seed/classes.sql
 *   # 本番へ入れるときは --local を --remote に変える
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type RawClass = {
  id: string;
  title: string;
  code: string;
  url: string;
  place: string;
  teacher: string;
  gakubu: string;
  nendo: number;
  timeInnerHTML: string;
  youbi: string;
  time: number;
  online: boolean;
};

const input = process.argv[2];
if (!input) {
  console.error("使い方: pnpm exec tsx scripts/seed-classes.ts <t.json のパス>");
  process.exit(1);
}

const OUTPUT = resolve("drizzle/seed/classes.sql");
/** D1 は1文につきパラメータ数の上限があるので、INSERT を小分けにする */
const CHUNK = 200;

const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const raw = JSON.parse(readFileSync(resolve(input), "utf8")) as RawClass[];

const classById = new Map<string, RawClass>();
/** classId + 曜日 + 時限 で一意。決定的な id にして再実行しても同じ行になるようにする */
const slots = new Map<string, { classId: string; youbi: string; time: number }>();

for (const row of raw) {
  if (!classById.has(row.id)) classById.set(row.id, row);

  const slotKey = `${row.id}-${row.youbi}-${row.time}`;
  if (!slots.has(slotKey)) {
    slots.set(slotKey, { classId: row.id, youbi: row.youbi, time: row.time });
  }
}

const statements: string[] = [
  "-- scripts/seed-classes.ts が生成。直接編集しないこと",
  "DELETE FROM classSlot;",
  "DELETE FROM class;",
];

const chunked = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

for (const chunk of chunked([...classById.values()], CHUNK)) {
  const values = chunk
    .map((row) =>
      [
        quote(row.id),
        quote(row.title),
        quote(row.code),
        quote(row.url),
        quote(row.place),
        quote(row.teacher),
        quote(row.gakubu),
        quote(row.timeInnerHTML),
        String(row.nendo),
        row.online ? 1 : 0,
      ].join(","),
    )
    .map((line) => `(${line})`)
    .join(",\n");

  statements.push(
    "INSERT INTO class " +
      "(id,title,code,url,place,teacher,gakubu,timeInnerHTML,nendo,online) VALUES\n" +
      values +
      ";",
  );
}

for (const chunk of chunked([...slots.entries()], CHUNK)) {
  const values = chunk
    .map(([key, slot]) => {
      // key から決定的に id を作るので、シードを流し直しても id が変わらない
      const id = createHash("sha1").update(key).digest("base64url").slice(0, 21);
      return `(${quote(id)},${quote(slot.classId)},${quote(slot.youbi)},${slot.time})`;
    })
    .join(",\n");

  statements.push(
    "INSERT INTO classSlot (id,classId,youbi,time) VALUES\n" + values + ";",
  );
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, statements.join("\n") + "\n", "utf8");

console.log(`元データ        : ${raw.length} 行`);
console.log(`class           : ${classById.size} 件`);
console.log(`classSlot       : ${slots.size} 件`);
console.log(`出力            : ${OUTPUT}`);
console.log("");
console.log("次のコマンドで投入する:");
console.log("  pnpm exec wrangler d1 execute hoseilink-d1 --local --file drizzle/seed/classes.sql");
