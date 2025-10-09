// Dice logic module for Warcrow
// Single source of truth: faces are loaded from warcrow_dice_faces.json

export const DS = Object.freeze({
    HIT: 'HIT',
    HOLLOW_HIT: 'HOLLOW_HIT',
    BLOCK: 'BLOCK',
    HOLLOW_BLOCK: 'HOLLOW_BLOCK',
    SPECIAL: 'SPECIAL',
    HOLLOW_SPECIAL: 'HOLLOW_SPECIAL'
});

// Optional helpers to work with a pipeline without creating a hard dependency cycle
function applyPipelineToAggregate(aggregate, pipeline) {
    if (!pipeline || typeof pipeline.applyPost !== 'function') return aggregate;
    const state = { dice: [], rollDetails: [], aggregate: { ...aggregate } };
    pipeline.applyPost(state);
    return state.aggregate;
}

export async function loadDiceFaces() {
    const response = await fetch('warcrow_dice_faces.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load warcrow_dice_faces.json');
    const faces = await response.json();
    // Basic validation
    for (const color of Object.keys(faces)) {
        if (!Array.isArray(faces[color]) || faces[color].length !== 8) {
            throw new Error(`Die ${color} must have exactly 8 faces`);
        }
    }
    return faces;
}

export function isAttackColor(color) {
    return color === 'RED' || color === 'ORANGE' || color === 'YELLOW';
}

export function countSymbolsFromFace(face, isElite) {
    const result = {
        hits: 0,
        blocks: 0,
        specials: 0,
        hollowHits: 0,
        hollowBlocks: 0,
        hollowSpecials: 0
    };

    for (const symbol of face) {
        switch (symbol) {
            case DS.HIT:
                result.hits += 1;
                break;
            case DS.BLOCK:
                result.blocks += 1;
                break;
            case DS.SPECIAL:
                result.specials += 1;
                break;
            case DS.HOLLOW_HIT:
                // Always count hollows separately; elite should be handled by post-processing pipeline
                result.hollowHits += 1;
                break;
            case DS.HOLLOW_BLOCK:
                result.hollowBlocks += 1;
                break;
            case DS.HOLLOW_SPECIAL:
                result.hollowSpecials += 1;
                break;
        }
    }

    return result;
}

export function simulateDiceRoll(pool, facesByColor, isElite, rng = Math.random) {
    const aggregate = {
        hits: 0,
        blocks: 0,
        specials: 0,
        hollowHits: 0,
        hollowBlocks: 0,
        hollowSpecials: 0
    };

    for (const [color, count] of Object.entries(pool)) {
        const colorKey = normalizeColor(color);
        if (!facesByColor[colorKey]) continue;
        for (let i = 0; i < count; i++) {
            const faceIndex = Math.floor(rng() * 8);
            const face = facesByColor[colorKey][faceIndex];
            const rolled = countSymbolsFromFace(face, false);
            aggregate.hits += rolled.hits;
            aggregate.blocks += rolled.blocks;
            aggregate.specials += rolled.specials;
            aggregate.hollowHits += rolled.hollowHits;
            aggregate.hollowBlocks += rolled.hollowBlocks;
            aggregate.hollowSpecials += rolled.hollowSpecials;
        }
    }

    return aggregate;
}

