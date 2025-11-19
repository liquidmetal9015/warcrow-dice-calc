import type { FacesByColor, Aggregate, Pool } from '../dice';
import { 
    computePoolExpectedValue, 
    shouldRerollAggregate,
    computeColorExpectedValues,
    scoreDie,
    selectDiceToReroll,
    getWeightsForPriorityMode,
    countSymbolsFromFace,
    normalizeColor
} from '../dice';
import type { RepeatRollConfig, RepeatDiceConfig, DieRoll } from '../types/reroll';

export type ExplorerDieState = {
    id: number;
    color: string;
    faceIndex: number;
};

// Render a single die card
export function renderDieCard(
    die: ExplorerDieState,
    faces: ReadonlyArray<ReadonlyArray<string>>,
    dieRoll: { color: string; faceIndex: number; symbols: Aggregate },
    score: number,
    rerollPriority: number | null,
    priorityMode: 'hits' | 'blocks' | 'specials',
    countHollowAsFilled: boolean,
    onChange: (faceIndex: number) => void,
    onReroll: () => void
): string {
    const face = faces[die.faceIndex] as readonly string[];
    const symbols = countSymbolsFromFace(face as any);
    
    // Calculate expected value for the priority symbol type
    const { expectedCount, currentCount, symbolLabel } = getExpectedAndCurrentForPriority(
        faces,
        symbols,
        priorityMode,
        countHollowAsFilled
    );
    
    // Calculate performance based only on the priority symbol (not weighted score)
    const performance = currentCount - expectedCount;
    
    // Create radio buttons for all 8 faces
    const faceRadios = faces.map((f, idx) => {
        const faceSymbols = countSymbolsFromFace(f as any);
        const checked = idx === die.faceIndex ? 'checked' : '';
        return `
            <label class="face-radio ${checked ? 'selected' : ''}" data-die-id="${die.id}" data-face-index="${idx}">
                <input type="radio" name="die-${die.id}-face" value="${idx}" ${checked}>
                <span class="face-display">${renderFaceSymbols(faceSymbols)}</span>
            </label>
        `;
    }).join('');
    
    // Performance indicator (bar showing worst to best)
    const performancePercent = calculatePerformancePercent(performance, expectedCount);
    
    // Format priority badge text (only show if below average)
    const shouldShowPriority = rerollPriority && score < 0;
    const priorityText = shouldShowPriority ? `${rerollPriority}` : '';
    
    // Get die icon and color class
    const dieIconKey = `DIE_${normalizeColor(die.color)}`;
    const dieIconGlyph = (window as any).WARCROW_ICON_MAP?.[dieIconKey] || die.color;
    const dieColorClass = `${normalizeColor(die.color).toLowerCase()}-die`;
    
    return `
        <div class="die-card ${shouldShowPriority ? 'reroll-candidate' : ''}" data-die-id="${die.id}">
            <div class="die-card__header">
                <span class="die-icon-large ${dieColorClass} wc-icon">${dieIconGlyph}</span>
                ${priorityText ? `<span class="reroll-badge">${priorityText}</span>` : ''}
            </div>
            
            <div class="die-card__faces">
                <div class="face-selector-header">
                    <span class="face-selector-label">Face Selection</span>
                    <button class="btn btn--sm btn--secondary reroll-die-btn" data-die-id="${die.id}">🎲 Reroll</button>
                </div>
                <div class="face-selector">${faceRadios}</div>
            </div>
            
            <div class="die-card__stats">
                ${expectedCount > 0 ? `
                    <div class="stat-row">
                        <span class="stat-label">Current ${symbolLabel}:</span>
                        <span class="stat-value">${currentCount}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Expected ${symbolLabel}:</span>
                        <span class="stat-value">${expectedCount.toFixed(2)}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Performance:</span>
                        <span class="stat-value ${performance < 0 ? 'negative' : 'positive'}">
                            ${performance >= 0 ? '+' : ''}${performance.toFixed(2)}
                        </span>
                    </div>
                    
                    <div class="performance-bar">
                        <div class="performance-bar__track">
                            <div class="performance-bar__fill" style="left: ${performancePercent}%"></div>
                        </div>
                        <div class="performance-bar__labels">
                            <span>Worst</span>
                            <span>Expected</span>
                            <span>Best</span>
                        </div>
                    </div>
                ` : `
                    <div class="no-performance-message">
                        <p>This die cannot produce ${symbolLabel.toLowerCase()} and will not benefit from rerolling for this objective.</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

// Render aggregate analysis section
export function renderAggregateAnalysis(
    aggregate: Aggregate,
    pool: Pool,
    facesByColor: FacesByColor,
    repeatRollConfig: RepeatRollConfig
): string {
    const symbol = repeatRollConfig.condition.symbol;
    const expected = computePoolExpectedValue(pool, facesByColor, symbol);
    const actual = aggregate[symbol] || 0;
    const shouldReroll = shouldRerollAggregate(aggregate, repeatRollConfig.condition, pool, facesByColor);
    
    // If no dice can produce this symbol, show a special message
    if (expected === 0) {
        return `
            <div class="aggregate-analysis">
                <h3>Full Reroll Analysis</h3>
                <div class="aggregate-result">
                    <div class="result-row">
                        <span class="result-label">Current Roll:</span>
                        <span class="result-value">${renderFullAggregate(aggregate)}</span>
                    </div>
                </div>
                
                <div class="no-performance-message">
                    <p>No dice in this pool can produce ${symbol}. Rerolling will not help achieve this objective.</p>
                </div>
            </div>
        `;
    }
    
    // Visual bar showing where actual sits relative to expected
    const range = expected * 2; // rough range for visualization
    const percent = Math.max(0, Math.min(100, (actual / range) * 100));
    
    return `
        <div class="aggregate-analysis">
            <h3>Full Reroll Analysis</h3>
            <div class="aggregate-result">
                <div class="result-row">
                    <span class="result-label">Current Roll:</span>
                    <span class="result-value">${renderFullAggregate(aggregate)}</span>
                </div>
            </div>
            
            <div class="reroll-recommendation ${shouldReroll ? 'recommend-reroll' : 'recommend-keep'}">
                <div class="recommendation-header">
                    <span class="recommendation-icon">${shouldReroll ? '🔄' : '✓'}</span>
                    <span class="recommendation-text">
                        ${shouldReroll ? 'Reroll Recommended' : 'Keep Roll'}
                    </span>
                </div>
                <div class="recommendation-details">
                    <div class="stat-comparison">
                        <div class="stat-item">
                            <span class="stat-label">Actual ${symbol}:</span>
                            <span class="stat-value">${actual}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Expected ${symbol}:</span>
                            <span class="stat-value">${expected.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Difference:</span>
                            <span class="stat-value ${actual < expected ? 'negative' : 'positive'}">
                                ${(actual - expected).toFixed(2)}
                            </span>
                        </div>
                    </div>
                    
                    <div class="performance-bar">
                        <div class="performance-bar__track">
                            <div class="performance-bar__marker" style="left: ${percent}%"></div>
                            <div class="performance-bar__expected" style="left: ${(expected / range) * 100}%"></div>
                        </div>
                        <div class="performance-bar__labels">
                            <span>0</span>
                            <span>Expected</span>
                            <span>Best</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <p class="policy-note">Based on "${repeatRollConfig.condition.type}" policy for ${symbol}</p>
        </div>
    `;
}

// Helper: Render symbols using icon font
function renderFaceSymbols(symbols: Aggregate): string {
    const parts: string[] = [];
    
    // Render each symbol type using the WarcrowSymbols icon font
    if (symbols.hits > 0) {
        parts.push(`<span class="symbol-icon hit" data-symbol="HIT">${'1'.repeat(symbols.hits)}</span>`);
    }
    if (symbols.hollowHits > 0) {
        parts.push(`<span class="symbol-icon hollow-hit" data-symbol="HOLLOW_HIT">${'2'.repeat(symbols.hollowHits)}</span>`);
    }
    if (symbols.blocks > 0) {
        parts.push(`<span class="symbol-icon block" data-symbol="BLOCK">${'3'.repeat(symbols.blocks)}</span>`);
    }
    if (symbols.hollowBlocks > 0) {
        parts.push(`<span class="symbol-icon hollow-block" data-symbol="HOLLOW_BLOCK">${'4'.repeat(symbols.hollowBlocks)}</span>`);
    }
    if (symbols.specials > 0) {
        parts.push(`<span class="symbol-icon special" data-symbol="SPECIAL">${'5'.repeat(symbols.specials)}</span>`);
    }
    if (symbols.hollowSpecials > 0) {
        parts.push(`<span class="symbol-icon hollow-special" data-symbol="HOLLOW_SPECIAL">${'6'.repeat(symbols.hollowSpecials)}</span>`);
    }
    
    return parts.length > 0 ? parts.join('') : '<span class="no-symbols">—</span>';
}

// Helper: Render symbol aggregate (just the icons)
function renderSymbolAggregate(symbols: Aggregate): string {
    return renderFaceSymbols(symbols);
}

// Helper: Render full aggregate (all symbols)
function renderFullAggregate(aggregate: Aggregate): string {
    return renderFaceSymbols(aggregate);
}

// Calculate performance percentage for visualization (0-100)
function calculatePerformancePercent(score: number, expectedValue: number): number {
    // Map score to 0-100 range where 50 = expected
    // Negative scores go 0-50, positive scores go 50-100
    if (score < 0) {
        // Map from worst possible (-expectedValue) to expected (0)
        return Math.max(0, 50 + (score / expectedValue) * 50);
    } else {
        // Map from expected (0) to best possible (+expectedValue)
        return Math.min(100, 50 + (score / expectedValue) * 50);
    }
}

// Get ordinal suffix for numbers (1st, 2nd, 3rd, 4th, etc.)
function getOrdinalSuffix(n: number): string {
    const j = n % 10;
    const k = n % 100;
    if (j === 1 && k !== 11) {
        return 'st';
    }
    if (j === 2 && k !== 12) {
        return 'nd';
    }
    if (j === 3 && k !== 13) {
        return 'rd';
    }
    return 'th';
}

// Calculate expected and current values for the priority symbol type
function getExpectedAndCurrentForPriority(
    faces: ReadonlyArray<ReadonlyArray<string>>,
    currentSymbols: Aggregate,
    priorityMode: 'hits' | 'blocks' | 'specials',
    countHollowAsFilled: boolean
): { expectedCount: number; currentCount: number; symbolLabel: string } {
    // Determine which symbol(s) to count based on priority mode
    let symbolLabel = '';
    let currentCount = 0;
    
    switch (priorityMode) {
        case 'hits':
            symbolLabel = 'Hits';
            currentCount = currentSymbols.hits + (countHollowAsFilled ? currentSymbols.hollowHits : 0);
            break;
        case 'blocks':
            symbolLabel = 'Blocks';
            currentCount = currentSymbols.blocks + (countHollowAsFilled ? currentSymbols.hollowBlocks : 0);
            break;
        case 'specials':
            symbolLabel = 'Specials';
            currentCount = currentSymbols.specials + (countHollowAsFilled ? currentSymbols.hollowSpecials : 0);
            break;
    }
    
    // Calculate expected count for this die
    let expectedCount = 0;
    for (const face of faces) {
        const symbols = countSymbolsFromFace(face as any);
        let faceValue = 0;
        
        switch (priorityMode) {
            case 'hits':
                faceValue = symbols.hits + (countHollowAsFilled ? symbols.hollowHits : 0);
                break;
            case 'blocks':
                faceValue = symbols.blocks + (countHollowAsFilled ? symbols.hollowBlocks : 0);
                break;
            case 'specials':
                faceValue = symbols.specials + (countHollowAsFilled ? symbols.hollowSpecials : 0);
                break;
        }
        
        expectedCount += faceValue;
    }
    
    expectedCount /= faces.length; // Average across all faces
    
    return { expectedCount, currentCount, symbolLabel };
}

