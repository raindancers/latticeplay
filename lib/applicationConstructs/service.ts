import * as cdk from 'aws-cdk-lib';

import { 
  aws_vpclattice as vpclattice,
  aws_certificatemanager as certificatemanager,
} 
from 'aws-cdk-lib';
import * as constructs from 'constructs'

import * as lattice from './index'

export interface WeightedTargetGroup {
	readonly target: lattice.LatticeTargetGroup,
	readonly weight?: number | undefined
}

export interface AddListenerProps {
	name: string
	defaultResponse?: lattice.FixedResponse | WeightedTargetGroup[] | undefined
	protocol?: lattice.Protocol | undefined
	port?: number | undefined
}

export interface LatticeServiceProps {
	
	readonly authType?: lattice.LatticeAuthType | undefined,
	readonly dnsEntry?: vpclattice.CfnService.DnsEntryProperty | undefined,
	readonly certificate?: certificatemanager.Certificate | undefined
	readonly customDomain?: string
	readonly tags?: cdk.Tag[] | undefined 
	readonly description?: string | undefined
	readonly name?: string | undefined
}

export class LatticeService extends constructs.Construct {

	serviceId: string
		
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
		if (props.certificate) {
			certificateArn = props.certificate.certificateArn
		}

		const service = new vpclattice.CfnService(this, 'LatticeService', /* all optional props */ {
			authType: props.authType,
			certificateArn: certificateArn,
			customDomainName: props.customDomain,
			dnsEntry: props.dnsEntry,
			name: props.name,
			tags: serviceTags,
		});

		this.serviceId = service.attrArn

	}


	// TODO. It seems that the Forward has not yet got into cdk. 
	//public addListener(protocol: Protocol, defaultAction: Forward | FixedResponse,  name?: string, port?: number, ): void {

	public addListener(props: AddListenerProps): string {
		
		// check the the port is in range if it is specificed
		if (props.port) {
			if (props.port < 0 || props.port > 65535) {
				throw new Error("Port out of range")
			}
		
		}
		// default to using HTTPS
		let protocol = props.protocol ?? lattice.Protocol.HTTPS 
		
		// if its not specified, set it to the default port based on the protcol
		let port: number 
		switch(protocol) {
			case lattice.Protocol.HTTP:
				port = props.port ?? 80
				break;
			case lattice.Protocol.HTTPS:
				port = props.port ?? 443
				break;
			default:
				throw new Error("Protocol not supported")
		}

		// the default action is a not found
		let defaultAction: vpclattice.CfnListener.DefaultActionProperty = { 
				fixedResponse: {
					statusCode: lattice.FixedResponse.NOT_FOUND,
				}
		}
		// Fixed Responses are numbers from the Enum
		if (props.defaultResponse) {
			if (typeof(props.defaultResponse) === 'number')  { 
				defaultAction = { 
					fixedResponse: {
						statusCode: props.defaultResponse
					}
				}
			} else {

				let targetGroups: vpclattice.CfnListener.WeightedTargetGroupProperty[] = [];
				let requireWeight: boolean = false
				
				if (props.defaultResponse.length > 1) {
					requireWeight = true
				}
				
				props.defaultResponse.forEach((targetGroup) => {

					if (requireWeight && !targetGroup.weight) {
						throw new Error("Weights are required for multiple target groups")
					}
					targetGroups.push({
						targetGroupIdentifier: targetGroup.target.targetGroupId,
						weight: targetGroup.weight ?? 100
					})
				})

				defaultAction = { 
					forward: { 
						targetGroups: targetGroups,
					}
				}
				
			}
		}

		
		const listener = new lattice.LatticeListener(this, `Listener-${props.name}`, {
			defaultAction: defaultAction,
			protocol: protocol,
			port: port,
			serviceIdentifier: this.serviceId,
			name: props.name
		  });

		  return listener.listenerId

	}
	
}

