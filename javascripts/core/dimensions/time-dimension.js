"use strict";

function buyTimeDimension(tier) {

  const dim = TimeDimension(tier);
  if (tier > 4 && !TimeStudy.timeDimension(tier).isBought) return false;
  if (player.eternityPoints.lt(dim.cost)) return false;
  if (Enslaved.isRunning && dim.bought > 0) return false;

  player.eternityPoints = player.eternityPoints.minus(dim.cost);
  dim.amount = dim.amount.plus(1);
  dim.bought += 1;
  dim.cost = dim.nextCost(dim.bought);
  return true;
}

function resetTimeDimensions() {
  for (const dim of TimeDimensions.all) dim.amount = new Decimal(dim.bought);
}

function fullResetTimeDimensions() {
  for (const dim of TimeDimensions.all) {
    dim.cost = new Decimal(dim.baseCost);
    dim.amount = new Decimal(0);
    dim.bought = 0;
  }
}

function toggleAllTimeDims() {
  const areEnabled = player.reality.tdbuyers[0];
  for (let i = 1; i < 9; i++) {
    player.reality.tdbuyers[i - 1] = !areEnabled;
  }
}

function buyMaxTimeDimTier(tier) {
  const dim = TimeDimension(tier);
  if (tier > 4 && !TimeStudy.timeDimension(tier).isBought) return false;
  if (Enslaved.isRunning) return buyTimeDimension(tier);
  const bulk = bulkBuyBinarySearch(player.eternityPoints, {
    costFunction: bought => dim.nextCost(bought),
    cumulative: true,
    firstCost: dim.cost,
  }, dim.bought);
  if (!bulk) return false;
  player.eternityPoints = player.eternityPoints.minus(bulk.purchasePrice);
  dim.amount = dim.amount.plus(bulk.quantity);
  dim.bought += bulk.quantity;
  dim.cost = dim.nextCost(dim.bought);
  return true;
}

function buyMaxTimeDimensions() {
  // Default behavior: Buy as many as possible, starting with the highest dimension first
  // (reduces overhead at higher EP)
  if (player.eternityPoints.gte(1e10)) {
    for (let i = 8; i > 0; i--) buyMaxTimeDimTier(i);
  } else {
    // Low EP behavior: Try to buy the highest affordable new dimension, then loop buying the cheapest possible
    for (let i = 4; i > 0 && TimeDimension(i).bought === 0; i--)
      buyTimeDimension(i);

    // Should never take more than like 50 iterations; explicit infinite loops make me nervous
    for (let stop = 0; stop < 1000; stop++) {
      let cheapestDim = 1;
      let cheapestCost = TimeDimension(1).cost;
      for (let i = 2; i <= 4; i++) {
        if (TimeDimension(i).cost.lte(cheapestCost)) {
          cheapestDim = i;
          cheapestCost = TimeDimension(i).cost;
        }
      }
      let bought = false;
      if (player.eternityPoints.gte(cheapestCost))
        bought = buyTimeDimension(cheapestDim);
      if (!bought)
        break;
    }
  }
}

function timeDimensionCommonMultiplier() {
  let mult = new Decimal(kongAllDimMult)
    .timesEffectsOf(
      Achievement(105),
      Achievement(128),
      TimeStudy(93),
      TimeStudy(103),
      TimeStudy(151),
      TimeStudy(221),
      TriadStudy(1),
      EternityChallenge(1).reward,
      EternityChallenge(10).reward,
      EternityUpgrade.tdMultAchs,
      EternityUpgrade.tdMultTheorems,
      EternityUpgrade.tdMultRealTime,
      player.replicanti.unl && player.replicanti.amount.gt(1) ? DilationUpgrade.tdMultReplicanti : null,
      RealityUpgrade(22),
      AlchemyResource.dimensionality
    );
  if (EternityChallenge(9).isRunning) {
    mult = mult.times(
      Decimal.pow(
        Math.clampMin(player.infinityPower.pow(getInfinityConversionRate() / 7).log2(), 1),
        4)
      .clampMin(1));
  }
  return mult;
}

class TimeDimensionState extends DimensionState {
  constructor(tier) {
    super(() => player.dimensions.time, tier);
    const BASE_COSTS = [null, 1, 5, 100, 1000, "1e2350", "1e2650", "1e3000", "1e3350"];
    this._baseCost = new Decimal(BASE_COSTS[tier]);
    const COST_MULTS = [null, 3, 9, 27, 81, 24300, 72900, 218700, 656100];
    this._costMultiplier = COST_MULTS[tier];
    const E6000_SCALING_AMOUNTS = [null, 7322, 4627, 3382, 2665, 833, 689, 562, 456];
    this._e6000ScalingAmount = E6000_SCALING_AMOUNTS[tier];
    const COST_THRESHOLDS = [Decimal.NUMBER_MAX_VALUE, "1e1300", "1e6000"];
    this._costIncreaseThresholds = COST_THRESHOLDS;
  }

