/* eslint-env browser */

export class Cluster {
  /**
   * @param {URL|string} url Cluster HTTP API root URL.
   * @param {{ auth: string }} [options]
   */
  constructor (url, options) {
    /**
     * @private
     * @readonly
     */
    this.url = new URL(url)
    /**
     * @private
     * @readonly
     */
    this.options = options || {}
  }

  /**
   * @private
   * @returns {Record<string, string>}
   */
  authHeaders () {
    return this.options.auth ? { Authorization: `Basic ${this.options.auth}` } : {}
  }

  /**
   * @param {File|Blob} file
   * @param {import('./index').PinOptions} [options]
   * @returns {Promise<import('./index').AddResponse>}
   */
  async add (file, options) {
    if (!(file instanceof File) && !(file instanceof Blob)) {
      throw new Error('invalid file')
    }

    const body = new FormData()
    body.append('file', file, file.name)

    const url = new URL('/add', this.url)
    url.searchParams.set('cid-version', 1)
    setPinOptions(options, url.searchParams)

    const headers = this.authHeaders()
    const response = await fetch(url.toString(), { method: 'POST', headers, body })

    if (!response.ok) {
      throw Object.assign(new Error(`${response.status}: ${response.statusText}`), { response })
    }

    const data = await response.json()
    return { ...data, cid: data.cid['/'] }
  }

  /**
   * @param {Iterable<File|Blob>} files
   * @param {import('./index').PinOptions} [options]
   * @returns {Promise<import('./index').AddDirectoryResponse>}
   */
  async addDirectory (files, options) {
    const body = new FormData()

    for (const f of files) {
      if (!(f instanceof File) && !(f instanceof Blob)) {
        throw new Error('invalid file')
      }
      body.append('file', f, f.name)
    }

    const url = new URL('/add', this.url)
    url.searchParams.set('cid-version', 1)
    url.searchParams.set('wrap-with-directory', true)
    setPinOptions(options, url.searchParams)

    const headers = this.authHeaders()
    const response = await fetch(url.toString(), { method: 'POST', headers, body })

    if (!response.ok) {
      throw Object.assign(new Error(`${response.status}: ${response.statusText}`), { response })
    }

    const data = await response.text()
    return data.split(/\r?\n/)
      .filter(Boolean)
      .map(d => JSON.parse(d))
      .map(d => ({ ...d, cid: d.cid['/'] }))
  }

  /**
   * @param {string} cid CID or IPFS/IPNS path to pin to the cluster.
   * @param {import('./index').PinOptions} [options]
   * @returns {Promise<import('./index').PinResponse>}
   */
  async pin (cid, options) {
    const path = cid.startsWith('/') ? `/pins${cid}` : `/pins/${cid}`
    const url = new URL(path, this.url)
    setPinOptions(options, url.searchParams)

    const headers = this.authHeaders()
    const response = await fetch(url.toString(), { method: 'POST', headers })

    if (!response.ok) {
      throw Object.assign(new Error(`${response.status}: ${response.statusText}`), { response })
    }

    const data = await response.json()
    return {
      replicationFactorMin: data.replication_factor_min,
      replicationFactorMax: data.replication_factor_max,
      name: data.name,
      mode: data.mode,
      shardSize: data.shard_size,
      userAllocations: data.user_allocations,
      expireAt: new Date(data.expire_at),
      metadata: data.metadata,
      pinUpdate: data.pin_update,
      cid: data.cid['/'],
      type: data.type,
      allocations: data.allocations,
      maxDepth: data.max_depth,
      reference: data.reference
    }
  }

  /**
   * @param {string} cid CID or IPFS/IPNS path to unpin from the cluster.
   * @returns {Promise<import('./index').PinResponse>}
   */
  async unpin (cid) {
    const path = cid.startsWith('/') ? `/pins${cid}` : `/pins/${cid}`
    const url = new URL(path, this.url)
    const headers = this.authHeaders()
    const response = await fetch(url.toString(), { method: 'POST', headers })

    if (!response.ok) {
      throw Object.assign(new Error(`${response.status}: ${response.statusText}`), { response })
    }

    const data = await response.json()
    return {
      replicationFactorMin: data.replication_factor_min,
      replicationFactorMax: data.replication_factor_max,
      name: data.name,
      mode: data.mode,
      shardSize: data.shard_size,
      userAllocations: data.user_allocations,
      expireAt: new Date(data.expire_at),
      metadata: data.metadata,
      pinUpdate: data.pin_update,
      cid: data.cid['/'],
      type: data.type,
      allocations: data.allocations,
      maxDepth: data.max_depth,
      reference: data.reference
    }
  }

  /**
   * @param {string} cid The CID to get pin status information for.
   * @param {import('./index').StatusOptions} [options]
   * @returns {Promise<import('./index').StatusResponse>}
   */
  async status (cid, options) {
    const url = new URL(`/pins/${encodeURIComponent(cid)}`, this.url)

    options = options || {}
    if (options.local != null) {
      url.searchParams.set('local', options.local)
    }

    const headers = this.authHeaders()
    const response = await fetch(url.toString(), { headers })

    if (!response.ok) {
      throw Object.assign(new Error(`${response.status}: ${response.statusText}`), { response })
    }

    const data = await response.json()
    let peerMap = data.peer_map
    if (peerMap) {
      peerMap = Object.fromEntries(Object.entries(peerMap).map(([k, v]) => (
        [k, { peerName: v.peername, status: v.status, timestamp: new Date(v.timestamp), error: v.error }]
      )))
    }

    return { cid: data.cid['/'], name: data.name, peerMap }
  }
}

/**
 * @param {import('./index').PinOptions} options
 * @param {URLSearchParams} searchParams
 */
function setPinOptions (options, searchParams) {
  options = options || {}
  if (options.replicationFactorMin != null) {
    searchParams.set('replication_factor_min', options.replicationFactorMin)
  }
  if (options.replicationFactorMax != null) {
    searchParams.set('replication_factor_max', options.replicationFactorMax)
  }
  if (options.name != null) {
    searchParams.set('name', options.name)
  }
  if (options.mode != null) {
    searchParams.set('mode', options.mode)
  }
  if (options.shardSize != null) {
    searchParams.set('shard_size', options.shardSize)
  }
  if (options.userAllocations != null) {
    for (const a of options.userAllocations) {
      searchParams.append('user_allocations', a)
    }
  }
  if (options.expireAt != null) {
    searchParams.set('expire_at', options.expireAt.toISOString())
  }
  if (options.metadata != null) {
    for (const [k, v] of Object.entries(options.metadata)) {
      searchParams.set(`meta-${k}`, v)
    }
  }
  if (options.pinUpdate != null) {
    searchParams.set('pin_update', options.pinUpdate)
  }
}