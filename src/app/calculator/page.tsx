'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

const RANKS = [
  { name: 'Bronze', perStep: 200 },
  { name: 'Silver', perStep: 225 },
  { name: 'Gold', perStep: 250 },
  { name: 'Sapphire', perStep: 275 },
  { name: 'Platinum', perStep: 300 },
  { name: 'Diamond', perStep: 325 },
  { name: 'Blue Diamond', perStep: 350 },
] as const;

type RankName = typeof RANKS[number]['name'];

type DepthPreload = {
  depth: number;
  nodeCount: number;
  left: number;
  right: number;
};

type ManualNode = {
  nodeId: number;
  oldLeft: number;
  oldRight: number;
  newLeft: number;
  newRight: number;
};

type Bucket = {
  count: bigint;
  oldLeft: bigint;
  oldRight: bigint;
  newLeft: bigint;
  newRight: bigint;
  childRanks: [RankName | null, RankName | null];
};

const rankValue = Object.fromEntries(RANKS.map((rank) => [rank.name, rank.perStep])) as Record<RankName, number>;
const rankOrder = RANKS.map((rank) => rank.name);

function bigPower2(exp: number) {
  return 1n << BigInt(exp);
}

function fmt(value: bigint | number) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function money(value: bigint | number, currency: string) {
  return `${currency}${fmt(value)}`;
}

function depthOf(nodeId: number) {
  return Math.floor(Math.log2(nodeId)) + 1;
}

function higherRank(current: RankName, candidate: RankName): RankName {
  return rankOrder.indexOf(candidate) > rankOrder.indexOf(current) ? candidate : current;
}

function qualifyRank(steps: bigint, childRanks: Array<RankName | null>): RankName {
  let rank: RankName = 'Bronze';
  if (childRanks.filter((child) => child === 'Bronze').length >= 2) rank = 'Silver';
  if (childRanks.filter((child) => child === 'Silver').length >= 2) rank = 'Gold';
  if (steps >= 10n) rank = higherRank(rank, 'Sapphire');
  if (steps >= 30n) rank = higherRank(rank, 'Platinum');
  if (steps >= 50n) rank = higherRank(rank, 'Diamond');
  if (steps >= 80n) rank = higherRank(rank, 'Blue Diamond');
  return rank;
}

function buildBuckets(
  nodeCount: bigint,
  baseOldLeft: number,
  baseOldRight: number,
  depthPreloads: DepthPreload[],
  manualNodes: ManualNode[],
  childRanks: [RankName | null, RankName | null],
): Bucket[] {
  const buckets: Bucket[] = [];
  let remaining = nodeCount;

  for (const manual of manualNodes) {
    if (remaining <= 0n) break;
    buckets.push({
      count: 1n,
      oldLeft: BigInt(baseOldLeft + manual.oldLeft),
      oldRight: BigInt(baseOldRight + manual.oldRight),
      newLeft: BigInt(manual.newLeft),
      newRight: BigInt(manual.newRight),
      childRanks,
    });
    remaining -= 1n;
  }

  for (const preload of depthPreloads) {
    if (remaining <= 0n) break;
    const selected = BigInt(Math.max(0, preload.nodeCount)) < remaining ? BigInt(Math.max(0, preload.nodeCount)) : remaining;
    if (selected <= 0n) continue;
    buckets.push({
      count: selected,
      oldLeft: BigInt(baseOldLeft + preload.left),
      oldRight: BigInt(baseOldRight + preload.right),
      newLeft: 0n,
      newRight: 0n,
      childRanks,
    });
    remaining -= selected;
  }

  if (remaining > 0n) {
    buckets.push({
      count: remaining,
      oldLeft: BigInt(baseOldLeft),
      oldRight: BigInt(baseOldRight),
      newLeft: 0n,
      newRight: 0n,
      childRanks,
    });
  }

  return buckets;
}

