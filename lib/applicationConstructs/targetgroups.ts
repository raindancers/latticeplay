import * as cdk from 'aws-cdk-lib';
import { 
  aws_vpclattice as vpclattice,
  aws_ec2 as ec2,
  aws_lambda as aws_lambda,
  aws_elasticloadbalancingv2 as elbv2
}

from 'aws-cdk-lib'

import * as lattice from './index'
import * as constructs from 'constructs'


export interface LatticeTargetGroupProps {
	name: string,
    type: lattice.TargetType,
	instancetargets?: ec2.Instance[],
	ipTargets?: string[],
	lambdaTargets?: aws_lambda.Function[],
	albTargets?: elbv2.ApplicationListener[]
	config?: lattice.TargetGroupConfig | undefined,
	
}

export class LatticeTargetGroup extends constructs.Construct {

  targetGroupId: string

  constructor(scope: constructs.Construct, id: string, props: LatticeTargetGroupProps) {
    super(scope, id);

	var targets: vpclattice.CfnTargetGroup.TargetProperty[] = []


	switch(props.type){
		case lattice.TargetType.LAMBDA:
			if (!(props.lambdaTargets )) {
				throw new Error("Must specific Lambda Targets if Type is LambdaTarget");
			}
			props.lambdaTargets.forEach((target) => {
				targets.push(
					{ id: target.functionArn }
				)
			})
			break;

		case lattice.TargetType.IP:
			if (!(props.ipTargets )) {
				throw new Error("Must specific IP Targets if Type is IPTarget");
			}
			props.ipTargets.forEach((target) => {
				targets.push(
					{ id: target }
				)
			})
			break;

		case lattice.TargetType.INSTANCE:
			if (!(props.instancetargets )) {
				throw new Error("Must specific Instance Targets if Type is InstanceTarget");
			}
			props.instancetargets.forEach((target) => {
				targets.push(
					{ id: target.instanceId }
				)
			})	
			break;
		
		case lattice.TargetType.ALB:
			if (!(props.albTargets )) {
				throw new Error("Must specific ALB Targets if Type is ALBTarget");
			}
			props.albTargets.forEach((target) => {
				targets.push(
					{ id: target.listenerArn }
				)
			})
			break;

		default:
			throw Error(`Invalid TargetType: ${props.type}`);
	
	}

	// check that there is a config if the target type is lambda
    if ( props.type === lattice.TargetType.LAMBDA && props.config ) {
		throw new Error('If TargetType is LAMBDA, no configuration is needed');
	} else {
		if ( !(props.config) && props.type !== lattice.TargetType.LAMBDA) {
			throw Error(`Configuration is required for TargetType: ${props.type}`);
		}
	}

    const TargetGroup = new vpclattice.CfnTargetGroup(this, 'TargetGroup', {
		type: props.type,
		//name: props.name,
		config: props.config?.targetGroupConfig,
		targets: targets
	})

	this.targetGroupId = TargetGroup.attrId
  }
}