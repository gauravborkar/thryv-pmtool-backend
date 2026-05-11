import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../app'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(typeof res.body.timestamp).toBe('string')
  })
})

describe('GET /', () => {
  it('returns the API welcome message', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Thryv PM Tool API')
  })
})
