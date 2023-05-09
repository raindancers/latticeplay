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

    const functionOne = new aws_lambda.Function(this, 'FunctionOne', {})

    const targetGroupOne = new lattice.LatticeTargetGroup(this, 'TargetOne', {
      name: 'TargetGroupOne',
      type: lattice.TargetType.LAMBDA,
      lambdaTargets: [
        functionOne
      ],
    })

    const serviceOne = new lattice.LatticeService(this, 'ServiceOne', {
      authType: lattice.LatticeAuthType.NONE,
      description: 'ServiceOne is a thing of wonder',
      name: 'serviceOne'
    })

    const listenerOne = serviceOne.addListener({
      name: 'serviceOneListner',
      defaultResponse : lattice.FixedResponse.NOT_FOUND,
      protocol: lattice.Protocol.HTTPS,
    })
    
    listenerOne.addListenerRule({
      name: 'listentoLambdaOne',
      action: [{ target: targetGroupOne }],
      priority: 100,  
      pathMatch:  {
        pathMatchType: lattice.PathMatchType.EXACT,
        matchKey: '/serviceOne',
        caseSensitive: false,
      } 
    })
    

    const serviceNetwork = new lattice.LatticeServiceNetwork(this, 'DemoLattice', {
      name: 'mydemolatticenetwork',
      description: 'Demo Lattice Network'
    }) 

    // log to S3
    serviceNetwork.logToS3(s3.Bucket.fromBucketName(this, 'loggingbucket', 'logbucket'))
    
    //associate  vpcs to lattice serviceNetwork
    serviceNetwork.associateVPC(vpcOne, [sgVpcOne]);
    
    // associate services to lattice serviceNetwork
    serviceNetwork.associateService(serviceOne);

    //share the servicenetwork to another account
    serviceNetwork.share({
      name: 'demoShare',
      principals: ['123456789013']
    });
    
 }
}
