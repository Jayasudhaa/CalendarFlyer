import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

let db;
function app() {
  const server=express();
  server.use('/api/discover',require('./discover'));
  server.use('/api/radar',require('./radar'));
  return server;
}
beforeEach(()=>{db=mockClient(DynamoDBDocumentClient);});
afterEach(()=>db.restore());
describe('public discovery boundaries',()=>{
  it('nearby recommendations expose only upcoming Radar opt-in events',async()=>{
    db.on(ScanCommand).resolves({Items:[{org_id:'org-test',name:'Test org',latitude:37,longitude:-122,category:'temple'}]});
    db.on(QueryCommand).resolves({Items:[
      {event_id:'org-only',date:'2099-01-01',title:'Org only',discoverability:'org_only'},
      {event_id:'legacy',date:'2099-01-01',title:'Legacy'},
      {event_id:'past',date:'2000-01-01',title:'Past',discoverability:'radar'},
      {event_id:'radar',date:'2099-01-01',title:'Public event',discoverability:'radar'},
    ]});
    const response=await request(app()).get('/api/discover/nearby?lat=37&lng=-122');
    expect(response.status).toBe(200);
    expect(response.body.orgs).toHaveLength(1);
    expect(response.body.orgs[0].upcoming_events.map(e=>e.event_id)).toEqual(['radar']);
  });
  it.each(['lat=91&lng=0','lat=0&lng=181','lat=Infinity&lng=0','lat=0&lng=0&radius=-1','lat=0&lng=0&radius=abc'])(
    'rejects invalid nearby input %s before database access',async query=>{
      expect((await request(app()).get('/api/discover/nearby?'+query)).status).toBe(400);
      expect(db.calls()).toHaveLength(0);
    });
  it.each(['-1','1.5','abc'])('rejects invalid Radar limit %s',async limit=>{
    expect((await request(app()).get('/api/radar?limit='+limit)).status).toBe(400);
    expect(db.calls()).toHaveLength(0);
  });
});
