import { json } from 'itty-router-extras'
import BigNumber from 'bignumber.js'
import { chunk, countBy, groupBy } from 'lodash'
import {
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
  Account,
} from 'stellar-base'

import { handleResponse } from "../@js/utils"

export default async (request, { 
  STELLAR_NETWORK,
  HORIZON_URL,
  COLOR_PK,
  COLOR_SK,
}, ctx) => {
  const body = await request.json()

  let {
    userAccount,
    colorSponsorIndex,
    movePalette,
    makePalette
  } = body

  makePalette = makePalette.map((hex) => hex
    .substring(0, 6) // colorSponsorIndex codes can have valid capital letters
    .toLowerCase()
    .replace(/\W/gi, '')
    + hex.substring(6)
  )

  const paletteKeypair = Keypair.random()
  const paletteAccount = paletteKeypair.publicKey()

  await fetch(`https://friendbot.stellar.org/?addr=${paletteAccount}`).then(handleResponse)

  const transactions = await fetch(`${HORIZON_URL}/accounts/${paletteAccount}`)
  .then(handleResponse)
  .then((account) => {
    const ops = []
    const moveHexGroups = Object.entries(groupBy(movePalette, ({ account, asset_code }) => `${asset_code}:${account}`))
    const makeHexCounts = Object.entries(countBy(makePalette))

    ops.push(
      Operation.beginSponsoringFutureReserves({ // The userAccount will sponsor the paletteAccount
        sponsoredId: paletteAccount,
        source: userAccount
      }),

      Operation.setOptions({
        masterWeight: 0,
        signer: {
          ed25519PublicKey: userAccount, // Add the userAccount as the primary signer
          weight: 1
        },
        source: paletteAccount
      }),

      Operation.endSponsoringFutureReserves({ // Close sponsorship
        source: paletteAccount
      }),
    )

    moveHexGroups.forEach(([, group]) => {
      const { account, asset_code } = group[0]
      const COLOR = new Asset(asset_code, COLOR_PK)
      const balance = new BigNumber(group.length).toFixed(0)

      ops.push(
        Operation.changeTrust({
          asset: COLOR,
          limit: new BigNumber(256).div(10000000).toFixed(7),
          source: paletteAccount
        }),
        Operation.payment({
          destination: paletteAccount,
          amount: new BigNumber(balance).div(10000000).toFixed(7),
          asset: COLOR,
          source: account
        }),
      )
    })

    makeHexCounts.forEach(([hex, count]) => {
      const COLOR = new Asset(`${hex}${colorSponsorIndex}`, COLOR_PK)
      const balance = new BigNumber(count).toFixed(0)

      ops.push(
        Operation.changeTrust({
          asset: COLOR,
          limit: new BigNumber(256).div(10000000).toFixed(7),
          source: paletteAccount
        }),
        Operation.payment({
          destination: paletteAccount,
          amount: new BigNumber(balance).div(10000000).toFixed(7),
          asset: COLOR,
          source: COLOR_PK
        }),
      )
    })

    return chunk(ops, 100).map((opsChunk, i) => {
      let transaction = new TransactionBuilder(
        new Account(account.id, account.sequence), 
        {
          fee: new BigNumber(1).div('0.0000001').div(opsChunk.length).toFixed(0, 3), // 1 XLM div # of ops
          networkPassphrase: Networks[STELLAR_NETWORK]
        }
      ).setTimeout(0)

      opsChunk.forEach((op) => transaction.addOperation(op))

      transaction = transaction.build()

      if (!i)
        transaction.sign(paletteKeypair)

      if (transaction.operations.findIndex(({ source }) => source === COLOR_PK) > -1)
        transaction.sign(Keypair.fromSecret(COLOR_SK))

      return {
        sequence: account.sequence,
        xdr: transaction.toXDR()
      }
    })
  })

  return json({
    account: paletteAccount,
    transactions
  })
}