export default function CalculatorPage() {
  const [levels, setLevels] = useState(5);
  const [displayLevels, setDisplayLevels] = useState(5);
  const [currency, setCurrency] = useState('$');
  const [uvPrice, setUvPrice] = useState(500);
  const [leftReq, setLeftReq] = useState(3);
  const [rightReq, setRightReq] = useState(3);
  const [maxSteps, setMaxSteps] = useState(100);
  const [commissionCap, setCommissionCap] = useState(40);
  const [manufacturing, setManufacturing] = useState(30);
  const [expenses, setExpenses] = useState(10);
  const [targetProfit, setTargetProfit] = useState(20);
  const [preloadAllLeft, setPreloadAllLeft] = useState(0);
  const [preloadAllRight, setPreloadAllRight] = useState(0);
  const [depthPreloads, setDepthPreloads] = useState<DepthPreload[]>([
    { depth: 1, nodeCount: 0, left: 0, right: 0 },
    { depth: 2, nodeCount: 0, left: 0, right: 0 },
  ]);
  const [manualNodes, setManualNodes] = useState<ManualNode[]>([
    { nodeId: 1, oldLeft: 0, oldRight: 0, newLeft: 0, newRight: 0 },
    { nodeId: 2, oldLeft: 0, oldRight: 0, newLeft: 0, newRight: 0 },
  ]);

  const result = useMemo(() => {
    const totalNodes = bigPower2(levels) - 1n;
    const leftNodes = (totalNodes - 1n) / 2n;
    const rightNodes = leftNodes;
    const manualByDepth = new Map<number, ManualNode[]>();
    for (const manual of manualNodes) {
      if (manual.nodeId >= 1 && (manual.oldLeft || manual.oldRight || manual.newLeft || manual.newRight)) {
        const d = depthOf(manual.nodeId);
        if (d <= levels) manualByDepth.set(d, [...(manualByDepth.get(d) ?? []), manual]);
      }
    }

    let totalSteps = 0n;
    let payingNodes = 0n;
    let newUv = 0n;
    let preloadedLeft = 0n;
    let preloadedRight = 0n;
    let formulaCommission = 0n;
    let childRanks: [RankName | null, RankName | null] = [null, null];
    const depthRows = [];

    for (let depth = levels; depth >= 1; depth -= 1) {
      const nodeCount = bigPower2(depth - 1);
      const sideUv = depth < levels ? bigPower2(levels - depth) - 1n : 0n;
      const buckets = buildBuckets(
        nodeCount,
        preloadAllLeft,
        preloadAllRight,
        depthPreloads.filter((row) => row.depth === depth && row.nodeCount > 0),
        manualByDepth.get(depth) ?? [],
        childRanks,
      );

      const rankCounts = Object.fromEntries(RANKS.map((rank) => [rank.name, 0n])) as Record<RankName, bigint>;
      let depthSteps = 0n;
      let depthPaying = 0n;
      let depthCommission = 0n;
      let depthPreLeft = 0n;
      let depthPreRight = 0n;
      let maxDepthSteps = 0n;

      for (const bucket of buckets) {
        const leftUv = sideUv + bucket.oldLeft + bucket.newLeft;
        const rightUv = sideUv + bucket.oldRight + bucket.newRight;
        const rawSteps = leftUv / BigInt(leftReq) < rightUv / BigInt(rightReq) ? leftUv / BigInt(leftReq) : rightUv / BigInt(rightReq);
        const payableSteps = rawSteps < BigInt(maxSteps) ? rawSteps : BigInt(maxSteps);
        const rank = qualifyRank(payableSteps, bucket.childRanks);
        rankCounts[rank] += bucket.count;
        depthSteps += payableSteps * bucket.count;
        if (payableSteps > 0n) depthPaying += bucket.count;
        if (payableSteps > maxDepthSteps) maxDepthSteps = payableSteps;
        depthPreLeft += bucket.oldLeft * bucket.count;
        depthPreRight += bucket.oldRight * bucket.count;
        newUv += (bucket.newLeft + bucket.newRight) * bucket.count;
        depthCommission += payableSteps * BigInt(rankValue[rank]) * bucket.count;
      }

      totalSteps += depthSteps;
      payingNodes += depthPaying;
      preloadedLeft += depthPreLeft;
      preloadedRight += depthPreRight;
      formulaCommission += depthCommission;
      const dominantRank = RANKS.reduce((best, rank) => rankCounts[rank.name] > rankCounts[best.name] ? rank : best, RANKS[0]).name;
      childRanks = [dominantRank, dominantRank];

      depthRows.unshift({
        depth,
        nodes: nodeCount,
        sideUv,
        preloadedLeft: depthPreLeft,
        preloadedRight: depthPreRight,
        maxSteps: maxDepthSteps,
        payingNodes: depthPaying,
        totalSteps: depthSteps,
        commission: depthCommission,
      });
    }

    const grossInflow = (totalNodes + newUv) * BigInt(uvPrice);
    const maxPool = grossInflow * BigInt(commissionCap) / 100n;
    const actualPaid = formulaCommission < maxPool ? formulaCommission : maxPool;
    const manufacturingCost = grossInflow * BigInt(manufacturing) / 100n;
    const expenseCost = grossInflow * BigInt(expenses) / 100n;
    const target = grossInflow * BigInt(targetProfit) / 100n;
    const retained = grossInflow - manufacturingCost - expenseCost - actualPaid;
    const status = manufacturingCost + expenseCost + formulaCommission > grossInflow
      ? 'BURST'
      : formulaCommission > maxPool
        ? 'WARNING'
        : retained >= target
          ? 'SAFE'
          : 'WARNING';

    return {
      totalNodes,
      leftNodes,
      rightNodes,
      totalSteps,
      payingNodes,
      newUv,
      preloadedLeft,
      preloadedRight,
      formulaCommission,
      grossInflow,
      maxPool,
      actualPaid,
      excess: formulaCommission > actualPaid ? formulaCommission - actualPaid : 0n,
      manufacturingCost,
      expenseCost,
      target,
      retained,
      profitLoss: retained - target,
      status,
      depthRows,
    };
  }, [levels, uvPrice, leftReq, rightReq, maxSteps, commissionCap, manufacturing, expenses, targetProfit, preloadAllLeft, preloadAllRight, depthPreloads, manualNodes]);

  const sampleNodes = useMemo(() => {
    const capped = Math.min(displayLevels, 15);
    const count = Number(bigPower2(capped) - 1n);
    return Array.from({ length: count }, (_, index) => {
      const node = index + 1;
      const left = node * 2;
      const right = left + 1;
      return { node, depth: depthOf(node), parent: node > 1 ? Math.floor(node / 2) : '-', left: left <= count ? left : '-', right: right <= count ? right : '-' };
    });
  }, [displayLevels]);

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm text-orange-300 hover:text-orange-200">← Magic AI Portal</Link>
          <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">Client-ready simulator</span>
        </div>

        <section className="rounded-[2rem] border border-orange-500/25 bg-gradient-to-br from-orange-500/20 via-[#151515] to-emerald-500/10 p-8 shadow-2xl">
          <p className="mb-3 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-200">MAGIC Calculator</p>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">Binary inflow and payout stress test</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
            Old UV is treated as existing liability. New UV is counted as current inflow.
            Payout uses old plus new UV, with automatic rank-based step amount.
          </p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ['Status', result.status],
            ['Total nodes', fmt(result.totalNodes)],
            ['Payable steps', fmt(result.totalSteps)],
            ['Actual payout', money(result.actualPaid, currency)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[.04] p-5 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="mt-2 break-words text-2xl font-black text-white">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-white/10 bg-[#121212] p-5">
            <h2 className="text-lg font-bold">Inputs</h2>
            <Input label="Calculation tree levels" value={levels} setValue={setLevels} min={1} max={1000} />
            <Input label="Sample display levels" value={displayLevels} setValue={setDisplayLevels} min={1} max={15} />
            <Input label="UV price" value={uvPrice} setValue={setUvPrice} min={1} />
            <Input label="Left UV per step" value={leftReq} setValue={setLeftReq} min={1} />
            <Input label="Right UV per step" value={rightReq} setValue={setRightReq} min={1} />
            <Input label="Hard max steps per node/week" value={maxSteps} setValue={setMaxSteps} min={1} />
            <Input label="Commission cap %" value={commissionCap} setValue={setCommissionCap} min={0} max={100} />
            <Input label="Manufacturing %" value={manufacturing} setValue={setManufacturing} min={0} max={100} />
            <Input label="Expenses %" value={expenses} setValue={setExpenses} min={0} max={100} />
            <Input label="Target profit %" value={targetProfit} setValue={setTargetProfit} min={0} max={100} />
            <Input label="Preload left UV in every node" value={preloadAllLeft} setValue={setPreloadAllLeft} min={0} />
            <Input label="Preload right UV in every node" value={preloadAllRight} setValue={setPreloadAllRight} min={0} />
          </aside>

          <div className="space-y-6">
            <DataTable title="Money summary" rows={[
              ['Gross inflow', money(result.grossInflow, currency)],
              ['Formula commission', money(result.formulaCommission, currency)],
              ['Max commission pool', money(result.maxPool, currency)],
              ['Actual commission paid', money(result.actualPaid, currency)],
              ['Excess commission', money(result.excess, currency)],
              ['Manufacturing cost', money(result.manufacturingCost, currency)],
              ['Expenses', money(result.expenseCost, currency)],
              ['Target profit', money(result.target, currency)],
              ['Retained amount', money(result.retained, currency)],
              ['Profit/loss vs target', money(result.profitLoss, currency)],
            ]} />

            <EditableTable
              title="Preload by depth"
              rows={depthPreloads}
              setRows={setDepthPreloads}
              columns={[
                ['depth', 'Depth'],
                ['nodeCount', 'Node count'],
                ['left', 'Old left UV / node'],
                ['right', 'Old right UV / node'],
              ]}
              blank={{ depth: 1, nodeCount: 0, left: 0, right: 0 }}
            />

            <EditableTable
              title="Manual UV by exact node"
              rows={manualNodes}
              setRows={setManualNodes}
              columns={[
                ['nodeId', 'Node ID'],
                ['oldLeft', 'Old left UV'],
                ['oldRight', 'Old right UV'],
                ['newLeft', 'New left UV'],
                ['newRight', 'New right UV'],
              ]}
              blank={{ nodeId: 1, oldLeft: 0, oldRight: 0, newLeft: 0, newRight: 0 }}
            />

            <div className="rounded-2xl border border-white/10 bg-[#121212] p-5">
              <h2 className="mb-3 text-lg font-bold">Payout by tree depth</h2>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="sticky top-0 bg-[#191919] text-xs uppercase text-gray-400">
                    <tr>{['Depth', 'Nodes', 'Side UV', 'Max steps/node', 'Paying nodes', 'Total steps', 'Commission'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.depthRows.map((row) => (
                      <tr key={row.depth} className="border-t border-white/5">
                        <td className="px-3 py-2">{row.depth}</td>
                        <td className="px-3 py-2">{fmt(row.nodes)}</td>
                        <td className="px-3 py-2">{fmt(row.sideUv)}</td>
                        <td className="px-3 py-2">{fmt(row.maxSteps)}</td>
                        <td className="px-3 py-2">{fmt(row.payingNodes)}</td>
                        <td className="px-3 py-2">{fmt(row.totalSteps)}</td>
                        <td className="px-3 py-2">{money(row.commission, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#121212] p-5">
              <h2 className="mb-3 text-lg font-bold">Sample binary tree node IDs</h2>
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#191919] text-xs uppercase text-gray-400">
                    <tr>{['Node', 'Depth', 'Parent', 'Left child', 'Right child'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {sampleNodes.map((row) => (
                      <tr key={row.node} className="border-t border-white/5">
                        <td className="px-3 py-2">{row.node}</td>
                        <td className="px-3 py-2">{row.depth}</td>
                        <td className="px-3 py-2">{row.parent}</td>
                        <td className="px-3 py-2">{row.left}</td>
                        <td className="px-3 py-2">{row.right}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Input({ label, value, setValue, min = 0, max }: { label: string; value: number; setValue: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(e) => setValue(Number(e.target.value))}
        className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-2 text-white outline-none focus:border-orange-500" />
    </label>
  );
}

function DataTable({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#121212] p-5">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <table className="w-full text-left text-sm">
        <tbody>{rows.map(([label, value]) => (
          <tr key={label} className="border-t border-white/5 first:border-t-0">
            <td className="px-3 py-2 text-gray-400">{label}</td>
            <td className="px-3 py-2 font-semibold text-white">{value}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function EditableTable<T extends Record<string, number>>({
  title, rows, setRows, columns, blank,
}: {
  title: string;
  rows: T[];
  setRows: (rows: T[]) => void;
  columns: Array<[keyof T, string]>;
  blank: T;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#121212] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <button onClick={() => setRows([...rows, blank])} className="rounded-lg bg-orange-500 px-3 py-1 text-sm font-semibold text-white">Add row</button>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase text-gray-400">
            <tr>{columns.map(([, label]) => <th key={label} className="px-2 py-2">{label}</th>)}</tr>
          </thead>
          <tbody>{rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-white/5">
              {columns.map(([key]) => (
                <td key={String(key)} className="px-2 py-2">
                  <input type="number" value={row[key]} min={0} onChange={(event) => {
                    const next = rows.map((candidate, index) => index === rowIndex ? { ...candidate, [key]: Number(event.target.value) } : candidate);
                    setRows(next);
                  }} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-2 py-1.5 text-white outline-none focus:border-orange-500" />
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
