import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import {
  aws_s3 as s3,
  aws_ec2 as ec2,
  aws_lambda,
}
from 'aws-cdk-lib'
import * as constructs from 'constructs'
import * as lattice from '../applicationConstructs/index'


export class LatticeDemoStack extends cdk.Stack {
  constructor(scope: constructs.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpcOne = new ec2.Vpc(this, 'vpcOne', {})
    const sgVpcOne = new ec2.SecurityGroup(this, 'sgOne', {
      vpc: vpcOne
    })

    const functionOne = new aws_lambda.Function(this, 'FunctionOne', {
      runtime: aws_lambda.Runtime.PYTHON_3_10,
      handler: 'helloWorld.lambda_handler',
      code: aws_lambda.Code.fromAsset(path.join(__dirname, './lambda' )),
      timeout:  cdk.Duration.seconds(15),
    })

    const targetGroupOne = new lattice.LatticeTargetGroup(this, 'TargetOne', {
      name: 'targetgroupOne',
      type: lattice.TargetType.LAMBDA,
      lambdaTargets: [
        functionOne
      ],
    })

    const serviceOne = new lattice.LatticeService(this, 'ServiceOne', {
      authType: lattice.LatticeAuthType.NONE,
      description: 'ServiceOne is a thing of wonder',
      //name: 'serviceOne'
    })

    const listenerOne = serviceOne.addListener({
      name: 'serviceonelistner',
      defaultResponse : lattice.FixedResponse.NOT_FOUND,
      protocol: lattice.Protocol.HTTPS,
    })
    
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
    

    const serviceNetwork = new lattice.LatticeServiceNetwork(this, 'DemoLattice', {
      //name: 'mydemolatticenetwork',
      description: 'Demo Lattice Network'
    }) 

    const loggingBucket = new s3.Bucket(this, 'loggingbucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })
    

    //log to S3
    serviceNetwork.logToS3(loggingBucket)
    
    //associate  vpcs to lattice serviceNetwork
    serviceNetwork.associateVPC(vpcOne, [sgVpcOne]);
    
    // associate services to lattice serviceNetwork
    serviceNetwork.associateService(serviceOne);

    //share the servicenetwork to another account
    serviceNetwork.share({
      name: 'demoshare',
      principals: ['123456789013']
    });
    
 }
}
