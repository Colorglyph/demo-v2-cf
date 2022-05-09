import { json, StatusError } from "itty-router-extras"

import account from '../proxy/account'
import glyph from '../proxy/glyph'
import glyphs from '../proxy/glyphs'
import claimableBalances from '../proxy/claimable-balances'
import offers from '../proxy/offers'
import palettes from '../proxy/palettes'
import userOffers from "../proxy/user-offers"
import userGlyphs from "../proxy/user-glyphs"

export default async (request, env, ctx) => {
  const cache = caches.default
  const cacheUrl = new URL(request.url)
  const cacheKey = new Request(cacheUrl.toString(), request)

  let response = await cache.match(cacheKey)

  if (response)
    return response

  const { params, query } = request

  let res
  let args = {
    query,
    env,
  }

  switch(params.route) {
    case 'account':
      res = await account(args)
    break
    case 'glyph':
      res = await glyph(args)
    break
    case 'glyphs':
      res = await glyphs(args)
    break
    case 'claimable-balances':
      res = await claimableBalances(args)
    break
    case 'offers':
      res = await offers(args)
    break
    case 'user-offers':
      res = await userOffers(args)
    break
    case 'user-glyphs':
      res = await userGlyphs(args)
    break
    case 'palettes':
      res = await palettes(args)
    break
    default:
      throw new StatusError(404, 'Not Found')
  }

  response = json(res, {
    headers: {
      'Cache-Control': `public, max-age=5`
    }
  })
  ctx.waitUntil(cache.put(cacheKey, response.clone()))

  return response
}