  /** @returns {Decimal} */
  get cost() { return this.data.cost; }
  /** @param {Decimal} value */
  set cost(value) { this.data.cost = value; }

  nextCost(bought) {
    if (this._tier > 4 && bought < this.e6000ScalingAmount) {
      return Decimal.pow(this.costMultiplier, bought).times(this.baseCost);
    }

    const costMultIncreases = [1, 1.5, 2.2];
    for (let i = 0; i < this._costIncreaseThresholds.length; i++) {
      const cost = Decimal.pow(this.costMultiplier * costMultIncreases[i], bought).times(this.baseCost);
      if (cost.lt(this._costIncreaseThresholds[i])) return cost;
    }

    let base = this.costMultiplier;
    if (this._tier <= 4) base *= 2.2;
    const exponent = this.e6000ScalingAmount + (bought - this.e6000ScalingAmount) * TimeDimensions.scalingPast1e6000;
    return Decimal.pow(base, exponent).times(this.baseCost);
  }

  get isUnlocked() {
    return this._tier < 5 || TimeStudy.timeDimension(this._tier).isBought;
  }

  get isAffordable() {
    return player.eternityPoints.gte(this.cost);
  }

  get multiplier() {
    const tier = this._tier;

    if (EternityChallenge(11).isRunning) return new Decimal(1);
    let mult = GameCache.timeDimensionCommonMultiplier.value
      .timesEffectsOf(
        tier === 1 ? TimeStudy(11) : null,
        tier === 3 ? TimeStudy(73) : null,
        tier === 4 ? TimeStudy(227) : null
      );

    const dim = TimeDimension(tier);
    mult = mult.times(Decimal.pow(dim.powerMultiplier, dim.bought));
    mult = mult.clampMin(0).pow(getAdjustedGlyphEffect("timepow"));

    if (Laitela.has(LAITELA_UNLOCKS.DIM_POW)) mult = mult.pow(Laitela.dimensionMultPowerEffect);

    mult = mult.pow(getAdjustedGlyphEffect("effarigdimensions"));

    mult = mult.pow(getAdjustedGlyphEffect("curseddimensions"));

    mult = mult.powEffectOf(AlchemyResource.time);

    if (player.dilation.active) {
      mult = dilatedValueOf(mult);
    }

    if (Effarig.isRunning) {
      mult = Effarig.multiplier(mult);
    } else if (V.isRunning) {
      mult = mult.pow(0.5);
    } else if (Laitela.isRunning) {
      mult = mult.pow(Laitela.dimMultNerf);
    }

    return mult;
  }

  get productionPerSecond() {
    if (EternityChallenge(1).isRunning || EternityChallenge(10).isRunning || TimeCompression.isActive) {
      return new Decimal(0);
    }

    if (EternityChallenge(11).isRunning) {
      return this.amount;
    }
    let production = this.amount.times(this.multiplier);
    if (EternityChallenge(7).isRunning) {
      production = production.dividedBy(Tickspeed.current.dividedBy(1000));
    }
    return production;
  }

  get rateOfChange() {
    const tier = this._tier;
    if (tier === 8) {
      return new Decimal(0);
    }
    const toGain = TimeDimension(tier + 1).productionPerSecond;
    const current = Decimal.max(this.amount, 1);
    return toGain.times(10).dividedBy(current).times(getGameSpeedupForDisplay());
  }

  get baseCost() {
    return this._baseCost;
  }

  get costMultiplier() {
    return this._costMultiplier;
  }

  get powerMultiplier() {
    return new Decimal(4).timesEffectsOf(this._tier === 8 ? GlyphSacrifice.time : null);
  }

  get e6000ScalingAmount() {
    return this._e6000ScalingAmount;
  }

  get costIncreaseThresholds() {
    return this._costIncreaseThresholds;
  }
}

/**
 * @function
 * @param {number} tier
 * @return {TimeDimensionState}
 */
const TimeDimension = TimeDimensionState.createAccessor();

const TimeDimensions = {
  /**
   * @type {TimeDimensionState[]}
   */
  all: TimeDimension.index.compact(),

  get scalingPast1e6000() {
    return 4;
  },

  tick(diff) {
    for (let tier = 8; tier > 1; tier--) {
      TimeDimension(tier).produceDimensions(TimeDimension(tier - 1), diff / 10);
    }

    if (EternityChallenge(7).isRunning) {
      TimeDimension(1).produceDimensions(InfinityDimension(8), diff);
    } else {
      TimeDimension(1).produceCurrency(Currency.timeShards, diff);
    }

    EternityChallenge(7).reward.applyEffect(production => {
      InfinityDimension(8).amount = InfinityDimension(8).amount.plus(production.times(diff / 10));
    });
  }
};
