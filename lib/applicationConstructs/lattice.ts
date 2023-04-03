import * as cdk from 'aws-cdk-lib';
import { 
  aws_vpclattice as lattice,
  aws_ec2 as ec2,
  aws_certificatemanager as certificatemanager,
  aws_route53 as route53,
  aws_s3 as s3,
  aws_logs as logs,
  aws_kinesis as kinesis
} 
from 'aws-cdk-lib';
import { AuthType } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as constructs from 'constructs'
import { config } from 'process';

export enum LatticeAuthType {
	NONE = 'NONE',
	IAM = 'AWS_IAM'
}

export enum Protocol {
	HTTP = 'HTTP',
	HTTPS = 'HTTPS',
}

export interface DnsEntry {
	name: string,
	r53zone: route53.HostedZone
}

export interface TargetGroup {
	targetGroupIdentifier: string
	weight?: number
}

export interface Forward {
	forward: {
		targetGroups: TargetGroup[] 
	}
}

export enum TargetType {
  LAMBDA = 'LAMBDA',
  IP = 'IP',
  INSTANCE = 'INSTANCE',
  ALB = 'ALB'
}

export interface TargetGroupTarget {
	id: string,
	port: number,
}

export interface LatticeTargetGroupProps {
	name: string,
    type: TargetType,
	targets: TargetGroupTarget[],
	config?: lattice.CfnTargetGroup.TargetGroupConfigProperty | undefined,
	
}

export class LatticeTargetGroup extends constructs.Construct {

  targetGroupId: string,

  constructor(scope: constructs.Construct, id: string, props: LatticeTargetGroupProps) {
    super(scope, id);

    if ( props.type === TargetType.LAMBDA && props.config ) {
		throw new Error('If TargetType is LAMBDA, no configuration is needed');
	} else {
		if (!( props.config)) {
			throw Error(`Configuration is required for TargetType: ${props.type}`);
		}
	}

    const TargetGroup = new lattice.CfnTargetGroup(this, 'TargetGroup', {
		name: props.name,
		type: props.type,
		config: props.config,
		targets: props.targets
	})

	this.targetGroupId = TargetGroup.attrId
  }
}



export interface LatticeServiceProps {
	authType?: LatticeAuthType | undefined,
	certificate?: certificatemanager.Certificate | undefined,
	dnsEntry?: DnsEntry | undefined,
	customDomain?: string
	tags?: cdk.Tag[] | undefined 
	description?: string | undefined
	name?: string | undefined
}

export class LatticeService extends constructs.Construct {

	serviceId: string
	
	constructor(scope: constructs.Construct, id: string, props: LatticeServiceProps) {
		super(scope, id);

		// If the certificate is provided as a prop, extract the Arn
		let certificateArn: string | undefined
		if (props.certificate) {
			certificateArn = props.certificate.certificateArn
		}

		// Create Tags
		let serviceTags: cdk.Tag[] = []
	
		if (props.tags) {
			serviceTags = props.tags
			if (props.description) {
				let descriptionRegEx: RegExp = /'^.{0,256}$'/;
				if (!(descriptionRegEx.test(props.description))){
					throw new Error("Service Network Descripton must be no longer than 256 characters");
				}
				serviceTags.push(new cdk.Tag('description', props.description))
			}
		}

		const service = new lattice.CfnService(this, 'LatticeService', /* all optional props */ {
			authType: props.authType,
			certificateArn: certificateArn,
			customDomainName: props.customDomain,
			dnsEntry: {
			  domainName: props.dnsEntry?.name,
			  hostedZoneId: props.dnsEntry?.r53zone.hostedZoneId 
			},
			name: props.name,
			tags: serviceTags,
		});

		this.serviceId = service.attrArn
	}

	// TODO. It seems that the Forward has not yet got into cdk. 
	//public addListener(protocol: Protocol, defaultAction: Forward | FixedResponse,  name?: string, port?: number, ): void {
	public addListener(name: string, protocol: Protocol, defaultAction: Forward,   port?: number, ): string {
		
		const listener = new lattice.CfnListener(this, `Listener-${name}`, {
			defaultAction: defaultAction,
			protocol: protocol,
			name: name,
			port: port,
			serviceIdentifier: this.serviceId,
		  });

		  return listener.attrId

	}
	
}

