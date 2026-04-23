// =============================================================================
// CALCULATOR SCRIPT — FULLY FEATURED PORTFOLIO CALCULATOR
// =============================================================================
// Features: Expression display, repeating equals, advanced math (√, %, +/−, ⌫),
//            memory functions (M+, M−, MR, MC), full keyboard support.
//
// Architecture: Simple state machine with clear phase transitions.
//   ENTRY  → Building currentInput from digit/function presses
//   PENDING → Operator selected, waiting for second operand
//   RESULT  → Calculation performed, result displayed
//   ERROR   → Div/0 or negative sqrt triggers full reset via clearAll()
// =============================================================================

// ---------- DOM ELEMENT REFERENCES ----------
// Cached references to display elements for performance
const display = document.getElementById('display');           // Main numeric output
const expressionDisplay = document.getElementById('expression'); // Equation preview
const memoryIndicator = document.getElementById('memory-indicator'); // "M: X" display

// ---------- CORE STATE VARIABLES ----------
// These track the calculator's current phase and operands
let currentInput = '';        // The number actively being typed/built
let previousInput = '';       // First operand (saved when operator pressed)
let operator = null;          // Active arithmetic operator (+, −, *, /)
let shouldResetDisplay = false; // True → next digit replaces currentInput (phase change flag)
let expression = '';          // Full equation string shown in expression display
let lastOperator = null;      // Persisted operator for repeat-equals feature
let lastOperand = '';         // Persisted second operand for repeat-equals feature

// ---------- MEMORY STATE ----------
// Memory persists across calculations until MC or page refresh
let memoryValue = 0;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Updates the main display, defaulting to '0' when empty */
function updateDisplay(value) {
  display.textContent = value === '' ? '0' : value;
}

/** Updates the equation preview above the main display */
function updateExpression(text) {
  expressionDisplay.textContent = text;
}

/** Syncs the footer memory indicator with the current memory value */
function updateMemoryIndicator() {
  memoryIndicator.textContent = `M: ${memoryValue}`;
}

/**
 * FULL STATE RESET — Called after errors (div/0, negative sqrt) and clear (C).
 * Returns every state variable to its initial value to prevent corrupted state
 * from leaking into subsequent operations.
 */
function clearAll() {
  currentInput = '';
  previousInput = '';
  operator = null;
  shouldResetDisplay = false;
  expression = '';
  lastOperator = null;
  lastOperand = '';
  updateDisplay('0');
  updateExpression('');
}

/**
 * Core arithmetic engine — safe evaluation without using eval().
 * Handles edge case: division by zero returns 'Error' string.
 * @param {string} a - First operand
 * @param {string} b - Second operand  
 * @param {string} op - Operator character
 * @returns {number|string} Numeric result or 'Error'
 */
function calculate(a, b, op) {
  const num1 = parseFloat(a);
  const num2 = parseFloat(b);
  // Defensive: guard against malformed input (shouldn't occur in normal flow)
  if (isNaN(num1) || isNaN(num2)) return '';
  switch (op) {
    case '+': return num1 + num2;
    case '-': return num1 - num2;
    case '*': return num1 * num2;
    case '/': 
      return num2 === 0 ? 'Error' : num1 / num2;  // Div/0 guard
    default: return '';
  }
}

// =============================================================================
// ADVANCED MATH HANDLERS (√, %, +/−, ⌫)
// =============================================================================

/** 
 * √ Square root — validates input is non-negative, errors with reset on negative.
 * Also updates the expression display to show what was computed.
 */
function handleSquareRoot() {
  if (currentInput === '') return;            // Nothing to operate on
  const original = currentInput;              // Snapshot before alteration for expression
  const num = parseFloat(original);
  if (num < 0) {
    updateDisplay('Error');
    clearAll();                              // Full reset prevents state corruption
    return;
  }
  const result = Math.sqrt(num);
  currentInput = result.toString();
  updateDisplay(currentInput);
  // Show informative expression: √(9) = 3
  updateExpression(`√(${original}) = ${currentInput}`);
  shouldResetDisplay = true;                 // Next digit starts fresh number
}

/** 
 * % Percentage — context-aware behavior:
 *   - With pending operator: calculates X% of previous operand (for tip/discount math)
 *   - Standalone: simply divides by 100 (converts percentage to decimal)
 * Expression display clearly shows the conversion.
 */
function handlePercentage() {
  if (currentInput === '') return;
  const original = currentInput;              // Original value before conversion
  const num = parseFloat(original);
  if (operator && previousInput !== '') {
    // e.g., "200 + 5 %" → 5 becomes 10% of 200 = 10
    const base = parseFloat(previousInput);
    const percentValue = (base * num) / 100;
    currentInput = percentValue.toString();
  } else {
    // Standalone: "50 %" → 0.5
    currentInput = (num / 100).toString();
  }
  updateDisplay(currentInput);
  // Show e.g. 50% = 0.5
  updateExpression(`${original}% = ${currentInput}`);
}

