// Merge scripts/pool-L1..7.json into src/core/puzzles.json (compact: counts as digit strings, solution as hex).
import { readFileSync, writeFileSync } from 'node:fs';
const toHex = (bits: string) => { let s = ''; const b = bits.padEnd(Math.ceil(bits.length / 4) * 4, '0'); for (let i = 0; i < b.length; i += 4) s += parseInt(b.slice(i, i + 4), 2).toString(16); return s; };
const pools = [1, 2, 3, 4, 5, 6, 7].map((k) => JSON.parse(readFileSync(`scripts/pool-L${k}.json`, 'utf8')) as any[]);
const out = pools.map((pool) => pool.map((p) => ({ n: p.n, r: p.rows.join(''), c: p.cols.join(''), g: p.givens, s: toHex(p.sol) })));
writeFileSync('src/core/puzzles.json', JSON.stringify(out));
const meta = pools.map((pool, k) => ({ level: k + 1, count: pool.length }));
console.log(meta, 'total', pools.reduce((a, p) => a + p.length, 0));
