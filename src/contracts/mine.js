import BigNumber from 'bignumber.js'
import {
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
  Account,
} from 'stellar-base'
import { countBy } from 'lodash'

import { handleResponse } from '../@js/utils'
import { XLM } from '../@js/vars'

// WARN
// All colors cost the same atm
// All colors are available

export default async ({
  userAccount,
  paletteSecret,
  paletteAccount,
  palette: ogPalette = []
}, { 
  STELLAR_NETWORK,
  HORIZON_URL,
  COLOR_SK,
  COLOR_ISSUER_PK, 
  FEE_PK,
}) => {
  ogPalette = ogPalette.map((hex) => hex
    .substring(0, 6) // royaltyIndex codes can have valid capital letters
    .toLowerCase()
    .replace(/\W/gi, '')
    + hex.substring(6)
  )

  let paletteKeypair

  if (
    !paletteAccount
    && paletteSecret
  ) {
    paletteKeypair = Keypair.fromSecret(paletteSecret)
    paletteAccount = paletteKeypair.publicKey()
  }

  return fetch(`${HORIZON_URL}/accounts/${userAccount}`)
  .then(handleResponse)
  .then((account) => {
    const ops = []
    const signers = []
    const royaltyIndex = account.data.royaltyindex ? Buffer.from(account.data.royaltyindex, 'base64') : -1

    if (parseInt(royaltyIndex) < 0)
      throw new Error(`Missing a valid royaltyindex`)

    const palette = sanitizePalette(ogPalette, royaltyIndex)
    const paletteCounts = Object.entries(countBy(palette))

    if (paletteAccount) {

      if (paletteKeypair) { // Create new paletteAccount
        signers.push(paletteKeypair)

        ops.push(
          Operation.createAccount({ // Create a new paletteAccount
            destination: paletteAccount,
            startingBalance: '1',
            source: userAccount
          }),

          Operation.beginSponsoringFutureReserves({ // The userAccount will sponsor the paletteAccount
            sponsoredId: paletteAccount,
            source: userAccount
          }),

          Operation.setOptions({ // Set some options on the paletteAccount
            masterWeight: 0, // Remove the master signer
            signer: {
              ed25519PublicKey: userAccount, // Add the userAccount as the primary signer
              weight: 1
            },
            source: paletteAccount
          }),
        )
      }

      else ops.push( // Reuse existing paletteAccount
        Operation.beginSponsoringFutureReserves({ // The userAccount will sponsor the paletteAccount
          sponsoredId: paletteAccount,
          source: userAccount
        }),
      )
    }

    if (paletteCounts.length) {
      signers.push(Keypair.fromSecret(COLOR_SK))

      paletteCounts.forEach(([asset_code, count]) => {
        const COLOR = new Asset(asset_code, COLOR_ISSUER_PK)

        ops.push(
          Operation.changeTrust({
            asset: COLOR,
            limit: new BigNumber(256).div(10000000).toFixed(7),
            source: paletteAccount
          }),
          Operation.payment({
            destination: paletteAccount,
            amount: new BigNumber(count).div(10000000).toFixed(7),
            asset: COLOR,
            source: COLOR_ISSUER_PK
          }),
        )
      })

      ops.push(
        Operation.endSponsoringFutureReserves({ // Close sponsorship
          source: paletteAccount
        }),

        Operation.payment({ // Pay the FEE_PK for all these fresh mints
          asset: XLM,
          amount: new BigNumber(palette.length).times(0.1).toFixed(7),
          destination: FEE_PK,
          source: userAccount
        }),
      )
    }

    let transaction = new TransactionBuilder(
      new Account(account.id, account.sequence), 
      {
        fee: new BigNumber(1).div('0.0000001').div(ops.length).toFixed(0, 3), // 1 XLM div # of ops
        networkPassphrase: Networks[STELLAR_NETWORK]
      }
    ).setTimeout(0)

    ops.forEach((op) => transaction.addOperation(op))

    transaction = transaction.build()

    if (signers.length)
      transaction.sign(...signers)

    return transaction.toXDR()
  })
}

function sanitizePalette(palette, index) {
  return palette.map((hex) => {
    if (hex.length !== 6)
      throw new Error(`${hex} isn't a valid hex color code`)

    return `${hex}${index}`
  })
}