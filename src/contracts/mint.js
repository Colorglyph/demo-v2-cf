import BigNumber from 'bignumber.js'
import { countBy } from 'lodash'
import {
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
  Account
} from 'stellar-base'

import paletteToManageData from './mint/palette-to-manage-data'

import { handleResponse } from '../@js/utils'
import { XLM } from '../@js/vars'

// WARN
// We need to be _very_ sure the paletteAccount is safe to use
// No weird signers
// No weird assets
// Don't mint if already minted
// No open offers, colors must not be actively engaged in other markets  
// Claimable balance reduces balance so no issues there
// AMM either A) reduces balance or B) introduces additional trustlines so no issues there
// Open offers can be detected via buying|selling liabilities so no issues there
// If you try to mint with an open outstanding buy offer for the glyph you'll get a op line full error. You need to close the buy offer before minting
// No open buy offers before minting

// TODO
// Support or error when paletteAccount signer isn't master
// Particularly true in the case of initial mints. Might be nice to have userAccount as a signer on palette accounts but in the case of initial mint this could cause issues
// If using sponsored colors ensure trades will be possible (won't break the 100 atomic ops limit)

export default async ({
  userAccount,
  paletteAccount,
  name: ogName,
  description: ogDescription,
  palette: ogPalette
}, {
  STELLAR_NETWORK,
  HORIZON_URL,
  GLYPH_SIGNER_SK,
  COLOR_ISSUER_PK,
  FEE_PK, 
  GLYPH_SIGNER_PK, 
  GLYPH_SPONSOR_PK, 
  PALETTE_SPONSOR_PK,
}) => {
  ogPalette = ogPalette.map((hex) => hex
    .substring(0, 6) // colorSponsorIndex codes can have valid capital letters
    .toLowerCase()
    .replace(/\W/gi, '')
    + hex.substring(6)
  )

  const name = sanitizeName(ogName)
  const description = sanitizeDescription(ogDescription)
  const palette = sanitizePalette(ogPalette)

  const { manageData, hash } = await paletteToManageData({ name, description, palette })

  const issuerKeypair = Keypair.fromRawEd25519Seed(hash)
  const issuerAccount = issuerKeypair.publicKey()

  const issuerAccountExists = await fetch(`${HORIZON_URL}/accounts/${issuerAccount}`)
  .then(handleResponse)
  .then(() => true)
  .catch(() => false)

  const COLORGLYPH = new Asset('COLORGLYPH', issuerAccount)

  return fetch(`${HORIZON_URL}/accounts/${paletteAccount}`)
  .then(handleResponse)
  .then(async (account) => {
    if (account.sponsor)
      throw new Error(`Sponsored accounts cannot be used for minting. Revoke account sponsorship and try again`)

    const existingSigners = account.signers.filter(({ key, type }) => {
      if (type !== 'ed25519_public_key')
        throw new Error(`Signer type ${type} is not supported. Please remove and try again`)

      return key !== paletteAccount
    })

    if (existingSigners.length > 1)
      throw new Error(`Palette accounts must initialize with only one signer. Account ${paletteAccount} has ${account.signers.length}`)

    sanitizeBalances({
      balances: account.balances,
      palette: ogPalette,
      COLOR_ISSUER_PK
    })

    const ops = []

    ops.push(
      Operation.beginSponsoringFutureReserves({ // The PALETTE_SPONSOR_PK will sponsor the GLYPH_SIGNER_PK on the paletteAccount
        sponsoredId: paletteAccount,
        source: PALETTE_SPONSOR_PK
      }),

      Operation.setOptions({ // Set some options on the paletteAccount
        masterWeight: 0, // Remove the master signer
        signer: {
          ed25519PublicKey: GLYPH_SIGNER_PK, // Add the glyph address as the primary signer
          weight: 1
        },
        source: paletteAccount
      }),

      Operation.endSponsoringFutureReserves({ // Close sponsorship
        source: paletteAccount
      }),
    )

    if (issuerAccountExists) ops.push(
      Operation.beginSponsoringFutureReserves({ // The paletteAccount will sponsor the issuerAccount base reserve
        sponsoredId: issuerAccount,
        source: paletteAccount
      }),

      Operation.revokeAccountSponsorship({ // Sponsor the issuerAccount with the paletteAccount
        account: issuerAccount,
        source: issuerAccount
      }),

      Operation.endSponsoringFutureReserves({ // Close sponsorship
        source: issuerAccount
      }),
    )

    else ops.push(
      Operation.beginSponsoringFutureReserves({ // The paletteAccount will sponsor the issuerAccount base reserve
        sponsoredId: issuerAccount,
        source: paletteAccount
      }),

      Operation.createAccount({ // Create the new CG issuerAccount
        destination: issuerAccount,
        startingBalance: '1',
        source: paletteAccount
      }),

      Operation.endSponsoringFutureReserves({ // Close sponsorship
        source: issuerAccount
      }),
    )

    ops.push(
      Operation.beginSponsoringFutureReserves({ // The issuerAccount will sponsor the paletteAccount base reserve 
        sponsoredId: paletteAccount,
        source: issuerAccount
      }),

      Operation.revokeAccountSponsorship({
        account: paletteAccount,
        source: paletteAccount
      }),

      Operation.endSponsoringFutureReserves({ // Close sponsorship
        source: paletteAccount
      }),
    )

    if (existingSigners.length) existingSigners.forEach(({ key }) =>
      ops.push(
        Operation.setOptions({
          signer: {
            ed25519PublicKey: key, // Remove any non master signers
            weight: 0
          },
          source: paletteAccount
        })
      )
    )

    if (!issuerAccountExists) {
      ops.push(
        Operation.beginSponsoringFutureReserves({ // The GLYPH_SPONSOR_PK will sponsor the GLYPH_SIGNER_PK and the manage data attrs on the issuerAccount
          sponsoredId: issuerAccount,
          source: GLYPH_SPONSOR_PK
        }),

        Operation.setOptions({ // Set some options on the paletteAccount
          homeDomain: 'colorglyph.io',
          inflationDest: userAccount, // Mark the userAccount as the OG minter (could be used for royalties later) (might be better to use a sponsored signer)
          setFlags: 11, // Entirely lock down the NFT
          masterWeight: 0, // Remove the master signer
          signer: {
            ed25519PublicKey: GLYPH_SIGNER_PK, // Add the glyph address as the primary signer
            weight: 1
          },
          source: issuerAccount
        }),
      )

      manageData.forEach(([name, value]) => // Push the sep39 manage data attrs into the issuerAccount if they don't already exist
        ops.push(
          Operation.manageData({
            name,
            value,
            source: issuerAccount
          })
        )
      )

      ops.push(
        Operation.endSponsoringFutureReserves({ // Close sponsorship
          source: issuerAccount
        }),
      )
    }

    ops.push(
      Operation.changeTrust({ // Open a trustline for the NFT on the new account
        asset: COLORGLYPH,
        limit: '1',
        source: userAccount
      }),

      Operation.setTrustLineFlags({ // Open NFT authorization
        asset: COLORGLYPH,
        trustor: userAccount,
        flags: {
          authorized: true,
          authorizedToMaintainLiabilities: false
        },
        source: issuerAccount
      }),

      Operation.payment({ // Make a payment of 1 NFT from the paletteAccount to the userAccount
        asset: COLORGLYPH,
        amount: '1',
        destination: userAccount,
        source: issuerAccount
      }),

      Operation.setTrustLineFlags({ // Revoke NFT authorization
        asset: COLORGLYPH,
        trustor: userAccount,
        flags: {
          authorized: false,
          authorizedToMaintainLiabilities: true
        },
        source: issuerAccount
      }),

      Operation.payment({ // Make a payment of >= 5 XLM profit to the FEE_PK
        asset: XLM,
        amount: '5',
        destination: FEE_PK,
        source: paletteAccount
      }),
    )

    // Use the userAccount as the fee and sequence source
    const userAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${userAccount}`).then(handleResponse)

    let transaction = new TransactionBuilder(
      new Account(userAccountLoaded.id, userAccountLoaded.sequence), 
      {
        fee: new BigNumber(1).div('0.0000001').div(ops.length).toFixed(0, 3), // 1 XLM div # of ops
        networkPassphrase: Networks[STELLAR_NETWORK]
      }
    ).setTimeout(0)

    ops.forEach((op) => transaction.addOperation(op))

    transaction = transaction.build()

    transaction.sign(Keypair.fromSecret(GLYPH_SIGNER_SK))

    if (!issuerAccountExists)
      transaction.sign(issuerKeypair)

    return transaction.toXDR()
  })
}

// TODO
// sanitizeName and sanitizeDescription need to actually sanitize lmao
// probably no reason to restructure the palette, should just throw if it's not perfect
// no #, lowercase only, alpha numerics only, r,g,b numbers within 0-255 range, initial length is appropriate

function sanitizeName(name) {
  return name
}
function sanitizeDescription(description) {
  return description
}
function sanitizePalette(palette) {
  if (palette.length !== 256)
    throw new Error(`Palette only has ${palette.length} colors. Must have exactly 256`)

  return palette.map((hex) => {
    if (hex.length !== 12)
      throw new Error(`${hex} isn't a valid hex color code`)

    const [r, g, b] = hex.substring(0, 6).match(/.{1,2}/g)

    return [
      parseInt(r, 16),
      parseInt(g, 16),
      parseInt(b, 16),
    ]
  })
}
function sanitizeBalances({ balances, palette, COLOR_ISSUER_PK }) {
  const colorCounts = countBy(palette)

  balances.forEach(({ asset_type, asset_code, asset_issuer, buying_liabilities, selling_liabilities, balance }) => {
    if (asset_type === 'native')
      return

    if (asset_issuer !== COLOR_ISSUER_PK)
      throw new Error(`Asset ${asset_code}:${asset_issuer} is not a valid color asset. Please remove it from this account and try again`)

    if (
      !new BigNumber(buying_liabilities).isZero()
      || !new BigNumber(selling_liabilities).isZero()
    ) throw new Error(`Color ${asset_code} has outstanding liabilities. Adjust and try again`)

    if (!new BigNumber(colorCounts[asset_code]).div(1e7).isEqualTo(balance))
      throw new Error(`Palette and asset balance mismatch for color ${asset_code}`)
  })
}