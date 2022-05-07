// Glyph seller is accepting a pending buy offer

import BigNumber from 'bignumber.js'
import { countBy } from 'lodash'
import { Asset, Claimant, Operation } from 'stellar-base'

import { getRoyaltyAccounts, handleResponse } from '../../@js/utils'
import { smallest, wholeMinusSmallest, feeAccountClaimantPredicate, XLM } from '../../@js/vars'

// TODO

// DONE
// Close all pending sell offers for glyph

// Sell Glyph for Glyph
export async function sellItNowGlyphForGlyph({
  userAccount,
  baseAsset,
  counterAsset,
  ops,
}, {
  HORIZON_URL
}) {

  // TODO

  // Find the counterAsset seller account
  // Safe because there can only be one holder so regardless of how many open offers the asset has it will all be for the same seller account
  // Also safe because only a holder can open a sell offer for an asset (not true for /accounts filtered by asset where records can show empty trustlines)
  const sellerAccount = await fetch(`${HORIZON_URL}/offers?selling=${counterAsset.isNative() ? 'native' : `${counterAsset.code}:${counterAsset.issuer}`}&limit=1&order=desc`)
  .then(handleResponse)
  .then(({_embedded: {records}}) => records[0].seller)

  ops.push(
    // Open a trustline on the buyers account
    Operation.changeTrust({
      asset: counterAsset,
      limit: '1',
      source: userAccount
    }),

    // Clear any outstanding sell offers the baseAsset holder has
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    // Reenable baseAsset authorization
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: true,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    // Open counterAsset authorization
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: counterAsset,
      flags: {
        authorized: true,
        authorizedToMaintainLiabilities: false
      },
      source: counterAsset.issuer
    }),

    // Use a path payment to ensure the expected transfer action occurs
    Operation.pathPaymentStrictSend({
      sendAsset: baseAsset,
      sendAmount: '1',
      destination: userAccount,
      destAsset: counterAsset,
      destMin: smallest,
      source: userAccount
    }),

    // Clear any outstanding sell offers the current baseAsset holder has
    Operation.setTrustLineFlags({
      trustor: sellerAccount,
      asset: counterAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: false
      },
      source: counterAsset.issuer
    }),

    // Clawback leftover asset from the previous owners account
    Operation.clawback({
      asset: counterAsset,
      amount: wholeMinusSmallest,
      from: sellerAccount,
      source: counterAsset.issuer
    }),    

    // After the successful transfer we need to bump from smallest to whole
    Operation.payment({
      asset: counterAsset,
      amount: wholeMinusSmallest,
      destination: userAccount,
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
  )

  return ops
}

// Sell Glyph for something else
export async function sellItNowGlyphForX({
  balanceId,
  userAccount,
  ops,
}, env) {

  // TODO
  
  // DONE
  // Take the pending escrow royalty payment

  // CONSIDER
  // Don't require royalty payments to yourself
  // Use payments vs claimable balances for royalty payments if trustline is already open on receiver account (will save on sub entry fees)
  // Support path payments where I can accept a buy offer for an asset I hold through an asset I don't
    // Someone buying GLYPH for USDC, I should be able to sell that glyph for GLYPH <> USDC <> XLM

  const {
    FEE_PK,
    HORIZON_URL
  } = env

  const claimableBalance = await fetch(`${HORIZON_URL}/claimable_balances/${balanceId}`).then(handleResponse)

  const counterAccount = claimableBalance.sponsor
  
  let counterAsset

  if (claimableBalance.asset === 'native')
    counterAsset = XLM
  else {
    const [code, issuer] = claimableBalance.asset.split(':')
    counterAsset = new Asset(code, issuer)
  }
  
  const { destination: baseAssetIssuer } = claimableBalance.claimants.find(({destination}) => destination !== counterAccount)
  const baseAsset = new Asset('COLORGLYPH', baseAssetIssuer)
  const bigPrice = new BigNumber(claimableBalance.amount)

  const [
    baseAssetIssuerAccountLoaded, 
    royaltyAccounts
  ] = await getRoyaltyAccounts(baseAsset, env)

  ops.push(

    // Claim the escrow claimable balance into the baseAssetIssuer account
    Operation.claimClaimableBalance({
      balanceId,
      source: baseAssetIssuer
    }),
  )

  // Open trust for non-native counterAsset on userAccount
  if (claimableBalance.asset !== 'native') ops.push(
    Operation.changeTrust({
      asset: counterAsset,
      source: userAccount
    }),
  )

  ops.push(

    // Make a payment from baseAssetIssuer to userAccount for cb amount so userAccount can make the baseAsset sell for counterAsset
    Operation.payment({
      asset: counterAsset,
      amount: claimableBalance.amount,
      destination: userAccount,
      source: baseAssetIssuer
    }),
  )

  // Create claimable balance payments of 50% of the price per pixel color to the color sponsor account
  Object
  .entries(countBy(royaltyAccounts))
  .forEach(([account, count]) => ops.push(
    Operation.createClaimableBalance({
      asset: counterAsset,
      amount: bigPrice.times(0.5).times(count).div(256).toFixed(7), // e.g. 10 * 0.5 * 128 / 256 = 2.5
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
      amount: bigPrice.times(0.1).toFixed(7), // 10% og minter royalty 
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

    // Clear any outstanding sell offers the current holder has
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    // Re-open asset authorization for userAccount
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: true,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    // Open asset authorization for counterAccount
    Operation.setTrustLineFlags({
      trustor: counterAccount,
      asset: baseAsset,
      flags: {
        authorized: true,
        authorizedToMaintainLiabilities: false
      },
      source: baseAsset.issuer
    }),

    // Send glyph to counterAccount
    Operation.payment({
      asset: baseAsset,
      amount: '1',
      destination: counterAccount,
      source: userAccount
    }),

    // Close asset authorization for userAccount
    Operation.setTrustLineFlags({
      trustor: userAccount,
      asset: baseAsset,
      flags: {
        authorized: false,
        authorizedToMaintainLiabilities: true
      },
      source: baseAsset.issuer
    }),

    // Close asset authorization for counterAccount
    Operation.setTrustLineFlags({
      trustor: counterAccount,
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