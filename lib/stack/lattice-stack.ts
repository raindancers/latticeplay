import * as cdk from 'aws-cdk-lib';
import {
  aws_s3 as s3,
  aws_ec2 as ec2,
  aws_lambda,
}
from 'aws-cdk-lib'
import { Handler } from 'aws-cdk-lib/aws-lambda';
import * as constructs from 'constructs'
import * as lattice from '../applicationConstructs/lattice'




export class LatticeStack extends cdk.Stack {
  constructor(scope: constructs.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpcOne = new ec2.Vpc(this, 'vpcOne', {})
    const sgVpcOne = new ec2.SecurityGroup(this, 'sgOne', {
      vpc: vpcOne
    })

    const serviceOne = new lattice.LatticeService(this, 'ServiceOne', {
      authType: lattice.LatticeAuthType.NONE,
      description: 'ServiceOne is a thing of wonder',
      name: 'serviceOne'
    })

    const functionOne = new aws_lambda.Function(this, 'FunctionOne', {
      runtime: aws_lambda.Runtime.PYTHON_3_9,
      code: 
      handler: 
    })

    
    const targetGroupOne = new lattice.LatticeTargetGroup(this, 'TargetOne', {
      name: 'TargetGroupOne',
      type: lattice.TargetType.LAMBDA,
      targets: [{
        id: 
        port: 443
      }],
      config?: lattice.CfnTargetGroup.TargetGroupConfigProperty | undefined,
    })



    const listnerOne = serviceOne.addListener(
      'serviceOneListner',
      lattice.Protocol.HTTPS,
      {
        forward: {
          targetGroups: [
	          { 
              targetGroupIdentifier: targetGroupOne.targetGroupId ,
              weight: 100,
            }
          ]
        }
      }
    )

    

    
    const vpcTwo = new ec2.Vpc(this, 'vpcTwo', {})
    const sgVpcTwo = new ec2.SecurityGroup(this, 'sgTne', {
      vpc: vpcTwo
    })


    const serviceTwo = new lattice.LatticeService(this, 'ServiceTwo', {
      authType: lattice.LatticeAuthType.NONE,
      description: 'ServiceTwo is a thing of distress',
      name: 'serviceTwo'
    })
    
    const listnerTwo = serviceOne.addListener(
      'serviceTwoListner',
      lattice.Protocol.HTTPS,
      {
        forward: {
          targetGroups: [
            
          ]
        }
      }
    )
    
    


    const serviceNetwork = new lattice.LatticeServiceNetwork(this, 'DemoLattice', {
      name: 'mydemolatticenetwork',
      //authType: lattice.LatticeAuthType.NONE,
    }) 

    // log to S3
    serviceNetwork.logToS3(s3.Bucket.fromBucketName(this, 'loggingbucket', 'logbucket'))
    
    //associate  vpcs to lattice serviceNetwork
    serviceNetwork.associateVPC(vpcOne, [sgVpcOne]);
    serviceNetwork.associateVPC(vpcTwo, [sgVpcTwo]);
    
    // associate services to lattice serviceNetwork
    serviceNetwork.associateService(serviceOne);
    serviceNetwork.associateService(serviceTwo);
    

    // 

  }
}