/** 
 * +/− Toggle sign — flips between positive and negative.
 * Displays the transformation in the expression area.
 */
function handleToggleSign() {
  if (currentInput === '') return;
  const original = currentInput;
  const num = parseFloat(original);
  currentInput = (num * -1).toString();
  updateDisplay(currentInput);
  // Show e.g. 5 → -5
  updateExpression(`${original} → ${currentInput}`);
}

/** ⌫ Backspace — removes last character; respects shouldResetDisplay lock */
function handleBackspace() {
  if (!shouldResetDisplay && currentInput.length > 0) {
    currentInput = currentInput.slice(0, -1);
    updateDisplay(currentInput || '0');
  }
}

// =============================================================================
// MEMORY FUNCTION HANDLERS (M+, M−, MR, MC)
// =============================================================================
// Memory is a simple accumulator — adds/subtracts the current display value.
// MR recalls without clearing; MC resets to zero.

function handleMemoryAdd() {
  memoryValue += parseFloat(currentInput) || 0;
  updateMemoryIndicator();
}

function handleMemorySubtract() {
  memoryValue -= parseFloat(currentInput) || 0;
  updateMemoryIndicator();
}

function handleMemoryRecall() {
  currentInput = memoryValue.toString();
  updateDisplay(currentInput);
  shouldResetDisplay = true;  // Recalled value gets replaced on next digit, like iOS
}

function handleMemoryClear() {
  memoryValue = 0;
  updateMemoryIndicator();
}

// =============================================================================
// CORE INPUT HANDLERS
// =============================================================================

/**
 * Handles ALL number and decimal input (both button clicks and keyboard).
 * Manages three special cases:
 *   1. Decimal validation — only one '.' per number
 *   2. Leading zero replacement — "0" + "5" becomes "5", not "05"
 *   3. Double-zero button — "5" + "00" becomes "500" for rapid large-number entry
 * @param {string} value - Digit, decimal, or "00" from button data-value
 */
function handleNumber(value) {
  // Phase transition: after operator or equals, clear before new input
  if (shouldResetDisplay) {
    currentInput = '';
    shouldResetDisplay = false;
  }
  
  // --- Decimal validation (one per number) ---
  if (value === '.') {
    if (currentInput.includes('.')) return;  // Already has decimal — ignore
    if (currentInput === '') currentInput = '0'; // Leading decimal → "0."
  }
  
  // --- Double-zero shortcut ---
  if (value === '00') {
    if (currentInput === '' || currentInput === '0') {
      currentInput = '0';     // Don't allow "000"
    } else {
      currentInput += '00';   // "5" → "500"
    }
  } else {
    // --- Leading zero guard ---
    if (value !== '.' && currentInput === '0') {
      currentInput = value;   // Replace "0" with digit
    } else {
      currentInput += value;  // Normal append
    }
  }
  
  updateDisplay(currentInput);
}

/**
 * Handles operator (+, −, *, /) button presses.
 * Manages three scenarios:
 *   1. First operator: stores currentInput as previousInput, sets operator
 *   2. Chained operators: computes pending result first, then sets new operator
 *   3. Operator replacement: changes operator without losing first operand
 * @param {string} nextOperator - The operator symbol pressed
 */
function handleOperator(nextOperator) {
  // Starting with operator: treat missing number as "0" (for "+ 5 =" use case)
  if (currentInput === '' && previousInput === '') {
    currentInput = '0';
  }
  
  // Pending operation exists — compute it before accepting new operator
  if (operator !== null && !shouldResetDisplay) {
    const result = calculate(previousInput, currentInput, operator);
    if (result === 'Error') {
      updateDisplay('Error');
      updateExpression('Error');
      clearAll();
      return;
    }
    currentInput = result.toString();
    updateDisplay(currentInput);
  }
  
  // Operator replacement: already in "pending" phase, just swap operator symbol
  if (shouldResetDisplay && operator !== null) {
    const parts = expression.trim().split(' ');
    parts[parts.length - 1] = nextOperator;  // Replace last token
    expression = parts.join(' ');
    operator = nextOperator;
    updateExpression(expression);
    return;
  }
  
  // Build or extend expression string for the preview display
  if (expression === '' || shouldResetDisplay) {
    expression = currentInput + ' ' + nextOperator;
  } else {
    expression = expression + ' ' + currentInput + ' ' + nextOperator;
  }
  updateExpression(expression);
  
  // Transition to PENDING phase
  previousInput = currentInput;
  operator = nextOperator;
  shouldResetDisplay = true;
  
  // Clear repeat-equals memory (new explicit operator breaks repeat chain)
  lastOperator = null;
  lastOperand = '';
}

