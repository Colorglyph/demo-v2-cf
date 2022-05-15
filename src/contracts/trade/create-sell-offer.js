// Glyph seller is offering to sell for something specific

import { Operation } from 'stellar-base'

import { smallest, wholeDivSmallest } from '../../@js/vars'

// TODO

// DONE
// Support offering to sell the same glyph multiple times for different counter assets (I want to sell my glyph A for either B, C or D)

// Create an offer to sell a Glyph for a Glyph  
export async function sellGlyphForGlyph({
  userAccount,
  baseAsset,
  counterAsset,
  ops,
}) {

  // TODO

  // CONSIDER
  // Support an option to sell 1 base glyph for 1 of many counter glyphs

  ops.push(
    // Open a trustline for the counterAsset on the sellers account
    Operation.changeTrust({
      asset: counterAsset,
      limit: '1',
      source: userAccount
    }),

    // Open permission to open an offer for the counterAsset
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: counterAsset,
      flags: {
        authorized: true,
        authorizedToMaintainLiabilities: false
      },
      source: counterAsset.issuer
    }),

    // Open permission to open an offer for the baseAsset
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: true,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    // Configure a sell offer for the counterAsset for the baseAsset
    Operation.manageSellOffer({
      selling: baseAsset,
      buying: counterAsset,
      amount: smallest,
      price: wholeDivSmallest,
      source: userAccount
    }),

    // Limit authorization to just maintaining liabilities for counterAsset
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: counterAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: true
      },
      source: counterAsset.issuer
    }),

    // Limit authorization to just maintaining liabilities for baseAsset
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: true
      },
      source: baseAsset.issuer
    }),
  )

  return ops
}

// Create an offer to sell a Glyph for something else
export async function sellGlyphForX({
  offerId = 0,
  userAccount,
  baseAsset,
  counterAsset,
  bigPrice,
  ops,
}) {
  
  // TODO

  ops.push(
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: true,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    Operation.manageSellOffer({
      offerId,
      selling: baseAsset,
      buying: counterAsset,
      amount: smallest, // By selling the smallest we permit 100 open offers for this asset and a max counter price of 21,474,836.47
      price: bigPrice.div(smallest).toFixed(7), // base + royalty
      source: userAccount
    }),

    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: true
      },
      source: baseAsset.issuer
    }),
  )

  return ops
}