import BigNumber from 'bignumber.js'
import {
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
  Account
} from 'stellar-base'

import { handleResponse } from '../@js/utils'
import { feeAccount, glyphSigner, XLM } from '../@js/vars'

// WARN
// What happens if you try and scrape with an open sell offer? Fails, you don't have an available COLORGLYPH to burn
// No open sell offers before scraping

// TODO
// Ensure issuer account is actually an issuer of an official COLORGLYPH asset
// Lots of accounts can have sponsors, but only COLORGLYPH assets with sponsored accounts are legit
// userAccount holds a COLORGLYPH asset issued by issuerAccount

export default async ({
  userAccount,
  issuerAccount,
}, {
  STELLAR_NETWORK,
  HORIZON_URL,
  GLYPH_SK
}) => {
  const COLORGLYPH = new Asset('COLORGLYPH', issuerAccount)

  const userAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${userAccount}`).then(handleResponse)

  if (!userAccountLoaded.balances.find(({ asset_code, asset_issuer }) =>
    asset_code === COLORGLYPH.code
    && asset_issuer === COLORGLYPH.issuer
  )) throw new Error(`${userAccount} does not hold COLORGLYPH:${issuerAccount}`)

  return fetch(`${HORIZON_URL}/accounts/${issuerAccount}`)
  .then(handleResponse)
  .then(async (account) => {
    const ops = []
    const paletteAccount = account.sponsor

    if (!paletteAccount)
      throw new Error(`COLORGLYPH:${issuerAccount} is not able to be scraped`)

    ops.push(
      Operation.setTrustLineFlags({ // Open NFT authorization
        asset: COLORGLYPH,
        trustor: userAccount,
        flags: {
          authorized: true,
          authorizedToMaintainLiabilities: false
        },
        source: issuerAccount
      }),

      Operation.payment({ // Burn NFT back to issuing account
        asset: COLORGLYPH,
        amount: '1',
        destination: issuerAccount,
        source: userAccount
      }),

      Operation.setTrustLineFlags({
        asset: COLORGLYPH,
        trustor: userAccount,
        flags: {
          authorized: false,
          authorizedToMaintainLiabilities: true
        },
        source: issuerAccount
      }),

      Operation.setOptions({ // Remove glyphSigner from the paletteAccount
        signer: {
          ed25519PublicKey: glyphSigner,
          weight: 0
        },
        source: paletteAccount
      }),

      Operation.beginSponsoringFutureReserves({ // The userAccount will sponsor the signer on the paletteAccount
        sponsoredId: paletteAccount,
        source: userAccount
      }),

      Operation.setOptions({ // Add userAccount as a signer on the paletteAccount
        signer: {
          ed25519PublicKey: userAccount,
          weight: 1
        },
        source: paletteAccount
      }),

      Operation.endSponsoringFutureReserves({ // Close sponsorship
        source: paletteAccount
      }),

      Operation.payment({
        asset: XLM,
        destination: issuerAccount,
        amount: '1',
        source: userAccount
      }),

      Operation.payment({
        asset: XLM,
        destination: paletteAccount,
        amount: '1',
        source: userAccount
      }),

      Operation.revokeAccountSponsorship({
        account: paletteAccount,
        source: issuerAccount
      }),

      Operation.revokeAccountSponsorship({
        account: issuerAccount,
        source: paletteAccount
      }),

      Operation.payment({
        asset: XLM,
        destination: userAccount,
        amount: '1',
        source: issuerAccount
      }),

      Operation.payment({
        asset: XLM,
        destination: userAccount,
        amount: '1',
        source: paletteAccount
      }),

      Operation.payment({ // Make a payment of 5 XLM to the feeAccount
        asset: XLM,
        amount: '5',
        destination: feeAccount,
        source: userAccount
      }),
    )

    let transaction = new TransactionBuilder(
      new Account(userAccountLoaded.id, userAccountLoaded.sequence), 
      {
        fee: new BigNumber(1).div('0.0000001').div(ops.length).toFixed(0, 3), // 1 XLM div # of ops
        networkPassphrase: Networks[STELLAR_NETWORK]
      }
    ).setTimeout(0)

    ops.forEach((op) => transaction.addOperation(op))

    transaction = transaction.build()

    transaction.sign(Keypair.fromSecret(GLYPH_SK))

    return transaction.toXDR()
  })
}