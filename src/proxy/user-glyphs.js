import BigNumber from "bignumber.js"
import Bluebird from 'bluebird'

import getAccount from './account'
import getOffers from './offers'
import getClaimableBalances from './claimable-balances'

export default ({ query, env }) => {
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
      getOffers({query: {seller: query.id, selling: glyph.asset_issuer}, env}),
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