export interface LatticeServiceNetworkProps {
	/**
	 * Json Policy Document. If this not supplied, the Auth Model will be NONE
	 */
	authPolicy?: string
	/**
	 * Service name
	 */
	name: string;
	/**
	 * Tags for the Service Network
	 */
	tags?: cdk.Tag[] | undefined;
	/**
	 * Description of the Service Network
	 */
	description?: string;
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

	constructor(scope: constructs.Construct, id: string, props: LatticeServiceNetworkProps) {
    super(scope, id);

	// check name

	let nameRegEx: RegExp = /'^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'/;
	if (!(nameRegEx.test(props.name))) {
		throw new Error("The name of the service network,must be  3-63 characters. The valid characters are a-z, 0-9, and hyphens (-)")
	}
	
	// description is a tag? need to create one maually and see what it does.
	let latticeNetworkTags: cdk.Tag[] = []
	
	if (props.tags) {
		latticeNetworkTags = props.tags
		if (props.description) {
			let descriptionRegEx: RegExp = /'^.{0,256}$'/;
			if (!(descriptionRegEx.test(props.description))){
				throw new Error("Service Network Descripton must be no longer than 256 characters");
			}
			latticeNetworkTags.push(new cdk.Tag('description', props.description))
		}
	}
	let authType: AuthType = AuthType.NO_AUTH
	if (props.authPolicy) {
		authType = AuthType.RESOURCE_POLICY
	} 


    const serviceNetwork = new lattice.CfnServiceNetwork(this, 'LatticeServiceNetwork', {
      authType: authType,
      name: 'name',
      tags: latticeNetworkTags
    });

	new lattice.CfnAuthPolicy(this, 'AuthPolicy', {
		policy: props.authPolicy,
		resourceIdentifier: serviceNetwork.attrArn,
	})

	this.serviceNetworkId = serviceNetwork.attrArn

  }

  public associateService(service: LatticeService, dnsEntry?: DnsEntry, tags?: cdk.Tag[]): void {

	const cfntags: cdk.CfnTag[] = []

	if(tags) {
		tags.forEach((tag) => {
			
			cfntags.push({
				key: tag.key,
				value: tag.value	
			})
		})
	}

	new lattice.CfnServiceNetworkServiceAssociation(this, 'LatticeServiceAssociation', /* all optional props */ {
		dnsEntry: {
		  domainName: dnsEntry.name,
		  hostedZoneId: dnsEntry.r53zone.hostedZoneId,
		},
		serviceIdentifier: service.serviceId,
		serviceNetworkIdentifier: this.serviceNetworkId,
		tags: cfntags
	  });

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

	const cfnServiceNetworkVpcAssociation = new lattice.CfnServiceNetworkVpcAssociation(this, 'VpcAssociation', /* all optional props */ {
		securityGroupIds: securityGroupIds,
		serviceNetworkIdentifier: this.serviceNetworkId,
		tags: cfntags,
		vpcIdentifier: vpc.vpcId
	  });
  }
  
  public logToS3(bucket: s3.IBucket | s3.Bucket, suffix?: string): void {

	// TODO. COnsider to parsing the suffix

	const cfnAccessLogSubscription = new lattice.CfnAccessLogSubscription(this, 'LatticeLoggingtoS3', {
	  destinationArn: `${bucket.bucketArn}${suffix}`,
	  resourceIdentifier: this.serviceNetworkId,
		
	});
  }

  public sendToCloudWatch(log: logs.LogGroup): void {
	const cfnAccessLogSubscription = new lattice.CfnAccessLogSubscription(this, 'LattiCloudwatch', {
		destinationArn: log.logGroupArn,
		resourceIdentifier: this.serviceNetworkId, 
	});
  }

  public streamToKinesis(stream: kinesis.Stream): void {
	const cfnAccessLogSubscription = new lattice.CfnAccessLogSubscription(this, 'LatticeKinesis', {
		destinationArn: stream.streamArn,
		resourceIdentifier: this.serviceNetworkId, 
	});
	
  }
}