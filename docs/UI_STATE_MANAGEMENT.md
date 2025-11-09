# UI State Management Best Practices

## The Problem: Stale Closure Captures

When creating event handlers in JavaScript/TypeScript, it's easy to accidentally capture stale references to configuration objects. This leads to bugs where UI changes appear to work, but get reverted when other controls are used.

### Example of the Bug

```typescript
function initUI(initialConfig: Config) {
  const checkbox = document.getElementById('enable');
  const radio = document.getElementById('mode');
  
  // ❌ BAD: Captures stale initialConfig
  checkbox.addEventListener('change', () => {
    callback({ ...initialConfig, enabled: checkbox.checked });
    // Even if user changed radio, this spreads the OLD initialConfig!
  });
}
```

### The Fix

Always read the **current UI state** from DOM elements instead of relying on captured variables:

```typescript
function initUI(initialConfig: Config) {
  const checkbox = document.getElementById('enable');
  const radio = document.getElementById('mode');
  
  // ✅ GOOD: Reads current state from DOM
  checkbox.addEventListener('change', () => {
    callback({ 
      enabled: checkbox.checked,
      mode: radio.value  // Current value from DOM!
    });
  });
}
```

## Best Practices

### 1. **Source of Truth: Always the DOM**

When building config objects in event handlers, read ALL values from DOM elements:

```typescript
// ✅ Read everything from DOM
const config = {
  enabled: enableCheckbox.checked,
  max: parseInt(maxInput.value, 10),
  mode: Array.from(radioButtons).find(r => r.checked)?.value || 'default',
  includeHollow: hollowCheckbox?.checked || false
};
```

### 2. **Never Spread Captured Configs in Event Handlers**

Avoid spreading `initialConfig`, `currentConfig`, or any other captured configuration:

```typescript
// ❌ BAD
callback({ ...initialConfig, enabled: true });
callback({ ...currentConfig, max: newMax });

// ✅ GOOD
callback({ 
  enabled: true,
  max: newMax,
  mode: getCurrentMode(),
  // ... all other properties read from DOM
});
```

### 3. **Extract State Reading Logic**

Create helper functions to read current state:

```typescript
function getCurrentConfig(): Config {
  return {
    enabled: enableCheckbox.checked,
    max: parseInt(maxInput.value || '2', 10),
    mode: Array.from(radioButtons).find(r => r.checked)?.value || 'default',
    includeHollow: hollowCheckbox?.checked || false
  };
}

// Use in all event handlers
enableCheckbox.addEventListener('change', () => {
  callback(getCurrentConfig());
});

maxInput.addEventListener('input', () => {
  callback(getCurrentConfig());
});
```

### 4. **Use initialConfig Only for Initialization**

The `initialConfig` parameter should only be used to set initial DOM state, never in event handlers:

```typescript
function initUI(initialConfig: Config) {
  // ✅ Use initialConfig to set initial DOM state
  enableCheckbox.checked = initialConfig.enabled;
  maxInput.value = String(initialConfig.max);
  
  // ✅ Event handlers read from DOM
  enableCheckbox.addEventListener('change', () => {
    callback(getCurrentConfig());
  });
}
```

## Testing Strategy

### Manual Testing Checklist

When testing UI controls that affect configuration:

1. ✅ Change control A (e.g., select "blocks" priority)
2. ✅ Verify the value updates correctly
3. ✅ Change control B (e.g., toggle checkbox off/on)
4. ✅ **Verify control A's value is still correct** ← This catches the bug!
5. ✅ Change control A again
6. ✅ Verify it works

### Automated Testing

Consider adding integration tests that:
- Change multiple UI controls in sequence
- Verify config state after each change
- Toggle controls on/off and verify state persists

## Code Review Checklist

When reviewing UI initialization code:

- [ ] Are event handlers reading from DOM elements?
- [ ] Is `initialConfig` (or similar) only used for initialization?
- [ ] Are there any `...spread` operators in event handlers?
- [ ] Does each event handler build a complete config object?
- [ ] Is there a helper function to get current state?

## Root Cause Analysis: The Reroll Bug

### What Happened

In `src/ui/rerollEditor.ts`, the checkbox toggle handler was:

```typescript
enableCheckbox.addEventListener('change', () => {
  callback({ ...initialConfig, enabled: checkbox.checked });
});
```

### The Bug Sequence

1. User loads page → `initialConfig.priorityMode = 'hits'`
2. User changes priority to 'blocks' → works correctly
3. User unchecks "repeat dice" → handler spreads `initialConfig`, reverting priority to 'hits'
4. User rechecks "repeat dice" → still using reverted 'hits' value
5. User changes priority to 'blocks' again → works (because that handler reads from DOM)

### The Fix

```typescript
enableCheckbox.addEventListener('change', () => {
  const checkedRadio = Array.from(priorityRadios).find(r => r.checked);
  callback({ 
    enabled: checkbox.checked,
    maxDiceToReroll: parseInt(maxInput.value || '2', 10),
    priorityMode: checkedRadio?.value as Config['priorityMode'] || 'hits',
    countHollowAsFilled: hollowCheckbox?.checked || false
  });
});
```

## Related Patterns to Avoid

### React/Vue Equivalent

Even in frameworks, similar issues can occur:

```typescript
// ❌ BAD: Capturing stale prop
useEffect(() => {
  const handler = () => doSomething(props.value);
  element.addEventListener('click', handler);
}, []); // Empty deps → captures initial props.value

// ✅ GOOD: Include in dependencies
useEffect(() => {
  const handler = () => doSomething(props.value);
  element.addEventListener('click', handler);
  return () => element.removeEventListener('click', handler);
}, [props.value]); // Re-registers when value changes
```

## Summary

**Golden Rule**: In event handlers, always read the current state from its authoritative source (DOM elements, state management, etc.) rather than relying on captured variables from outer scopes.

This prevents subtle bugs where UI controls appear to work independently but interfere with each other through stale closure captures.

