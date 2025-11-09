import type { Aggregate, FacesByColor, Pool, RNG, MonteCarloResults, CombatResults, Distribution, JointDistribution, FixedDiceConfig } from '../dice';
import { incJoint, normalizeDistribution, normalizeJoint } from '../utils/distribution';

export type RollFn = (pool: Pool, facesByColor: FacesByColor, rng: RNG) => Aggregate;

export interface AnalysisRunOptions {
  pool: Pool;
  facesByColor: FacesByColor;
  simulationCount: number;
  rng?: RNG;
  roll: RollFn;
  transformAggregate?: (agg: Aggregate) => Aggregate;
  fixedDice?: FixedDiceConfig; // NEW: Fixed dice configuration
}

export async function runAnalysis(options: AnalysisRunOptions): Promise<MonteCarloResults> {
  const { pool, facesByColor, simulationCount, roll, rng = Math.random, transformAggregate } = options;
  const results: MonteCarloResults = {
    hits: {}, blocks: {}, specials: {}, hollowHits: {}, hollowBlocks: {}, hollowSpecials: {},
    totalHits: {}, totalBlocks: {}, totalSpecials: {},
    jointHitsSpecialsFilled: {}, jointBlocksSpecialsFilled: {}, jointHitsSpecialsHollow: {}, jointBlocksSpecialsHollow: {}, jointHitsSpecialsTotal: {}, jointBlocksSpecialsTotal: {},
    expected: { hits: 0, blocks: 0, specials: 0, hollowHits: 0, hollowBlocks: 0, hollowSpecials: 0 },
    std: { hits: 0, blocks: 0, specials: 0 },
    timestamp: new Date().toLocaleTimeString()
  };

  let sumSqHits = 0, sumSqBlocks = 0, sumSqSpecials = 0;
  for (let i = 0; i < simulationCount; i++) {
    const pre = roll(pool, facesByColor, rng);
    const agg = transformAggregate ? transformAggregate(pre) : pre;

    results.hits[agg.hits] = (results.hits[agg.hits] || 0) + 1;
    results.blocks[agg.blocks] = (results.blocks[agg.blocks] || 0) + 1;
    results.specials[agg.specials] = (results.specials[agg.specials] || 0) + 1;
    results.hollowHits[agg.hollowHits] = (results.hollowHits[agg.hollowHits] || 0) + 1;
    results.hollowBlocks[agg.hollowBlocks] = (results.hollowBlocks[agg.hollowBlocks] || 0) + 1;
    results.hollowSpecials[agg.hollowSpecials] = (results.hollowSpecials[agg.hollowSpecials] || 0) + 1;

    const totalHits = (agg.hits || 0) + (agg.hollowHits || 0);
    const totalBlocks = (agg.blocks || 0) + (agg.hollowBlocks || 0);
    const totalSpecials = (agg.specials || 0) + (agg.hollowSpecials || 0);
    results.totalHits[totalHits] = (results.totalHits[totalHits] || 0) + 1;
    results.totalBlocks[totalBlocks] = (results.totalBlocks[totalBlocks] || 0) + 1;
    results.totalSpecials[totalSpecials] = (results.totalSpecials[totalSpecials] || 0) + 1;

    incJoint(results.jointHitsSpecialsFilled, agg.hits, agg.specials);
    incJoint(results.jointBlocksSpecialsFilled, agg.blocks, agg.specials);
    incJoint(results.jointHitsSpecialsHollow, agg.hollowHits, agg.hollowSpecials);
    incJoint(results.jointBlocksSpecialsHollow, agg.hollowBlocks, agg.hollowSpecials);
    incJoint(results.jointHitsSpecialsTotal, totalHits, totalSpecials);
    incJoint(results.jointBlocksSpecialsTotal, totalBlocks, totalSpecials);

    results.expected.hits += agg.hits || 0;
    results.expected.blocks += agg.blocks || 0;
    results.expected.specials += agg.specials || 0;
    results.expected.hollowHits += agg.hollowHits || 0;
    results.expected.hollowBlocks += agg.hollowBlocks || 0;
    results.expected.hollowSpecials += agg.hollowSpecials || 0;

    sumSqHits += (agg.hits || 0) * (agg.hits || 0);
    sumSqBlocks += (agg.blocks || 0) * (agg.blocks || 0);
    sumSqSpecials += (agg.specials || 0) * (agg.specials || 0);
  }

  normalizeDistribution(results.hits, simulationCount);
  normalizeDistribution(results.blocks, simulationCount);
  normalizeDistribution(results.specials, simulationCount);
  normalizeDistribution(results.hollowHits, simulationCount);
  normalizeDistribution(results.hollowBlocks, simulationCount);
  normalizeDistribution(results.hollowSpecials, simulationCount);
  normalizeDistribution(results.totalHits, simulationCount);
  normalizeDistribution(results.totalBlocks, simulationCount);
  normalizeDistribution(results.totalSpecials, simulationCount);
  normalizeJoint(results.jointHitsSpecialsFilled, simulationCount);
  normalizeJoint(results.jointBlocksSpecialsFilled, simulationCount);
  normalizeJoint(results.jointHitsSpecialsHollow, simulationCount);
  normalizeJoint(results.jointBlocksSpecialsHollow, simulationCount);
  normalizeJoint(results.jointHitsSpecialsTotal, simulationCount);
  normalizeJoint(results.jointBlocksSpecialsTotal, simulationCount);

  results.expected.hits /= simulationCount;
  results.expected.blocks /= simulationCount;
  results.expected.specials /= simulationCount;
  results.expected.hollowHits /= simulationCount;
  results.expected.hollowBlocks /= simulationCount;
  results.expected.hollowSpecials /= simulationCount;

  const meanH = results.expected.hits;
  const meanB = results.expected.blocks;
  const meanS = results.expected.specials;
  const varH = Math.max(0, (sumSqHits / simulationCount) - (meanH * meanH));
  const varB = Math.max(0, (sumSqBlocks / simulationCount) - (meanB * meanB));
  const varS = Math.max(0, (sumSqSpecials / simulationCount) - (meanS * meanS));
  results.std.hits = Math.sqrt(varH);
  results.std.blocks = Math.sqrt(varB);
  results.std.specials = Math.sqrt(varS);

  return results;
}

