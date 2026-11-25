import express from 'express';
import request from 'supertest';

import docsRouter from '../docs';

const app = express();
app.use(docsRouter);

describe('OpenAPI documentation routes', () => {
  it('serves Swagger UI at /docs', async () => {
    const response = await request(app).get('/docs');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
    expect(response.text).toContain('Stellar-Save API Documentation');
  });

  it('serves the Redoc page at /redoc', async () => {
    const response = await request(app).get('/redoc');

    expect(response.status).toBe(200);
    expect(response.text).toContain("spec-url='/openapi.yaml'");
  });

  it('serves the YAML OpenAPI source at /openapi.yaml', async () => {
    const response = await request(app).get('/openapi.yaml');

    expect(response.status).toBe(200);
    expect(response.text).toContain('openapi: 3.0.3');
    expect(response.text).toContain('Stellar-Save Backend API');
  });

  it('serves the parsed OpenAPI document at /openapi.json', async () => {
    const response = await request(app).get('/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.0.3');
    expect(response.body.info.title).toBe('Stellar-Save Backend API');
  });
});
