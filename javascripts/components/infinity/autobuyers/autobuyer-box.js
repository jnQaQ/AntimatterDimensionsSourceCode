"use strict";

Vue.component("autobuyer-box", {
  components: {
    "interval-label": {
      props: {
        autobuyer: Object
      },
      data() {
        return {
          interval: 0,
          hasMaxedInterval: false,
          bulk: 0,
          bulkUnlocked: false,
          bulkUnlimited: false,
        };
      },
      computed: {
        // Rounds UP to the nearest 0.01 so that eg. 0.103 doesn't display as 0.10, appearing maxed when it isn't
        intervalDisplay() {
          const sec = TimeSpan.fromMilliseconds(this.interval).totalSeconds;
          return format(Math.ceil(100 * sec) / 100, 2, 2);
        }
      },
      methods: {
        update() {
          this.interval = this.autobuyer.interval;
          this.hasMaxedInterval = this.autobuyer.hasMaxedInterval;
          this.bulk = this.autobuyer.bulk;
          // If it's undefined, the autobuyer isn't the dimboost autobuyer
          // and we don't have to worry about bulk being unlocked.
          this.bulkUnlocked = this.autobuyer.isBulkBuyUnlocked !== false;
          this.bulkUnlimited = this.autobuyer.hasUnlimitedBulk;
        }
      },
      template: `
        <div class="c-autobuyer-box__small-text">
          Current interval: {{ intervalDisplay }} seconds
          <span v-if="hasMaxedInterval && bulkUnlocked && bulk">
            <br>Current bulk: {{ bulkUnlimited ? "Unlimited" : formatX(bulk, 2) }}
          </span>
        </div>`
    }
  },
  props: {
    autobuyer: Object,
    name: String,
    showInterval: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isUnlocked: false,
      isActive: false,
      globalToggle: false,
      canBeBought: false,
      isUnlockable: false,
      antimatterCost: new Decimal(0),
      isBought: false,
      antimatter: new Decimal(0)
    };
  },
  watch: {
    isActive(newValue) {
      this.autobuyer.isActive = newValue;
    }
  },
  computed: {
    autobuyerBuyBoxClass() {
      return {
        "c-autobuyer-buy-box": true,
        "o-primary-btn": true,
        "o-primary-btn--enabled": this.isUnlockable,
        "o-primary-btn--disabled": !this.isUnlockable
      };
    },
    autobuyerToggleClass() {
      return this.isActive ? "fas fa-check" : "fas fa-times";
    },
    autobuyerStateClass() {
      return {
        "o-autobuyer-toggle-checkbox__label": true,
        "o-autobuyer-toggle-checkbox__label--active": this.isActive,
        "o-autobuyer-toggle-checkbox__label--disabled": !this.globalToggle
      };
    },
    showEternity() {
      return PlayerProgress.eternityUnlocked()
        ? "this Eternity"
        : "";
    }
  },
  methods: {
    update() {
      const autobuyer = this.autobuyer;
      this.isUnlocked = autobuyer.isUnlocked;
      this.isActive = autobuyer.isActive;
      this.globalToggle = player.auto.autobuyersOn;
      this.canBeBought = autobuyer.canBeBought;
      this.isUnlockable = autobuyer.canUnlockSlowVersion;
      this.antimatterCost = autobuyer.antimatterCost;
      this.isBought = autobuyer.isBought;
      this.antimatter.copyFrom(player.records.thisEternity.maxAM);
    },
    toggle() {
      this.isActive = !this.isActive;
    },
    purchase() {
      this.autobuyer.purchase();
    }
  },
  template: `
    <div v-if="isUnlocked || isBought" class="c-autobuyer-box-row">
      <div class="l-autobuyer-box__header">
        {{ name }}
        <interval-label v-if="showInterval" :autobuyer="autobuyer" />
      </div>
      <div class="c-autobuyer-box-row__intervalSlot"><slot name="intervalSlot" /></div>
      <div class="c-autobuyer-box-row__toggleSlot"><slot name="toggleSlot" /></div>
      <div class="c-autobuyer-box-row__prioritySlot"><slot name="prioritySlot" /></div>
      <div class="c-autobuyer-box-row__optionSlot"><slot name="optionSlot" /></div>
      <div class="l-autobuyer-box__footer" @click="toggle">
        <label
          :for="name"
          :class="autobuyerStateClass"
        >
          <span :class="autobuyerToggleClass"></span>
        </label>
        <input
          :checked="isActive && globalToggle"
          :disabled="!globalToggle"
          :name="name"
          type="checkbox"
        />
      </div>
    </div>
    <div v-else-if="canBeBought" @click="purchase" :class="autobuyerBuyBoxClass">
      {{ name }}
      <br>
      Requirement: {{ format(antimatterCost) }} Total Antimatter {{ showEternity }}
    </div>`
});
