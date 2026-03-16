import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ShelterLinkStack } from '../lib/shelter-link-stack';

describe('ShelterLinkStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new ShelterLinkStack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  describe('DynamoDB table', () => {
    it('creates table with correct partition and sort key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
        ],
      });
    });

    it('enables DynamoDB Streams with NEW_AND_OLD_IMAGES', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        StreamSpecification: { StreamViewType: 'NEW_AND_OLD_IMAGES' },
      });
    });

    it('sets TTL attribute', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
      });
    });
  });

  describe('SQS queues', () => {
    it('creates a DLQ', () => {
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'shelterlink-processor-dlq',
      });
    });

    it('wires DLQ to main processor queue with maxReceiveCount 3', () => {
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'shelterlink-processor',
        RedrivePolicy: {
          maxReceiveCount: 3,
        },
      });
    });
  });

  describe('SNS topic', () => {
    it('creates inbound SNS topic', () => {
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'shelterlink-inbound',
      });
    });
  });

  describe('Lambda function', () => {
    it('creates Update_Processor Lambda with correct runtime', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'shelterlink-update-processor',
        Runtime: 'nodejs20.x',
      });
    });
  });
});
