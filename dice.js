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
                if (isElite) { result.hits += 1; } else { result.hollowHits += 1; }
                break;
            case DS.HOLLOW_BLOCK:
                if (isElite) { result.blocks += 1; } else { result.hollowBlocks += 1; }
                break;
            case DS.HOLLOW_SPECIAL:
                if (isElite) { result.specials += 1; } else { result.hollowSpecials += 1; }
                break;
        }
    }

    return result;
}

export function simulateDiceRoll(pool, facesByColor, isElite) {
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
            const faceIndex = Math.floor(Math.random() * 8);
            const face = facesByColor[colorKey][faceIndex];
            const rolled = countSymbolsFromFace(face, isElite);
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

export async function performMonteCarloSimulation(pool, facesByColor, simulationCount, isElite) {
    const results = {
        hits: {},
        blocks: {},
        specials: {},
        hollowHits: {},
        hollowBlocks: {},
        hollowSpecials: {},
        // Combined distributions where hollow counts as filled (for display of hollow+filled)
        totalHits: {},
        totalBlocks: {},
        totalSpecials: {},
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

    for (let i = 0; i <= 50; i++) {
        results.hits[i] = 0;
        results.blocks[i] = 0;
        results.specials[i] = 0;
        results.hollowHits[i] = 0;
        results.hollowBlocks[i] = 0;
        results.hollowSpecials[i] = 0;
        results.totalHits[i] = 0;
        results.totalBlocks[i] = 0;
        results.totalSpecials[i] = 0;
    }

    for (let i = 0; i < simulationCount; i++) {
        const roll = simulateDiceRoll(pool, facesByColor, isElite);
        results.hits[roll.hits]++;
        results.blocks[roll.blocks]++;
        results.specials[roll.specials]++;
        results.hollowHits[roll.hollowHits]++;
        results.hollowBlocks[roll.hollowBlocks]++;
        results.hollowSpecials[roll.hollowSpecials]++;

        // Combined totals per roll
        const totalHits = roll.hits + roll.hollowHits;
        const totalBlocks = roll.blocks + roll.hollowBlocks;
        const totalSpecials = roll.specials + roll.hollowSpecials;
        results.totalHits[totalHits]++;
        results.totalBlocks[totalBlocks]++;
        results.totalSpecials[totalSpecials]++;

        results.expected.hits += roll.hits;
        results.expected.blocks += roll.blocks;
        results.expected.specials += roll.specials;
        results.expected.hollowHits += roll.hollowHits;
        results.expected.hollowBlocks += roll.hollowBlocks;
        results.expected.hollowSpecials += roll.hollowSpecials;
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

    results.expected.hits /= simulationCount;
    results.expected.blocks /= simulationCount;
    results.expected.specials /= simulationCount;
    results.expected.hollowHits /= simulationCount;
    results.expected.hollowBlocks /= simulationCount;
    results.expected.hollowSpecials /= simulationCount;

    return results;
}

export async function performCombatSimulation(attackerPool, defenderPool, facesByColor, simulationCount, isAttackerElite, isDefenderElite) {
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
        timestamp: new Date().toLocaleTimeString()
    };

    for (let i = 0; i <= 50; i++) {
        results.woundsAttacker[i] = 0;
        results.woundsDefender[i] = 0;
        results.attackerSpecialsDist[i] = 0;
        results.defenderSpecialsDist[i] = 0;
    }

    let attackerWins = 0;
    for (let i = 0; i < simulationCount; i++) {
        const attackerRoll = simulateDiceRoll(attackerPool, facesByColor, isAttackerElite);
        const defenderRoll = simulateDiceRoll(defenderPool, facesByColor, isDefenderElite);

        const woundsA = Math.max(0, attackerRoll.hits - defenderRoll.blocks);
        const woundsD = Math.max(0, defenderRoll.hits - attackerRoll.blocks);

        results.woundsAttacker[woundsA]++;
        results.woundsDefender[woundsD]++;

        results.attackerSpecialsDist[attackerRoll.specials]++;
        results.defenderSpecialsDist[defenderRoll.specials]++;

        if (woundsA > woundsD) attackerWins++;

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