export async function performMonteCarloSimulation(pool, facesByColor, simulationCount, isElite, rng = Math.random) {
    const results = {
        hits: {},
        blocks: {},
        specials: {},
        hollowHits: {},
        hollowBlocks: {},
        hollowSpecials: {},
        // Standard deviation (filled symbols) for quick summary display
        std: {
            hits: 0,
            blocks: 0,
            specials: 0
        },
        // Combined distributions where hollow counts as filled (for display of hollow+filled)
        totalHits: {},
        totalBlocks: {},
        totalSpecials: {},
        // Bivariate (joint) distributions
        jointHitsSpecialsFilled: {},   // x: hits (filled), y: specials (filled)
        jointBlocksSpecialsFilled: {}, // x: blocks (filled), y: specials (filled)
        jointHitsSpecialsHollow: {},   // x: hollowHits, y: hollowSpecials
        jointBlocksSpecialsHollow: {}, // x: hollowBlocks, y: hollowSpecials
        jointHitsSpecialsTotal: {},    // x: totalHits (filled+hollow), y: totalSpecials (filled+hollow)
        jointBlocksSpecialsTotal: {},  // x: totalBlocks (filled+hollow), y: totalSpecials (filled+hollow)
        expected: {
            hits: 0,
            blocks: 0,
            specials: 0,
            hollowHits: 0,
            hollowBlocks: 0,
            hollowSpecials: 0
        },
        timestamp: new Date().toLocaleTimeString()
    };


    const incJoint = (map, x, y) => {
        if (!map[x]) map[x] = {};
        map[x][y] = (map[x][y] || 0) + 1;
    };

    // Accumulators for variance (filled symbols only)
    let sumSqHits = 0, sumSqBlocks = 0, sumSqSpecials = 0;

    for (let i = 0; i < simulationCount; i++) {
        const roll = simulateDiceRoll(pool, facesByColor, isElite, rng);
        results.hits[roll.hits] = (results.hits[roll.hits] || 0) + 1;
        results.blocks[roll.blocks] = (results.blocks[roll.blocks] || 0) + 1;
        results.specials[roll.specials] = (results.specials[roll.specials] || 0) + 1;
        results.hollowHits[roll.hollowHits] = (results.hollowHits[roll.hollowHits] || 0) + 1;
        results.hollowBlocks[roll.hollowBlocks] = (results.hollowBlocks[roll.hollowBlocks] || 0) + 1;
        results.hollowSpecials[roll.hollowSpecials] = (results.hollowSpecials[roll.hollowSpecials] || 0) + 1;

        // Combined totals per roll
        const totalHits = roll.hits + roll.hollowHits;
        const totalBlocks = roll.blocks + roll.hollowBlocks;
        const totalSpecials = roll.specials + roll.hollowSpecials;
        results.totalHits[totalHits] = (results.totalHits[totalHits] || 0) + 1;
        results.totalBlocks[totalBlocks] = (results.totalBlocks[totalBlocks] || 0) + 1;
        results.totalSpecials[totalSpecials] = (results.totalSpecials[totalSpecials] || 0) + 1;

        // Joint distributions per roll
        incJoint(results.jointHitsSpecialsFilled, roll.hits, roll.specials);
        incJoint(results.jointBlocksSpecialsFilled, roll.blocks, roll.specials);
        incJoint(results.jointHitsSpecialsHollow, roll.hollowHits, roll.hollowSpecials);
        incJoint(results.jointBlocksSpecialsHollow, roll.hollowBlocks, roll.hollowSpecials);
        incJoint(results.jointHitsSpecialsTotal, totalHits, totalSpecials);
        incJoint(results.jointBlocksSpecialsTotal, totalBlocks, totalSpecials);

        results.expected.hits += roll.hits;
        results.expected.blocks += roll.blocks;
        results.expected.specials += roll.specials;
        results.expected.hollowHits += roll.hollowHits;
        results.expected.hollowBlocks += roll.hollowBlocks;
        results.expected.hollowSpecials += roll.hollowSpecials;

        // Sum of squares for variance (filled only)
        sumSqHits += roll.hits * roll.hits;
        sumSqBlocks += roll.blocks * roll.blocks;
        sumSqSpecials += roll.specials * roll.specials;
    }

    for (const key of Object.keys(results.hits)) {
        results.hits[key] = (results.hits[key] / simulationCount) * 100;
        results.blocks[key] = (results.blocks[key] / simulationCount) * 100;
        results.specials[key] = (results.specials[key] / simulationCount) * 100;
        results.hollowHits[key] = (results.hollowHits[key] / simulationCount) * 100;
        results.hollowBlocks[key] = (results.hollowBlocks[key] / simulationCount) * 100;
        results.hollowSpecials[key] = (results.hollowSpecials[key] / simulationCount) * 100;
    }

    // Normalize combined distributions
    for (const key of Object.keys(results.totalHits)) {
        results.totalHits[key] = (results.totalHits[key] / simulationCount) * 100;
        results.totalBlocks[key] = (results.totalBlocks[key] / simulationCount) * 100;
        results.totalSpecials[key] = (results.totalSpecials[key] / simulationCount) * 100;
    }

    // Normalize joint distributions to percentages
    const normalizeJoint = (map) => {
        for (const x of Object.keys(map)) {
            const row = map[x];
            for (const y of Object.keys(row)) {
                row[y] = (row[y] / simulationCount) * 100;
            }
        }
    };
    normalizeJoint(results.jointHitsSpecialsFilled);
    normalizeJoint(results.jointBlocksSpecialsFilled);
    normalizeJoint(results.jointHitsSpecialsHollow);
    normalizeJoint(results.jointBlocksSpecialsHollow);
    normalizeJoint(results.jointHitsSpecialsTotal);
    normalizeJoint(results.jointBlocksSpecialsTotal);

    results.expected.hits /= simulationCount;
    results.expected.blocks /= simulationCount;
    results.expected.specials /= simulationCount;
    results.expected.hollowHits /= simulationCount;
    results.expected.hollowBlocks /= simulationCount;
    results.expected.hollowSpecials /= simulationCount;

    // Compute standard deviations for filled symbols
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

// New: pipeline-based Monte Carlo (post-processing after each roll)
export async function performMonteCarloSimulationWithPipeline(pool, facesByColor, simulationCount, pipeline, rng = Math.random) {
    const results = {
        hits: {},
        blocks: {},
        specials: {},
        hollowHits: {},
        hollowBlocks: {},
        hollowSpecials: {},
        std: {
            hits: 0,
            blocks: 0,
            specials: 0
        },
        totalHits: {},
        totalBlocks: {},
        totalSpecials: {},
        jointHitsSpecialsFilled: {},
        jointBlocksSpecialsFilled: {},
        jointHitsSpecialsHollow: {},
        jointBlocksSpecialsHollow: {},
        jointHitsSpecialsTotal: {},
        jointBlocksSpecialsTotal: {},
        expected: {
            hits: 0,
            blocks: 0,
            specials: 0,
            hollowHits: 0,
            hollowBlocks: 0,
            hollowSpecials: 0
        },
        timestamp: new Date().toLocaleTimeString()
    };


    const incJoint = (map, x, y) => {
        if (!map[x]) map[x] = {};
        map[x][y] = (map[x][y] || 0) + 1;
    };

    let sumSqHits = 0, sumSqBlocks = 0, sumSqSpecials = 0;

    for (let i = 0; i < simulationCount; i++) {
        const pre = simulateDiceRoll(pool, facesByColor, false, rng);
        const roll = applyPipelineToAggregate(pre, pipeline);

        results.hits[roll.hits] = (results.hits[roll.hits] || 0) + 1;
        results.blocks[roll.blocks] = (results.blocks[roll.blocks] || 0) + 1;
        results.specials[roll.specials] = (results.specials[roll.specials] || 0) + 1;
        results.hollowHits[roll.hollowHits] = (results.hollowHits[roll.hollowHits] || 0) + 1;
        results.hollowBlocks[roll.hollowBlocks] = (results.hollowBlocks[roll.hollowBlocks] || 0) + 1;
        results.hollowSpecials[roll.hollowSpecials] = (results.hollowSpecials[roll.hollowSpecials] || 0) + 1;

        const totalHits = (roll.hits || 0) + (roll.hollowHits || 0);
        const totalBlocks = (roll.blocks || 0) + (roll.hollowBlocks || 0);
        const totalSpecials = (roll.specials || 0) + (roll.hollowSpecials || 0);
        results.totalHits[totalHits] = (results.totalHits[totalHits] || 0) + 1;
        results.totalBlocks[totalBlocks] = (results.totalBlocks[totalBlocks] || 0) + 1;
        results.totalSpecials[totalSpecials] = (results.totalSpecials[totalSpecials] || 0) + 1;

        incJoint(results.jointHitsSpecialsFilled, roll.hits, roll.specials);
        incJoint(results.jointBlocksSpecialsFilled, roll.blocks, roll.specials);
        incJoint(results.jointHitsSpecialsHollow, roll.hollowHits, roll.hollowSpecials);
        incJoint(results.jointBlocksSpecialsHollow, roll.hollowBlocks, roll.hollowSpecials);
        incJoint(results.jointHitsSpecialsTotal, totalHits, totalSpecials);
        incJoint(results.jointBlocksSpecialsTotal, totalBlocks, totalSpecials);

        results.expected.hits += roll.hits;
        results.expected.blocks += roll.blocks;
        results.expected.specials += roll.specials;
        results.expected.hollowHits += roll.hollowHits;
        results.expected.hollowBlocks += roll.hollowBlocks;
        results.expected.hollowSpecials += roll.hollowSpecials;

        sumSqHits += (roll.hits || 0) * (roll.hits || 0);
        sumSqBlocks += (roll.blocks || 0) * (roll.blocks || 0);
        sumSqSpecials += (roll.specials || 0) * (roll.specials || 0);
    }

    for (const key of Object.keys(results.hits)) {
        results.hits[key] = (results.hits[key] / simulationCount) * 100;
        results.blocks[key] = (results.blocks[key] / simulationCount) * 100;
        results.specials[key] = (results.specials[key] / simulationCount) * 100;
        results.hollowHits[key] = (results.hollowHits[key] / simulationCount) * 100;
        results.hollowBlocks[key] = (results.hollowBlocks[key] / simulationCount) * 100;
        results.hollowSpecials[key] = (results.hollowSpecials[key] / simulationCount) * 100;
    }
    for (const key of Object.keys(results.totalHits)) {
        results.totalHits[key] = (results.totalHits[key] / simulationCount) * 100;
        results.totalBlocks[key] = (results.totalBlocks[key] / simulationCount) * 100;
        results.totalSpecials[key] = (results.totalSpecials[key] / simulationCount) * 100;
    }
    const normalizeJoint = (map) => {
        for (const x of Object.keys(map)) {
            const row = map[x];
            for (const y of Object.keys(row)) {
                row[y] = (row[y] / simulationCount) * 100;
            }
        }
    };
    normalizeJoint(results.jointHitsSpecialsFilled);
    normalizeJoint(results.jointBlocksSpecialsFilled);
    normalizeJoint(results.jointHitsSpecialsHollow);
    normalizeJoint(results.jointBlocksSpecialsHollow);
    normalizeJoint(results.jointHitsSpecialsTotal);
    normalizeJoint(results.jointBlocksSpecialsTotal);

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

export async function performCombatSimulation(attackerPool, defenderPool, facesByColor, simulationCount, isAttackerElite, isDefenderElite, rng = Math.random) {
    const results = {
        woundsAttacker: {}, // Attacker → Defender
        woundsDefender: {}, // Defender → Attacker
        attackerSpecialsDist: {},
        defenderSpecialsDist: {},
        expected: {
            attackerHits: 0,
            attackerSpecials: 0,
            defenderBlocks: 0,
            defenderSpecials: 0,
            defenderHits: 0,
            attackerBlocks: 0,
            woundsAttacker: 0,
            woundsDefender: 0
        },
        attackerWinRate: 0,
        attackerTieRate: 0,
        attackerLossRate: 0,
        timestamp: new Date().toLocaleTimeString()
    };


    let attackerWins = 0;
    let attackerTies = 0;
    let attackerLosses = 0;
    for (let i = 0; i < simulationCount; i++) {
        const attackerRoll = simulateDiceRoll(attackerPool, facesByColor, isAttackerElite, rng);
        const defenderRoll = simulateDiceRoll(defenderPool, facesByColor, isDefenderElite, rng);

        const woundsA = Math.max(0, attackerRoll.hits - defenderRoll.blocks);
        const woundsD = Math.max(0, defenderRoll.hits - attackerRoll.blocks);

        results.woundsAttacker[woundsA] = (results.woundsAttacker[woundsA] || 0) + 1;
        results.woundsDefender[woundsD] = (results.woundsDefender[woundsD] || 0) + 1;

        results.attackerSpecialsDist[attackerRoll.specials] = (results.attackerSpecialsDist[attackerRoll.specials] || 0) + 1;
        results.defenderSpecialsDist[defenderRoll.specials] = (results.defenderSpecialsDist[defenderRoll.specials] || 0) + 1;

        if (woundsA > woundsD) attackerWins++;
        else if (woundsA === woundsD) attackerTies++;
        else attackerLosses++;

        results.expected.attackerHits += attackerRoll.hits;
        results.expected.attackerSpecials += attackerRoll.specials;
        results.expected.attackerBlocks += attackerRoll.blocks;
        results.expected.defenderHits += defenderRoll.hits;
        results.expected.defenderBlocks += defenderRoll.blocks;
        results.expected.defenderSpecials += defenderRoll.specials;
        results.expected.woundsAttacker += woundsA;
        results.expected.woundsDefender += woundsD;
    }

    for (const key of Object.keys(results.woundsAttacker)) {
        results.woundsAttacker[key] = (results.woundsAttacker[key] / simulationCount) * 100;
        results.woundsDefender[key] = (results.woundsDefender[key] / simulationCount) * 100;
        results.attackerSpecialsDist[key] = (results.attackerSpecialsDist[key] / simulationCount) * 100;
        results.defenderSpecialsDist[key] = (results.defenderSpecialsDist[key] / simulationCount) * 100;
    }

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

// New: pipeline-based combat simulation
export async function performCombatSimulationWithPipeline(attackerPool, defenderPool, facesByColor, simulationCount, attackerPipeline, defenderPipeline, rng = Math.random) {
    const results = {
        woundsAttacker: {},
        woundsDefender: {},
        attackerSpecialsDist: {},
        defenderSpecialsDist: {},
        expected: {
            attackerHits: 0,
            attackerSpecials: 0,
            defenderBlocks: 0,
            defenderSpecials: 0,
            defenderHits: 0,
            attackerBlocks: 0,
            woundsAttacker: 0,
            woundsDefender: 0
        },
        attackerWinRate: 0,
        attackerTieRate: 0,
        attackerLossRate: 0,
        timestamp: new Date().toLocaleTimeString()
    };


    let attackerWins = 0;
    let attackerTies = 0;
    let attackerLosses = 0;
    for (let i = 0; i < simulationCount; i++) {
        const preA = simulateDiceRoll(attackerPool, facesByColor, false, rng);
        const preD = simulateDiceRoll(defenderPool, facesByColor, false, rng);
        const attackerRoll = applyPipelineToAggregate(preA, attackerPipeline);
        const defenderRoll = applyPipelineToAggregate(preD, defenderPipeline);

        // Defender-first pairwise combat switches
        if (defenderPipeline && typeof defenderPipeline.applyCombat === 'function') {
            defenderPipeline.applyCombat(defenderRoll, attackerRoll, 'defender');
        }
        if (attackerPipeline && typeof attackerPipeline.applyCombat === 'function') {
            attackerPipeline.applyCombat(attackerRoll, defenderRoll, 'attacker');
        }

        const woundsA = Math.max(0, (attackerRoll.hits || 0) - (defenderRoll.blocks || 0));
        const woundsD = Math.max(0, (defenderRoll.hits || 0) - (attackerRoll.blocks || 0));

        results.woundsAttacker[woundsA] = (results.woundsAttacker[woundsA] || 0) + 1;
        results.woundsDefender[woundsD] = (results.woundsDefender[woundsD] || 0) + 1;
        results.attackerSpecialsDist[attackerRoll.specials] = (results.attackerSpecialsDist[attackerRoll.specials] || 0) + 1;
        results.defenderSpecialsDist[defenderRoll.specials] = (results.defenderSpecialsDist[defenderRoll.specials] || 0) + 1;

        if (woundsA > woundsD) attackerWins++;
        else if (woundsA === woundsD) attackerTies++;
        else attackerLosses++;

        results.expected.attackerHits += attackerRoll.hits || 0;
        results.expected.attackerSpecials += attackerRoll.specials || 0;
        results.expected.attackerBlocks += attackerRoll.blocks || 0;
        results.expected.defenderHits += defenderRoll.hits || 0;
        results.expected.defenderBlocks += defenderRoll.blocks || 0;
        results.expected.defenderSpecials += defenderRoll.specials || 0;
        results.expected.woundsAttacker += woundsA;
        results.expected.woundsDefender += woundsD;
    }

    for (const key of Object.keys(results.woundsAttacker)) {
        results.woundsAttacker[key] = (results.woundsAttacker[key] / simulationCount) * 100;
        results.woundsDefender[key] = (results.woundsDefender[key] / simulationCount) * 100;
        results.attackerSpecialsDist[key] = (results.attackerSpecialsDist[key] / simulationCount) * 100;
        results.defenderSpecialsDist[key] = (results.defenderSpecialsDist[key] / simulationCount) * 100;
    }

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

export function computeDieStats(faces, color) {
    // Return basic per-face probabilities for key symbols (ignoring hollow)
    const total = faces.length;
    let hitFaces = 0, blockFaces = 0, specialFaces = 0;
    for (const face of faces) {
        if (face.includes(DS.HIT)) hitFaces++;
        if (face.includes(DS.BLOCK)) blockFaces++;
        if (face.includes(DS.SPECIAL)) specialFaces++;
    }
    if (isAttackColor(color)) {
        return {
            primaryLabel: 'Hit',
            primaryPct: (hitFaces / total) * 100,
            secondaryLabel: 'Special',
            secondaryPct: (specialFaces / total) * 100
        };
    }
    return {
        primaryLabel: 'Block',
        primaryPct: (blockFaces / total) * 100,
        secondaryLabel: 'Special',
        secondaryPct: (specialFaces / total) * 100
    };
}

export function normalizeColor(color) {
    // Accept either capitalized UI labels or upper-case json keys
    switch (color) {
        case 'Red': return 'RED';
        case 'Orange': return 'ORANGE';
        case 'Yellow': return 'YELLOW';
        case 'Green': return 'GREEN';
        case 'Blue': return 'BLUE';
        case 'Black': return 'BLACK';
        default: return String(color).toUpperCase();
    }
}


