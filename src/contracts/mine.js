import BigNumber from 'bignumber.js'
import {
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
  Account,
} from 'stellar-base'
import shajs from 'sha.js'
import { countBy } from 'lodash'

import { handleResponse } from '../@js/utils'
import { colorIssuer, feeAccount, glyphSponsor, XLM } from '../@js/vars'

// TODO
// Ensure royalty payments will be going to a created account (should we also ensure if it's an existing account that it's the userAccounts?)
  // Probably not

// CONCERNS
// All colors cost the same atm
// All colors are available

export default async ({
  userAccount,
  paletteSecret,
  paletteAccount,
  palette: ogPalette = [],
  colorSponsorIndex
}, { 
  STELLAR_NETWORK,
  HORIZON_URL,
  COLOR_SK,
}) => {
  if (parseInt(base62.decode(colorSponsorIndex)) > (62 ** 6 - 1))
    throw new Error(`colorSponsorIndex out or range`)

  ogPalette = ogPalette.map((hex) => hex
    .substring(0, 6) // colorSponsorIndex codes can have valid capital letters
    .toLowerCase()
    .replace(/\W/gi, '')
    + hex.substring(6)
  )

  let paletteKeypair

  const palette = sanitizePalette(ogPalette, colorSponsorIndex)
  const paletteCounts = Object.entries(countBy(palette))

  if (
    !paletteAccount
    && paletteSecret
  ) {
    paletteKeypair = Keypair.fromSecret(paletteSecret)
    paletteAccount = paletteKeypair.publicKey()
  }

  const colorSponsorHash = shajs('sha256').update(glyphSponsor).update(colorSponsorIndex).digest()
  const colorSponsorKeypair = Keypair.fromRawEd25519Seed(colorSponsorHash)
  const colorSponsorAccount = colorSponsorKeypair.publicKey()
  const colorSponsorAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${colorSponsorAccount}`)
  .then(handleResponse)
  .catch((err) => {
    if (err?.status === 404)
      return null
    throw err
  })

  return fetch(`${HORIZON_URL}/accounts/${userAccount}`)
  .then(handleResponse)
  .then((account) => {
    const ops = []
    const signers = []

    if (
      colorSponsorAccountLoaded
      && colorSponsorAccountLoaded.sponsor !== userAccount
    ) throw new Error(`Cannot mine colors from an account you do not sponsor`)

    if (!colorSponsorAccountLoaded) {
      signers.push(colorSponsorKeypair)

      ops.push(
        Operation.beginSponsoringFutureReserves({ // The userAccount will sponsor the colorSponsorAccount
          sponsoredId: colorSponsorAccount,
          source: userAccount
        }),

        Operation.createAccount({ // Create a new colorSponsorAccount
          destination: colorSponsorAccount,
          startingBalance: '0',
          source: userAccount
        }),

        Operation.setOptions({ // Set some options on the colorSponsorAccount
          masterWeight: 0, // Remove the master signer
          signer: {
            ed25519PublicKey: userAccount, // Add the userAccount as the primary signer
            weight: 1
          },
          source: colorSponsorAccount
        }),

        Operation.endSponsoringFutureReserves({ // Close sponsorship
          source: colorSponsorAccount
        }),

        Operation.manageData({
          name: 'colorsponsorindex', // Maybe colorroyaltyindex or just royaltyindex or maybe just cgindex
          value: colorSponsorIndex,
          source: userAccount
        })
      )
    }

    if (paletteAccount) {

      if ( paletteKeypair) { // Create new paletteAccount
        signers.push(paletteKeypair)

        ops.push(
          Operation.createAccount({ // Create a new paletteAccount
            destination: paletteAccount,
            startingBalance: '1',
            source: userAccount
          }),

          Operation.beginSponsoringFutureReserves({ // The userAccount will sponsor the colorSponsorAccount
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
        Operation.beginSponsoringFutureReserves({ // The userAccount will sponsor the colorSponsorAccount
          sponsoredId: paletteAccount,
          source: userAccount
        }),
      )
    }

    if (paletteCounts.length) {
      signers.push(Keypair.fromSecret(COLOR_SK))

      paletteCounts.forEach(([asset_code, count]) => {
        const COLOR = new Asset(asset_code, colorIssuer)

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
            source: colorIssuer
          }),
        )
      })

      ops.push(
        Operation.endSponsoringFutureReserves({ // Close sponsorship
          source: paletteAccount
        }),

        Operation.payment({ // Pay the feeAccount for all these fresh mints
          asset: XLM,
          amount: new BigNumber(palette.length).times(0.1).toFixed(7), // TODO numbers like this should be variable 
          destination: feeAccount,
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