import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import {
  aws_s3 as s3,
  aws_ec2 as ec2,
  aws_lambda,
  aws_route53 as r53,
}
from 'aws-cdk-lib'
import * as constructs from 'constructs'
import * as lattice from '../applicationConstructs/index'
import * as network from 'raindancers-network'
import { TestHost } from './testhost';


export class LatticeDemoStack extends cdk.Stack {
  constructor(scope: constructs.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // subnets for the internal workloads
    const workloads = new network.SubnetGroup(this, "workloads", {
      name: "workloads",
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      cidrMask: 24,
    });

    // create a vpc
    const vpcOne = new network.EnterpriseVpc(this, "WorkloadEvpc", {
      evpc: {
        ipAddresses: ec2.IpAddresses.cidr('10.100.0.0/21'),
        maxAzs: 2,
        natGateways: 0,
        subnetConfiguration: [
          workloads.subnet
        ],
      },
    });

    // add ssm endpoints to the vpc, so we can get to the testserver
    vpcOne.addServiceEndpoints({
      services: [
        ec2.InterfaceVpcEndpointAwsService.EC2,
        ec2.InterfaceVpcEndpointAwsService.SSM,
        ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
      ],
      subnetGroup: workloads,
    })
    // y give some things some names
    const zone = new r53.PrivateHostedZone(this, 'TestZone',{
      zoneName: 'lattice.cloud',
      vpc: vpcOne.vpc,
    })

    // add a testhost
    new TestHost(this, "TestHost", {
      vpc: vpcOne.vpc,
      subnets: { subnetGroupName: "workloads" },
      r53zone: zone,
      hostname: `testhost-1`,
    });

    // this is the security group that is applied to the interface of the lattice service. 
    const sgVpcOne = new ec2.SecurityGroup(this, 'sgOne', {
      vpc: vpcOne.vpc
    })

    sgVpcOne.addIngressRule(
      ec2.Peer.ipv4(vpcOne.vpc.vpcCidrBlock),
      ec2.Port.tcp(80),
    )

    sgVpcOne.addIngressRule(
      ec2.Peer.ipv4(vpcOne.vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
    )



    // add a hello world lambda function;
    const functionOne = new aws_lambda.Function(this, 'FunctionOne', {
      runtime: aws_lambda.Runtime.PYTHON_3_10,
      handler: 'helloWorld.lambda_handler',
      code: aws_lambda.Code.fromAsset(path.join(__dirname, './lambda' )),
      timeout:  cdk.Duration.seconds(15),
    })


    // create a target group that targets the lambda function
    const targetGroupOne = new lattice.LatticeTargetGroup(this, 'TargetOne', {
      name: 'targetgroupOne',
      type: lattice.TargetType.LAMBDA,
      lambdaTargets: [
        functionOne
      ],
    })

    // create a lattice Service
    const serviceOne = new lattice.LatticeService(this, 'ServiceOne', {
      authType: lattice.LatticeAuthType.NONE,
      description: 'ServiceOne is a thing of wonder',
    })

    // attach a listner to the service 
    const listenerOne = serviceOne.addListener({
      name: 'serviceonelistner',
      defaultResponse : lattice.FixedResponse.NOT_FOUND,
      protocol: lattice.Protocol.HTTPS,
    })
    
    // add a rule to the listener
    listenerOne.addListenerRule({
      name: 'listentolambdaone',
      action: [{ target: targetGroupOne }],
      priority: 100,  
      pathMatch:  {
        pathMatchType: lattice.PathMatchType.EXACT,
        matchValue: '/serviceOne',
        caseSensitive: false,
      } 
    })
    
    // create a service network
    const serviceNetwork = new lattice.LatticeServiceNetwork(this, 'DemoLattice', {
      //name: 'mydemolatticenetwork',
      description: 'Demo Lattice Network'
    }) 

    // create a place for logs
    const loggingBucket = new s3.Bucket(this, 'loggingbucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })
    
    //log to S3
    serviceNetwork.logToS3(loggingBucket)
    
    //associate the vpcs to the lattice serviceNetwork
    serviceNetwork.associateVPC(vpcOne.vpc, [sgVpcOne]);
    
    // associate services to lattice serviceNetwork
    serviceNetwork.associateService(serviceOne);

    //share the servicenetwork to another account
    // serviceNetwork.share({
    //   name: 'demoshare',
    //   principals: ['123456789013']
    // });
    
 }
}
