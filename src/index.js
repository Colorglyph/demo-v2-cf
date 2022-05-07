import { Router } from 'itty-router'
import {
  error,
  StatusError,
} from 'itty-router-extras'

import apiContracts from './api/contracts'
import apiPreparePaletteAccount from './api/prepare-palette-account'
import apiProxy from './api/proxy'

const router = Router()

router.post('/contracts/:command', apiContracts)
router.post('/utils/prepare-palette-account', apiPreparePaletteAccount)
router.get('/proxy/:route', apiProxy)
router.all('*', () => { throw new StatusError(404, 'Not Found') })

export default { 
  fetch: (...args) => router
  .handle(...args)
  .then(res => {
    res.headers.append('Access-Control-Allow-Origin', '*') // cors ftw
    return res 
  })
  .catch((err) => {
    err = error(err.status, err?.message || err)
    err.headers.append('Access-Control-Allow-Origin', '*') // cors ftw
    return err
  })
}