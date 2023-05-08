import * as cdk from 'aws-cdk-lib';

import { 
  aws_vpclattice as vpc_lattice,
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



import * as lattice from './index'


export interface LatticeServiceProps {
	readonly authType?: lattice.LatticeAuthType | undefined,
	readonly dnsEntry?: lattice.DnsEntry | undefined,
	readonly customDomain?: string
	readonly tags?: cdk.Tag[] | undefined 
	readonly description?: string | undefined
	readonly name?: string | undefined
}

export class LatticeService extends constructs.Construct {

	serviceId: string
	certificate: certificatemanager.Certificate | undefined
	dnsEntry: lattice.DnsEntry | undefined
	customDomain: string | undefined
	

	public static fromLatticeServiceArn(scope: constructs.Construct, id: string, serviceArn: string): LatticeService {
		return new LatticeService(scope, id, { serviceId: serviceArn })
	}

	
	constructor(scope: constructs.Construct, id: string, props: LatticeServiceProps) {
		super(scope, id);

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

		let certificateArn: string | undefined = undefined
		if (this.certificate) {
			certificateArn = this.certificate.certificateArn
		}

		const service = new vpc_lattice.CfnService(this, 'LatticeService', /* all optional props */ {
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

	public addCertificate(certificate: certificatemanager.Certificate): void {
		this.certificate = certificate
	}

	public addDnsEntry(dnsEntry: lattice.DnsEntry): void {

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