export interface CombatTransforms {
  attacker?: { transformAggregate?: (agg: Aggregate) => Aggregate; applyCombat?: (self: Aggregate, opp: Aggregate) => void };
  defender?: { transformAggregate?: (agg: Aggregate) => Aggregate; applyCombat?: (self: Aggregate, opp: Aggregate) => void };
}

export interface CombatRunOptions {
  attackerPool: Pool;
  defenderPool: Pool;
  facesByColor: FacesByColor;
  simulationCount: number;
  rng?: RNG;
  roll: RollFn;
  transforms?: CombatTransforms;
  attackerFixedDice?: FixedDiceConfig; // NEW: Fixed dice for attacker
  defenderFixedDice?: FixedDiceConfig; // NEW: Fixed dice for defender
}

export async function runCombat(options: CombatRunOptions): Promise<CombatResults> {
  const { attackerPool, defenderPool, facesByColor, simulationCount, roll, rng = Math.random, transforms, attackerFixedDice, defenderFixedDice } = options;
  const results: CombatResults = {
    woundsAttacker: {}, woundsDefender: {}, attackerSpecialsDist: {}, defenderSpecialsDist: {},
    expected: { attackerHits: 0, attackerSpecials: 0, attackerBlocks: 0, defenderHits: 0, defenderSpecials: 0, defenderBlocks: 0, woundsAttacker: 0, woundsDefender: 0 },
    attackerWinRate: 0, attackerTieRate: 0, attackerLossRate: 0,
    timestamp: new Date().toLocaleTimeString()
  };

  let attackerWins = 0, attackerTies = 0, attackerLosses = 0;
  for (let i = 0; i < simulationCount; i++) {
    // Roll attacker dice (with fixed dice if specified)
    const preA = (attackerFixedDice && attackerFixedDice.length > 0)
      ? (() => {
          // Import simulateDiceRollWithFixed inline to avoid circular dependency
          const { simulateDiceRollWithFixed } = require('../dice');
          return simulateDiceRollWithFixed(attackerPool, attackerFixedDice, facesByColor, rng);
        })()
      : roll(attackerPool, facesByColor, rng);
    
    // Roll defender dice (with fixed dice if specified)
    const preD = (defenderFixedDice && defenderFixedDice.length > 0)
      ? (() => {
          const { simulateDiceRollWithFixed } = require('../dice');
          return simulateDiceRollWithFixed(defenderPool, defenderFixedDice, facesByColor, rng);
        })()
      : roll(defenderPool, facesByColor, rng);
    
    const attacker = transforms?.attacker?.transformAggregate ? transforms.attacker.transformAggregate(preA) : preA;
    const defender = transforms?.defender?.transformAggregate ? transforms.defender.transformAggregate(preD) : preD;

    if (transforms?.defender?.applyCombat) transforms.defender.applyCombat(defender, attacker);
    if (transforms?.attacker?.applyCombat) transforms.attacker.applyCombat(attacker, defender);

    const woundsA = Math.max(0, (attacker.hits || 0) - (defender.blocks || 0));
    const woundsD = Math.max(0, (defender.hits || 0) - (attacker.blocks || 0));

    results.woundsAttacker[woundsA] = (results.woundsAttacker[woundsA] || 0) + 1;
    results.woundsDefender[woundsD] = (results.woundsDefender[woundsD] || 0) + 1;
    results.attackerSpecialsDist[attacker.specials] = (results.attackerSpecialsDist[attacker.specials] || 0) + 1;
    results.defenderSpecialsDist[defender.specials] = (results.defenderSpecialsDist[defender.specials] || 0) + 1;

    if (woundsA > woundsD) attackerWins++; else if (woundsA === woundsD) attackerTies++; else attackerLosses++;

    results.expected.attackerHits += attacker.hits || 0;
    results.expected.attackerSpecials += attacker.specials || 0;
    results.expected.attackerBlocks += attacker.blocks || 0;
    results.expected.defenderHits += defender.hits || 0;
    results.expected.defenderBlocks += defender.blocks || 0;
    results.expected.defenderSpecials += defender.specials || 0;
    results.expected.woundsAttacker += woundsA;
    results.expected.woundsDefender += woundsD;
  }

  normalizeDistribution(results.woundsAttacker, simulationCount);
  normalizeDistribution(results.woundsDefender, simulationCount);
  normalizeDistribution(results.attackerSpecialsDist, simulationCount);
  normalizeDistribution(results.defenderSpecialsDist, simulationCount);

  results.expected.attackerHits /= simulationCount;
  results.expected.attackerSpecials /= simulationCount;
  results.expected.attackerBlocks /= simulationCount;
  results.expected.defenderHits /= simulationCount;
  results.expected.defenderBlocks /= simulationCount;
  results.expected.defenderSpecials /= simulationCount;
  results.expected.woundsAttacker /= simulationCount;
  results.expected.woundsDefender /= simulationCount;
  results.attackerWinRate = (attackerWins / simulationCount) * 100;
  results.attackerTieRate = (attackerTies / simulationCount) * 100;
  results.attackerLossRate = (attackerLosses / simulationCount) * 100;

  return results;
}


