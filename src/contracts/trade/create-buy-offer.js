// Glyph buyer is offering to buy with something specific

import BigNumber from 'bignumber.js'
import {
  Claimant,
  Operation,
} from 'stellar-base'

import {
  smallest,
} from '../../@js/vars'

// TODO

// Create an offer to buy a Glyph with a Glyph
export async function buyGlyphForGlyph({
  userAccount,
  baseAsset,
  counterAsset,
  ops,
}) {
  
  // TODO

  // DONE
  // Support opening multiple different offers with the same counter glyph

  // CONSIDER
  // Support an option buy 1 base glyph with 1 of many counter glyphs

  ops.push(
    // Open a trustline for the baseAsset on the sellers account
    Operation.changeTrust({
      asset: baseAsset,
      limit: '1',
      source: userAccount
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

    // Configure a sell offer for the counterAsset for the baseAsset
    Operation.manageBuyOffer({
      selling: counterAsset,
      buying: baseAsset,
      buyAmount: '1',
      price: smallest,
      source: userAccount
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
  )

  return ops
}

// Create an offer to buy a Glyph with something else
export async function buyGlyphForX({
  userAccount,
  baseAsset,
  counterAsset,
  bigPrice,
  ops,
}) {

  // TODO
  // This function is not signed for by the service account so this is essentially just a utility function and should likely be moved out to the client

  // DONE
  // Configure an escrowed royalty payment

  const escrowAmount = new BigNumber(bigPrice).times(1.6) // original bigPrice + 10% glyph royalty + 50% color royalty

  // Not using classic offers as it's unintuitive to discover what offer was taken to know how much royalty you owe in the middle of the atomic transaction
  // Offer matching always takes the best baseAsset price so while you offer to sell your baseAsset for 100 XLM if an offer exists for 110 XLM the matching engine will actually take that offer 
    // meaning you owe off 110 not the 100 you input
    // what might work though is that by using path payments you could match on the 110 XLM but only take 100 leaving it partially filled, then you close the taken offer
    // unfortunately though I don't think it's possible to know what offer is being taken in the middle of the atomic offer to know what partial offer you need to kill

  ops.push(

    // Open a trustline for baseAsset on the userAccount
    Operation.changeTrust({
      asset: baseAsset,
      source: userAccount
    }),

    // Create a claimable balance payment of 10% of the price to the og minter
    // Using claimable balances vs offers since offers pose a price order problem making it really difficult to select specific offers and thus escrowed royalties to claim
      // Note though that this does break using the /trades endpoint for discovery for the Create-Buy-Offer <> Sell-It-Now flow as the Sell-It-Now side transfers the glyph via a payment
        // We could require both a claimable balance and a sort of dummy proxy offer from the user account but until we're sure we need the /trade trick it's cheaper and easier to only use the cb
    Operation.createClaimableBalance({
      asset: counterAsset,
      amount: escrowAmount.toFixed(7),
      claimants: [
        new Claimant(
          // Who we'll send the baseAsset to should this offer be taken
          userAccount,
          Claimant.predicateUnconditional()
        ),
        new Claimant(
          // baseAsset issuer to allow for cb discovery from baseAsset
          baseAsset.issuer,
          Claimant.predicateUnconditional()
        ),
      ],
      source: userAccount
    }),
  )

  return ops
}