/**
 * Handles action buttons: Clear (C) and Equals (=).
 * Equals has two modes:
 *   CASE 1 — Normal: operator and two operands present → calculate
 *   CASE 2 — Repeat: stored lastOperator/lastOperand exist → repeat last operation
 * @param {string} action - 'clear' or 'calculate'
 */
function handleAction(action) {
  if (action === 'clear') {
    clearAll();  // Full state reset
  } 
  else if (action === 'calculate') {
    // CASE 1: Normal calculation (operator active, two operands ready)
    if (operator && previousInput !== '' && !shouldResetDisplay) {
      const result = calculate(previousInput, currentInput, operator);
      const finalExpression = expression + ' ' + currentInput + ' =';
      updateExpression(finalExpression);
      
      if (result === 'Error') {
        updateDisplay('Error');
        clearAll();
        return;
      }
      
      // Store for possible repeat-equals (CASE 2 below)
      lastOperator = operator;
      lastOperand = currentInput;
      currentInput = result.toString();
      updateDisplay(currentInput);
      
      // Transition to RESULT phase
      operator = null;
      previousInput = '';
      shouldResetDisplay = true;
    }
    // CASE 2: Repeat equals — reapply last operation with current result
    // e.g., 5 + 3 = 8, then = → 8 + 3 = 11, then = → 11 + 3 = 14
    else if (!operator && lastOperator && previousInput === '') {
      const result = calculate(currentInput, lastOperand, lastOperator);
      const repeatExpression = currentInput + ' ' + lastOperator + ' ' + lastOperand + ' =';
      updateExpression(repeatExpression);
      
      if (result === 'Error') {
        updateDisplay('Error');
        clearAll();
        return;
      }
      
      currentInput = result.toString();
      updateDisplay(currentInput);
      shouldResetDisplay = true;
    }
    // Implicit else: nothing to calculate — do nothing (silent no-op)
  }
}

// =============================================================================
// EVENT LISTENERS — Button Clicks
// =============================================================================
// Uses event delegation pattern: one listener per button.
// Routes clicks based on data-* attributes for clean separation of concerns.

const buttons = document.querySelectorAll('.btn');
buttons.forEach(button => {
  button.addEventListener('click', (e) => {
    e.preventDefault();  // Prevent any default form/submit behavior
    
    // --- Memory functions (routed via data-memory attribute) ---
    const memoryAction = button.dataset.memory;
    if (memoryAction) {
      if (memoryAction === 'add') handleMemoryAdd();
      else if (memoryAction === 'subtract') handleMemorySubtract();
      else if (memoryAction === 'recall') handleMemoryRecall();
      else if (memoryAction === 'clear') handleMemoryClear();
      return;
    }
    
    // --- Advanced functions and actions (routed via data-action attribute) ---
    const action = button.dataset.action;
    if (action) {
      if (action === 'sqrt') handleSquareRoot();
      else if (action === 'percent') handlePercentage();
      else if (action === 'toggleSign') handleToggleSign();
      else if (action === 'backspace') handleBackspace();
      else if (action === 'clear' || action === 'calculate') handleAction(action);
      return;
    }
    
    // --- Numbers and operators (routed via class and data-value/data-operator) ---
    if (button.classList.contains('number')) {
      handleNumber(button.dataset.value);
    } else if (button.classList.contains('operator')) {
      handleOperator(button.dataset.operator);
    }
  });
});

// =============================================================================
// KEYBOARD SUPPORT — Power User Feature
// =============================================================================
// Maps physical keys to calculator functions for efficiency.
// Prevents default on calculator keys (stops Enter from submitting forms, etc.)

document.addEventListener('keydown', (e) => {
  const key = e.key;
  
  // Block default browser behavior for all calculator-mapped keys
  if (/^[0-9.]$/.test(key) || 
      ['+', '-', '*', '/', 'Enter', 'Escape', 'c', 'C', 'Backspace', '%', 's', 'S', '!'].includes(key)) {
    e.preventDefault();
  }
  
  // --- Route keypresses to handlers ---
  if (/^[0-9.]$/.test(key)) handleNumber(key);        // Digits & decimal
  if (['+', '-', '*', '/'].includes(key)) handleOperator(key);  // Arithmetic
  if (key === 'Enter') handleAction('calculate');      // Equals
  if (key === 'Escape' || key === 'c' || key === 'C') handleAction('clear'); // Clear
  if (key === 'Backspace') handleBackspace();          // Delete
  if (key === '%') handlePercentage();                  // Percent
  if (key === 's' || key === 'S') handleSquareRoot();  // Square root
  if (key === '!' || key === '~') handleToggleSign();  // Toggle sign
});

// Initialize memory indicator on page load (shows "M: 0")
updateMemoryIndicator();