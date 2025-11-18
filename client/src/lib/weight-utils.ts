/**
 * Weight Management Utilities for OKR Key Results
 * 
 * Ensures Key Result weights sum to 100% for accurate rollup calculations.
 * Supports auto-balancing, manual locking, and normalization.
 */

export interface WeightedItem {
  id: string;
  weight: number;
  isWeightLocked?: boolean;
}

/**
 * Calculate the total weight across all items
 * Treats undefined or null weights as 0
 */
export function calculateTotalWeight(items: WeightedItem[]): number {
  return items.reduce((sum, item) => sum + (item.weight || 0), 0);
}

/**
 * Check if weights sum to 100% (within rounding tolerance)
 */
export function isWeightValid(items: WeightedItem[], tolerance: number = 0.01): boolean {
  const total = calculateTotalWeight(items);
  return Math.abs(total - 100) <= tolerance;
}

/**
 * Get validation message for current weight distribution
 */
export function getWeightValidationMessage(items: WeightedItem[]): {
  isValid: boolean;
  message: string;
  total: number;
} {
  const total = calculateTotalWeight(items);
  const isValid = Math.abs(total - 100) <= 0.01;
  
  if (isValid) {
    return {
      isValid: true,
      message: "Weights are balanced (100%)",
      total,
    };
  }
  
  const diff = total - 100;
  if (diff > 0) {
    return {
      isValid: false,
      message: `Weights exceed 100% by ${diff.toFixed(1)}%`,
      total,
    };
  } else {
    return {
      isValid: false,
      message: `Weights are under 100% by ${Math.abs(diff).toFixed(1)}%`,
      total,
    };
  }
}

/**
 * Auto-balance weights across unlocked items
 * Distributes weight equally among unlocked items, preserving locked weights
 */
export function autoBalanceWeights<T extends WeightedItem>(items: T[]): T[] {
  if (items.length === 0) return items;
  
  // Single item always gets 100%
  if (items.length === 1) {
    return items.map(item => ({ ...item, weight: 100 }));
  }
  
  // Separate locked and unlocked items
  const locked = items.filter(item => item.isWeightLocked === true);
  const unlocked = items.filter(item => item.isWeightLocked !== true);
  
  // If all items are locked, return as-is
  if (unlocked.length === 0) {
    return items;
  }
  
  // Calculate remaining weight after locked items (default to 0 for undefined weights)
  const lockedTotal = locked.reduce((sum, item) => sum + (item.weight || 0), 0);
  const remainingWeight = 100 - lockedTotal;
  
  // Distribute remaining weight equally among unlocked items
  const weightPerUnlocked = remainingWeight / unlocked.length;
  
  // Create new array with updated weights
  return items.map(item => {
    const isLocked = item.isWeightLocked === true;
    if (isLocked) {
      return { ...item, weight: item.weight || 0 }; // Ensure weight is defined
    } else {
      return { ...item, weight: Math.round(weightPerUnlocked * 100) / 100 };
    }
  });
}

/**
 * Normalize weights to sum exactly to 100%
 * Applies proportional adjustments, concentrating rounding errors on the largest unlocked item
 */
export function normalizeWeights<T extends WeightedItem>(items: T[]): T[] {
  if (items.length === 0) return items;
  
  // Single item always gets 100%
  if (items.length === 1) {
    return items.map(item => ({ ...item, weight: 100 }));
  }
  
  const total = calculateTotalWeight(items);
  
  // Already normalized (within tolerance)
  if (Math.abs(total - 100) <= 0.01) {
    return items;
  }
  
  // Separate locked and unlocked items
  const unlocked = items.filter(item => item.isWeightLocked !== true);
  
  // If all items are locked and don't sum to 100%, return as-is (user must fix manually)
  if (unlocked.length === 0) {
    return items;
  }
  
  // Apply proportional scaling to unlocked items (default undefined weights to 0)
  const unlockedTotal = unlocked.reduce((sum, item) => sum + (item.weight || 0), 0);
  const lockedTotal = total - unlockedTotal;
  const targetUnlockedTotal = 100 - lockedTotal;
  const scaleFactor = unlockedTotal > 0 ? targetUnlockedTotal / unlockedTotal : 1;
  
  // Scale unlocked items
  const scaled = items.map(item => {
    const isLocked = item.isWeightLocked === true;
    if (isLocked) {
      return { ...item, weight: item.weight || 0 }; // Ensure weight is defined
    } else {
      const currentWeight = item.weight || 0;
      return { ...item, weight: Math.round(currentWeight * scaleFactor * 100) / 100 };
    }
  });
  
  // Handle rounding errors by adjusting the largest unlocked item
  const newTotal = calculateTotalWeight(scaled);
  const diff = 100 - newTotal;
  
  if (Math.abs(diff) > 0.01 && unlocked.length > 0) {
    // Find largest unlocked item, or first unlocked if all are zero
    const unlockedItems = scaled.filter(item => item.isWeightLocked !== true);
    const largestUnlocked = unlockedItems.reduce((max, item) => 
      ((item.weight || 0) > (max.weight || 0) ? item : max), 
      unlockedItems[0] // Use first unlocked item as fallback
    );
    
    if (largestUnlocked) {
      return scaled.map(item => {
        if (item.id === largestUnlocked.id) {
          const currentWeight = item.weight || 0;
          return { ...item, weight: Math.round((currentWeight + diff) * 100) / 100 };
        }
        return item;
      });
    }
  }
  
  return scaled;
}

/**
 * Get suggested weight adjustments to reach 100%
 */
export function getSuggestedAdjustments(items: WeightedItem[]): {
  itemId: string;
  currentWeight: number;
  suggestedWeight: number;
  adjustment: number;
}[] {
  const normalized = normalizeWeights(items);
  
  return items.map((item, index) => {
    const currentWeight = item.weight || 0;
    const suggestedWeight = normalized[index].weight || 0;
    return {
      itemId: item.id,
      currentWeight,
      suggestedWeight,
      adjustment: suggestedWeight - currentWeight,
    };
  }).filter(suggestion => Math.abs(suggestion.adjustment) > 0.01);
}
