#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LatticeDemoStack } from '../lib/stack/latticeDemo'

const app = new cdk.App();
new LatticeDemoStack(app, 'LatticeStack', {  
  env: { account: '847997321372', region: 'ap-southeast-2'},
});