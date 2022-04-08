import BigNumber from 'bignumber.js'
import {
  Keypair,
} from 'stellar-base'
import shajs from 'sha.js'

import {
  colorIssuer,
  glyphSponsor,
  HORIZON_URL, 
} from "./vars"

export async function handleResponse(response) {
  if (response.ok)
    return response.headers.get('content-type')?.indexOf('json') > -1
    ? response.json() 
    : response.text()

  throw response
}

export async function getColorSponsorAccounts(baseAsset) {
  const baseAssetIssuerAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${baseAsset.issuer}`).then(handleResponse)
  const baseAssetPaletteAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${baseAssetIssuerAccountLoaded.sponsor}`).then(handleResponse)
  const colorSponsorAccounts = baseAssetPaletteAccountLoaded.balances
  .filter(({ asset_issuer }) => asset_issuer === colorIssuer)
  .map(({ asset_code, balance }) => {
    const colorSponsorIndex = asset_code.substring(6)
    const colorSponsorHash = shajs('sha256').update(glyphSponsor).update(colorSponsorIndex).digest()
    const colorSponsorKeypair = Keypair.fromRawEd25519Seed(colorSponsorHash)
    const colorSponsorAccount = colorSponsorKeypair.publicKey()

    return new Array(new BigNumber(balance).times(1e7).toNumber()).fill(colorSponsorAccount)
  })
  .flat()
  
  return [
    baseAssetIssuerAccountLoaded,
    colorSponsorAccounts
  ] 
}