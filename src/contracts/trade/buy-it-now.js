// Glyph buyer is accepting a pending sell offer

import { Operation, Claimant } from 'stellar-base'
import { countBy } from 'lodash'

import { handleResponse, getColorSponsorAccounts } from '../../@js/utils'
import { smallest, wholeMinusSmallest, feeAccountClaimantPredicate } from '../../@js/vars'

// TODO

// DONE
// Close all pending sell offers for glyph

// Buy Glyph with Glyph
export async function buyItNowGlyphForGlyph({
  userAccount,
  baseAsset,
  counterAsset,
  ops,
}, {
  HORIZON_URL,
}) {

  // TODO

  // Find the baseAsset seller account
  // Safe because there can only be one holder so regardless of how many open offers the asset has it will all be for the same seller account
  // Also safe because only a holder can open a sell offer for an asset (not true for /accounts filtered by asset where records can show empty trustlines)
  const sellerAccount = await fetch(`${HORIZON_URL}/offers?selling=${baseAsset.code}:${baseAsset.issuer}&limit=1&order=desc`)
  .then(handleResponse)
  .then(({_embedded: {records}}) => records[0].seller)

  ops.push(
    // Open a trustline on the buyers account
    Operation.changeTrust({
      asset: baseAsset,
      limit: '1',
      source: userAccount
    }),

    // Clear any outstanding sell offers the counterAsset holder has
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: counterAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: false
      },
      source: counterAsset.issuer
    }),

    // Reenable counterAsset authorization
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: counterAsset,
      flags: {
        authorized: true,
        authorizedToMaintainLiabilities: false
      },
      source: counterAsset.issuer
    }),

    // Open asset authorization for baseAsset
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: true,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    // Use a path payment to ensure the expected transfer action occurs
    Operation.pathPaymentStrictSend({
      sendAsset: counterAsset,
      sendAmount: '1',
      destination: userAccount,
      destAsset: baseAsset,
      destMin: smallest,
      source: userAccount
    }),

    // Clear any outstanding sell offers the current baseAsset holder has
    Operation.setTrustLineFlags({
      trustor: sellerAccount,
      asset: baseAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    // Clawback leftover asset from the previous owners account
    Operation.clawback({
      asset: baseAsset,
      amount: wholeMinusSmallest,
      from: sellerAccount,
      source: baseAsset.issuer
    }),    

    // After the successful transfer we need to bump from smallest to whole
    Operation.payment({
      asset: baseAsset,
      amount: wholeMinusSmallest,
      destination: userAccount,
      source: baseAsset.issuer
    }),

    // Close counterAsset authorization
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: counterAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: true
      },
      source: counterAsset.issuer
    }),

    // Close baseAsset authorization
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

// Buy Glyph with something else
export async function buyItNowGlyphForX({
  userAccount,
  baseAsset,
  counterAsset,
  bigPrice,
  ops,
}, env) {

  // TODO
  
  // DONE
  // Build and execute a royalty payment "inline"

  // CONSIDER
  // Don't require royalty payments to yourself
  // Use payments vs claimable balances if trustline is already open on receiver account (will save on sub entry fees)
  // Support path payments where I can accept a sell offer for an asset I don't hold through an asset I do
    // Someone selling GLYPH for USDC, I should be able to buy that glyph with XLM <> USDC <> GLYPH

  const {
    HORIZON_URL,
    FEE_PK,
  } = env

  // Find the baseAsset seller account
  // Safe because there can only be one holder so regardless of how many open offers the asset has it will all be for the same seller account
  // Also safe because only a holder can open a sell offer for an asset (not true for /accounts filtered by asset where records can show empty trustlines)
  const sellerAccount = await fetch(`${HORIZON_URL}/offers?selling=${baseAsset.code}:${baseAsset.issuer}&limit=1&order=desc`)
  .then(handleResponse)
  .then(({_embedded: {records}}) => records[0].seller)

  const [
    baseAssetIssuerAccountLoaded, 
    colorSponsorAccounts
  ] = await getColorSponsorAccounts(baseAsset, env)

  const basePrice = bigPrice.div(1.6)

  // Create claimable balance payments of 50% of the price per pixel color to the color sponsor account
  Object
  .entries(countBy(colorSponsorAccounts))
  .forEach(([account, count]) => ops.push(
    Operation.createClaimableBalance({
      asset: counterAsset,
      amount: basePrice.times(0.5).times(count).div(256).toFixed(7), // e.g. 10 * 0.5 * 128 / 256 = 2.5
      claimants: [
        new Claimant(
          account,
          Claimant.predicateUnconditional()
        ),
        new Claimant( // Reclaimable by FEE_PK in 336 days (28 * 12 days)
          FEE_PK,
          feeAccountClaimantPredicate
        )
      ],
      source: userAccount
    })
  ))

  ops.push(
    
    // Create a claimable balance payment of 10% of the price to the og minter
    Operation.createClaimableBalance({
      asset: counterAsset,
      amount: basePrice.times(0.1).toFixed(7), // 10% og minter royalty 
      claimants: [
        new Claimant(
          baseAssetIssuerAccountLoaded.inflation_destination || FEE_PK,
          Claimant.predicateUnconditional()
        ),
        new Claimant( // reclaimable by FEE_PK in 336 days (28 * 12 days)
          FEE_PK,
          feeAccountClaimantPredicate
        )
      ],
      source: userAccount
    }),

    // Open a trustline on the buyers account
    Operation.changeTrust({
      asset: baseAsset,
      limit: '1',
      source: userAccount
    }),

    // Open asset authorization
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: true,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    // Use a path payment to ensure the expected transfer action occurs
    Operation.pathPaymentStrictSend({
      sendAsset: counterAsset,
      sendAmount: basePrice.toFixed(7),
      destination: userAccount,
      destAsset: baseAsset,
      destMin: smallest,
      source: userAccount
    }),

    // Clear any outstanding sell offers the current holder has
    Operation.setTrustLineFlags({
      trustor: sellerAccount,
      asset: baseAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    // Clawback leftover asset from the previous owners account
    Operation.clawback({
      asset: baseAsset,
      amount: wholeMinusSmallest,
      from: sellerAccount,
      source: baseAsset.issuer
    }),    

    // After the successful transfer we need to bump from smallest to whole
    Operation.payment({
      asset: baseAsset,
      amount: wholeMinusSmallest,
      destination: userAccount,
      source: baseAsset.issuer
    }),

    // Close asset authorization
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