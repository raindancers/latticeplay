import * as cdk from 'aws-cdk-lib';

import { 
  aws_vpclattice as vpclattice,
  aws_ec2 as ec2,
  aws_certificatemanager as certificatemanager,
  aws_route53 as route53,
  aws_s3 as s3,
  aws_logs as logs,
  aws_kinesis as kinesis,
  aws_ram as ram,
} 
from 'aws-cdk-lib';
import { principalIsOwnedResource } from 'aws-cdk-lib/aws-iam';
import * as constructs from 'constructs'


import * as lattice from './index'


export interface LatticeServiceNetworkProps {
	/**
	 * Service name
	 */
	readonly name?: string | undefined;
	/**
	 * Tags for the Service Network
	 */
	readonly tags?: cdk.Tag[] | undefined;
	/**
	 * Description of the Service Network
	 */
	readonly description?: string;
}


/**
 * AWS Lattice Service Network. 
 *
 */
export class LatticeServiceNetwork extends constructs.Construct {
  
	/**
	 * Service Network Id
	 */
	serviceNetworkId: string
	serviceNetworkArn: string

	authType: lattice.LatticeAuthType |  undefined

	constructor(scope: constructs.Construct, id: string, props: LatticeServiceNetworkProps) {
      super(scope, id);

	// check props.name to match 3-63 characters. The valid characters are a-z, 0-9, and hyphens (-)

	
	// description is implemented as a tag
	let latticeNetworkTags: cdk.Tag[] = []
	
	if (props.tags) {
		latticeNetworkTags = props.tags
		if (props.description) {
			let descriptionRegEx: RegExp = /'^.{0,256}$'/;
			if (!(descriptionRegEx.test(props.description))){
				throw new Error("Service Network Description must be no longer than 256 characters");
			}
			latticeNetworkTags.push(new cdk.Tag('description', props.description))
		}
	}


	// create the service network
    const serviceNetwork = new vpclattice.CfnServiceNetwork(this, 'LatticeServiceNetwork', {
      authType: this.authType ?? lattice.LatticeAuthType.NONE,
      name: props.name,
      tags: latticeNetworkTags
    });


	this.serviceNetworkId = serviceNetwork.attrId
	this.serviceNetworkArn = serviceNetwork.attrArn

  }

  public addAuthPolicy(policy: lattice.LatticePolicy): void {
	
	this.authType = lattice.LatticeAuthType.IAM;
	
	new vpclattice.CfnAuthPolicy(this, 'AuthPolicy', {
		policy: policy.policy,
		resourceIdentifier: this.serviceNetworkId,
	})
  }


  public associateVPC(vpc: ec2.Vpc, securityGroups: ec2.SecurityGroup[], tags?: cdk.Tag[]): void {

	const securityGroupIds: string[] = [] 
	securityGroups.forEach((securityGroup) => {
		securityGroupIds.push(securityGroup.securityGroupId)
	})

	const cfntags: cdk.CfnTag[] = []

	if(tags) {
		tags.forEach((tag) => {
			
			cfntags.push({
				key: tag.key,
				value: tag.value	
			})
		})
	}

	const cfnServiceNetworkVpcAssociation = new vpclattice.CfnServiceNetworkVpcAssociation(this, 'VpcAssociation', /* all optional props */ {
		securityGroupIds: securityGroupIds,
		serviceNetworkIdentifier: this.serviceNetworkId,
		tags: cfntags,
		vpcIdentifier: vpc.vpcId
	  });
  }
  
  public logToS3(bucket: s3.IBucket | s3.Bucket, suffix?: string): void {

	// TODO. COnsider to parsing the suffix

	const cfnAccessLogSubscription = new vpclattice.CfnAccessLogSubscription(this, 'LatticeLoggingtoS3', {
	  destinationArn: `${bucket.bucketArn}${suffix}`,
	  resourceIdentifier: this.serviceNetworkId,
		
	});
  }

  public sendToCloudWatch(log: logs.LogGroup): void {
	const cfnAccessLogSubscription = new vpclattice.CfnAccessLogSubscription(this, 'LattiCloudwatch', {
		destinationArn: log.logGroupArn,
		resourceIdentifier: this.serviceNetworkId, 
	});
  }

  public streamToKinesis(stream: kinesis.Stream): void {
	const cfnAccessLogSubscription = new vpclattice.CfnAccessLogSubscription(this, 'LatticeKinesis', {
		destinationArn: stream.streamArn,
		resourceIdentifier: this.serviceNetworkId, 
	});
	
  }

  public associateService(service: lattice.LatticeService, dnsEntry?: vpclattice.CfnServiceNetworkServiceAssociation.DnsEntryProperty, tags?: cdk.Tag[]): void {

	const cfntags: cdk.CfnTag[] = []

	if(tags) {
		tags.forEach((tag) => {
			
			cfntags.push({
				key: tag.key,
				value: tag.value	
			})
		})
	}

	new vpclattice.CfnServiceNetworkServiceAssociation(this, 'LatticeServiceAssociation', /* all optional props */ {
		dnsEntry: dnsEntry,
		serviceIdentifier: service.serviceId,
		serviceNetworkIdentifier: this.serviceNetworkId,
		tags: cfntags
	  });

  }

  public share(props: ShareServiceNetworkProps): void {

	new ram.CfnResourceShare(this, 'ServiceNetworkShare', {
		name: props.name,
		resourceArns: [this.serviceNetworkArn],
		allowExternalPrincipals: props.allowExternalPrincipals,
		principals: props.principals
	})
  }
}

// An AWS account ID
// An Amazon Resource Name (ARN) of an organization in AWS Organizations
// An ARN of an organizational unit (OU) in AWS Organizations

export interface ShareServiceNetworkProps {
	name: string;
	allowExternalPrincipals?: boolean | undefined
	principals?: string[] | undefined
}
