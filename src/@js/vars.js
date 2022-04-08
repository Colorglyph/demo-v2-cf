import BigNumber from 'bignumber.js'
import {
  Asset,
  Claimant,
} from 'stellar-base'

export const HORIZON_URL = 'https://horizon-testnet.stellar.org'
export const STELLAR_NETWORK = 'TESTNET'

export const glyphSponsor = STELLAR_NETWORK === 'PUBLIC'
  ? ''
  : 'GAPK2VEX2Z2QT4SRAHXKK55L2JYAZCW2XVLIZ2IUETSB5CFZ2AKUJ7UB'

export const paletteSponsor = STELLAR_NETWORK === 'PUBLIC'
  ? ''
  : 'GDIMVM7A77U6Q547H73LMPY2KO4N4QTELDH6O5KU7G4F2SCV4QGGMIZT'

export const feeAccount = STELLAR_NETWORK === 'PUBLIC'
  ? 'GCH7W7ZPMQCHVBOODIWZOSWEUJB3WON6YTHPIQDOUSKKBLS733DCGFEE'
  : 'GBISA2O4573KH6MW5TEUTF3E4MCIZLNHHUN6Y73XXAK4EV45OVKMH352'

export const glyphSigner = STELLAR_NETWORK === 'PUBLIC'
  ? 'GA5FTIF3YBCMBMF4UQTVW5RVO2TMYD77ZEBWICFKNMO45JVW3E3GLYPH'
  : 'GDQFNMIICEUSNJ42XVN2DPANMSUAGUVKLCQT5C3SV3YDCXMJFOTPCLPE'

export const colorIssuer = STELLAR_NETWORK === 'PUBLIC'
  ? 'GBQVRMV4I2AYX767KPEUXFE3FFB3XBNCQ6KG2Q5TTPRDCP5FP4ACOLOR'
  : 'GAILK6CVLXS27D3PAOFRQKACVWUZGUMA2WMLL7I3OS4FCZBCPZDVHGII'

export const smallest = '0.01'
export const wholeDivSmallest = new BigNumber(1).div(smallest).toFixed(7)
export const wholeMinusSmallest = new BigNumber(1).minus(smallest).toFixed(7)
export const XLM = Asset.native()

export const feeAccountClaimantPredicate = Claimant.predicateNot(
  Claimant.predicateBeforeRelativeTime(
    new BigNumber(60).times(60).times(24).times(336).toFixed(0, 3)
  )
)