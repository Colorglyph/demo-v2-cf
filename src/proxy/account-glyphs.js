import BigNumber from "bignumber.js"
import Bluebird from 'bluebird'

import getAccount from './account'
import getOffers from './offers'
import getClaimableBalances from './claimable-balances'

import sep39 from "../api/sep39"

export default ({ query, env }) => {
  const { STELLAR_NETWORK } = env

  return getAccount({query, env})
  .then((record) =>
    record.balances.filter(({asset_code, balance}) => 
      asset_code === 'COLORGLYPH'
      && new BigNumber(balance).isGreaterThan(0)
    )
  )
  .then((glyphs) => new Bluebird.map(glyphs, async (glyph) => {
    const [
      buyOffers,
      buyClaimableBalances,
      sell
    ] = await Promise.all([
      getOffers({query: {buying: glyph.asset_issuer}, env}),
      getClaimableBalances({query: {claimant: glyph.asset_issuer}, env}),
      getOffers({query: {selling: glyph.asset_issuer}, env}),

      sep39({
        url: new URL(`file:////${glyph.asset_issuer}`),
        search: {
          name: 'json',
          network: STELLAR_NETWORK.toLowerCase()
        }
      })
      .then((res) => res.json())
      .then((res) => res.forEach(({key, value}) => glyph[key] = value))
    ])

    glyph.offers = {
      buy: [
        ...buyOffers,
        ...buyClaimableBalances
      ],
      sell
    }
    
    return glyph
  }, {concurrency: 10}))
}