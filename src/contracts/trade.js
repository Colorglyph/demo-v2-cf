import BigNumber from 'bignumber.js'
import {
  Networks,
  TransactionBuilder,
  Asset,
  Keypair,
  Account,
} from 'stellar-base'

import { handleResponse } from '../@js/utils'
import { XLM } from '../@js/vars'

import { buyItNowGlyphForGlyph, buyItNowGlyphForX } from './trade/buy-it-now'
import { buyGlyphForGlyph, buyGlyphForX } from './trade/create-buy-offer'
import { sellGlyphForGlyph, sellGlyphForX } from './trade/create-sell-offer'
import { sellItNowGlyphForGlyph, sellItNowGlyphForX } from './trade/sell-it-now'

export default async ({
  balanceId,
  userAccount,
  baseAssetIssuer,
  counterAsset,
  price,
  side,
}, env) => {
  const {
    STELLAR_NETWORK,
    HORIZON_URL,
    GLYPH_SIGNER_SK
  } = env
  const ops = []
  const signers = [Keypair.fromSecret(GLYPH_SIGNER_SK)]

  const bigPrice = new BigNumber(price)
  const baseAsset = baseAssetIssuer ? new Asset('COLORGLYPH', baseAssetIssuer) : null

  counterAsset = counterAsset 
  ? counterAsset === 'native'
    ? XLM
    : new Asset(counterAsset.code, counterAsset.issuer)
  : null

  if (side === 'buy') {
    const existingOffer = await fetch(`${HORIZON_URL}/offers?buying=${counterAsset.isNative() ? 'native' : `${counterAsset.code}:${counterAsset.issuer}`}&selling=${baseAsset.code}:${baseAsset.issuer}&limit=1&order=desc`)
    .then(handleResponse)
    .then(({_embedded: {records}}) => records[0])

    if (counterAsset?.code === 'COLORGLYPH') {

      if (existingOffer)
      await buyItNowGlyphForGlyph({
        userAccount,
        baseAsset,
        counterAsset,
        ops,
      }, env)

      else
      await buyGlyphForGlyph({
        userAccount,
        baseAsset,
        counterAsset,
        ops,
      }, env)
    }

    else {
      
      if (existingOffer)
      await buyItNowGlyphForX({
        userAccount,
        baseAsset,
        counterAsset,
        bigPrice,
        ops,
      }, env)

      else {
        signers.pop() // Currently sellGlyphForX is a utility function and doesn't actually require system signing, so remove it

        await buyGlyphForX({
          userAccount,
          baseAsset,
          counterAsset,
          bigPrice,
          ops,
        }, env)
      }
    }
    
  }

  else {
    if (counterAsset?.code === 'COLORGLYPH') {
      const existingOffer = await fetch(`${HORIZON_URL}/offers?buying=${baseAsset.code}:${baseAsset.issuer}&selling=${counterAsset.isNative() ? 'native' : `${counterAsset.code}:${counterAsset.issuer}`}&limit=1&order=desc`)
      .then(handleResponse)
      .then(({_embedded: {records}}) => records[0])

      if (existingOffer)
      await sellItNowGlyphForGlyph({
        userAccount,
        baseAsset,
        counterAsset,
        ops,
      }, env)

      else
      await sellGlyphForGlyph({
        userAccount,
        baseAsset,
        counterAsset,
        ops,
      }, env)
    }

    else {
      if (balanceId)
      await sellItNowGlyphForX({
        balanceId,
        userAccount,
        ops,
      }, env)

      else
      await sellGlyphForX({
        userAccount,
        baseAsset,
        counterAsset,
        bigPrice,
        ops,
      }, env)
    }
  }

  const userAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${userAccount}`).then(handleResponse) // Use the userAccount as the fee and sequence source

  let transaction = new TransactionBuilder(
    new Account(userAccountLoaded.id, userAccountLoaded.sequence), 
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
}