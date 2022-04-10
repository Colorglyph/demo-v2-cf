import BigNumber from 'bignumber.js'
import {
  Asset,
  Claimant,
} from 'stellar-base'

export const smallest = '0.01'
export const wholeDivSmallest = new BigNumber(1).div(smallest).toFixed(7)
export const wholeMinusSmallest = new BigNumber(1).minus(smallest).toFixed(7)
export const XLM = Asset.native()

export const feeAccountClaimantPredicate = Claimant.predicateNot(
  Claimant.predicateBeforeRelativeTime(
    new BigNumber(60).times(60).times(24).times(336).toFixed(0, 3)
  )
)