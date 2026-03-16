#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ShelterLinkStack } from '../lib/shelter-link-stack';

const app = new cdk.App();

new ShelterLinkStack(app, 'ShelterLinkStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'ShelterLink — real-time shelter capacity tracking infrastructure',
});
