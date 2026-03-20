import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as appsync from 'aws-cdk-lib/aws-appsync';
// import * as ssm from 'aws-cdk-lib/aws-ssm';       // re-enable with Pinpoint
// import * as pinpoint from 'aws-cdk-lib/aws-pinpoint'; // re-enable with Pinpoint
import { Construct } from 'constructs';

export class ShelterLinkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------------
    // Task 1.1 — DynamoDB single-table
    // -------------------------------------------------------------------------
    const table = new dynamodb.Table(this, 'ShelterLinkTable', {
      tableName: 'shelterlink-data',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      exportName: 'ShelterLinkTableName',
      description: 'DynamoDB single-table name',
    });

    new cdk.CfnOutput(this, 'TableStreamArn', {
      value: table.tableStreamArn!,
      exportName: 'ShelterLinkTableStreamArn',
      description: 'DynamoDB Streams ARN for real-time dashboard push',
    });

    // -------------------------------------------------------------------------
    // Task 1.2 — SNS topic, SQS queue, DLQ, and Lambda event source
    // -------------------------------------------------------------------------
    const inboundTopic = new sns.Topic(this, 'ShelterLinkInboundTopic', {
      topicName: 'shelterlink-inbound',
      displayName: 'ShelterLink Inbound SMS Events',
    });

    const dlq = new sqs.Queue(this, 'ShelterLinkDLQ', {
      queueName: 'shelterlink-processor-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const processorQueue = new sqs.Queue(this, 'ShelterLinkProcessorQueue', {
      queueName: 'shelterlink-processor',
      visibilityTimeout: cdk.Duration.seconds(30),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    inboundTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(processorQueue, {
        rawMessageDelivery: true,
      })
    );

    // -------------------------------------------------------------------------
    // Task 1.4 — Dedicated IAM execution role (least-privilege)
    // Built before the Lambda so we can attach it
    // -------------------------------------------------------------------------
    const lambdaRole = new iam.Role(this, 'UpdateProcessorRole', {
      roleName: 'shelterlink-update-processor-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    // DynamoDB — scoped to specific table ARN
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'DynamoDBTableAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:Query',
        ],
        resources: [table.tableArn, `${table.tableArn}/index/*`],
      })
    );

    // SQS — scoped to specific queue ARN
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SQSQueueAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
        ],
        resources: [processorQueue.queueArn],
      })
    );

    // -------------------------------------------------------------------------
    // Task 1.3 — AWS Pinpoint application and SMS channel
    // TODO: Re-enable once Pinpoint SMS sandbox access is approved for this account.
    // To re-enable:
    //   1. Go to AWS Console → Amazon Pinpoint → request SMS sandbox access
    //   2. Uncomment the block below and redeploy
    // -------------------------------------------------------------------------
    // const pinpointApp = new pinpoint.CfnApp(this, 'ShelterLinkPinpointApp', {
    //   name: 'shelterlink',
    // });
    // new pinpoint.CfnSMSChannel(this, 'ShelterLinkSMSChannel', {
    //   applicationId: pinpointApp.ref,
    //   enabled: true,
    // });
    // lambdaRole.addToPolicy(new iam.PolicyStatement({
    //   sid: 'PinpointSendMessages',
    //   effect: iam.Effect.ALLOW,
    //   actions: ['mobiletargeting:SendMessages'],
    //   resources: [
    //     `arn:aws:mobiletargeting:${this.region}:${this.account}:apps/${pinpointApp.ref}`,
    //     `arn:aws:mobiletargeting:${this.region}:${this.account}:apps/${pinpointApp.ref}/*`,
    //   ],
    // }));
    // const pinpointAppIdParam = new ssm.StringParameter(this, 'PinpointAppIdParam', {
    //   parameterName: '/shelterlink/pinpoint/app-id',
    //   stringValue: pinpointApp.ref,
    //   description: 'ShelterLink Pinpoint application ID',
    // });
    // const originationNumberParam = new ssm.StringParameter(this, 'OriginationNumberParam', {
    //   parameterName: '/shelterlink/pinpoint/origination-number',
    //   stringValue: 'PLACEHOLDER',
    //   description: 'ShelterLink Pinpoint origination phone number (E.164 format)',
    // });
    // lambdaRole.addToPolicy(new iam.PolicyStatement({
    //   sid: 'SSMParameterRead',
    //   effect: iam.Effect.ALLOW,
    //   actions: ['ssm:GetParameter'],
    //   resources: [pinpointAppIdParam.parameterArn, originationNumberParam.parameterArn],
    // }));

    // -------------------------------------------------------------------------
    // Task 1.2 (continued) — Placeholder Lambda + SQS event source
    // -------------------------------------------------------------------------
    const updateProcessor = new lambda.Function(this, 'UpdateProcessor', {
      functionName: 'shelterlink-update-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      // Placeholder asset — replaced by Phase 2 Lambda build output
      code: lambda.Code.fromInline(
        `exports.handler = async (event) => { console.log(JSON.stringify(event)); };`
      ),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        SHELTER_TABLE: table.tableName,
        PINPOINT_APP_ID: 'PENDING', // re-enable after Pinpoint subscription approved
        ORIGINATION_NUMBER: 'PENDING',
        LOG_LEVEL: 'INFO',
      },
    });

    updateProcessor.addEventSource(
      new lambdaEventSources.SqsEventSource(processorQueue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      })
    );

    // -------------------------------------------------------------------------
    // Outputs
    // -------------------------------------------------------------------------
    new cdk.CfnOutput(this, 'InboundTopicArn', {
      value: inboundTopic.topicArn,
      exportName: 'ShelterLinkInboundTopicArn',
    });

    new cdk.CfnOutput(this, 'ProcessorQueueUrl', {
      value: processorQueue.queueUrl,
      exportName: 'ShelterLinkProcessorQueueUrl',
    });

    new cdk.CfnOutput(this, 'DLQUrl', {
      value: dlq.queueUrl,
      exportName: 'ShelterLinkDLQUrl',
    });

    new cdk.CfnOutput(this, 'UpdateProcessorFunctionArn', {
      value: updateProcessor.functionArn,
      exportName: 'ShelterLinkUpdateProcessorArn',
    });

    // -------------------------------------------------------------------------
    // Task 12.1 — Lambda Function URL (public HTTP endpoint, replaces Pinpoint for demo)
    // -------------------------------------------------------------------------
    const updateProcessorUrl = updateProcessor.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['Content-Type'],
      },
    });

    new cdk.CfnOutput(this, 'UpdateProcessorFunctionUrl', {
      value: updateProcessorUrl.url,
      exportName: 'UpdateProcessorFunctionUrl',
      description: 'Lambda Function URL for direct HTTP POST ingestion (demo/hackathon)',
    });

    new cdk.CfnOutput(this, 'LambdaRoleArn', {
      value: lambdaRole.roleArn,
      exportName: 'ShelterLinkLambdaRoleArn',
    });
    // Note: PinpointAppId output is commented out until Pinpoint subscription is approved
    // new cdk.CfnOutput(this, 'PinpointAppId', { value: pinpointApp.ref, exportName: 'ShelterLinkPinpointAppId' });

    // -------------------------------------------------------------------------
    // Task 12.3 — Chat and Donations DynamoDB tables
    // -------------------------------------------------------------------------
    const chatTable = new dynamodb.Table(this, 'ShelterLinkChatTable', {
      tableName: 'shelterlink-chat',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const donationsTable = new dynamodb.Table(this, 'ShelterLinkDonationsTable', {
      tableName: 'shelterlink-donations',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI: query all donations for a given shelter
    donationsTable.addGlobalSecondaryIndex({
      indexName: 'shelterlink-donations-by-shelter',
      partitionKey: { name: 'shelterId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'pledgedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, 'ChatTableName', {
      value: chatTable.tableName,
      exportName: 'ShelterLinkChatTableName',
    });

    new cdk.CfnOutput(this, 'DonationsTableName', {
      value: donationsTable.tableName,
      exportName: 'ShelterLinkDonationsTableName',
    });

    // Grant Lambda role access to new tables
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ChatDonationsTableAccess',
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:Scan'],
      resources: [
        chatTable.tableArn, `${chatTable.tableArn}/index/*`,
        donationsTable.tableArn, `${donationsTable.tableArn}/index/*`,
      ],
    }));

    // -------------------------------------------------------------------------
    // Task 10.2 — Stream handler Lambda with structured logging
    // -------------------------------------------------------------------------
    const streamHandler = new lambda.Function(this, 'StreamHandler', {
      functionName: 'shelterlink-stream-handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'streamHandler.handler',
      code: lambda.Code.fromInline(
        `exports.handler = async (event) => { require('@aws-lambda-powertools/logger'); };`
      ),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        CONNECTIONS_TABLE: table.tableName,
        LOG_LEVEL: 'INFO',
      },
    });

    // Grant stream handler read access to DynamoDB streams
    table.grantStreamRead(streamHandler);

    // Wire DynamoDB stream to stream handler
    streamHandler.addEventSource(
      new lambdaEventSources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 2,
      })
    );

    // Update the Update_Processor env to include LOG_LEVEL explicitly
    updateProcessor.addEnvironment('LOG_LEVEL', 'INFO');

    // -------------------------------------------------------------------------
    // Task 12.4 — AppSync GraphQL API for Community Chat
    // -------------------------------------------------------------------------

    // IAM role for AppSync to read/write the chat table
    const appSyncRole = new iam.Role(this, 'AppSyncDynamoRole', {
      assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com'),
    });
    chatTable.grantReadWriteData(appSyncRole);

    const chatApi = new appsync.CfnGraphQLApi(this, 'ShelterLinkChatApi', {
      name: 'shelterlink-chat',
      authenticationType: 'API_KEY',
      xrayEnabled: false,
    });

    const chatApiKey = new appsync.CfnApiKey(this, 'ShelterLinkChatApiKey', {
      apiId: chatApi.attrApiId,
      description: 'ShelterLink Community Chat public API key',
      // Expires 1 year from a fixed epoch — rotate before production
      expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    });

    const chatSchema = new appsync.CfnGraphQLSchema(this, 'ShelterLinkChatSchema', {
      apiId: chatApi.attrApiId,
      definition: `
        type ChatMessage {
          roomId: String!
          timestamp: String!
          senderName: String!
          message: String!
          userType: String!
        }

        type Query {
          getMessages(roomId: String!, limit: Int): [ChatMessage]
        }

        type Mutation {
          sendMessage(roomId: String!, senderName: String!, message: String!, userType: String!): ChatMessage
        }

        type Subscription {
          onNewMessage(roomId: String!): ChatMessage
            @aws_subscribe(mutations: ["sendMessage"])
        }

        schema {
          query: Query
          mutation: Mutation
          subscription: Subscription
        }
      `,
    });

    const chatDataSource = new appsync.CfnDataSource(this, 'ChatTableDataSource', {
      apiId: chatApi.attrApiId,
      name: 'ChatTableDataSource',
      type: 'AMAZON_DYNAMODB',
      dynamoDbConfig: {
        tableName: chatTable.tableName,
        awsRegion: this.region,
      },
      serviceRoleArn: appSyncRole.roleArn,
    });

    // Resolver: sendMessage mutation → PutItem
    const sendMessageResolver = new appsync.CfnResolver(this, 'SendMessageResolver', {
      apiId: chatApi.attrApiId,
      typeName: 'Mutation',
      fieldName: 'sendMessage',
      dataSourceName: chatDataSource.name,
      requestMappingTemplate: `{
        "version": "2017-02-28",
        "operation": "PutItem",
        "key": {
          "PK": $util.dynamodb.toDynamoDBJson("ROOM#$ctx.args.roomId"),
          "SK": $util.dynamodb.toDynamoDBJson("MSG#$util.time.nowISO8601()")
        },
        "attributeValues": {
          "roomId": $util.dynamodb.toDynamoDBJson($ctx.args.roomId),
          "timestamp": $util.dynamodb.toDynamoDBJson($util.time.nowISO8601()),
          "senderName": $util.dynamodb.toDynamoDBJson($ctx.args.senderName),
          "message": $util.dynamodb.toDynamoDBJson($ctx.args.message),
          "userType": $util.dynamodb.toDynamoDBJson($ctx.args.userType),
          "ttl": $util.dynamodb.toDynamoDBJson($util.time.nowEpochSeconds() + 2592000)
        }
      }`,
      responseMappingTemplate: `$util.toJson($ctx.result)`,
    });
    sendMessageResolver.addDependency(chatDataSource);
    sendMessageResolver.addDependency(chatSchema);

    // Resolver: getMessages query → Query (sort descending, limit N)
    const getMessagesResolver = new appsync.CfnResolver(this, 'GetMessagesResolver', {
      apiId: chatApi.attrApiId,
      typeName: 'Query',
      fieldName: 'getMessages',
      dataSourceName: chatDataSource.name,
      requestMappingTemplate: `{
        "version": "2017-02-28",
        "operation": "Query",
        "query": {
          "expression": "PK = :pk",
          "expressionValues": {
            ":pk": $util.dynamodb.toDynamoDBJson("ROOM#$ctx.args.roomId")
          }
        },
        "scanIndexForward": false,
        "limit": $util.defaultIfNull($ctx.args.limit, 50)
      }`,
      responseMappingTemplate: `$util.toJson($ctx.result.items)`,
    });
    getMessagesResolver.addDependency(chatDataSource);
    getMessagesResolver.addDependency(chatSchema);

    new cdk.CfnOutput(this, 'ChatApiEndpoint', {
      value: chatApi.attrGraphQlUrl,
      exportName: 'ShelterLinkChatApiEndpoint',
      description: 'AppSync GraphQL endpoint for Community Chat',
    });

    new cdk.CfnOutput(this, 'ChatApiKey', {
      value: chatApiKey.attrApiKey,
      exportName: 'ShelterLinkChatApiKey',
      description: 'AppSync API key for Community Chat (public read/write)',
    });

    // -------------------------------------------------------------------------
    // Task 10.1 — CloudWatch Alarms
    // -------------------------------------------------------------------------

    // Alarm: Lambda error rate > 1% over 5 minutes
    const errorRateAlarm = new cloudwatch.Alarm(this, 'UpdateProcessorErrorRateAlarm', {
      alarmName: 'shelterlink-update-processor-error-rate',
      alarmDescription: 'Lambda Update_Processor error rate exceeded 1% over 5 minutes',
      metric: new cloudwatch.MathExpression({
        expression: 'errors / MAX([errors, invocations]) * 100',
        usingMetrics: {
          errors: updateProcessor.metricErrors({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
          }),
          invocations: updateProcessor.metricInvocations({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
          }),
        },
        period: cdk.Duration.minutes(5),
        label: 'Error Rate (%)',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm: DLQ has any messages visible (indicates processing failures)
    const dlqAlarm = new cloudwatch.Alarm(this, 'DLQMessagesVisibleAlarm', {
      alarmName: 'shelterlink-dlq-messages-visible',
      alarmDescription: 'Messages appeared in the ShelterLink DLQ — processing failures detected',
      metric: dlq.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(1),
        statistic: 'Maximum',
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm: DynamoDB throttled requests > 0
    const dynamoThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoDBThrottledRequestsAlarm', {
      alarmName: 'shelterlink-dynamodb-throttled-requests',
      alarmDescription: 'DynamoDB throttled requests detected on ShelterLink table',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ThrottledRequests',
        dimensionsMap: { TableName: table.tableName },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cdk.CfnOutput(this, 'ErrorRateAlarmArn', {
      value: errorRateAlarm.alarmArn,
      exportName: 'ShelterLinkErrorRateAlarmArn',
    });

    new cdk.CfnOutput(this, 'DLQAlarmArn', {
      value: dlqAlarm.alarmArn,
      exportName: 'ShelterLinkDLQAlarmArn',
    });

    new cdk.CfnOutput(this, 'DynamoThrottleAlarmArn', {
      value: dynamoThrottleAlarm.alarmArn,
      exportName: 'ShelterLinkDynamoThrottleAlarmArn',
    });
  }
}
