import { StatusError, text } from 'itty-router-extras'

import setup from '../contracts/setup'
import mine from '../contracts/mine'
import mint from '../contracts/mint'
import scrape from '../contracts/scrape'
import trade from '../contracts/trade'

export default async (request, env, ctx) => {
  const body = await request.json()

  let xdr

  switch(request.params.command) {
    case 'setup':
      xdr = await setup(body, env)
    break
    case 'mine':
      xdr = await mine(body, env)
    break
    case 'mint':
      xdr = await mint(body, env)
    break
    case 'scrape':
      xdr = await scrape(body, env)
    break
    case 'trade':
      xdr = await trade(body, env)
    break
    default:
      throw new StatusError(404, 'Not Found')
  }

  return text(xdr)
}