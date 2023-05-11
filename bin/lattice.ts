import * as cdk from 'aws-cdk-lib';
import { LatticeDemoStack } from '../lib/stack/latticeDemo'

const app = new cdk.App();
new LatticeDemoStack(app, 'LatticeStack', {  
  env: { 
    account: app.node.tryGetContext('account'),
    region: app.node.tryGetContext('region'),
  }
});
