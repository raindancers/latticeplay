import * as cdk from 'aws-cdk-lib';
import { 
  aws_vpclattice as vpclattice,
  aws_ec2 as ec2,
} 
from 'aws-cdk-lib'

import * as lattice from './index'
import * as constructs from 'constructs'

export interface TargetGroupHealthCheck {
	enabled?: boolean | undefined,
	healthCheckInterval?: cdk.Duration | undefined
	healthCheckTimeout?: cdk.Duration | undefined
	healthyThresholdCount?: number | undefined
	matcher?: lattice.FixedResponse | undefined
	path?: string | undefined
	port?: number | undefined
	protocol?: lattice.Protocol | undefined
	protocolVersion?: lattice.ProtocolVersion | undefined
	unhealthyThresholdCount?: number | undefined
}

export interface TargetGroupConfigProps {
  port: number,
  protocol: lattice.Protocol,
  vpc: ec2.Vpc,
  ipAddressType?: lattice.IpAddressType | undefined
  protocolVersion?: lattice.ProtocolVersion | undefined
  healthCheck?: TargetGroupHealthCheck | undefined
} 

export class TargetGroupConfig extends constructs.Construct {

  targetGroupConfig: vpclattice.CfnTargetGroup.TargetGroupConfigProperty

  constructor(scope: constructs.Construct, id: string, props: TargetGroupConfigProps) {
    super(scope, id);

	// validate the ranges for the health check
	if (props.healthCheck?.healthCheckInterval) {
		if (props.healthCheck?.healthCheckInterval.toSeconds() < 5 || props.healthCheck?.healthCheckInterval.toSeconds() > 300) {
			throw new Error("HealthCheckInterval must be between 5 and 300 seconds")
		}
	}
	
	if (props.healthCheck?.healthCheckTimeout) {
		if (props.healthCheck?.healthCheckTimeout.toSeconds() < 1 || props.healthCheck?.healthCheckTimeout.toSeconds() > 120) {
			throw new Error("HealthCheckTimeout must be between 1 and 120seconds")
		}
	}
	
	if (props.healthCheck?.healthyThresholdCount) {
		if (props.healthCheck?.healthyThresholdCount < 2 || props.healthCheck?.healthyThresholdCount > 10) {
			throw new Error("HealthyThresholdCount must be between 1 and 10")
		}
	}
	// the enum returns a number, but we need a string, so convert	
	let matcher: vpclattice.CfnTargetGroup.MatcherProperty | undefined = undefined
	if (props.healthCheck?.matcher) {
		const codeAsString = props.healthCheck.matcher.toString()
		matcher = { httpCode: codeAsString } 
	}

	// default for https is 443, otherwise 80
	var port: number = 80
	if (!(props.healthCheck?.port) && props.healthCheck?.protocol) {
		if (props.healthCheck?.protocol === lattice.Protocol.HTTPS) {
			port = 443
		}
	}

	if (props.protocolVersion) {
		if (props.protocolVersion === lattice.ProtocolVersion.GRPC) {
			throw new Error("GRPC is not supported");	
		}
	}

	if (props.healthCheck?.unhealthyThresholdCount) {
		if (props.healthCheck?.unhealthyThresholdCount < 2 || props.healthCheck?.unhealthyThresholdCount > 10) {
			throw new Error("UnhealthyThresholdCount must be between 2 and 10")
		}
	}

	let targetHealthCheck: vpclattice.CfnTargetGroup.HealthCheckConfigProperty = {
		enabled: props.healthCheck?.enabled ?? true,
		healthCheckIntervalSeconds: props.healthCheck?.healthCheckInterval?.toSeconds() ?? 30,
		healthCheckTimeoutSeconds: props.healthCheck?.healthCheckTimeout?.toSeconds() ?? 5,
		matcher: matcher,
		path:  props.healthCheck?.path ?? '/',
		port: props.port ?? port,
		protocol: props.healthCheck?.protocol ?? 'HTTP',
		protocolVersion: props.healthCheck?.protocolVersion ?? 'HTTP1',
		unhealthyThresholdCount: props.healthCheck?.unhealthyThresholdCount ?? 2,
	}



	this.targetGroupConfig = {
		port: props.port,
		protocol: props.protocol,
		vpcIdentifier: props.vpc.vpcId,
		ipAddressType: props.ipAddressType ?? lattice.IpAddressType.IPV4,
		protocolVersion: props.protocolVersion ?? lattice.ProtocolVersion.HTTP1,
		healthCheck: targetHealthCheck
    }
  } 
}

